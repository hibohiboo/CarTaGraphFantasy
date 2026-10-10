// キャラクター（docs/cartagraph/character-growth.md、典型ロールは scenario-type.md、称号は comparison-and-titles.md）。

import { z } from 'zod';
import { type CardDef, commentSchema, idSchema } from '../card/model';
import type { Abilities } from '../check/model';

/** 典型ロールの通称（PCが持つデータから導出する。固定属性ではない） */
export type CharacterArchetype = 'traveler' | 'explorer' | 'adventurer';

export const ARCHETYPE_LABEL: Record<CharacterArchetype, string> = {
  traveler: '旅人',
  explorer: '探索者',
  adventurer: '冒険者',
};

export interface Character {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  /** 能力値を持たなければ旅人 */
  abilities?: Abilities;
  hp?: { current: number; max: number };
  /** 戦闘用の基本行動値（冒険者のみ） */
  baseActionValue?: number;
  /** キャラクターデッキ（所有・構成デッキ） */
  deck: CardDef[];
  /** 称号タグ（特徴カードの一種。所有者が反映を選んだもの） */
  titles: string[];
  /** 結末タグ（後続シナリオの前提タグと突き合わせる） */
  endingTags: string[];
  cp: { total: number; spent: number };
  createdAt: string;
}

const positiveInt = z.number().int().min(1);

/**
 * キャラクター作成のルール（rules/character-creation.json。システム製作者が JSON を直してコミットする）。
 * CP 予算はハードな制約（docs/cartagraph/character-growth.md）。
 * 能力値の配分（abilities）と作成時の HP（initialHp）は**仮ルール**：配分方法と作成時の HP は未解決論点
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
  /** 能力値を持って作ったときの HP（仮ルール） */
  initialHp: positiveInt,
});

export type CharacterCreationRules = z.infer<typeof characterCreationRulesSchema>;
