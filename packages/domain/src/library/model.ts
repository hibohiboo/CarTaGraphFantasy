// 共有設定（docs/cartagraph/graph.md「正史グラフの共有設定への格上げ」）。

import type { CardKind } from '../card/model';

/** 共有設定（正史グラフから格上げされた設定・カード） */
export interface LibraryEntry {
  id: string;
  kind: CardKind;
  name: string;
  description: string;
  tags: string[];
  originScenarioTitle: string;
  promotedBy: string;
  promotedAt: string;
}
