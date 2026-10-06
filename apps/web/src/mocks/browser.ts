import { setupWorker } from 'msw/browser';
import { createDevScenarioFileStore } from './devScenarioFileStore';
import { handlers, setScenarioFileStore } from './handlers';

export const worker = setupWorker(...handlers);

/** Service Worker を起動する。base 配下（GitHub Pages では /CarTaGraphFantasy/app/）に置いた worker を指す */
export async function startMockWorker(): Promise<void> {
  // 開発サーバーの書き込みの口が開いているときだけ、公開したシナリオを scenarios/<id>.json に書く
  // （apps/web/vite/scenarioFilePlugin.ts。GitHub Pages のデモ・エージェント用の開発サーバーでは書かない）
  if (__SCENARIO_FILE_WRITE__) setScenarioFileStore(createDevScenarioFileStore());
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
