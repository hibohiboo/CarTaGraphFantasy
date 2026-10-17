import { describe, expect, it } from 'vitest';
import type { CardDef } from '../card/model';
import { safeParseScenarioFile, toScenarioFile } from './file';
import type { DeckNode, Scenario } from './model';
import {
  editableSceneNodes,
  publishErrors,
  publishWarnings,
  reachableNodeIds,
  reachesEnding,
  unreachableNodes,
} from './readiness';

const go = (id: string, nextNodeId?: string): CardDef => ({
  id,
  kind: 'choice',
  name: id,
  tags: [],
  ...(nextNodeId && { nextNodeId }),
});
const node = (
  id: string,
  kind: DeckNode['kind'],
  next: string[] = [],
  extra: Partial<DeckNode> = {},
): DeckNode => ({
  id,
  kind,
  name: id,
  cards: next.map((n) => go(`to-${n}`, n)),
  ...extra,
});
const ids = (nodes: DeckNode[]) => nodes.map((n) => n.id);

const scenario = (deck: DeckNode[], o: Partial<Scenario> = {}): Scenario => ({
  id: 'sc-x',
  title: 't',
  authorId: 'u',
  authorName: 'n',
  summary: '概要',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  partySize: { min: 1, max: 1 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'gm-required',
  deck,
  endings: [{ id: 'e1', name: '結末' }],
  libraryStatus: 'draft',
  updatedAt: '2026-10-17T00:00:00.000Z',
  ...o,
});

describe('reachableNodeIds / unreachableNodes（T1）', () => {
  it('導入 → A → 結末の一本道は全部届く。どこからも指されないシーン B は届かない', () => {
    const deck = [
      node('i', 'intro', ['a']),
      node('a', 'scene', ['end']),
      node('b', 'scene'),
      node('end', 'ending', [], { endingId: 'e1' }),
    ];
    expect([...reachableNodeIds(deck)].sort()).toEqual(['a', 'end', 'i']);
    expect(ids(unreachableNodes(deck))).toEqual(['b']);
  });

  it('導入から切れた島（B → C）では、C は指されているが届かない', () => {
    const deck = [node('i', 'intro'), node('b', 'scene', ['c']), node('c', 'scene')];
    expect(ids(unreachableNodes(deck))).toEqual(['b', 'c']);
  });

  it('導入から切れた輪（X → Y → X）では X も Y も届かない', () => {
    const deck = [node('i', 'intro'), node('x', 'scene', ['y']), node('y', 'scene', ['x'])];
    expect(ids(unreachableNodes(deck))).toEqual(['x', 'y']);
  });

  it('輪（導入 → A → B → A）でも止まる', () => {
    const deck = [node('i', 'intro', ['a']), node('a', 'scene', ['b']), node('b', 'scene', ['a'])];
    expect(unreachableNodes(deck)).toEqual([]);
  });

  it('入れ子のノードも、指されていれば届き、指されなければ届かない', () => {
    const deck = [
      node('i', 'intro', ['a']),
      node('a', 'scene', [], {
        children: [node('in1', 'scene', ['in2']), node('in2', 'scene'), node('in3', 'scene')],
      }),
    ];
    // in1 は指されていない（親が届いても子は自動では届かない）
    expect(ids(unreachableNodes(deck))).toEqual(['in1', 'in2', 'in3']);
    const deck2 = [
      node('i', 'intro', ['in1']),
      node('a', 'scene', [], { children: [node('in1', 'scene', ['in2']), node('in2', 'scene')] }),
    ];
    expect(ids(unreachableNodes(deck2))).toEqual(['a']);
  });

  it('選択肢でないカードの nextNodeId は辿らない', () => {
    const info: CardDef = { id: 'n', kind: 'info', name: 'メモ', tags: [], nextNodeId: 'a' };
    const deck = [node('i', 'intro', [], { cards: [info] }), node('a', 'scene')];
    expect(ids(unreachableNodes(deck))).toEqual(['a']);
  });

  it('導入が無いデッキは何も届かない', () => {
    const deck = [node('a', 'scene', ['end']), node('end', 'ending', [], { endingId: 'e1' })];
    expect(reachableNodeIds(deck).size).toBe(0);
    expect(ids(unreachableNodes(deck))).toEqual(['a', 'end']);
  });

  it('届かないプール用のノードは出さず、届かない結末のノードは出す。導入は出ない', () => {
    const deck = [
      node('i', 'intro'),
      node('npc', 'npc'),
      node('inf', 'info'),
      node('en', 'enemy'),
      node('loc', 'location'),
      node('end', 'ending', [], { endingId: 'e1' }),
    ];
    expect(ids(unreachableNodes(deck))).toEqual(['end']);
  });
});

describe('reachesEnding（T2）', () => {
  it('届く結末のノードがあれば真', () => {
    const deck = [node('i', 'intro', ['end']), node('end', 'ending', [], { endingId: 'e1' })];
    expect(reachesEnding(deck)).toBe(true);
  });

  it('結末のノードが届かない所（届かないシーンからしか指されない）にだけあるなら偽', () => {
    const deck = [
      node('i', 'intro'),
      node('b', 'scene', ['end']),
      node('end', 'ending', [], { endingId: 'e1' }),
    ];
    expect(reachesEnding(deck)).toBe(false);
  });

  it('結末のノードが無ければ偽', () => {
    expect(reachesEnding([node('i', 'intro', ['a']), node('a', 'scene')])).toBe(false);
  });
});

describe('publishWarnings（T3）', () => {
  it('行き止まり → 届かない → 概要が空 の順で、ノードはデッキの並び順', () => {
    const deck = [
      node('i', 'intro', ['a']),
      node('b', 'scene'),
      node('a', 'scene'),
      node('end', 'ending', [], { endingId: 'e1' }),
    ];
    const w = publishWarnings(scenario(deck, { summary: '' }));
    expect(w.map((x) => (x.kind === 'noSummary' ? x.kind : `${x.kind}:${x.node.id}`))).toEqual([
      'deadEnd:b',
      'deadEnd:a',
      'unreachable:b',
      'unreachable:end',
      'noSummary',
    ]);
  });

  it('同じノードが行き止まりかつ届かないときは両方出す（deadEnd → unreachable）', () => {
    const w = publishWarnings(
      scenario([node('i', 'intro', ['a']), node('x', 'scene'), node('a', 'scene', ['i'])]),
    );
    expect(w.map((x) => (x.kind === 'noSummary' ? x.kind : `${x.kind}:${x.node.id}`))).toEqual([
      'deadEnd:x',
      'unreachable:x',
    ]);
  });

  it.each(['', '   ', '　　'])('概要が %j なら noSummary', (summary) => {
    const w = publishWarnings(scenario([node('i', 'intro')], { summary }));
    expect(w.some((x) => x.kind === 'noSummary')).toBe(true);
  });

  it('概要が1文字なら noSummary は出ない', () => {
    const w = publishWarnings(scenario([node('i', 'intro', ['i'])], { summary: 'あ' }));
    expect(w).toEqual([]);
  });

  it('カードが0枚のシーンは、それだけでは注意にならない（行き止まりとしては出る）', () => {
    const deck = [node('i', 'intro', ['a']), node('a', 'scene', [], { cards: [] })];
    const w = publishWarnings(scenario(deck));
    expect(w.map((x) => x.kind)).toEqual(['deadEnd']);
  });

  it('プール用のノードは注意にならない', () => {
    const deck = [node('i', 'intro', ['i']), node('npc', 'npc'), node('en', 'enemy')];
    expect(publishWarnings(scenario(deck))).toEqual([]);
  });
});

describe('editableSceneNodes（T4）', () => {
  it('最上位の導入・シーン・結末だけをデッキの並びで返す（入れ子・プール用は返さない）', () => {
    const deck = [
      node('i', 'intro'),
      node('npc', 'npc'),
      node('a', 'scene', [], { children: [node('in', 'scene')] }),
      node('end', 'ending', [], { endingId: 'e1' }),
      node('loc', 'location'),
    ];
    expect(ids(editableSceneNodes(deck))).toEqual(['i', 'a', 'end']);
  });
});

describe('publishErrors（T4）', () => {
  const brokenRef = [node('i', 'intro', ['nowhere'])];

  it('参照の誤りとシナリオタイプの食い違いを節ごとに返す', () => {
    const s = scenario(brokenRef, {
      scenarioType: { noCombat: true, noCheck: false },
      spaceModel: '1d',
    });
    expect(publishErrors(s)).toEqual([
      {
        title: '参照に誤りがある',
        errors: ['カード「to-nowhere」の nextNodeId「nowhere」のノードが無い'],
      },
      {
        title: 'シナリオタイプと中身が食い違っている',
        errors: ['「戦闘なし」なのに、空間モデル「1d」を持っている'],
      },
    ]);
  });

  it('形の誤りは形の節だけを返す', () => {
    const s = { ...scenario([node('i', 'intro', ['nowhere'])]), partySize: { min: 'x', max: 1 } };
    const r = publishErrors(s);
    expect(r).toHaveLength(1);
    expect(r[0]?.title).toBe('形が誤っている');
    expect(r[0]?.errors.join('\n')).toContain('partySize');
  });

  it('誤りの無いシナリオは空', () => {
    expect(publishErrors(scenario([node('i', 'intro')]))).toEqual([]);
  });

  it.each([
    ['誤りなし', scenario([node('i', 'intro')])],
    ['参照の誤り', scenario(brokenRef)],
    [
      'タイプの食い違い',
      scenario([node('i', 'intro')], {
        scenarioType: { noCombat: true, noCheck: false },
        spaceModel: '2d',
      }),
    ],
    ['形の誤り', { ...scenario([node('i', 'intro')]), recommendedCp: 'x' }],
  ])('%s：サーバーの検査と合否と誤りの行が一致する', (_, s) => {
    const server = safeParseScenarioFile('scenarios/sc-x.json', toScenarioFile(s as Scenario));
    const errors = publishErrors(s);
    expect(errors.length === 0).toBe(server.ok);
    if (!server.ok) {
      for (const sec of errors) for (const e of sec.errors) expect(server.message).toContain(e);
    }
  });
});
