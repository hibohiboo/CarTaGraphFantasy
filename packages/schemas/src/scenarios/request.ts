// シナリオの API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の13〜16）。
// 形だけを書く。名前・題名が空でないか、募集人数が1以上の整数か、外すシーンがシナリオにあるかなどは、受け取る側が
// 今のメッセージで検査する。

import {
  recruitmentKindSchema,
  recruitmentProposalHandlingSchema,
} from '@cartagraph/domain/session/model';
import { z } from 'zod';
import { defineBody } from '../body/parse';

/** POST /scenarios/:id/start-solo */
export const startSoloBody = defineBody(z.object({ name: z.string() }));

/** POST /scenarios */
export const createScenarioBody = defineBody(z.object({ title: z.string() }));

/**
 * PATCH /scenarios/:id：下書きは書きかけでも保存できるので、オブジェクトであることだけを見て中身は見ない
 * （プランの D5。公開中のシナリオは、受け取る側が保存の前に公開のファイルの検査をかける）
 */
export const updateScenarioBody = defineBody(z.record(z.string(), z.unknown()), {
  '': '本文はオブジェクトにしてください',
});

/** POST /scenarios/:id/recruitments：省いた種類は通常の募集。項目ごとの条件（種類による使い分け）は受け取る側 */
export const createRecruitmentBody = defineBody(
  z.object({
    kind: recruitmentKindSchema.optional(),
    capacity: z.number().optional(),
    note: z.string().optional(),
    excludedNodeIds: z.array(z.string()).optional(),
    proposalHandling: recruitmentProposalHandlingSchema.optional(),
  }),
  {
    kind: '募集の種類は通常か GM 不在のどちらかで指定してください',
    capacity: '募集人数は1以上の整数で指定してください',
    excludedNodeIds: '外すシーンの指定の形が正しくありません',
    proposalHandling: '提案の扱いは「GM が後から裁定」か「提案不可」で指定してください',
  },
);
