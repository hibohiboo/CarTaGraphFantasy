// 能力値と判定（docs/cartagraph/check.md）。packages/domain の土台で、どこにも依存しない。
// zod スキーマの書き方の方針は card/model.ts の冒頭にある。

import { z } from 'zod';

/** 能力値のキー（docs/cartagraph/check.md）。Abilities のキーと一致させる */
export const abilityKeySchema = z.enum(['body', 'skill', 'mind']);

/** 能力値（docs/cartagraph/check.md） */
export interface Abilities {
  body: number; // 体
  skill: number; // 技
  mind: number; // 心
}

/** 選択肢カードに紐づく判定（能力値＋2d6 vs 目標値） */
export const checkSpecSchema = z.strictObject({
  ability: abilityKeySchema,
  target: z.number(),
  onSuccess: z.string(),
  onFailure: z.string(),
});

/** 選択肢カードに紐づく判定（能力値＋2d6 vs 目標値） */
export type CheckSpec = z.infer<typeof checkSpecSchema>;
