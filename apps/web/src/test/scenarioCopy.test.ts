// シナリオのコピーの純粋な関数（docs/plans/2026-10-14-シナリオのコピー.md T3m、
// docs/cartagraph/scenario-flow.md「シナリオのコピー」）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { describe, expect, it } from 'vitest';
import { copyOf } from '../mocks/scenarioCopy';

const me = { id: 'u-me', name: '自分' };
const now = '2026-10-17T00:00:00.000Z';

const source = (extra: Partial<Scenario> = {}): Scenario => ({
  $comment: '元のファイルの注記',
  id: 'sc-parent',
  title: '灰色館',
  authorId: 'u-other',
  authorName: '琴音',
  summary: '概要',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: ['前作'],
  partySize: { min: 2, max: 4 },
  spaceModel: null,
  recommendedCp: 3,
  baseCp: 3,
  proposalHandling: 'gm-required',
  deck: [
    {
      id: 'd-intro',
      kind: 'intro',
      name: '導入',
      cards: [
        {
          id: 'c1',
          kind: 'choice',
          name: '進む',
          tags: [],
          portraitUrl: 'data:image/png;base64,AA',
        },
      ],
    },
    { id: 'd-end', kind: 'ending', name: '結末', cards: [], endingId: 'e1' },
  ],
  endings: [{ id: 'e1', name: '結末', grantsTag: '灰色館を経験', noReplay: true }],
  libraryStatus: 'published',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

const copy = (s: Scenario, version = 2) => copyOf(s, { version, me, id: 'sc-new', now });

describe('copyOf', () => {
  it('id・作者・題名・状態・更新日時・親を差し替え、ほかはそのまま写す（$comment・画像も）', () => {
    const s = source();
    const c = copy(s);
    expect(c).toEqual({
      ...s,
      id: 'sc-new',
      authorId: 'u-me',
      authorName: '自分',
      title: '灰色館のコピー',
      libraryStatus: 'draft',
      updatedAt: now,
      copiedFrom: { scenarioId: 'sc-parent', version: 2 },
    });
    expect(c.$comment).toBe('元のファイルの注記');
    expect(c.deck[0]?.cards[0]?.portraitUrl).toBe('data:image/png;base64,AA');
  });

  it('元のオブジェクトを書き換えない', () => {
    const s = source();
    const before = JSON.stringify(s);
    copy(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('元が既に「…のコピー」なら「…のコピーのコピー」になる', () => {
    expect(copy(source({ title: '灰色館のコピー' })).title).toBe('灰色館のコピーのコピー');
  });

  it.each(['published', 'draft'] as const)(
    '元の libraryStatus が %s でも下書きになる',
    (status) => {
      expect(copy(source({ libraryStatus: status })).libraryStatus).toBe('draft');
    },
  );

  it('元が copiedFrom を持っていても写さず、元のシナリオと版に差し替える', () => {
    const c = copy(source({ copiedFrom: { scenarioId: 'sc-grand', version: 9 } }), 4);
    expect(c.copiedFrom).toEqual({ scenarioId: 'sc-parent', version: 4 });
  });

  it('深く複製する（2回コピーして片方を変えても、もう片方・元は変わらない）', () => {
    const s = source();
    const a = copy(s);
    const b = copy(s);
    a.deck[0]?.cards.push({ id: 'c2', kind: 'choice', name: '足す', tags: [] });
    a.endings[0]!.name = '変えた';
    expect(b.deck[0]?.cards).toHaveLength(1);
    expect(b.endings[0]?.name).toBe('結末');
    expect(s.deck[0]?.cards).toHaveLength(1);
  });
});
