// 「公開の前に決めること」を畳んだときの1行の要約（docs/plans/2026-10-17-シナリオ製作の導線.md T5b）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { describe, expect, it } from 'vitest';
import { scenarioSummaryLine } from '@/pages/creator/scenario-edit/lib/summary';

const base: Scenario = {
  id: 'sc-x',
  title: 't',
  authorId: 'u',
  authorName: 'n',
  summary: '紹介',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  partySize: { min: 2, max: 4 },
  spaceModel: null,
  recommendedCp: 3,
  baseCp: 0,
  proposalHandling: 'gm-required',
  deck: [],
  endings: [],
  libraryStatus: 'draft',
  updatedAt: '2026-10-17T00:00:00.000Z',
};
const line = (o: Partial<Scenario>) => scenarioSummaryLine({ ...base, ...o });

describe('scenarioSummaryLine（T5b）', () => {
  it('冒険・人数の範囲・推奨CP・空間なし', () => {
    expect(line({})).toBe('冒険・2〜4人・推奨CP 3・空間なし');
  });

  it('4つのシナリオタイプ', () => {
    expect(line({ scenarioType: { noCombat: true, noCheck: false } })).toMatch(/^戦闘なし・/);
    expect(line({ scenarioType: { noCombat: false, noCheck: true } })).toMatch(/^判定なし・/);
    expect(line({ scenarioType: { noCombat: true, noCheck: true } })).toMatch(/^読み物・/);
  });

  it('想定人数の下限と上限が同じなら1つの数、違えば範囲', () => {
    expect(line({ partySize: { min: 3, max: 3 } })).toContain('・3人・');
    expect(line({ partySize: { min: 1, max: 4 } })).toContain('・1〜4人・');
  });

  it('空間モデル：なし・1次元・2次元', () => {
    expect(line({ spaceModel: '1d' })).toContain('空間1次元');
    expect(line({ spaceModel: '2d' })).toContain('空間2次元');
    expect(line({ spaceModel: null })).toContain('空間なし');
  });

  it('前提タグは1件以上のときだけ件数を出す', () => {
    expect(line({ prerequisiteTags: [] })).not.toContain('前提タグ');
    expect(line({ prerequisiteTags: ['a', 'b'] })).toContain('前提タグ 2件');
  });

  it('概要が空（空白だけも）なら「概要が未記入」を末尾に足す。書いてあれば足さない', () => {
    expect(line({ summary: '' })).toMatch(/・概要が未記入$/);
    expect(line({ summary: ' 　' })).toMatch(/・概要が未記入$/);
    expect(line({ summary: 'あ' })).not.toContain('未記入');
  });
});
