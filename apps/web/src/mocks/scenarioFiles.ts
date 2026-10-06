// 遊べるシナリオ（リポジトリ直下の scenarios/*.json）を読み込む（docs/plans/2026-10-03-シナリオのJSON管理.md）。
// 検査（形・ファイル名と id・参照の整合）は packages/domain の parseScenarioFile。誤りがあれば読み込みで止まる。
// 開発サーバーの起動中に手で scenarios/ へファイルを足したときは、再起動すると拾う。画面から公開して書いたファイルは、
// 書き込みの口（apps/web/vite/scenarioFilePlugin.ts）がこのモジュールを無効化するので、次のリロードで拾う。

import { parseScenarioFile } from '@cartagraph/domain/scenario/file';
import type { Scenario } from '@cartagraph/domain/scenario/model';

const files = import.meta.glob('../../../../scenarios/*.json', { eager: true, import: 'default' });

/** id 順（glob の返す順に頼らない） */
export const scenarioFiles: Scenario[] = Object.entries(files)
  .map(([path, raw]) => parseScenarioFile(path, raw))
  .sort((a, b) => a.id.localeCompare(b.id));
