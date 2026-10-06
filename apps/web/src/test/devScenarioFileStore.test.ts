// 開発サーバーの書き込みの口へ送る保存先（mocks/devScenarioFileStore.ts。docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）

import { describe, expect, it } from 'vitest';
import { createDevScenarioFileStore } from '../mocks/devScenarioFileStore';
import { scenarioFiles } from '../mocks/scenarioFiles';

const galleon = () => {
  const s = scenarioFiles.find((x) => x.id === 'sc-galleon');
  if (!s) throw new Error('sc-galleon がありません');
  return s;
};

function fakeFetch(res: Response) {
  const calls: Request[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    calls.push(input as Request);
    return res;
  }) as typeof fetch;
  return { fn, calls };
}

describe('createDevScenarioFileStore', () => {
  it('口（/__dev/scenarios/<id>）へ JSON を PUT し、204 なら解決する', async () => {
    const { fn, calls } = fakeFetch(new Response(null, { status: 204 }));
    await createDevScenarioFileStore(fn).write(galleon());
    expect(calls).toHaveLength(1);
    const req = calls[0] as Request;
    expect(new URL(req.url).pathname).toBe('/__dev/scenarios/sc-galleon');
    expect(req.method).toBe('PUT');
    expect(req.headers.get('Content-Type')).toBe('application/json');
    expect(await req.json()).toEqual(galleon());
  });

  it('fetch そのものが失敗したら（開発サーバーが止まっているなど）、その誤りで失敗する', async () => {
    const fn = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(createDevScenarioFileStore(fn).write(galleon())).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('時間内に返らなければ中断して失敗する', async () => {
    const fn = ((input: Request) =>
      new Promise((_, reject) => {
        input.signal.addEventListener('abort', () => reject(input.signal.reason));
      })) as typeof fetch;
    await expect(createDevScenarioFileStore(fn, 5).write(galleon())).rejects.toThrow(
      '開発サーバーが 5ms で応答しなかった',
    );
  });

  it.each([422, 500])('%i なら応答の本文の文で失敗する', async (status) => {
    const { fn } = fakeFetch(
      new Response('scenarios/sc-galleon.json の形が誤っている', { status }),
    );
    await expect(createDevScenarioFileStore(fn).write(galleon())).rejects.toThrow(
      'scenarios/sc-galleon.json の形が誤っている',
    );
  });
});
