// MSW の応答を API の一覧と照らす仕組み（docs/plans/2026-10-11-APIドキュメント.md G7・T8・T9）。
// 照合（どの一覧の項目に当たるか）と、貯めた誤りの取り出しを確かめる。形の検査そのものは packages/schemas の
// checkResponse（schemas:test）。

import { delay, HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { server } from '../mocks/node';
import {
  checkMockedResponse,
  findEndpoint,
  settleResponseChecks,
  takeResponseErrors,
} from './responseCheck';

const url = (path: string) => new URL(`/api${path}`, location.origin).href;
const request = (method: string, path: string) => new Request(url(path), { method });
const json = (body: Parameters<typeof HttpResponse.json>[0], status = 200) =>
  HttpResponse.json(body, { status });

describe('findEndpoint（どの一覧の項目に当たるか）', () => {
  it.each([
    ['GET', '/sessions/s-1', 'GET /sessions/:id'],
    ['POST', '/sessions/s-1/play', 'POST /sessions/:id/play'],
    ['POST', '/sessions/s-1/proposals', 'POST /sessions/:id/proposals'],
    ['POST', '/sessions/s-1/proposals/p-1/approve', 'POST /sessions/:id/proposals/:pid/approve'],
    ['GET', '/scenarios', 'GET /scenarios'],
    ['GET', '/scenarios?x=1', 'GET /scenarios'],
    ['GET', '/scenarios/sc-1', 'GET /scenarios/:id'],
    ['GET', '/scenarios/sc-1/draft', 'GET /scenarios/:id/draft'],
    ['PATCH', '/scenarios/sc-1/draft', 'PATCH /scenarios/:id/draft'],
    ['GET', '/scenario-drafts', 'GET /scenario-drafts'],
  ])('%s %s は %s', (method, path, expected) => {
    const e = findEndpoint(request(method, path));
    expect(e && `${e.method.toUpperCase()} ${e.path}`).toBe(expected);
  });

  it('一覧に無いパス・メソッドは見つからない', () => {
    expect(findEndpoint(request('GET', '/nowhere'))).toBeUndefined();
    expect(findEndpoint(request('PATCH', '/sessions/s-1'))).toBeUndefined();
    expect(findEndpoint(request('PATCH', '/scenarios/sc-1'))).toBeUndefined();
    expect(findEndpoint(request('GET', '/sessions/s-1/extra/more'))).toBeUndefined();
  });
});

describe('checkMockedResponse（1つの応答の誤り）', () => {
  it('一覧どおりの応答は誤りが無い', async () => {
    expect(
      await checkMockedResponse(
        request('GET', '/me'),
        json({ id: 'u', name: 'PL', roles: [], readRules: [], unlockedCardIds: [] }),
      ),
    ).toEqual([]);
  });

  it('一覧に無いパスは誤り', async () => {
    expect(await checkMockedResponse(request('GET', '/nowhere'), json({}))).toEqual([
      'GET /api/nowhere：API の一覧（packages/schemas の api/endpoints.ts）に無い',
    ]);
  });

  it('JSON でない本文は誤り', async () => {
    const [error] = await checkMockedResponse(
      request('GET', '/me'),
      new HttpResponse('<html>', { status: 200 }),
    );
    expect(error).toMatch(/^GET \/me → 200：本文が JSON でない/);
  });

  it('同じパスでメソッドが違う項目の形を返したら誤り（GET /scenarios/:id に保存の応答）', async () => {
    const errors = await checkMockedResponse(
      request('GET', '/scenarios/sc-1'),
      json({ scenario: {}, file: null }),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/^GET \/scenarios\/:id → 200：/);
  });
});

describe('テストの中の応答の検査（setup.ts が組み込む）', () => {
  it('一覧と違う応答を返すと、テストの名前つきで誤りが貯まる', async () => {
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({
          id: 'u',
          name: 'PL',
          roles: [],
          readRules: [],
          unlockedCardIds: [],
          x: 1,
        }),
      ),
    );
    await api.get('/me');
    await settleResponseChecks();
    const errors = takeResponseErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^GET \/me → 200：本文 が一覧の形と違う/);
    expect(errors[0]).toContain('一覧と違う応答を返すと、テストの名前つきで誤りが貯まる');
  });

  it('本文を待たずにテストの本体が進んでも、その応答の誤りはこのテストの分として取り出せる', async () => {
    server.use(http.get('/api/characters', () => HttpResponse.json([{ id: 'only-id' }])));
    const res = await fetch('/api/characters');
    expect(res.status).toBe(200);
    await settleResponseChecks();
    const errors = takeResponseErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.includes('本文を待たずに'))).toBe(true);
  });

  it('一覧に無い状態コードは誤り（GET /me の 404）', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json({ message: '無い' }, { status: 404 })));
    await expect(api.get('/me')).rejects.toMatchObject({ status: 404 });
    await settleResponseChecks();
    expect(takeResponseErrors()[0]).toMatch(/^GET \/me → 404：一覧に無い状態コード/);
  });

  it('応答を待たずに投げっぱなしにしたリクエストも、応答が届くまで待ってこのテストの分にする', async () => {
    server.use(
      http.get('/api/me', async () => {
        await delay(30);
        return HttpResponse.json({ id: 'u', bogus: 1 });
      }),
    );
    void fetch('/api/me');
    await settleResponseChecks();
    const errors = takeResponseErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.includes('投げっぱなしにしたリクエスト'))).toBe(true);
  });
});
