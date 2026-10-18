import { walk } from '@cartagraph/domain/scenario/deck';
import { choiceReferrers } from '@cartagraph/domain/scenario/edit';
import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import { editableSceneNodes, publishWarnings } from '@cartagraph/domain/scenario/readiness';

export type NodeWarningKind = 'deadEnd' | 'unreachable';

/**
 * このノードに当たる、公開を止めない注意（概要が空は含めない）。
 * 保存済みのデッキで、このノードだけ編集中の値に差し替えて判定する（選択肢を直したらすぐ注意が変わる。他のノードは保存済みの値）
 */
export function nodeWarnings(sc: Scenario, draft: DeckNode): NodeWarningKind[] {
  const deck = sc.deck.map((n) => (n.id === draft.id ? draft : n));
  const kinds: NodeWarningKind[] = [];
  for (const w of publishWarnings({ ...sc, deck })) {
    if (w.kind !== 'noSummary' && w.node.id === draft.id) kinds.push(w.kind);
  }
  return kinds;
}

export type SceneLinkTargets = {
  /** このノードの編集中の選択肢カードの移り先（重複は1つ） */
  targets: DeckNode[];
  /** 保存済みのデッキで、選択肢カードがこのノードを指すノード（重複は1つ） */
  referrers: DeckNode[];
  /** シーン編集で開けるノードの並びでの前・次（無ければ null） */
  prev: DeckNode | null;
  next: DeckNode | null;
  /** シーン編集で開けるノードの id（リンクにしてよいもの。入れ子・プール用のノードは名前だけ） */
  editableIds: Set<string>;
};

const uniqueNodes = (nodes: DeckNode[]): DeckNode[] => [
  ...new Map(nodes.map((n) => [n.id, n])).values(),
];

/** シーンから前後へ移る導線（docs/plans/2026-10-17-シナリオ製作の導線.md D10・G5） */
export function sceneLinkTargets(deck: DeckNode[], draft: DeckNode): SceneLinkTargets {
  const byId = new Map(walk(deck).map((n) => [n.id, n]));
  const targets = uniqueNodes(
    draft.cards.flatMap((c) => {
      const to = c.kind === 'choice' && c.nextNodeId ? byId.get(c.nextNodeId) : undefined;
      return to ? [to] : [];
    }),
  );
  const referrers = uniqueNodes(choiceReferrers(deck, [draft.id]).map((r) => r.node));
  const editable = editableSceneNodes(deck);
  const at = editable.findIndex((n) => n.id === draft.id);
  return {
    targets,
    referrers,
    prev: at > 0 ? editable[at - 1] : null,
    next: at >= 0 && at < editable.length - 1 ? editable[at + 1] : null,
    editableIds: new Set(editable.map((n) => n.id)),
  };
}
