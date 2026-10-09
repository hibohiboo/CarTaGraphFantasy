// システムのカード一覧（rules/cards.json）の読み込み（docs/plans/2026-10-10-ルールとカードプールのJSON管理.md）。

import { describe, expect, it } from 'vitest';
import { parseSystemCards } from './catalog';

const PATH = '../../../../rules/cards.json';

const card = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  kind: 'item',
  name: id,
  tags: [],
  ...o,
});

describe('parseSystemCards', () => {
  it('正しい一覧を、並びのままカードの列で返す。一番上とカードごとの $comment は通る', () => {
    const raw = {
      $comment: '一覧の注記',
      cards: [card('c-a', { $comment: 'カードの注記', cpCost: 1 }), card('c-b')],
    };
    expect(parseSystemCards(PATH, raw).map((c) => c.id)).toEqual(['c-a', 'c-b']);
  });

  it('知らないキー（打ち間違い）は、パスつきで止まる', () => {
    expect(() => parseSystemCards(PATH, { cards: [card('c-a', { cpCots: 1 })] })).toThrow(
      /rules\/cards\.json.*形が誤っている/s,
    );
    expect(() => parseSystemCards(PATH, { cards: [], coment: 'x' })).toThrow(/rules\/cards\.json/);
  });

  it('cards が無ければ止まる', () => {
    expect(() => parseSystemCards(PATH, { $comment: 'x' })).toThrow(/rules\/cards\.json/);
  });

  it('id の重複は、パスと id つきで止まる', () => {
    expect(() =>
      parseSystemCards(PATH, { cards: [card('c-a'), card('c-b'), card('c-a')] }),
    ).toThrow(/rules\/cards\.json.*「c-a」が重複/s);
  });
});
