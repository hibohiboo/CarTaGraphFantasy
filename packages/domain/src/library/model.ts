// 共有設定（docs/cartagraph/graph.md「正史グラフの共有設定への格上げ」）。
// API の応答の型なので zod スキーマが正（方針は card/model.ts の冒頭）。

import { z } from 'zod';
import { cardKindSchema } from '../card/model';

/** 共有設定（正史グラフから格上げされた設定・カード） */
export const libraryEntrySchema = z.strictObject({
  id: z.string(),
  kind: cardKindSchema,
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  originScenarioTitle: z.string(),
  promotedBy: z.string(),
  promotedAt: z.string(),
});

/** 共有設定（正史グラフから格上げされた設定・カード） */
export type LibraryEntry = z.infer<typeof libraryEntrySchema>;
