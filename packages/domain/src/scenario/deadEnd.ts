// 募集を出すときの注意のための、デッキの構造の検査（docs/cartagraph/scenario-flow.md「募集とセッション」）。
// 募集は止めない。GM が判断するための注意に使う（自動戦闘のシーンの注意は deck.ts の hasAutoCombat）。
// deck は、GM が外したシーンを除いたデッキ（session/deck.ts の sessionDeck）を渡す。

import { walk } from './deck';
import type { DeckNode } from './model';

/**
 * 先へ進む選択肢の無いシーン：種類が導入・シーンで、移り先を持つ選択肢カードが1枚も無いノード（入れ子も見る）。
 * GM 不在のセッションでは、ここで行き止まりになる（「GM が後から裁定」なら、提案を移り先付きで採用して抜けられる）
 */
export function deadEndNodes(deck: DeckNode[]): DeckNode[] {
  return walk(deck).filter(
    (n) =>
      (n.kind === 'intro' || n.kind === 'scene') &&
      !n.cards.some((c) => c.kind === 'choice' && c.nextNodeId),
  );
}
