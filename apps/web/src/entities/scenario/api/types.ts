// シナリオの保存・公開の応答（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。
// 形の正は packages/schemas の scenarios/response.ts（API の一覧と OpenAPI が使う）。pages は schemas を import
// できないので、ここで別名を付けて渡す（再エクスポートではない。docs/plans/2026-10-11-APIドキュメント.md G8）。

import type {
  ScenarioFileResult as FileResult,
  ScenarioSaveResult as SaveResult,
} from '@cartagraph/schemas/scenarios/response';

/**
 * ファイル（scenarios/<id>.json）への書き込みの結果。saved: true は開発サーバーで書いた、
 * saved: false は書き込みの対象だが書かなかった（GitHub Pages のデモなど）、null は書き込みの対象外（下書きの保存）
 */
export type ScenarioFileResult = FileResult;

export type ScenarioSaveResult = SaveResult;
