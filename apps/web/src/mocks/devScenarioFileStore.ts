// 開発サーバーの書き込みの口（apps/web/vite/scenarioFilePlugin.ts）へシナリオを送る保存先
// （docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。browser.ts が、口が開いているときだけ差し込む。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { bypass } from 'msw';
import type { ScenarioFileStore } from './handlers';

/** 口の URL。BASE_URL を付けない絶対パス（vite/scenarioFilePlugin.ts の SCENARIO_FILE_ENDPOINT と揃える） */
const ENDPOINT = '/__dev/scenarios';

/** 口の応答を待つ上限。返らないと画面が「保存中…」のまま止まるため（口の Biome の上限より長くする） */
const TIMEOUT_MS = 15_000;

export function createDevScenarioFileStore(
  fetchFn: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): ScenarioFileStore {
  return {
    async write(scenario: Scenario) {
      // /__dev/* には MSW のハンドラが無いのでそのまま通るが、念のため bypass で MSW に横取りさせない
      // 開発サーバーが止まっていれば fetch が失敗し、そのまま投げる（MSW 側が 500 にする）。時間切れは日本語の文にする
      const res = await fetchFn(
        bypass(
          new Request(new URL(`${ENDPOINT}/${scenario.id}`, location.origin), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario),
            signal: AbortSignal.timeout(timeoutMs),
          }),
        ),
      ).catch((e: unknown) => {
        if ((e as { name?: unknown } | null)?.name === 'TimeoutError') {
          throw new Error(`開発サーバーが ${timeoutMs}ms で応答しなかった`);
        }
        throw e;
      });
      if (!res.ok) throw new Error((await res.text()) || `${res.status} ${res.statusText}`);
    },
  };
}
