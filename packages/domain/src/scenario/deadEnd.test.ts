import { describe, expect, it } from 'vitest';
import type { AutoCombatEnemy } from '../autoCombat/model';
import type { CardDef } from '../card/model';
import { deadEndNodes } from './deadEnd';
import { hasAutoCombat } from './deck';
import type { DeckNode } from './model';

const go = (id: string, nextNodeId?: string): CardDef => ({
  id,
  kind: 'choice',
  name: id,
  tags: [],
  ...(nextNodeId && { nextNodeId }),
});
const enemy: AutoCombatEnemy = {
  card: { id: 'en', kind: 'enemy', name: '試験官', tags: [] },
  hp: 10,
  baseActionValue: 10,
  priority: [],
};
const deck: DeckNode[] = [
  { id: 'intro', kind: 'intro', name: '導入', cards: [go('look'), go('to-town', 'town')] },
  {
    id: 'town',
    kind: 'scene',
    name: '街',
    cards: [go('look-around')],
    children: [{ id: 'gate', kind: 'scene', name: '門', cards: [go('to-end', 'end')] }],
  },
  {
    id: 'npc',
    kind: 'npc',
    name: '門番',
    // 選択肢でないカードが移り先を持っていても数えない
    cards: [{ id: 'note', kind: 'info', name: 'メモ', tags: [], nextNodeId: 'end' }],
  },
  {
    id: 'hall',
    kind: 'scene',
    name: '広間',
    cards: [{ id: 'note2', kind: 'info', name: '張り紙', tags: [], nextNodeId: 'end' }],
  },
  { id: 'end', kind: 'ending', name: '旅立ち', cards: [] },
];

describe('deadEndNodes（先へ進む選択肢の無いシーン）', () => {
  it('移り先を持つ選択肢が無い導入・シーンが返る。結末・NPC のノードは返らない', () => {
    expect(deadEndNodes(deck).map((n) => n.id)).toEqual(['town', 'hall']);
  });

  it('移り先を持つ選択肢が1枚でもあれば返らない（移り先の無い選択肢が混ざっていても）', () => {
    expect(deadEndNodes(deck).map((n) => n.id)).not.toContain('intro');
  });

  it('入れ子のシーンも見る（門は結末へ進めるので返らない。入れ子に行き止まりがあれば返る）', () => {
    const nested: DeckNode[] = [
      {
        id: 'town',
        kind: 'scene',
        name: '街',
        cards: [go('to-gate', 'gate')],
        children: [{ id: 'gate', kind: 'scene', name: '門', cards: [] }],
      },
    ];
    expect(deadEndNodes(nested).map((n) => n.id)).toEqual(['gate']);
  });
});

describe('hasAutoCombat（自動戦闘のシーンがあるか）', () => {
  it('自動戦闘のシーン（入れ子も）があれば true、無ければ false', () => {
    expect(hasAutoCombat(deck)).toBe(false);
    expect(
      hasAutoCombat([
        {
          id: 'town',
          kind: 'scene',
          name: '街',
          cards: [],
          children: [
            {
              id: 'exam',
              kind: 'scene',
              name: '試験',
              cards: [],
              autoCombat: { enemy, maxRounds: 20 },
            },
          ],
        },
      ]),
    ).toBe(true);
  });
});
