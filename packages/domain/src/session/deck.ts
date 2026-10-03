// GM が外したシーンを除いた、そのセッションで使うシナリオデッキ（docs/cartagraph/scenario-flow.md「GMのカスタマイズ」）。
// 外したシーンは子孫ごと除き、除いたシーンへ進む選択肢カードも除く（配らず、そこへは進めない）。
// セッションはシーンを移るたびにシナリオを引くので、開始時だけでなく遷移・自動戦闘のたびに通す。

import type { DeckNode } from '../scenario/model';

/** 外すと除かれるノード（外したノードとその子孫）。デッキに無い ID は無視する */
function removedNodes(deck: DeckNode[], excludedNodeIds: readonly string[]): DeckNode[] {
  const excluded = new Set(excludedNodeIds);
  const removed: DeckNode[] = [];
  const collect = (nodes: DeckNode[], inside: boolean) => {
    for (const n of nodes) {
      const out = inside || excluded.has(n.id);
      if (out) removed.push(n);
      collect(n.children ?? [], out);
    }
  };
  collect(deck, false);
  return removed;
}

/** 導入か結末が（子孫として巻き込まれる場合も含めて）除かれるか。導入と結末は外せない */
export function excludesFixedNode(deck: DeckNode[], excludedNodeIds: readonly string[]): boolean {
  return removedNodes(deck, excludedNodeIds).some((n) => n.kind === 'intro' || n.kind === 'ending');
}

export function sessionDeck(deck: DeckNode[], excludedNodeIds: readonly string[]): DeckNode[] {
  if (excludedNodeIds.length === 0) return deck;
  const removed = new Set(removedNodes(deck, excludedNodeIds).map((n) => n.id));
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
