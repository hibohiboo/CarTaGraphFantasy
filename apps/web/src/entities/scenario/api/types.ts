// シナリオの保存・公開の応答（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。
// MSW（mocks/handlers.ts）もこの型で応答する。

import type { Scenario } from '@cartagraph/domain/scenario/model';

/**
 * ファイル（scenarios/<id>.json）への書き込みの結果。saved: true は開発サーバーで書いた、
 * saved: false は書き込みの対象だが書かなかった（GitHub Pages のデモなど）、null は書き込みの対象外（下書きの保存）
 */
export type ScenarioFileResult = { saved: true; path: string } | { saved: false } | null;

export type ScenarioSaveResult = { scenario: Scenario; file: ScenarioFileResult };
