/// <reference types="vite/client" />

/**
 * 開発サーバーのシナリオの書き込みの口が開いているか（apps/web/vite/scenarioFilePlugin.ts の define）。
 * build・preview・Vitest・エージェント用の開発サーバー（既定）では false
 */
declare const __SCENARIO_FILE_WRITE__: boolean;
