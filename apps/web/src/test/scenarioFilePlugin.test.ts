// 開発サーバーの書き込みの口（apps/web/vite/scenarioFilePlugin.ts。docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。
// Vite のサーバーに依らない処理関数を、一時ディレクトリに対して確かめる。リポジトリの scenarios/ には書かない。
// setup.ts が window に触るので、環境は jsdom のまま（jsdom でも node:fs・node:child_process は使える）。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseScenarioFile,
  safeParseScenarioFile,
  scenarioFileIdPattern,
  toScenarioFile,
} from '@cartagraph/domain/scenario/file';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createBiomeFormatter,
  createHmrGuard,
  handleScenarioPut,
  type ScenarioPutRequest,
  scenarioFileWriteOpen,
  scenarioIdFromUrl,
  tempPathFor,
} from '../../vite/scenarioFilePlugin';
import { scenarioFiles } from '../mocks/scenarioFiles';

const rawFiles = import.meta.glob<string>('../../../../scenarios/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const rawText = (id: string) => {
  const t = rawFiles[`../../../../scenarios/${id}.json`];
  if (t === undefined) throw new Error(`${id}.json がありません`);
  return t;
};
const galleon = () => JSON.parse(rawText('sc-galleon')) as Scenario;

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cartagraph-scenarios-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const identity = async (_path: string, text: string) => text;
const put = (o: Partial<ScenarioPutRequest> = {}, format = identity, scenariosDir = dir) =>
  handleScenarioPut(
    {
      method: 'PUT',
      contentType: 'application/json',
      id: 'sc-galleon',
      body: JSON.stringify(galleon()),
      remoteAddress: '127.0.0.1',
      ...o,
    },
    { scenariosDir, idPattern: scenarioFileIdPattern, check: safeParseScenarioFile, format },
  );
const files = () => readdirSync(dir);

describe('handleScenarioPut', () => {
  it('正しいシナリオを <id>.json に書き、204。読み直すと送ったシナリオで、MSW の読み込みも通る', async () => {
    expect(await put()).toEqual({ status: 204 });
    const written = JSON.parse(readFileSync(join(dir, 'sc-galleon.json'), 'utf8'));
    expect(written).toEqual(galleon());
    expect(parseScenarioFile('scenarios/sc-galleon.json', written)).toEqual(galleon());
  });

  it('既にあるファイルを上書きし、一時ファイルを残さない', async () => {
    await writeFile(join(dir, 'sc-galleon.json'), '{}');
    expect(await put({ body: JSON.stringify({ ...galleon(), title: '直した' }) })).toEqual({
      status: 204,
    });
    expect(JSON.parse(readFileSync(join(dir, 'sc-galleon.json'), 'utf8')).title).toBe('直した');
    expect(files()).toEqual(['sc-galleon.json']);
  });

  it.each(['../x', 'a/b', '..%2Fx', 'A', 'sc_x', ''])(
    'id「%s」は 400 で、ファイルを作らない',
    async (id) => {
      expect((await put({ id })).status).toBe(400);
      expect(files()).toEqual([]);
    },
  );

  it('id「sc-1001」は通る', async () => {
    const body = JSON.stringify({ ...galleon(), id: 'sc-1001' });
    expect(await put({ id: 'sc-1001', body })).toEqual({ status: 204 });
  });

  it.each(['192.168.0.10', '::ffff:192.168.0.10', undefined])(
    '接続元が %s なら 403 で、ファイルを作らない',
    async (remoteAddress) => {
      expect((await put({ remoteAddress })).status).toBe(403);
      expect(files()).toEqual([]);
    },
  );

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])(
    '接続元が %s なら通る',
    async (remoteAddress) => {
      expect(await put({ remoteAddress })).toEqual({ status: 204 });
    },
  );

  it('PUT 以外は 405、JSON の型でなければ 415、本文が JSON でなければ 400。どれもファイルを作らない', async () => {
    expect((await put({ method: 'POST' })).status).toBe(405);
    expect((await put({ contentType: 'text/plain' })).status).toBe(415);
    expect((await put({ contentType: undefined })).status).toBe(415);
    expect((await put({ body: '{' })).status).toBe(400);
    expect(files()).toEqual([]);
  });

  it('Content-Type に charset が付いていても通る', async () => {
    expect(await put({ contentType: 'application/json; charset=utf-8' })).toEqual({ status: 204 });
  });

  it.each([
    ['形の誤り', { ...galleon(), proposalHandling: 'x' }, 'proposalHandling'],
    ['id と :id の食い違い', { ...galleon(), id: 'sc-other' }, 'sc-other'],
    [
      '参照の誤り',
      {
        ...galleon(),
        deck: [
          {
            id: 'a',
            kind: 'intro',
            name: '導入',
            cards: [{ id: 'x', kind: 'choice', name: 'x', tags: [], nextNodeId: 'nowhere' }],
          },
        ],
      },
      'nowhere',
    ],
  ])('%s は 422 で本文に誤りの文。既にあるファイルは変わらない', async (_, scenario, word) => {
    await writeFile(join(dir, 'sc-galleon.json'), 'before');
    const res = await put({ body: JSON.stringify(scenario) });
    expect(res.status).toBe(422);
    expect(res.body).toContain(word);
    expect(readFileSync(join(dir, 'sc-galleon.json'), 'utf8')).toBe('before');
    expect(files()).toEqual(['sc-galleon.json']);
  });

  it('整形が失敗したら 500 で、ファイルを書かない', async () => {
    const res = await put({}, async () => {
      throw new Error('biome が落ちた');
    });
    expect(res).toEqual({ status: 500, body: expect.stringContaining('biome が落ちた') });
    expect(files()).toEqual([]);
  });

  it('書き込みが失敗したら（書き込み先が無い）500 で、一時ファイルを残さない', async () => {
    const missing = join(dir, 'missing');
    expect((await put({}, identity, missing)).status).toBe(500);
    expect(existsSync(missing)).toBe(false);
    expect(files()).toEqual([]);
  });
});

describe('Biome での整形（本物の Biome）', () => {
  const format = createBiomeFormatter();

  it('MSW が読んだシナリオをファイルに書く形にして整形すると、今のファイルとバイト列で一致する（全ファイル）', async () => {
    for (const s of scenarioFiles) {
      expect(
        await format(`scenarios/${s.id}.json`, JSON.stringify(toScenarioFile(s), null, 2)),
      ).toBe(rawText(s.id));
    }
  }, 30_000);

  it('書き込み先が一時ディレクトリでも、Biome にはリポジトリの scenarios/<id>.json として渡す', async () => {
    expect(await put({}, format)).toEqual({ status: 204 });
    expect(readFileSync(join(dir, 'sc-galleon.json'), 'utf8')).toBe(rawText('sc-galleon'));
  }, 30_000);
});

describe('scenarioIdFromUrl（ミドルウェアの URL から id）', () => {
  it.each([
    ['/sc-1', 'sc-1'],
    ['/sc-1?x=1', 'sc-1'],
    ['/', ''],
    ['/sc-1/', 'sc-1/'],
    ['/..%2Fx', '..%2Fx'],
    [undefined, ''],
  ])('%s は「%s」（デコードせず、口の id の検査に任せる）', (url, id) => {
    expect(scenarioIdFromUrl(url)).toBe(id);
  });
});

describe('tempPathFor（一時ファイルのパス）', () => {
  it('同じ id でも呼ぶたびに違う名前で、同じディレクトリにあり、.json で終わらない（重なった書き込みが互いを上書きしない）', () => {
    const a = tempPathFor(dir, 'sc-x');
    const b = tempPathFor(dir, 'sc-x');
    expect(a).not.toBe(b);
    for (const p of [a, b]) {
      expect(p.startsWith(join(dir, '.sc-x.json.'))).toBe(true);
      expect(p.endsWith('.json')).toBe(false);
    }
  });
});

describe('Biome の整形のタイムアウト', () => {
  it('時間内に返らなければ失敗にする', async () => {
    await expect(createBiomeFormatter(1)('scenarios/sc-x.json', '{}')).rejects.toThrow(
      /返らなかった/,
    );
  });
});

describe('createHmrGuard（口が書いたファイルの HMR を止める）', () => {
  it('口が直前に書いたファイルは、2回目の通知でも止める。時間が過ぎたら止めない', () => {
    let now = 0;
    const guard = createHmrGuard(() => now);
    guard.record('D:\\repo\\scenarios\\sc-x.json');
    expect(guard.shouldSuppress('D:/repo/scenarios/sc-x.json')).toBe(true);
    now = 1000;
    expect(guard.shouldSuppress('D:/repo/scenarios/sc-x.json')).toBe(true);
    now = 2000;
    expect(guard.shouldSuppress('D:/repo/scenarios/sc-x.json')).toBe(true);
    now = 2001;
    expect(guard.shouldSuppress('D:/repo/scenarios/sc-x.json')).toBe(false);
  });

  it('ほかの scenarios/*.json やソースは止めない', () => {
    const guard = createHmrGuard(() => 0);
    guard.record('D:/repo/scenarios/sc-x.json');
    expect(guard.shouldSuppress('D:/repo/scenarios/sc-y.json')).toBe(false);
    expect(guard.shouldSuppress('D:/repo/apps/web/src/main.tsx')).toBe(false);
  });
});

describe('scenarioFileWriteOpen（口を開くか）', () => {
  const base = { command: 'serve' as const, isPreview: false, vitest: false, port: 5173, env: {} };
  it('人間用の開発サーバー（5173番）は開く', () => {
    expect(scenarioFileWriteOpen(base)).toBe(true);
    expect(scenarioFileWriteOpen({ ...base, port: undefined })).toBe(true);
  });
  it('build・preview・Vitest では開かない', () => {
    expect(scenarioFileWriteOpen({ ...base, command: 'build' })).toBe(false);
    expect(scenarioFileWriteOpen({ ...base, isPreview: true })).toBe(false);
    expect(scenarioFileWriteOpen({ ...base, vitest: true })).toBe(false);
  });
  it('エージェント用（5174番）は既定で開かず、CARTAGRAPH_WRITE_SCENARIOS=1 のときだけ開く', () => {
    expect(scenarioFileWriteOpen({ ...base, port: 5174 })).toBe(false);
    expect(
      scenarioFileWriteOpen({ ...base, port: 5174, env: { CARTAGRAPH_WRITE_SCENARIOS: '0' } }),
    ).toBe(false);
    expect(
      scenarioFileWriteOpen({ ...base, port: 5174, env: { CARTAGRAPH_WRITE_SCENARIOS: '1' } }),
    ).toBe(true);
  });
});
