// GET /card-pool の応答（docs/plans/2026-10-11-APIドキュメント.md G2）。キャラクター作成と村はずれの一歩の開始画面が使う。

import { cardDefSchema } from '@cartagraph/domain/card/model';
import { characterCreationRulesSchema } from '@cartagraph/domain/character/model';
import { z } from 'zod';

const rules = characterCreationRulesSchema.shape;

/**
 * 基本カードプールと解放済みカードプール、CP 予算。能力値の配分（abilities）と作成時の HP・基本行動値
 * （initialHp・initialBaseActionValue）は仮ルール（docs/provisional/character-creation.md。rules/character-creation.json）
 */
export const cardPoolSchema = z.strictObject({
  basic: z.array(cardDefSchema),
  unlocked: z.array(cardDefSchema),
  budget: rules.cpBudget,
  abilities: rules.abilities,
  initialHp: rules.initialHp,
  initialBaseActionValue: rules.initialBaseActionValue,
});

export type CardPool = z.infer<typeof cardPoolSchema>;
