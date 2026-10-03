// 人間GMの進行：描写を書く・選択肢カードをその場で作って配る・配った選択肢を取り下げる
// （docs/cartagraph/play-and-field.md「選択肢カードとGMの生成」「次のシーンへ進む」）。
// 画面（GM の進行のフォーム）とサーバー（MSW の描写 API）の両方がここを使う。
// deck は呼び出し側が sessionDeck（外したシーンを除いたデッキ）を通して渡す。

import type { CardDef } from '../card/model';
import type { DeckNode, DeckNodeKind } from '../scenario/model';
import type { Session } from './model';
import { findDeckNode } from './transition';

/** GM がその場で作って配る選択肢カードの入力。nextNodeId が空文字なら移り先なし */
export interface DealtChoice {
  name: string;
  description?: string;
  nextNodeId?: string;
}

export interface NarrationInput {
  /** 卓上の描写。空白だけなら今の描写を残す */
  flavor: string;
  /** 手札から取り下げる選択肢カードの ID */
  withdrawCardIds: string[];
  choices: DealtChoice[];
}

export interface NarrationTarget {
  id: string;
  /** 入れ子のノードは祖先の名前を添える（「〈親〉 › 〈子〉」） */
  label: string;
}

export type NarrationCheck = { ok: false; error: string } | { ok: true };

/** 「次のシーンへ進む」の移り先になる種類（導入→シーン→結末のノード間の操作） */
const TARGET_KINDS: ReadonlySet<DeckNodeKind> = new Set(['intro', 'scene', 'ending']);

/**
 * 選択肢カードの移り先にできるノード。デッキの順に並べる。
 * 自動戦闘のノード（人間GMのセッションでは進めない。planTransition と同じ理由）と、
 * いま居るノード（基本操作8は「別のノードへ移る」）は除く
 */
export function narrationTargets(
  deck: DeckNode[],
  currentNodeId: string | undefined,
): NarrationTarget[] {
  const walk = (nodes: DeckNode[], ancestors: string[]): NarrationTarget[] =>
    nodes.flatMap((n) => {
      const names = [...ancestors, n.name];
      const self =
        TARGET_KINDS.has(n.kind) && !n.autoCombat && n.id !== currentNodeId
          ? [{ id: n.id, label: names.join(' › ') }]
          : [];
      return [...self, ...walk(n.children ?? [], names)];
    });
  return walk(deck, []);
}

/** 描写も取り下げも配るも無い（送っても何も変わらない）入力か。画面は、この間はエラーを出さずにボタンを押せなくする */
export const isEmptyNarration = (input: NarrationInput) =>
  !input.flavor.trim() && input.withdrawCardIds.length === 0 && input.choices.length === 0;

/** 送れるかを判定する。エラーは上から順に最初の1つを返す */
export function checkNarration(
  session: Pick<Session, 'status' | 'hand' | 'currentScene'>,
  deck: DeckNode[],
  input: NarrationInput,
): NarrationCheck {
  const { withdrawCardIds, choices } = input;
  if (session.status !== 'playing')
    return { ok: false, error: '進行中のセッションでだけ、描写・選択肢を配れます' };
  if (isEmptyNarration(input))
    return { ok: false, error: '描写を書くか、選択肢を配るか取り下げてください' };
  if (new Set(withdrawCardIds).size !== withdrawCardIds.length)
    return { ok: false, error: '同じ選択肢を2回取り下げようとしています' };
  const handChoices = new Set(session.hand.filter((c) => c.kind === 'choice').map((c) => c.id));
  if (withdrawCardIds.some((id) => !handChoices.has(id)))
    return { ok: false, error: '取り下げる選択肢が手札にありません' };
  if (choices.some((c) => !c.name.trim()))
    return { ok: false, error: '配る選択肢の名前を入力してください' };
  const targets = new Set(narrationTargets(deck, session.currentScene.nodeId).map((t) => t.id));
  const badTarget = choices.find((c) => c.nextNodeId && !targets.has(c.nextNodeId));
  if (badTarget?.nextNodeId) {
    const name = findDeckNode(deck, badTarget.nextNodeId)?.node.name ?? badTarget.nextNodeId;
    return { ok: false, error: `「${name}」へは、選択肢で進めません` };
  }
  return { ok: true };
}

/** 配る選択肢カード。提案の採用で作るカードと同じく「GM生成」のタグを付ける。ID は呼び出し側が振る */
export function buildDealtCard(choice: DealtChoice, id: string): CardDef {
  const description = choice.description?.trim();
  return {
    id,
    kind: 'choice',
    name: choice.name.trim(),
    ...(description && { description }),
    ...(choice.nextNodeId && { nextNodeId: choice.nextNodeId }),
    tags: ['GM生成'],
  };
}

/** 取り下げたカードを除き、配ったカードを残った選択肢カードの後ろ（PC のカードの前）に入れる */
export function narrateHand(
  hand: CardDef[],
  withdrawCardIds: readonly string[],
  dealt: CardDef[],
): CardDef[] {
  const withdrawn = new Set(withdrawCardIds);
  const kept = hand.filter((c) => !withdrawn.has(c.id));
  const at = kept.map((c) => c.kind).lastIndexOf('choice') + 1;
  return [...kept.slice(0, at), ...dealt, ...kept.slice(at)];
}

/** いま居るノードが結末か */
export function isAtEnding(deck: DeckNode[], nodeId: string | undefined): boolean {
  return !!nodeId && findDeckNode(deck, nodeId)?.node.kind === 'ending';
}
