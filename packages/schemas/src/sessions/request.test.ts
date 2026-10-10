// セッションの API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の6〜12、T2）。

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { type RequestBody, safeParseBody } from '../body/parse';
import {
  approveProposalBody,
  autoCombatBody,
  modeBody,
  narrateBody,
  playCardBody,
  proposeBody,
  rejectProposalBody,
} from './request';

const shape = (key: string) => `本文の形が正しくありません（${key}）`;

describe('必須の文字列を1つ持つ本文', () => {
  it.each<[string, RequestBody<z.ZodType>, string]>([
    ['playCardBody', playCardBody, 'cardId'],
    ['proposeBody', proposeBody, 'text'],
    ['approveProposalBody', approveProposalBody, 'cardName'],
  ])('%s：%s が文字列なら通り、無い・数なら失敗する', (_, body, key) => {
    expect(safeParseBody(body, { [key]: 'x' }).ok).toBe(true);
    for (const raw of [{}, { [key]: 5 }])
      expect(safeParseBody(body, raw)).toEqual({ ok: false, message: shape(key) });
  });
});

describe('approveProposalBody', () => {
  it('nextNodeId は省ける・空文字も通る。数なら移り先の文', () => {
    expect(safeParseBody(approveProposalBody, { cardName: 'a', nextNodeId: '' }).ok).toBe(true);
    expect(safeParseBody(approveProposalBody, { cardName: 'a', nextNodeId: 1 })).toEqual({
      ok: false,
      message: '移り先の指定の形が正しくありません',
    });
  });
});

describe('rejectProposalBody', () => {
  it('reason は省ける（呼び出し側が「理由未記入」にする）。数なら失敗する', () => {
    expect(safeParseBody(rejectProposalBody, {})).toEqual({ ok: true, data: {} });
    expect(safeParseBody(rejectProposalBody, { reason: 5 })).toEqual({
      ok: false,
      message: shape('reason'),
    });
  });
});

describe('narrateBody', () => {
  const FORM = '描写・選択肢の指定の形が正しくありません';

  it('どの項目も省ける。正しい本文が通る', () => {
    expect(safeParseBody(narrateBody, {}).ok).toBe(true);
    const raw = {
      flavor: '扉が開く',
      withdrawCardIds: ['c-a'],
      choices: [{ name: '進む', description: '奥へ', nextNodeId: 'n-2' }, { name: '戻る' }],
    };
    expect(safeParseBody(narrateBody, raw)).toEqual({ ok: true, data: raw });
  });

  it.each<[string, unknown]>([
    ['本文が null', null],
    ['flavor が数', { flavor: 1 }],
    ['withdrawCardIds の要素が数', { withdrawCardIds: [1] }],
    ['choices が配列でない', { choices: 'x' }],
    ['選択肢の name が無い', { choices: [{ description: 'x' }] }],
    ['選択肢の nextNodeId が数', { choices: [{ name: 'a', nextNodeId: 1 }] }],
  ])('%s なら描写の文', (_, raw) => {
    expect(safeParseBody(narrateBody, raw)).toEqual({ ok: false, message: FORM });
  });
});

describe('modeBody', () => {
  it.each(['light', 'dense'])('%s は通る', (mode) => {
    expect(safeParseBody(modeBody, { mode })).toEqual({ ok: true, data: { mode } });
  });
  it.each<unknown>(['x', undefined, 1])('%o は失敗する', (mode) => {
    expect(safeParseBody(modeBody, { mode })).toEqual({ ok: false, message: shape('mode') });
  });
});

describe('autoCombatBody', () => {
  const FORM = '優先順位の行の形が正しくありません（各行はカードIDと使う条件の組）';

  it('priority は省ける（呼び出し側が「1枚以上」を検査する）', () => {
    expect(safeParseBody(autoCombatBody, {})).toEqual({ ok: true, data: {} });
  });

  it('使う条件は文字列なら通す（3種のどれかはドメインの検査が今のメッセージで見る）', () => {
    const raw = { priority: [{ cardId: 'c-a', when: 'sometimes' }] };
    expect(safeParseBody(autoCombatBody, raw)).toEqual({ ok: true, data: raw });
  });

  it.each<[string, unknown]>([
    ['本文が null', null],
    ['priority が配列でない', { priority: 'x' }],
    ['行が null', { priority: [null] }],
    ['cardId が数', { priority: [{ cardId: 1, when: 'always' }] }],
    ['when が無い', { priority: [{ cardId: 'c-a' }] }],
  ])('%s なら行の形の文', (_, raw) => {
    expect(safeParseBody(autoCombatBody, raw)).toEqual({ ok: false, message: FORM });
  });
});
