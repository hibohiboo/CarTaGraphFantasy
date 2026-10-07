// シナリオ製作者の編集の操作（docs/plans/2026-10-07-選択肢の移り先と結末の編集.md）。
// 画面（シナリオ編集・シーン編集）と MSW の新規作成が使う。どの操作も参照を壊さない（findScenarioRefErrors が空のまま）。

import type { CardDef } from '../card/model';
import { walk } from './deck';
import type { DeckNode, Scenario } from './model';

const KIND_LABEL: Partial<Record<DeckNode['kind'], string>> = { scene: 'シーン', ending: '結末' };

export type MoveTarget = { id: string; label: string };

/**
 * 選択肢カードの移り先に選べるノード：別のシーンと結末のノード（入れ子を含む、並びの順）。
 * そのカードがあるノード自身を出さないのは、play-and-field.md 基本操作8「別のノードへ移る」に合わせるため。
 * 導入・プール用のノードを出さないのはプランの D5（人間の決定）。GM の画面の移り先（session/narrate.ts の
 * narrationTargets）は GM の裁量で導入にも移れるので、目的が違い、共通にしない
 */
export function moveTargets(deck: DeckNode[], fromNodeId: string): MoveTarget[] {
  const visit = (nodes: DeckNode[], ancestors: string[]): MoveTarget[] =>
    nodes.flatMap((n) => {
      const names = [...ancestors, n.name];
      const kind = KIND_LABEL[n.kind];
      const self =
        kind && n.id !== fromNodeId ? [{ id: n.id, label: `${kind}：${names.join(' › ')}` }] : [];
      return [...self, ...visit(n.children ?? [], names)];
    });
  return visit(deck, []);
}

export type ChoiceReferrer = { node: DeckNode; card: CardDef };

/** nodeIds のどれかを移り先に持つ選択肢カードと、そのノード。nodeIds の中のノードにあるカードは数えない */
export function choiceReferrers(deck: DeckNode[], nodeIds: string[]): ChoiceReferrer[] {
  const removed = new Set(nodeIds);
  return walk(deck)
    .filter((n) => !removed.has(n.id))
    .flatMap((node) =>
      node.cards
        .filter((c) => c.kind === 'choice' && c.nextNodeId && removed.has(c.nextNodeId))
        .map((card) => ({ node, card })),
    );
}

/** ノードとその子孫の id */
const subtreeIds = (node: DeckNode): string[] => walk([node]).map((n) => n.id);

const without = (nodes: DeckNode[], drop: Set<string>): DeckNode[] =>
  nodes
    .filter((n) => !drop.has(n.id))
    .map((n) => (n.children ? { ...n, children: without(n.children, drop) } : n));

export type RemoveResult<T> = ({ ok: true } & T) | { ok: false; referrers: ChoiceReferrer[] };

/** ノードとその子孫を消す。移り先として指されていれば消さない（プランの D1） */
export function removeNode(deck: DeckNode[], nodeId: string): RemoveResult<{ deck: DeckNode[] }> {
  const node = walk(deck).find((n) => n.id === nodeId);
  if (!node) return { ok: true, deck };
  const drop = subtreeIds(node);
  const referrers = choiceReferrers(deck, drop);
  if (referrers.length > 0) return { ok: false, referrers };
  return { ok: true, deck: without(deck, new Set(drop)) };
}

/** 結末と、それを指す結末のノードを対で足す（プランの D6）。ノードの名前は結末の名前、デッキの最後に置く。結末タグは付けない */
export function addEnding(
  scenario: Scenario,
  name: string,
  ids: { endingId: string; nodeId: string },
): Scenario {
  return {
    ...scenario,
    endings: [...scenario.endings, { id: ids.endingId, name }],
    deck: [
      ...scenario.deck,
      { id: ids.nodeId, kind: 'ending', name, cards: [], endingId: ids.endingId },
    ],
  };
}

/**
 * 結末と、それを指す結末のノード（入れ子も、複数あれば全部）を対で消す（プランの D2）。
 * 消す結末のノードのどれかが移り先なら、何も消さない
 */
export function removeEnding(
  scenario: Scenario,
  endingId: string,
): RemoveResult<{ scenario: Scenario }> {
  if (!scenario.endings.some((e) => e.id === endingId)) return { ok: true, scenario };
  const drop = walk(scenario.deck)
    .filter((n) => n.kind === 'ending' && n.endingId === endingId)
    .flatMap(subtreeIds);
  const referrers = choiceReferrers(scenario.deck, drop);
  if (referrers.length > 0) return { ok: false, referrers };
  return {
    ok: true,
    scenario: {
      ...scenario,
      endings: scenario.endings.filter((e) => e.id !== endingId),
      deck: without(scenario.deck, new Set(drop)),
    },
  };
}

/** base が使われていれば -2・-3… を付けて、使われていない id にする（同じ時刻から作った id が重ならないように） */
export function unusedId(base: string, isTaken: (id: string) => boolean): string {
  if (!isTaken(base)) return base;
  let n = 2;
  while (isTaken(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** 消せない理由の文。括弧の中は、選択肢があるノードの名前 */
export function referrerMessage(referrers: ChoiceReferrer[]): string {
  const list = referrers.map((r) => `『${r.card.name}』（${r.node.name}）`).join('、');
  return `${list}から指されているので削除できません`;
}
