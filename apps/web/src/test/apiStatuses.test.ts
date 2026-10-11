// 一覧に書いた失敗の応答のうち、ほかのテストが一度も返していなかったもの（docs/plans/2026-10-11-APIドキュメント.md T10）。
// 返して、状態コードと本文（{ message }）が一覧どおりかを setup.ts の応答の検査に確かめさせる。
// 2026-10-11 に既存のテストの応答を数えて見つけた11組（存在しない id の 404 が10本と、二重の応募の 409）。

import { describe, expect, it } from 'vitest';
import { ApiError, api } from '@/shared/api/api';

/** 失敗した呼び出しの状態コードと文 */
async function failure(call: Promise<unknown>) {
  try {
    await call;
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, message: e.message };
    throw e;
  }
  throw new Error('成功してしまった');
}

describe('存在しない id は 404（本文は { message }）', () => {
  it.each<[string, () => Promise<unknown>, string]>([
    ['GET /characters/:id', () => api.get('/characters/pc-nowhere'), 'キャラクター'],
    ['GET /sessions/:id', () => api.get('/sessions/s-nowhere'), 'セッション'],
    ['GET /scenarios/:id', () => api.get('/scenarios/sc-nowhere'), 'シナリオ'],
    [
      'PATCH /characters/:id',
      () => api.patch('/characters/pc-nowhere', { addCardIds: [] }),
      'キャラクター',
    ],
    [
      'POST /sessions/:id/proposals',
      () => api.post('/sessions/s-nowhere/proposals', { text: '提案' }),
      'セッション',
    ],
    [
      'POST /sessions/:id/proposals/:pid/approve',
      () => api.post('/sessions/s-nowhere/proposals/p-1/approve', { cardName: 'カード' }),
      'セッション',
    ],
    [
      'POST /sessions/:id/proposals/:pid/reject',
      () => api.post('/sessions/s-nowhere/proposals/p-1/reject', {}),
      'セッション',
    ],
    [
      'POST /sessions/:id/mode',
      () => api.post('/sessions/s-nowhere/mode', { mode: 'light' }),
      'セッション',
    ],
    ['POST /sessions/:id/end', () => api.post('/sessions/s-nowhere/end'), 'セッション'],
    [
      'POST /scenarios/:id/recruitments',
      () => api.post('/scenarios/sc-nowhere/recruitments', { capacity: 2 }),
      'シナリオ',
    ],
  ])('%s', async (_, call, what) => {
    expect(await failure(call())).toEqual({ status: 404, message: `${what} が見つかりません` });
  });
});

describe('二重の応募は 409', () => {
  it('同じ PC で同じ募集に2回応募すると 409', async () => {
    await api.post('/recruitments/rc-1/apply', { characterId: 'pc-jin' });
    expect(await failure(api.post('/recruitments/rc-1/apply', { characterId: 'pc-jin' }))).toEqual({
      status: 409,
      message: 'このPCは応募済みです',
    });
  });
});
