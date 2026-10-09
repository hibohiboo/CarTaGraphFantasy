// 遊べるシナリオ（リポジトリ直下の scenarios/*.json）を読み込む（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// 検査（形・ファイル名と id・参照の整合・システムのカード一覧への参照）は packages/domain の loadScenarioFiles。
// 誤りがあれば読み込みで止まる。
// 開発サーバーの起動中に手で scenarios/ へファイルを足したときは、再起動すると拾う。画面から公開して書いたファイルは、
// 書き込みの口（apps/web/vite/scenarioFilePlugin.ts）がこのモジュールを無効化するので、次のリロードで拾う。

import { loadScenarioFiles } from '@cartagraph/domain/scenario/file';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import { systemCards } from './rulesFiles';

const files = import.meta.glob('../../../../scenarios/*.json', { eager: true, import: 'default' });

/** id 順（glob の返す順に頼らない） */
export const scenarioFiles: Scenario[] = loadScenarioFiles(
  files,
  systemCards.map((c) => c.id),
);
