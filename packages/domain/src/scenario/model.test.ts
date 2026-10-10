// シナリオの zod スキーマ（docs/plans/2026-10-03-シナリオのJSON管理.md「5. 新規テストケース」）。
// scenarios/*.json を手で直したときの書き間違いを読み込みで止められることを確かめる。

import { describe, expect, it } from 'vitest';
import { scenarioSchema } from './model';

/** 必須項目だけの最小のシナリオ */
const minimal = () => ({
  id: 'sc-min',
  title: '最小',
  authorId: 'u',
  authorName: '作者',
  summary: '',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  partySize: { min: 1, max: 1 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'auto-resolve',
  deck: [{ id: 'n-intro', kind: 'intro', name: '導入', cards: [] }],
  endings: [],
  libraryStatus: 'draft',
  updatedAt: '2026-10-03T00:00:00.000Z',
});

const card = (o: Record<string, unknown> = {}) => ({
  id: 'c',
  kind: 'choice',
  name: 'カード',
  tags: [],
  ...o,
});

// わざと壊すテストのため、壊す側では型を問わない
// biome-ignore lint/suspicious/noExplicitAny: 型に無い値を書き込んで失敗を確かめる
type Json = any;

/** 任意項目をすべて持つシナリオ */
const full = (): Json => ({
  ...minimal(),
  $comment: 'シナリオの注記',
  soloStarter: { hp: 20, baseActionValue: 10, cards: [card({ id: 'c-start', kind: 'skill' })] },
  soloGrowth: { hp: 20, baseActionValue: 10 },
  deck: [
    {
      id: 'n-intro',
      kind: 'intro',
      name: '導入',
      $comment: 'ノードの注記',
      dense: false,
      objective: '目的',
      endCondition: '終了条件',
      cards: [
        card({
          id: 'c-go',
          $comment: 'カードの注記',
          description: '説明',
          cpCost: 1,
          actionCost: 2,
          range: 1,
          check: { ability: 'body', target: 7, onSuccess: '成功', onFailure: '失敗' },
          faceDown: false,
          zone: 'pl',
          portraitUrl: 'https://example.com/a.png',
          combatEffect: { type: 'damage', dice: { count: 1, sides: 4, bonus: 0 } },
          nextNodeId: 'n-scene',
          dealWhen: { hasTags: ['a'], lacksTags: ['b'], lacksCards: ['c'] },
          playWhen: { hasTags: ['攻撃'] },
          soloEffect: {
            raiseAbility: 'mind',
            consumeTag: '引換',
            gainCards: [card({ id: 'c-gain', kind: 'item' })],
            achievement: card({ id: 'c-ach', kind: 'info' }),
          },
        }),
      ],
      children: [{ id: 'n-child', kind: 'npc', name: '子', cards: [] }],
    },
    {
      id: 'n-scene',
      kind: 'scene',
      name: '戦い',
      cards: [],
      autoCombat: {
        maxRounds: 20,
        enemy: {
          $comment: '敵の注記',
          card: card({ id: 'en', kind: 'enemy' }),
          hp: 26,
          baseActionValue: 9,
          priority: [{ card: card({ id: 'ea', kind: 'skill' }), when: 'half' }],
        },
      },
    },
    { id: 'n-end', kind: 'ending', name: '結末', cards: [], endingId: 'e1' },
  ],
  endings: [{ id: 'e1', name: '結末', grantsTag: 'タグ' }],
});

/** full() を壊して parse が失敗することを確かめる */
const failsWhen = (mutate: (s: Json) => void) => {
  const s = full();
  mutate(s);
  return scenarioSchema.safeParse(s).success;
};

describe('scenarioSchema', () => {
  it('必須項目だけの最小のシナリオが通る', () => {
    expect(scenarioSchema.safeParse(minimal()).success).toBe(true);
  });

  it('任意項目をすべて持つシナリオが通り、項目を落とさず足さない', () => {
    const s = full();
    expect(scenarioSchema.parse(s)).toEqual(s);
  });

  it('カード・ノードの kind が列挙に無い値だと失敗する', () => {
    expect(
      failsWhen((s) => {
        s.deck[0].cards[0].kind = 'magic';
      }),
    ).toBe(false);
    expect(
      failsWhen((s) => {
        s.deck[0].kind = 'chapter';
      }),
    ).toBe(false);
  });

  it.each(['id', 'deck', 'endings', 'updatedAt', 'proposalHandling'])(
    '必須項目 %s が無いと失敗する',
    (key) => {
      const s: Record<string, unknown> = minimal();
      delete s[key];
      expect(scenarioSchema.safeParse(s).success).toBe(false);
    },
  );

  // 知らないキー（書き間違い）は黙って捨てずに失敗させる。入れ子・再帰の中でも同じ
  const typo = { nextNodeID: 'x' };
  it.each<[string, (s: Json) => void]>([
    ['シナリオ', (s) => Object.assign(s, typo)],
    ['ノード', (s) => Object.assign(s.deck[0], typo)],
    ['カード', (s) => Object.assign(s.deck[0].cards[0], typo)],
    ['自動戦闘の敵', (s) => Object.assign(s.deck[1].autoCombat.enemy, typo)],
    ['優先順位のカード', (s) => Object.assign(s.deck[1].autoCombat.enemy.priority[0].card, typo)],
    ['成長の効果', (s) => Object.assign(s.deck[0].cards[0].soloEffect, typo)],
    [
      'gainCards の中のカード',
      (s) => Object.assign(s.deck[0].cards[0].soloEffect.gainCards[0], typo),
    ],
    ['達成カード', (s) => Object.assign(s.deck[0].cards[0].soloEffect.achievement, typo)],
    ['children の中のノード', (s) => Object.assign(s.deck[0].children[0], typo)],
  ])('%s に知らないキーがあると失敗する', (_, mutate) => {
    expect(failsWhen(mutate)).toBe(false);
  });

  it.each<[string, (s: Json) => void]>([
    [
      'gainCards の中のカードの kind',
      (s) => Object.assign(s.deck[0].cards[0].soloEffect.gainCards[0], { kind: 'x' }),
    ],
    [
      '達成カードの kind',
      (s) => Object.assign(s.deck[0].cards[0].soloEffect.achievement, { kind: 'x' }),
    ],
    ['children の中のノードの kind', (s) => Object.assign(s.deck[0].children[0], { kind: 'x' })],
    [
      '優先順位の when',
      (s) => Object.assign(s.deck[1].autoCombat.enemy.priority[0], { when: 'never' }),
    ],
  ])('入れ子の中の誤り（%s）も失敗する', (_, mutate) => {
    expect(failsWhen(mutate)).toBe(false);
  });

  it('spaceModel は null を書けるが、キーごと省くと失敗する', () => {
    expect(scenarioSchema.safeParse({ ...minimal(), spaceModel: null }).success).toBe(true);
    expect(scenarioSchema.safeParse({ ...minimal(), spaceModel: '2d' }).success).toBe(true);
    const { spaceModel: _, ...without } = minimal();
    expect(scenarioSchema.safeParse(without).success).toBe(false);
  });

  it('scenarioType は noCombat・noCheck の真偽値を両方持たないと失敗する', () => {
    const typed = (scenarioType: unknown) =>
      scenarioSchema.safeParse({ ...minimal(), scenarioType }).success;
    expect(typed({ noCombat: true, noCheck: true })).toBe(true);
    expect(typed({ noCombat: true })).toBe(false);
    expect(typed({ noCheck: false })).toBe(false);
    expect(typed({ noCombat: 'true', noCheck: false })).toBe(false);
    expect(typed({ noCombat: false, noCheck: false, noDense: true })).toBe(false);
    expect(typed(null)).toBe(false);
    const { scenarioType: _, ...without } = minimal();
    expect(scenarioSchema.safeParse(without).success).toBe(false);
  });

  it('以前の referenceTags（参照するデータ種別のタグ）が残っていると失敗する', () => {
    expect(scenarioSchema.safeParse({ ...minimal(), referenceTags: [] }).success).toBe(false);
  });

  it('省略可能な項目はキーが無ければ通り、null なら失敗する', () => {
    expect(scenarioSchema.safeParse(full()).success).toBe(true);
    expect(
      failsWhen((s) => {
        Object.assign(s.deck[0].cards[0], { description: null });
      }),
    ).toBe(false);
    expect(scenarioSchema.safeParse({ ...minimal(), soloGrowth: null }).success).toBe(false);
  });

  it('id と参照（nextNodeId・endingId）は空文字だと失敗する', () => {
    expect(failsWhen((s) => Object.assign(s, { id: '' }))).toBe(false);
    expect(failsWhen((s) => Object.assign(s.deck[0], { id: '' }))).toBe(false);
    expect(failsWhen((s) => Object.assign(s.deck[0].cards[0], { id: '' }))).toBe(false);
    expect(failsWhen((s) => Object.assign(s.deck[0].cards[0], { nextNodeId: '' }))).toBe(false);
    expect(failsWhen((s) => Object.assign(s.deck[2], { endingId: '' }))).toBe(false);
    expect(failsWhen((s) => Object.assign(s.endings[0], { id: '' }))).toBe(false);
  });

  it('updatedAt は ISO 8601 の日時なら通り、日付だけや不正な文字列なら失敗する', () => {
    expect(
      scenarioSchema.safeParse({ ...minimal(), updatedAt: '2026-09-30T21:00:00+09:00' }).success,
    ).toBe(true);
    expect(
      scenarioSchema.safeParse({ ...minimal(), updatedAt: '2026-09-30T12:34:56.000Z' }).success,
    ).toBe(true);
    expect(scenarioSchema.safeParse({ ...minimal(), updatedAt: '2026-09-30' }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...minimal(), updatedAt: '3日前' }).success).toBe(false);
  });
});
