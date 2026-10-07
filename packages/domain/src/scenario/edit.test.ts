// シナリオ製作者の編集の操作（docs/plans/2026-10-07-選択肢の移り先と結末の編集.md）。
// scenarios/*.json には children が無いので、テストの中で入れ子のデッキを組み立てる（deck.test.ts と同じ）。

import { describe, expect, it } from 'vitest';
import type { CardDef } from '../card/model';
import {
  addEnding,
  choiceReferrers,
  moveTargets,
  referrerMessage,
  removeEnding,
  removeNode,
  unusedId,
} from './edit';
import type { DeckNode, Scenario } from './model';
import { findScenarioRefErrors } from './refs';

const go = (id: string, nextNodeId?: string, name = id): CardDef => ({
  id,
  kind: 'choice',
  name,
  tags: [],
  ...(nextNodeId && { nextNodeId }),
});

const deck = (): DeckNode[] => [
  { id: 'intro', kind: 'intro', name: '港の酒場', cards: [go('c-go', 'pier', '桟橋へ')] },
  {
    id: 'pier',
    kind: 'scene',
    name: '鎖の桟橋',
    cards: [go('c-stay', 'pier'), go('c-deck', 'deck')],
    children: [
      { id: 'hold', kind: 'scene', name: '船倉', cards: [go('c-up', 'pier')] },
      { id: 'sunk', kind: 'ending', name: '沈む', cards: [], endingId: 'e-sunk' },
    ],
  },
  { id: 'deck', kind: 'scene', name: '甲板', cards: [go('c-win', 'win')] },
  { id: 'npc', kind: 'npc', name: '船長', cards: [] },
  { id: 'info', kind: 'info', name: '航海日誌', cards: [] },
  { id: 'enemy', kind: 'enemy', name: '亡霊', cards: [] },
  { id: 'win', kind: 'ending', name: '勝利', cards: [], endingId: 'e-win' },
];

const scenario = (over: Partial<Scenario> = {}): Scenario => ({
  id: 'sc-x',
  title: 't',
  authorId: 'u-me',
  authorName: 'ユウ',
  summary: '',
  referenceTags: [],
  prerequisiteTags: [],
  partySize: { min: 1, max: 4 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'gm-required',
  deck: deck(),
  endings: [
    { id: 'e-sunk', name: '沈んだ結末' },
    { id: 'e-win', name: '勝った結末', grantsTag: '船を取り戻した' },
  ],
  libraryStatus: 'draft',
  updatedAt: '2026-10-07T00:00:00.000Z',
  ...over,
});

const ids = (nodes: DeckNode[]): string[] => nodes.flatMap((n) => [n.id, ...ids(n.children ?? [])]);

describe('moveTargets', () => {
  it('別のシーンと結末（入れ子を含む）が並び順で入り、導入・プール用・自分自身は入らない', () => {
    expect(moveTargets(deck(), 'intro')).toEqual([
      { id: 'pier', label: 'シーン：鎖の桟橋' },
      { id: 'hold', label: 'シーン：鎖の桟橋 › 船倉' },
      { id: 'sunk', label: '結末：鎖の桟橋 › 沈む' },
      { id: 'deck', label: 'シーン：甲板' },
      { id: 'win', label: '結末：勝利' },
    ]);
    expect(moveTargets(deck(), 'pier').map((t) => t.id)).toEqual(['hold', 'sunk', 'deck', 'win']);
    expect(moveTargets(deck(), 'hold').map((t) => t.id)).toEqual(['pier', 'sunk', 'deck', 'win']);
  });
});

describe('choiceReferrers', () => {
  it('指している選択肢と、そのノードを返す（入れ子の中のカードも）', () => {
    expect(choiceReferrers(deck(), ['pier']).map((r) => [r.node.id, r.card.id])).toEqual([
      ['intro', 'c-go'],
      ['hold', 'c-up'],
    ]);
  });

  it('消すノード（とその子孫）の中から指す選択肢は数えない。外から指していれば数える', () => {
    // pier を消すなら、pier 自身の c-stay と、子の hold の c-up は数えない
    expect(choiceReferrers(deck(), ['pier', 'hold', 'sunk']).map((r) => r.card.id)).toEqual([
      'c-go',
    ]);
    // hold だけを消すなら、hold を指すカードは無い
    expect(choiceReferrers(deck(), ['hold'])).toEqual([]);
  });

  it('指されていなければ空', () => {
    expect(choiceReferrers(deck(), ['npc'])).toEqual([]);
  });
});

describe('removeNode', () => {
  it('指されていなければ、ノードと子孫を消し、引数は変えない', () => {
    const d = deck();
    const r = removeNode(d, 'deck');
    expect(r.ok).toBe(false); // deck は pier の c-deck から指されている
    const free = deck().map((n) =>
      n.id === 'pier' ? { ...n, cards: n.cards.filter((c) => c.id !== 'c-deck') } : n,
    );
    const r2 = removeNode(free, 'deck');
    expect(r2).toEqual({ ok: true, deck: free.filter((n) => n.id !== 'deck') });
    if (r2.ok) expect(findScenarioRefErrors(scenario({ deck: r2.deck }))).toEqual([]);
    expect(ids(free)).toContain('deck');
    expect(ids(d)).toContain('deck');
  });

  it('入れ子のノードも消せ、子孫ごと消える', () => {
    const d = deck().map((n) => (n.id === 'intro' ? { ...n, cards: [] } : n));
    const r = removeNode(d, 'pier');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(ids(r.deck)).toEqual(['intro', 'deck', 'npc', 'info', 'enemy', 'win']);
      // 消した入れ子の結末のノードが指していた結末は残るが、参照は壊れない
      expect(findScenarioRefErrors(scenario({ deck: r.deck }))).toEqual([]);
    }
  });

  it('指されていれば消さず、指している選択肢を返す', () => {
    const r = removeNode(deck(), 'pier');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.referrers.map((x) => x.card.name)).toEqual(['桟橋へ']);
  });
});

describe('addEnding・removeEnding', () => {
  it('addEnding は、結末と、それを指す結末のノードを最後に足す。結末タグは付けない', () => {
    const s = addEnding(scenario(), '引き分け', { endingId: 'e-draw', nodeId: 'n-draw' });
    expect(s.endings.at(-1)).toEqual({ id: 'e-draw', name: '引き分け' });
    expect(s.endings.at(-1)).not.toHaveProperty('grantsTag');
    expect(s.deck.at(-1)).toEqual({
      id: 'n-draw',
      kind: 'ending',
      name: '引き分け',
      cards: [],
      endingId: 'e-draw',
    });
    expect(findScenarioRefErrors(s)).toEqual([]);
  });

  it('removeEnding は、結末と、それを指す結末のノード（入れ子も、複数も）を消し、ほかは残す', () => {
    const base = scenario();
    base.deck.push({
      id: 'win2',
      kind: 'ending',
      name: '勝利（別）',
      cards: [],
      endingId: 'e-win',
    });
    base.deck.push({ id: 'free-end', kind: 'ending', name: 'どれも指さない', cards: [] });
    // win・win2 は移り先でないようにする
    base.deck = base.deck.map((n) => (n.id === 'deck' ? { ...n, cards: [] } : n));
    const r = removeEnding(base, 'e-win');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.scenario.endings.map((e) => e.id)).toEqual(['e-sunk']);
    expect(ids(r.scenario.deck)).not.toContain('win');
    expect(ids(r.scenario.deck)).not.toContain('win2');
    expect(ids(r.scenario.deck)).toContain('free-end');
    expect(ids(r.scenario.deck)).toContain('sunk');
    expect(findScenarioRefErrors(r.scenario)).toEqual([]);
  });

  it('入れ子の結末のノードも消える', () => {
    const r = removeEnding(scenario(), 'e-sunk');
    expect(r.ok).toBe(true);
    if (r.ok) expect(ids(r.scenario.deck)).not.toContain('sunk');
  });

  it('同じ結末を指す結末のノードのどれかが移り先なら、何も消さない（部分的に消さない）', () => {
    const base = scenario();
    base.deck.push({
      id: 'win2',
      kind: 'ending',
      name: '勝利（別）',
      cards: [],
      endingId: 'e-win',
    });
    const r = removeEnding(base, 'e-win');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.referrers.map((x) => x.card.id)).toEqual(['c-win']);
  });

  it('結末のノードを持たない結末は消せる。無い結末 id なら何も変えない', () => {
    const base = scenario({ endings: [...scenario().endings, { id: 'e-tag', name: 'タグだけ' }] });
    const r = removeEnding(base, 'e-tag');
    expect(r.ok && r.scenario.endings.map((e) => e.id)).toEqual(['e-sunk', 'e-win']);
    expect(removeEnding(base, 'e-none')).toEqual({ ok: true, scenario: base });
  });

  it('addEnding → removeEnding で元に戻る', () => {
    const base = scenario();
    const added = addEnding(base, '引き分け', { endingId: 'e-draw', nodeId: 'n-draw' });
    expect(removeEnding(added, 'e-draw')).toEqual({ ok: true, scenario: base });
  });
});

describe('unusedId', () => {
  it('空いていればそのまま、使われていれば -2・-3 と進める', () => {
    expect(unusedId('d-1', () => false)).toBe('d-1');
    const taken = new Set(['d-1', 'd-1-2']);
    expect(unusedId('d-1', (id) => taken.has(id))).toBe('d-1-3');
  });
});

describe('referrerMessage', () => {
  it('選択肢の名前と、それがあるノードの名前を並べる', () => {
    const r = removeNode(deck(), 'pier');
    if (r.ok) throw new Error('止まるはず');
    expect(referrerMessage(r.referrers)).toBe(
      '『桟橋へ』（港の酒場）から指されているので削除できません',
    );
    const r2 = choiceReferrers(deck(), ['pier', 'deck']);
    expect(referrerMessage(r2)).toBe(
      '『桟橋へ』（港の酒場）、『c-up』（船倉）から指されているので削除できません',
    );
  });
});
