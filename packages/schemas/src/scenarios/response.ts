// シナリオの API の応答のうち、packages/domain に無い形（docs/plans/2026-10-11-APIドキュメント.md G2、
// docs/plans/2026-10-11-シナリオの下書きのAPI.md G3）。

import { endingDefShapeSchema, scenarioSchema } from '@cartagraph/domain/scenario/model';
import { z } from 'zod';

/**
 * 下書き（製作者の書きかけ）。書きかけでも保存できるよう、業務の検査（再挑戦不可の結末には結末タグが要る、など）を
 * 外した形。形（知らないキー・型）は検査する。libraryStatus は意味を持たず、サーバーが常に 'draft' にする
 * （公開の状態は ScenarioDraftView.publication が持つ）
 */
export const scenarioDraftSchema = scenarioSchema.extend({
  endings: z.array(endingDefShapeSchema),
});

export type ScenarioDraft = z.infer<typeof scenarioDraftSchema>;

/**
 * 上書きした下書きの形を検査する（PATCH /scenarios/:id/draft）。誤りの文は最初の1件の場所を入れる。
 * モックと将来のバックエンドが同じ文を使う（apps/web は zod を直接使わない）
 */
export function safeParseScenarioDraft(
  value: unknown,
): { ok: true; draft: ScenarioDraft } | { ok: false; message: string } {
  const result = scenarioDraftSchema.safeParse(value);
  if (result.success) return { ok: true, draft: result.data };
  const issue = result.error.issues[0];
  const where = (issue?.path ?? []).map(String).join('.') || '本文';
  // 知らないキーは、どのキーかも出す（場所だけでは分からないため）
  const keys = issue?.code === 'unrecognized_keys' ? `：${issue.keys.join('・')}` : '';
  return { ok: false, message: `下書きの形が正しくありません（${where}${keys}）` };
}

/** 公開版の有無とシナリオ集に載っているか。none＝公開版が無い、listed＝載っている、unlisted＝外した */
export const scenarioPublicationSchema = z.enum(['none', 'listed', 'unlisted']);

export type ScenarioPublication = z.infer<typeof scenarioPublicationSchema>;

/** 製作者が見る下書きと、その公開の状態 */
export const scenarioDraftViewSchema = z.strictObject({
  draft: scenarioDraftSchema,
  publication: scenarioPublicationSchema,
  /** 下書きが公開版と違うか（libraryStatus・updatedAt を除いて比べる。公開版が無ければ false） */
  changed: z.boolean(),
});

export type ScenarioDraftView = z.infer<typeof scenarioDraftViewSchema>;

/**
 * ファイル（scenarios/<id>.json）への書き込みの結果。saved: true は開発サーバーで書いた、
 * saved: false は書き込みの対象だが書かなかった（GitHub Pages のデモなど）
 */
export const scenarioFileResultSchema = z.union([
  z.strictObject({ saved: z.literal(true), path: z.string() }),
  z.strictObject({ saved: z.literal(false) }),
]);

export type ScenarioFileResult = z.infer<typeof scenarioFileResultSchema>;

/** 公開・公開し直す・非公開の応答。公開版は公開のファイルの検査を通っている */
export const scenarioSaveResultSchema = z.strictObject({
  scenario: scenarioSchema,
  file: scenarioFileResultSchema,
});

/** 公開・公開し直す・非公開の応答（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md） */
export type ScenarioSaveResult = z.infer<typeof scenarioSaveResultSchema>;
