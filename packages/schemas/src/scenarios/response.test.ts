// 下書きの形の検査（docs/plans/2026-10-11-シナリオの下書きのAPI.md G3・T2）。

import { describe, expect, it } from 'vitest';
import { safeParseScenarioDraft } from './response';

const draft = (): Record<string, unknown> => ({
  id: 'sc-1',
  title: '下書き',
  authorId: 'u-me',
  authorName: 'ユウ',
  summary: '',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  partySize: { min: 1, max: 4 },
  spaceModel: null,
  recommendedCp: 3,
  baseCp: 3,
  proposalHandling: 'gm-required',
  deck: [{ id: 'n-intro', kind: 'intro', name: '導入', cards: [] }],
  endings: [],
  libraryStatus: 'draft',
  updatedAt: '2026-10-11T00:00:00.000Z',
});

describe('safeParseScenarioDraft', () => {
  it('書きかけ（参照の切れた選択肢・再挑戦不可で結末タグの無い結末）も通る', () => {
    const d = draft();
    d.deck = [
      {
        id: 'n-intro',
        kind: 'intro',
        name: '導入',
        cards: [{ id: 'c', kind: 'choice', name: '迷う', tags: [], nextNodeId: 'n-nowhere' }],
      },
    ];
    d.endings = [{ id: 'e', name: '結末', noReplay: true }];
    expect(safeParseScenarioDraft(d).ok).toBe(true);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['知らないキー', { ...draft(), foo: 1 }, '下書きの形が正しくありません（本文）'],
    ['型違い', { ...draft(), title: 123 }, '下書きの形が正しくありません（title）'],
    [
      'null のシナリオタイプ',
      { ...draft(), scenarioType: null },
      '下書きの形が正しくありません（scenarioType）',
    ],
    [
      'カードの中の型違い',
      {
        ...draft(),
        deck: [
          {
            id: 'n',
            kind: 'intro',
            name: '導入',
            cards: [{ id: 'c', kind: 5, name: 'x', tags: [] }],
          },
        ],
      },
      '下書きの形が正しくありません（deck.0.cards.0.kind）',
    ],
  ])('%s は誤りで、文に場所が入る', (_, value, message) => {
    expect(safeParseScenarioDraft(value)).toEqual({ ok: false, message });
  });
});
