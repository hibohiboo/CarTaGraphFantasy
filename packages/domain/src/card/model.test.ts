// カードの zod スキーマ。結末タグのカードが持つ ending（docs/plans/2026-10-14-セッションの独立.md T3d）。

import { describe, expect, it } from 'vitest';
import { cardDefSchema } from './model';

const card = (extra: Record<string, unknown> = {}) => ({
  id: 'c-end',
  kind: 'trait',
  name: '冒険者になった',
  tags: ['冒険者になった'],
  ...extra,
});
const ending = (extra: Record<string, unknown> = {}) => ({
  scenarioId: 'sc-1',
  endingId: 'e-ok',
  endingName: '旅立ち',
  noReplay: true,
  ...extra,
});

describe('cardDefSchema の ending', () => {
  it('ending は省いても通り、結末タグのカードの形も通る', () => {
    expect(cardDefSchema.safeParse(card()).success).toBe(true);
    expect(cardDefSchema.safeParse(card({ ending: ending() })).success).toBe(true);
  });

  it('知らないキー・足りないキー・型違い・空の id は落ちる', () => {
    expect(cardDefSchema.safeParse(card({ ending: ending({ x: 1 }) })).success).toBe(false);
    const { noReplay: _, ...noFlag } = ending();
    expect(cardDefSchema.safeParse(card({ ending: noFlag })).success).toBe(false);
    expect(cardDefSchema.safeParse(card({ ending: ending({ noReplay: 'yes' }) })).success).toBe(
      false,
    );
    expect(cardDefSchema.safeParse(card({ ending: ending({ scenarioId: '' }) })).success).toBe(
      false,
    );
    expect(cardDefSchema.safeParse(card({ ending: null })).success).toBe(false);
  });
});
