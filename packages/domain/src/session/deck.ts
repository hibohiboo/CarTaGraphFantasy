// GM が外したシーンを除いた、そのセッションで使うシナリオデッキ（docs/cartagraph/scenario-flow.md「GMのカスタマイズ」）。
// 外したシーンは子孫ごと除き、除いたシーンへ進む選択肢カードも除く（配らず、そこへは進めない）。
// セッションはシーンを移るたびにシナリオを引くので、開始時だけでなく遷移・自動戦闘のたびに通す。

import type { DeckNode } from '../scenario/model';

export function sessionDeck(deck: DeckNode[], excludedNodeIds: readonly string[]): DeckNode[] {
  if (excludedNodeIds.length === 0) return deck;
  const excluded = new Set(excludedNodeIds);
  const removed = new Set<string>();
  const collect = (nodes: DeckNode[], inside: boolean) => {
    for (const n of nodes) {
      const out = inside || excluded.has(n.id);
      if (out) removed.add(n.id);
      collect(n.children ?? [], out);
    }
  };
  collect(deck, false);
  if (removed.size === 0) return deck;

  const prune = (nodes: DeckNode[]): DeckNode[] =>
    nodes
      .filter((n) => !removed.has(n.id))
      .map((n) => ({
        ...n,
        cards: n.cards.filter((c) => !(c.nextNodeId && removed.has(c.nextNodeId))),
        ...(n.children && { children: prune(n.children) }),
      }));
  return prune(deck);
}
