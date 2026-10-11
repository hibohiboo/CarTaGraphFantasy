// シナリオの API の応答のうち、packages/domain に無い形（docs/plans/2026-10-11-APIドキュメント.md G2・G10）。

import { endingDefShapeSchema, scenarioSchema } from '@cartagraph/domain/scenario/model';
import { z } from 'zod';

/**
 * 下書きを含みうるシナリオ。下書きの保存（PATCH /scenarios/:id）は書きかけでも保存できるよう中身を検査しないので、
 * 業務の検査（再挑戦不可の結末には結末タグが要る、など）を外した形で書く。下書きの API を分けたら直す
 * （docs/backlog/scenario-draft-api.md）
 */
export const scenarioDraftSchema = scenarioSchema.extend({
  endings: z.array(endingDefShapeSchema),
});

/**
 * ファイル（scenarios/<id>.json）への書き込みの結果。saved: true は開発サーバーで書いた、
 * saved: false は書き込みの対象だが書かなかった（GitHub Pages のデモなど）、null は書き込みの対象外（下書きの保存）
 */
export const scenarioFileResultSchema = z
  .union([
    z.strictObject({ saved: z.literal(true), path: z.string() }),
    z.strictObject({ saved: z.literal(false) }),
  ])
  .nullable();

export type ScenarioFileResult = z.infer<typeof scenarioFileResultSchema>;

/** 公開・非公開の応答。公開のファイルの検査を通った後なので、シナリオは業務の検査も通っている */
export const scenarioSaveResultSchema = z.strictObject({
  scenario: scenarioSchema,
  file: scenarioFileResultSchema,
});

/** 保存・公開・非公開の応答（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md） */
export type ScenarioSaveResult = z.infer<typeof scenarioSaveResultSchema>;

/** 保存（PATCH /scenarios/:id）の応答。下書きを保存したときは業務の検査を通っていないことがある */
export const scenarioDraftSaveResultSchema = z.strictObject({
  scenario: scenarioDraftSchema,
  file: scenarioFileResultSchema,
});
