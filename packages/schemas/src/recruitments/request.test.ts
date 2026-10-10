// 募集の API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の1〜3、T2）。

import { describe, expect, it } from 'vitest';
import { safeParseBody } from '../body/parse';
import { applyBody, playFromRecruitmentBody, startRecruitmentBody } from './request';

describe('applyBody（POST /recruitments/:id/apply）', () => {
  it('characterId があれば通り、無い・数なら失敗する', () => {
    expect(safeParseBody(applyBody, { characterId: 'pc-1' }).ok).toBe(true);
    for (const raw of [{}, { characterId: 1 }])
      expect(safeParseBody(applyBody, raw)).toEqual({
        ok: false,
        message: '本文の形が正しくありません（characterId）',
      });
  });
});

describe('startRecruitmentBody（POST /recruitments/:id/start）', () => {
  const FORM = '参加させるPCの指定の形が正しくありません';

  it('どの項目も省ける', () => {
    expect(safeParseBody(startRecruitmentBody, {})).toEqual({ ok: true, data: {} });
  });

  it('正しい本文が通る', () => {
    const raw = { characterIds: ['pc-1'], driverCharacterId: 'pc-1', partyName: '一行' };
    expect(safeParseBody(startRecruitmentBody, raw)).toEqual({ ok: true, data: raw });
  });

  it.each<unknown>(['pc-jin', ['pc-jin', 1], null])(
    'characterIds が %o なら参加させるPCの文',
    (v) => {
      expect(safeParseBody(startRecruitmentBody, { characterIds: v })).toEqual({
        ok: false,
        message: FORM,
      });
    },
  );

  it.each([
    ['driverCharacterId', 1],
    ['partyName', 1],
  ])('%s が文字列でなければ失敗する', (key, value) => {
    expect(safeParseBody(startRecruitmentBody, { [key]: value })).toEqual({
      ok: false,
      message: `本文の形が正しくありません（${key}）`,
    });
  });
});

describe('playFromRecruitmentBody（POST /recruitments/:id/play）', () => {
  it('characterId は省ける（無ければ呼び出し側が 404）。数なら失敗する', () => {
    expect(safeParseBody(playFromRecruitmentBody, {})).toEqual({ ok: true, data: {} });
    expect(safeParseBody(playFromRecruitmentBody, { characterId: 1 })).toEqual({
      ok: false,
      message: '本文の形が正しくありません（characterId）',
    });
  });
});
