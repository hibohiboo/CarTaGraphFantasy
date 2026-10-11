// ログインユーザーの zod スキーマ（docs/plans/2026-10-11-APIドキュメント.md T1）。

import { describe, expect, it } from 'vitest';
import { currentUserSchema } from './model';

const me = () => ({
  id: 'u-1',
  name: 'PL',
  roles: ['pl', 'gm'],
  readRules: [],
  unlockedCardIds: ['c-1'],
});

describe('currentUserSchema', () => {
  it('ログインユーザーが通る', () => {
    expect(currentUserSchema.safeParse(me()).success).toBe(true);
  });

  it('知らないキー・列挙の外のロールは落ちる', () => {
    expect(currentUserSchema.safeParse({ ...me(), extra: 1 }).success).toBe(false);
    expect(currentUserSchema.safeParse({ ...me(), roles: ['owner'] }).success).toBe(false);
  });
});
