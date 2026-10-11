// シナリオの API の応答の型（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md、docs/plans/2026-10-11-シナリオの下書きのAPI.md）。
// 形の正は packages/schemas の scenarios/response.ts（API の一覧と OpenAPI が使う）。pages は schemas を import
// できないので、ここで別名を付けて渡す（再エクスポートではない。docs/plans/2026-10-11-APIドキュメント.md G8）。

import type {
  ScenarioDraftView as DraftView,
  ScenarioFileResult as FileResult,
  ScenarioPublication as Publication,
  ScenarioSaveResult as SaveResult,
} from '@cartagraph/schemas/scenarios/response';

/**
 * ファイル（scenarios/<id>.json）への書き込みの結果。saved: true は開発サーバーで書いた、
 * saved: false は書き込みの対象だが書かなかった（GitHub Pages のデモなど）
 */
export type ScenarioFileResult = FileResult;

/** 公開・公開し直す・非公開の応答 */
export type ScenarioSaveResult = SaveResult;

/** 製作者が見る下書きと、その公開の状態（none＝公開版が無い、listed＝シナリオ集に載っている、unlisted＝外した） */
export type ScenarioDraftView = DraftView;

export type ScenarioPublication = Publication;
