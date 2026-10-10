// シナリオの API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の13〜16、T2）。

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { type RequestBody, safeParseBody } from '../body/parse';
import {
  createRecruitmentBody,
  createScenarioBody,
  startSoloBody,
  updateScenarioBody,
} from './request';

const shape = (key: string) => `本文の形が正しくありません（${key}）`;

describe('必須の文字列を1つ持つ本文', () => {
  it.each<[string, RequestBody<z.ZodType>, string]>([
    ['startSoloBody', startSoloBody, 'name'],
    ['createScenarioBody', createScenarioBody, 'title'],
  ])('%s：%s が文字列なら通り、無い・数なら失敗する', (_, body, key) => {
    expect(safeParseBody(body, { [key]: 'x' }).ok).toBe(true);
    for (const raw of [{}, { [key]: 5 }])
      expect(safeParseBody(body, raw)).toEqual({ ok: false, message: shape(key) });
  });
});

describe('updateScenarioBody（下書きの保存。中身は見ない）', () => {
  const FORM = '本文はオブジェクトにしてください';

  it('オブジェクトなら、中身・知らないキーによらずそのまま通る', () => {
    const raw = { scenarioType: null, deck: 'x', memo: 1 };
    expect(safeParseBody(updateScenarioBody, raw)).toEqual({ ok: true, data: raw });
  });

  it.each<unknown>([null, 5, 'x', []])('%o なら失敗する', (raw) => {
    expect(safeParseBody(updateScenarioBody, raw)).toEqual({ ok: false, message: FORM });
  });
});

describe('createRecruitmentBody（POST /scenarios/:id/recruitments）', () => {
  it('どの項目も省ける。正しい本文が通る', () => {
    expect(safeParseBody(createRecruitmentBody, {}).ok).toBe(true);
    const raw = {
      kind: 'gmless',
      capacity: 2,
      note: 'どうぞ',
      excludedNodeIds: ['n-1'],
      proposalHandling: 'disabled',
    };
    expect(safeParseBody(createRecruitmentBody, raw)).toEqual({ ok: true, data: raw });
  });

  it.each([
    ['kind', 'whatever', '募集の種類は通常か GM 不在のどちらかで指定してください'],
    ['capacity', '3', '募集人数は1以上の整数で指定してください'],
    ['excludedNodeIds', ['n-1', 1], '外すシーンの指定の形が正しくありません'],
    [
      'proposalHandling',
      'auto-resolve',
      '提案の扱いは「GM が後から裁定」か「提案不可」で指定してください',
    ],
    ['note', 1, shape('note')],
  ])('%s が %o なら、その項目の文で失敗する', (key, value, message) => {
    expect(safeParseBody(createRecruitmentBody, { [key]: value })).toEqual({ ok: false, message });
  });
});
