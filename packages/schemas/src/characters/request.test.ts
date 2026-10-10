// キャラクターの API の本文（docs/plans/2026-10-10-APIスキーマの共用.md の表の4・5、T2〜T4）。

import { describe, expect, it } from 'vitest';
import { safeParseBody } from '../body/parse';
import { createCharacterBody, updateCharacterBody } from './request';

const abilities = { body: 3, skill: 3, mind: 3 };
const valid = { name: '新人', abilities, cardIds: ['c-a'] };
const ABILITY_MESSAGE = '能力値（体・技・心）を数で送ってください';

describe('createCharacterBody（POST /characters）', () => {
  it('正しい本文が通る', () => {
    expect(safeParseBody(createCharacterBody, valid)).toEqual({ ok: true, data: valid });
  });

  it.each([
    ['name が無い', { abilities, cardIds: [] }, '本文の形が正しくありません（name）'],
    ['name が数', { ...valid, name: 5 }, '本文の形が正しくありません（name）'],
    ['cardIds が無い', { name: 'a', abilities }, '本文の形が正しくありません（cardIds）'],
    ['cardIds が文字列', { ...valid, cardIds: 'c-a' }, '本文の形が正しくありません（cardIds）'],
    [
      'cardIds の要素が数',
      { ...valid, cardIds: ['c-a', 1] },
      '本文の形が正しくありません（cardIds.1）',
    ],
  ])('%s なら失敗する', (_, raw, message) => {
    expect(safeParseBody(createCharacterBody, raw)).toEqual({ ok: false, message });
  });

  it.each<[string, unknown]>([
    ['無い', undefined],
    ['null', null],
    ['文字列', '3,3,3'],
    ['キーが欠ける', { body: 3, skill: 3 }],
    ['数でない値', { ...abilities, mind: '3' }],
  ])('能力値が %s なら、能力値の文で失敗する', (_, value) => {
    expect(safeParseBody(createCharacterBody, { ...valid, abilities: value })).toEqual({
      ok: false,
      message: ABILITY_MESSAGE,
    });
  });

  it('能力値に知らないキーを混ぜても通り、結果に残らない', () => {
    const r = safeParseBody(createCharacterBody, {
      ...valid,
      abilities: { ...abilities, luck: 99 },
    });
    expect(r).toEqual({ ok: true, data: valid });
  });
});

describe('updateCharacterBody（PATCH /characters/:id）', () => {
  const FIXED = '能力値・HP・行動値は、作成したあとで変えられません';

  it('addCardIds だけ・空のオブジェクトなら通る', () => {
    expect(safeParseBody(updateCharacterBody, { addCardIds: ['c-a'] })).toEqual({
      ok: true,
      data: { addCardIds: ['c-a'] },
    });
    expect(safeParseBody(updateCharacterBody, {})).toEqual({ ok: true, data: {} });
  });

  it.each([
    ['abilities', null],
    ['abilities', abilities],
    ['hp', 0],
    ['hp', { current: 1, max: 1 }],
    ['baseActionValue', 0],
  ])('%s のキーがあれば、値（%o）によらず失敗する', (key, value) => {
    expect(safeParseBody(updateCharacterBody, { [key]: value })).toEqual({
      ok: false,
      message: FIXED,
    });
  });

  it('ほかの知らないキーは捨てて通る（反対側）', () => {
    expect(safeParseBody(updateCharacterBody, { addCardIds: [], memo: 'x' })).toEqual({
      ok: true,
      data: { addCardIds: [] },
    });
  });

  it('addCardIds が配列でなければ失敗する', () => {
    expect(safeParseBody(updateCharacterBody, { addCardIds: 'c-a' })).toEqual({
      ok: false,
      message: '本文の形が正しくありません（addCardIds）',
    });
  });
});
