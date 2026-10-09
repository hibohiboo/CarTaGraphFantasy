// キャラクター作成のルール（rules/character-creation.json）の読み込みと、能力値の配分の判定
// （docs/plans/2026-10-10-ルールとカードプールのJSON管理.md）。

import { describe, expect, it } from 'vitest';
import type { CardDef } from '../card/model';
import {
  abilitiesValid,
  basicPool,
  defaultAbilities,
  loadRules,
  parseCharacterCreationRules,
  pickCards,
} from './creation';

const PATH = '../../../../rules/character-creation.json';
const CARDS_PATH = '../../../../rules/cards.json';

const card = (id: string, o: Partial<CardDef> = {}): CardDef => ({
  id,
  kind: 'item',
  name: id,
  tags: [],
  cpCost: 1,
  ...o,
});
const cards = [card('c-a'), card('c-b', { cpCost: 0 }), card('c-reward', { cpCost: 4 })];

const raw = (o: Record<string, unknown> = {}) => ({
  $comment: '仮ルール',
  basicPoolCardIds: ['c-b', 'c-a'],
  cpBudget: 5,
  abilities: { total: 9, min: 1, max: 5 },
  initialHp: 14,
  ...o,
});
const parse = (o: Record<string, unknown> = {}) => parseCharacterCreationRules(PATH, raw(o), cards);
const abilities = (o: Record<string, unknown>) => ({
  abilities: { total: 9, min: 1, max: 5, ...o },
});

describe('parseCharacterCreationRules', () => {
  it('正しいルールを読める', () => {
    expect(parse()).toEqual(raw());
  });

  it.each([
    ['min == max', abilities({ min: 3, max: 3 })],
    ['total == 3×min', abilities({ total: 3 })],
    ['total == 3×max', abilities({ total: 15 })],
    ['cpBudget = 1', { cpBudget: 1 }],
    ['initialHp = 1', { initialHp: 1 }],
  ])('境界の内側は通る：%s', (_, o) => {
    expect(() => parse(o)).not.toThrow();
  });

  it.each([
    ['min > max', abilities({ min: 4, max: 3, total: 10 })],
    ['total = 3×min − 1', abilities({ min: 2, total: 5 })],
    ['total = 3×max + 1', abilities({ total: 16 })],
    ['min: 0', abilities({ min: 0 })],
    ['cpBudget が整数でない', { cpBudget: 5.5 }],
    ['initialHp が整数でない', { initialHp: 14.5 }],
    ['total が整数でない', abilities({ total: 9.5 })],
    ['min が整数でない', abilities({ min: 1.5 })],
    ['max が整数でない', abilities({ max: 5.5 })],
    ['cpBudget: 0', { cpBudget: 0 }],
    ['initialHp: 0', { initialHp: 0 }],
    ['知らないキー', { initalHp: 14 }],
    ['abilities の知らないキー', abilities({ mx: 5 })],
  ])('止まる（パスつき）：%s', (_, o) => {
    expect(() => parse(o)).toThrow(/rules\/character-creation\.json/);
  });

  it.each(['basicPoolCardIds', 'cpBudget', 'abilities', 'initialHp'])(
    '必須キー %s が欠けたら止まる',
    (key) => {
      const r: Record<string, unknown> = raw();
      delete r[key];
      expect(() => parseCharacterCreationRules(PATH, r, cards)).toThrow(/character-creation\.json/);
    },
  );

  it('基本カードプールが空なら止まる', () => {
    expect(() => parse({ basicPoolCardIds: [] })).toThrow(/基本カードプール.*空/);
  });

  it('基本カードプールの存在しない id は、id つきで止まる', () => {
    expect(() => parse({ basicPoolCardIds: ['c-a', 'c-nope'] })).toThrow(
      /「c-nope」.*カード一覧に無い/,
    );
  });

  it('基本カードプールの id の重複は止まる', () => {
    expect(() => parse({ basicPoolCardIds: ['c-a', 'c-a'] })).toThrow(/「c-a」が重複/);
  });

  it('基本カードプールのカードに CP コストが無い・負・整数でないなら止まる（0 は通る）', () => {
    const noCost = [...cards, card('c-free', { cpCost: undefined })];
    expect(() =>
      parseCharacterCreationRules(PATH, raw({ basicPoolCardIds: ['c-free'] }), noCost),
    ).toThrow(/「c-free」.*CP コスト/);
    const negative = [...cards, card('c-neg', { cpCost: -1 })];
    expect(() =>
      parseCharacterCreationRules(PATH, raw({ basicPoolCardIds: ['c-neg'] }), negative),
    ).toThrow(/「c-neg」.*CP コスト/);
    const fraction = [...cards, card('c-half', { cpCost: 0.5 })];
    expect(() =>
      parseCharacterCreationRules(PATH, raw({ basicPoolCardIds: ['c-half'] }), fraction),
    ).toThrow(/「c-half」.*CP コスト/);
    expect(() => parse({ basicPoolCardIds: ['c-b'] })).not.toThrow();
  });
});

describe('basicPool', () => {
  it('basicPoolCardIds の順にカードを返す（一覧の順ではない）', () => {
    expect(basicPool(parse(), cards).map((c) => c.id)).toEqual(['c-b', 'c-a']);
  });
});

describe('defaultAbilities', () => {
  it.each([
    [
      { total: 9, min: 1, max: 5 },
      { body: 3, skill: 3, mind: 3 },
    ],
    [
      { total: 10, min: 1, max: 5 },
      { body: 4, skill: 3, mind: 3 },
    ],
    [
      { total: 11, min: 1, max: 5 },
      { body: 4, skill: 4, mind: 3 },
    ],
    [
      { total: 7, min: 2, max: 3 },
      { body: 3, skill: 2, mind: 2 },
    ],
  ])('合計 %o を3つにできるだけ均等に配り、余りは体から', (a, expected) => {
    expect(defaultAbilities(a)).toEqual(expected);
    expect(abilitiesValid(expected, a)).toBe(true);
  });
});

describe('abilitiesValid', () => {
  const a = { total: 9, min: 1, max: 5 };
  it('合計がちょうど total で、どれも範囲内なら真', () => {
    expect(abilitiesValid({ body: 5, skill: 3, mind: 1 }, a)).toBe(true);
  });
  it.each([
    ['total − 1', { body: 3, skill: 3, mind: 2 }],
    ['total + 1', { body: 4, skill: 3, mind: 3 }],
  ])('合計が %s なら偽', (_, v) => {
    expect(abilitiesValid(v, a)).toBe(false);
  });
  it.each([
    ['max + 1 を含む', { body: 6, skill: 2, mind: 1 }],
    ['min − 1 を含む', { body: 5, skill: 4, mind: 0 }],
  ])('合計は合うが範囲外（%s）なら偽', (_, v) => {
    expect(abilitiesValid(v, a)).toBe(false);
  });
  it('合計も範囲も合うが、整数でない値を含むなら偽', () => {
    expect(abilitiesValid({ body: 2.5, skill: 3.5, mind: 3 }, a)).toBe(false);
  });
});

describe('pickCards', () => {
  const pool = [card('c-a'), card('c-b')];
  it('id の順に、プールのカードの深い複製を返し、無い id は捨てる', () => {
    const picked = pickCards(pool, ['c-b', 'c-nope', 'c-a']);
    expect(picked.map((c) => c.id)).toEqual(['c-b', 'c-a']);
    expect(picked[0]).toEqual(pool[1]);
    expect(picked[0]).not.toBe(pool[1]);
    expect(picked[0]?.tags).not.toBe(pool[1]?.tags);
  });

  it('同じ id を2回渡すと、別々の複製が2枚', () => {
    const [first, second] = pickCards(pool, ['c-a', 'c-a']);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});

describe('loadRules', () => {
  const rawCards = { cards };
  it('カード一覧と作成のルールを読む', () => {
    const r = loadRules({ cards: [CARDS_PATH, rawCards], creation: [PATH, raw()] });
    expect(r.systemCards.map((c) => c.id)).toEqual(['c-a', 'c-b', 'c-reward']);
    expect(r.characterCreation.cpBudget).toBe(5);
  });
  it('壊れたカード一覧は、そのパスつきで止まる', () => {
    expect(() =>
      loadRules({
        cards: [CARDS_PATH, { cards: [card('c-a'), card('c-a')] }],
        creation: [PATH, raw()],
      }),
    ).toThrow(/rules\/cards\.json/);
  });
  it('壊れた作成のルールは、そのパスつきで止まる', () => {
    expect(() =>
      loadRules({ cards: [CARDS_PATH, rawCards], creation: [PATH, raw({ cpBudget: 0 })] }),
    ).toThrow(/rules\/character-creation\.json/);
  });
});
