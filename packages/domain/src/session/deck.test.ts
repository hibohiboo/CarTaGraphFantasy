import { describe, expect, it } from 'vitest';
import type { CardDef } from '../card/model';
import type { DeckNode } from '../scenario/model';
import { excludesFixedNode, sessionDeck } from './deck';
import { planTransition } from './transition';

const choice = (id: string, nextNodeId?: string): CardDef => ({
  id,
  kind: 'choice',
  name: id,
  tags: [],
  nextNodeId,
});
const deck: DeckNode[] = [
  {
    id: 'intro',
    kind: 'intro',
    name: '導入',
    cards: [
      choice('街へ', 'town'),
      choice('森へ', 'forest'),
      choice('井戸へ', 'well'),
      choice('見回す'),
    ],
  },
  {
    id: 'town',
    kind: 'scene',
    name: '街',
    cards: [choice('広場へ', 'square')],
    children: [
      { id: 'square', kind: 'scene', name: '広場', cards: [choice('井戸へ', 'well')] },
      {
        id: 'alley',
        kind: 'scene',
        name: '路地',
        cards: [],
        children: [{ id: 'well', kind: 'scene', name: '井戸', cards: [] }],
      },
    ],
  },
  { id: 'forest', kind: 'scene', name: '森', cards: [] },
  { id: 'end', kind: 'ending', name: '旅立ち', cards: [] },
];
const ids = (nodes: DeckNode[]): string[] => nodes.flatMap((n) => [n.id, ...ids(n.children ?? [])]);
const cardIds = (node: DeckNode) => node.cards.map((c) => c.id);

describe('sessionDeck（GMが外したシーンを除いたデッキ。docs/cartagraph/scenario-flow.md「GMのカスタマイズ」）', () => {
  it('外したシーンが無ければ、元のデッキと同じ内容を返す', () => {
    expect(sessionDeck(deck, [])).toEqual(deck);
  });

  it('最上位のシーンを外すと、そのシーンが無くなり、ほかは残る', () => {
    expect(ids(sessionDeck(deck, ['forest']))).toEqual([
      'intro',
      'town',
      'square',
      'alley',
      'well',
      'end',
    ]);
  });

  it('入れ子のシーンを外すと、その子孫ごと無くなり、親と兄弟は残る', () => {
    expect(ids(sessionDeck(deck, ['alley']))).toEqual(['intro', 'town', 'square', 'forest', 'end']);
  });

  it('外したシーンとその子孫へ進む選択肢カードは無くなり、ほかのシーンへ進むもの・行き先の無いものは残る', () => {
    const d = sessionDeck(deck, ['alley']);
    // well は alley の子孫なので、導入の「井戸へ」も広場の「井戸へ」も無くなる
    expect(cardIds(d[0])).toEqual(['街へ', '森へ', '見回す']);
    expect(cardIds(d[1].children?.[0] as DeckNode)).toEqual([]);
    expect(cardIds(d[1])).toEqual(['広場へ']);
  });

  it('デッキに無い ID を外しても、何も変わらない', () => {
    expect(sessionDeck(deck, ['nowhere'])).toEqual(deck);
  });

  it('元のデッキを書き換えない', () => {
    const before = structuredClone(deck);
    sessionDeck(deck, ['alley', 'forest']);
    expect(deck).toEqual(before);
  });

  it('導入・結末を外す（子孫として巻き込む場合も含む）と excludesFixedNode が真。ほかのシーンだけなら偽', () => {
    expect(excludesFixedNode(deck, ['intro'])).toBe(true);
    expect(excludesFixedNode(deck, ['end'])).toBe(true);
    const nestedEnding: DeckNode[] = [
      { id: 'intro', kind: 'intro', name: '導入', cards: [] },
      {
        id: 'hall',
        kind: 'scene',
        name: '広間',
        cards: [],
        children: [{ id: 'fin', kind: 'ending', name: '結末', cards: [] }],
      },
    ];
    expect(excludesFixedNode(nestedEnding, ['hall'])).toBe(true);
    expect(excludesFixedNode(deck, ['town', 'forest', 'nowhere'])).toBe(false);
  });

  it('外したシーンへは planTransition で進めず、最上位のシーンを外すと総数がその分減る', () => {
    const scenario = { deck: sessionDeck(deck, ['forest']), endings: [] };
    expect(planTransition(scenario, { gmless: false }, 'forest', []).ok).toBe(false);
    const plan = planTransition(scenario, { gmless: false }, 'town', []);
    expect(plan.ok && plan.currentScene.total).toBe(3);
  });
});
