// シナリオデッキをたどる（入れ子の children も含めて、並びの順に）。deadEnd.ts・edit.ts と製作者の画面が使う。
// session/transition.ts の findDeckNode は、domain の中の向き（scenario ← session）のため scenario からは使わない。

import type { DeckNode } from './model';

export const walk = (nodes: DeckNode[]): DeckNode[] =>
  nodes.flatMap((n) => [n, ...walk(n.children ?? [])]);
