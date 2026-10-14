// キャラクターの zod スキーマ（docs/plans/2026-10-11-APIドキュメント.md T1）。

import { describe, expect, it } from 'vitest';
import { characterSchema } from './model';

const character = (): Record<string, unknown> => ({
  id: 'pc-1',
  name: 'PC',
  ownerId: 'u-1',
  ownerName: 'PL',
  abilities: { body: 2, skill: 2, mind: 2 },
  hp: { current: 10, max: 10 },
  baseActionValue: 3,
  deck: [{ id: 'c-1', kind: 'skill', name: 'スキル', tags: [] }],
  titles: [],
  cp: { total: 10, spent: 4 },
  createdAt: '2026-10-11T00:00:00Z',
});

describe('characterSchema', () => {
  it('キャラクターが通る', () => {
    expect(characterSchema.safeParse(character()).success).toBe(true);
  });

  it('知らないキーは、直下でも入れ子（能力値・HP・CP・デッキのカード）でも落ちる', () => {
    expect(characterSchema.safeParse({ ...character(), extra: 1 }).success).toBe(false);
    expect(
      characterSchema.safeParse({
        ...character(),
        abilities: { body: 2, skill: 2, mind: 2, luck: 1 },
      }).success,
    ).toBe(false);
    expect(
      characterSchema.safeParse({ ...character(), hp: { current: 1, max: 1, temp: 1 } }).success,
    ).toBe(false);
    expect(
      characterSchema.safeParse({ ...character(), cp: { total: 1, spent: 0, left: 1 } }).success,
    ).toBe(false);
    expect(
      characterSchema.safeParse({
        ...character(),
        deck: [{ id: 'c-1', kind: 'skill', name: 'スキル', tags: [], x: 1 }],
      }).success,
    ).toBe(false);
  });

  it('能力値のキーが欠けると落ちる', () => {
    expect(
      characterSchema.safeParse({ ...character(), abilities: { body: 2, skill: 2 } }).success,
    ).toBe(false);
  });
});
