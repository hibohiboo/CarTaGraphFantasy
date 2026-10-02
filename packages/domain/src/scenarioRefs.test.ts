// シナリオの中の参照の整合（docs/plans/2026-10-03-シナリオのJSON管理.md D5）。

import { describe, expect, it } from 'vitest';
import type { CardDef, DeckNode, Scenario } from './index';
import { findScenarioRefErrors } from './scenarioRefs';

const card = (id: string, o: Partial<CardDef> = {}): CardDef => ({
  id,
  kind: 'choice',
  name: id,
  tags: [],
  ...o,
});

const node = (id: string, cards: CardDef[] = [], o: Partial<DeckNode> = {}): DeckNode => ({
  id,
  kind: 'scene',
  name: id,
  cards,
  ...o,
});

const scenario = (deck: DeckNode[], endings: Scenario['endings'] = []): Scenario => ({
  id: 'sc',
  title: 't',
  authorId: 'u',
  authorName: 'n',
  summary: '',
  referenceTags: [],
  prerequisiteTags: [],
  partySize: { min: 1, max: 1 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'auto-resolve',
  deck,
  endings,
  libraryStatus: 'draft',
  updatedAt: '2026-10-03T00:00:00.000Z',
});

describe('findScenarioRefErrors', () => {
  it('整合したシナリオは空配列', () => {
    const s = scenario(
      [
        node('a', [card('go', { nextNodeId: 'b' }), card('stay')]),
        node('b', [], { kind: 'ending', endingId: 'e1' }),
      ],
      [{ id: 'e1', name: '結末' }],
    );
    expect(findScenarioRefErrors(s)).toEqual([]);
  });

  it('deck が空でも空配列', () => {
    expect(findScenarioRefErrors(scenario([]))).toEqual([]);
  });

  it('children の中のノードを指す nextNodeId は整合とみなす', () => {
    const s = scenario([
      node('a', [card('go', { nextNodeId: 'child' })], { children: [node('child')] }),
    ]);
    expect(findScenarioRefErrors(s)).toEqual([]);
  });

  it('endingId を持たない結末ノード、nextNodeId を持たないカードは整合', () => {
    const s = scenario([node('a', [card('x')]), node('end', [], { kind: 'ending' })]);
    expect(findScenarioRefErrors(s)).toEqual([]);
  });

  it('存在しないノードを指す nextNodeId を、カード id と行き先を含めて報告する', () => {
    const s = scenario([node('a', [card('lost', { nextNodeId: 'nowhere' })])]);
    const errors = findScenarioRefErrors(s);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('lost');
    expect(errors[0]).toContain('nowhere');
  });

  it('children の中のノードにあるカードの nextNodeId も検査する', () => {
    const s = scenario([
      node('a', [], { children: [node('child', [card('lost', { nextNodeId: 'nowhere' })])] }),
    ]);
    const errors = findScenarioRefErrors(s);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('lost');
  });

  it('endings に無い endingId を、ノード id と結末 id を含めて報告する', () => {
    const s = scenario(
      [node('end', [], { kind: 'ending', endingId: 'e-x' })],
      [{ id: 'e1', name: '結末' }],
    );
    const errors = findScenarioRefErrors(s);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('end');
    expect(errors[0]).toContain('e-x');
  });

  it('ノード id の重複を、children を含めて報告する', () => {
    expect(findScenarioRefErrors(scenario([node('a'), node('a')]))).toEqual([
      expect.stringContaining('a'),
    ]);
    const nested = findScenarioRefErrors(
      scenario([node('a', [], { children: [node('dup')] }), node('dup')]),
    );
    expect(nested).toHaveLength(1);
    expect(nested[0]).toContain('dup');
  });

  it('カード id の重複を、同じノード内でも別のノードどうしでも報告する', () => {
    const same = findScenarioRefErrors(scenario([node('a', [card('dup'), card('dup')])]));
    expect(same).toHaveLength(1);
    expect(same[0]).toContain('dup');
    const across = findScenarioRefErrors(
      scenario([node('a', [card('dup')]), node('b', [card('dup')])]),
    );
    expect(across).toHaveLength(1);
    expect(across[0]).toContain('dup');
  });

  it('endings の id の重複を報告する', () => {
    const errors = findScenarioRefErrors(
      scenario(
        [],
        [
          { id: 'e1', name: 'A' },
          { id: 'e1', name: 'B' },
        ],
      ),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('e1');
  });

  it('成長の効果で得るカード・達成カード・自動戦闘の敵のカードは、重複も行き先も検査しない', () => {
    const skill = card('c-slash', { kind: 'skill' });
    const s = scenario([
      node('a', [
        skill,
        card('learn', {
          soloEffect: {
            gainCards: [skill, card('g', { nextNodeId: 'nowhere' })],
            achievement: card('c-slash', { nextNodeId: 'nowhere' }),
          },
        }),
      ]),
      node('exam', [], {
        autoCombat: {
          maxRounds: 1,
          enemy: {
            card: card('c-slash', { kind: 'enemy', nextNodeId: 'nowhere' }),
            hp: 1,
            baseActionValue: 1,
            priority: [{ card: card('c-slash', { nextNodeId: 'nowhere' }), when: 'always' }],
          },
        },
      }),
    ]);
    expect(findScenarioRefErrors(s)).toEqual([]);
  });

  it('誤りが複数あれば、すべて報告する', () => {
    const s = scenario([
      node('a', [card('lost', { nextNodeId: 'nowhere' }), card('dup'), card('dup')]),
      node('a', [], { kind: 'ending', endingId: 'e-x' }),
    ]);
    expect(findScenarioRefErrors(s)).toHaveLength(4);
  });
});
