// 共有設定の zod スキーマ（docs/plans/2026-10-11-APIドキュメント.md T1）。

import { describe, expect, it } from 'vitest';
import { libraryEntrySchema } from './model';

const entry = () => ({
  id: 'lib-1',
  kind: 'location',
  name: '灰色館',
  description: '',
  tags: [],
  originScenarioTitle: 'シナリオ',
  promotedBy: 'GM',
  promotedAt: '2026-10-11T00:00:00Z',
});

describe('libraryEntrySchema', () => {
  it('共有設定が通る', () => {
    expect(libraryEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it('知らないキー・カード種別の外は落ちる', () => {
    expect(libraryEntrySchema.safeParse({ ...entry(), extra: 1 }).success).toBe(false);
    expect(libraryEntrySchema.safeParse({ ...entry(), kind: 'monster' }).success).toBe(false);
  });
});
