// キャラクター（docs/cartagraph/character-growth.md、称号は comparison-and-titles.md）。
// Character は API の応答の型なので zod スキーマが正（方針は card/model.ts の冒頭）。

import { z } from 'zod';
import { cardDefSchema, commentSchema, idSchema } from '../card/model';
import { abilitiesSchema } from '../check/model';

export const characterSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  ownerName: z.string(),
  /** 能力値・HP・基本行動値は、作成したときから持つ（character-growth.md「PCが持つデータ」） */
  abilities: abilitiesSchema,
  hp: z.strictObject({ current: z.number(), max: z.number() }),
  /** 戦闘用の基本行動値 */
  baseActionValue: z.number(),
  /** キャラクターデッキ（所有・構成デッキ） */
  deck: z.array(cardDefSchema),
  /** 称号タグ（特徴カードの一種。所有者が反映を選んだもの） */
  titles: z.array(z.string()),
  cp: z.strictObject({ total: z.number(), spent: z.number() }),
  createdAt: z.string(),
});

export type Character = z.infer<typeof characterSchema>;

const positiveInt = z.number().int().min(1);

/**
 * キャラクター作成のルール（rules/character-creation.json。システム製作者が JSON を直してコミットする）。
 * CP 予算はハードな制約（docs/cartagraph/character-growth.md）。
 * 能力値の配分（abilities）と作成時の HP・行動値（initialHp・initialBaseActionValue）は**仮ルール**：
 * 配分方法と作成時の HP・行動値は未解決論点
 * （docs/provisional/character-creation.md）。この形は「合計を範囲内で配る」
 * いまの仮ルールを表すだけで、論点が決まったら作り直す。
 * 関係の検査（min ≤ max、合計が3つの範囲で作れる）もここで行う。カード一覧との検査は creation.ts
 */
export const characterCreationRulesSchema = z.strictObject({
  $comment: commentSchema,
  /** 基本カードプール（誰でも最初から CP で選べるシステム標準のカード）の、カード一覧の id。並びは画面の並び */
  basicPoolCardIds: z.array(idSchema),
  /** CP 予算。新規 PC はみな同じ（character-growth.md） */
  cpBudget: positiveInt,
  /** 体・技・心の配分（仮ルール）。合計がちょうど total で、どれも min〜max。村の成長の上限にも max を使う */
  abilities: z
    .strictObject({ total: positiveInt, min: positiveInt, max: positiveInt })
    .superRefine((a, ctx) => {
      if (a.min > a.max)
        ctx.addIssue({ code: 'custom', message: `min（${a.min}）が max（${a.max}）より大きい` });
      else if (a.total < 3 * a.min || a.total > 3 * a.max)
        ctx.addIssue({
          code: 'custom',
          message: `total（${a.total}）は、体・技・心を ${a.min}〜${a.max} で配って作れない`,
        });
    }),
  /** 作成時の HP（仮ルール）。どの PC も持つ */
  initialHp: positiveInt,
  /** 作成時の基本行動値（仮ルール）。どの PC も持つ */
  initialBaseActionValue: positiveInt,
});

export type CharacterCreationRules = z.infer<typeof characterCreationRulesSchema>;
