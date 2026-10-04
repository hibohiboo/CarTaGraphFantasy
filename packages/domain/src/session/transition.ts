// 基本操作8「次のシーンへ進む」（docs/cartagraph/play-and-field.md）の遷移計算。
// セッションを書き換えず、遷移後の状態だけを返す（Functional Core）。適用は呼び出し側（MSW ハンドラ等）が行う。

import type { AutoCombatEnemy } from '../autoCombat/model';
import { meetsCondition } from '../card/condition';
import type { CardDef } from '../card/model';
import type { DeckNode, Scenario } from '../scenario/model';
import type { Session } from './model';

/** シナリオデッキを入れ子まで探す。path は最上位の祖先から見つかったノードまで */
export function findDeckNode(
  deck: DeckNode[],
  id: string,
): { node: DeckNode; topIndex: number; path: DeckNode[] } | null {
  const search = (nodes: DeckNode[], ancestors: DeckNode[]): DeckNode[] | null => {
    for (const n of nodes) {
      const path = [...ancestors, n];
      if (n.id === id) return path;
      const found = n.children && search(n.children, path);
      if (found) return found;
    }
    return null;
  };
  const path = search(deck, []);
  if (!path) return null;
  return { node: path[path.length - 1], topIndex: deck.indexOf(path[0]), path };
}

/**
 * ノードに入ったときに手札へ配る選択肢カード。GM不在のセッションでは、配る条件
 * （docs/cartagraph/solo-village.md、仮ルール）を満たすものだけにする。held は判定に使うカード（heldCards）
 */
export function dealChoices(
  node: Pick<DeckNode, 'cards'>,
  held: CardDef[],
  session: Pick<Session, 'gmless'>,
): CardDef[] {
  const choices = node.cards.filter((c) => c.kind === 'choice');
  if (!session.gmless) return choices;
  return choices.filter((c) => meetsCondition(c.dealWhen, held));
}

export type TransitionPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      currentScene: Session['currentScene'];
      /** 手札に配り直す選択肢カード。自動戦闘のノードでは空（勝利後に配る） */
      choices: CardDef[];
      /** 移り先が自動戦闘のノードなら、その相手と上限 */
      autoCombat?: { enemy: AutoCombatEnemy; maxRounds: number };
      /** GM不在のセッションで結末ノードへ移ったら true */
      ended: boolean;
      /** ended のとき、結末のノードが指す結末の結末タグ（docs/cartagraph/solo-village.md「結末タグ」、仮ルール） */
      endingTag?: string;
    };

export function planTransition(
  scenario: Pick<Scenario, 'deck' | 'endings'>,
  session: Pick<Session, 'gmless'>,
  nextNodeId: string,
  /** 配る条件の判定に使うカード（heldCards）。遷移に伴う効果を適用した後の状態で渡す */
  held: CardDef[],
): TransitionPlan {
  const found = findDeckNode(scenario.deck, nextNodeId);
  if (!found) return { ok: false, error: `移り先のシーン（${nextNodeId}）がシナリオにありません` };
  const { node, topIndex, path } = found;
  // 自動戦闘はGM不在のセッション限定（docs/cartagraph/auto-combat.md）。GM不在でないセッションでは入らない
  if (node.autoCombat && !session.gmless)
    return {
      ok: false,
      error: `「${node.name}」は自動戦闘のシーンのため、GM不在でないセッションでは進めません`,
    };
  // 結末で自動終了するのはGM不在のセッションだけ（play-and-field.md「次のシーンへ進む」）
  const ended = node.kind === 'ending' && session.gmless;
  const endingTag = ended
    ? scenario.endings.find((e) => e.id === node.endingId)?.grantsTag
    : undefined;
  return {
    ok: true,
    currentScene: {
      index: topIndex,
      total: scenario.deck.length,
      name: node.name,
      path: path.map((n) => n.name).join(' › '),
      nodeId: node.id,
    },
    choices: node.autoCombat ? [] : dealChoices(node, held, session),
    ...(node.autoCombat && { autoCombat: node.autoCombat }),
    ended,
    ...(endingTag && { endingTag }),
  };
}
