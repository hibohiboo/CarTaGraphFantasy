// キャラクターの API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の4・5）。
// 形だけを書く。能力値の配分・CP 予算・名前が空でないかは、受け取る側が今のメッセージで検査する。

import { z } from 'zod';
import { defineBody } from '../body/parse';

/** POST /characters：どの PC も作成したときから能力値を持つ（docs/cartagraph/character-growth.md「PCが持つデータ」） */
export const createCharacterBody = defineBody(
  z.object({
    name: z.string(),
    abilities: z.object({ body: z.number(), skill: z.number(), mind: z.number() }),
    cardIds: z.array(z.string()),
  }),
  { abilities: '能力値（体・技・心）を数で送ってください' },
);

const FIXED_AFTER_CREATION = '能力値・HP・行動値は、作成したあとで変えられません';

/** PATCH /characters/:id：カードを足すだけ。能力値・HP・行動値のキーがあれば、値によらず断る */
export const updateCharacterBody = defineBody(
  z.object({
    addCardIds: z.array(z.string()).optional(),
    abilities: z.never().optional(),
    hp: z.never().optional(),
    baseActionValue: z.never().optional(),
  }),
  {
    abilities: FIXED_AFTER_CREATION,
    hp: FIXED_AFTER_CREATION,
    baseActionValue: FIXED_AFTER_CREATION,
  },
);
