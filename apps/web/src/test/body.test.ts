// MSW のハンドラが本文を読む口（mocks/body.ts。docs/plans/2026-10-10-APIスキーマの共用.md G5・T5）。
// 検査とメッセージそのものは packages/schemas の safeParseBody の単体テストが守る。

import { applyBody, startRecruitmentBody } from '@cartagraph/schemas/recruitments/request';
import { describe, expect, it } from 'vitest';
import { readBody } from '../mocks/body';

const request = (body?: string) =>
  new Request('http://localhost/api/x', { method: 'POST', body, headers: {} });

describe('readBody', () => {
  it('本文の文字列が空なら {} として検査する（本文を付けない api.post(url) の呼び出し）', async () => {
    expect(await readBody(request(), startRecruitmentBody)).toEqual({ ok: true, data: {} });
    expect(await readBody(request(''), startRecruitmentBody)).toEqual({ ok: true, data: {} });
  });

  it('JSON として壊れていれば 422 で、本文そのものの誤りの文', async () => {
    const r = await readBody(request('{'), applyBody);
    if (r.ok) throw new Error('通ってはいけない');
    expect(r.response.status).toBe(422);
    expect(await r.response.json()).toEqual({ message: '本文の形が正しくありません' });
  });

  it('スキーマに合わなければ 422 で、safeParseBody の文', async () => {
    const r = await readBody(request(JSON.stringify({ characterId: 1 })), applyBody);
    if (r.ok) throw new Error('通ってはいけない');
    expect(r.response.status).toBe(422);
    expect(await r.response.json()).toEqual({
      message: '本文の形が正しくありません（characterId）',
    });
  });

  it('合えば検査を通った本文を返す', async () => {
    expect(await readBody(request(JSON.stringify({ characterId: 'pc-1' })), applyBody)).toEqual({
      ok: true,
      data: { characterId: 'pc-1' },
    });
  });
});
