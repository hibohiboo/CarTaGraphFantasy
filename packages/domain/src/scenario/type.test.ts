// シナリオタイプ（docs/cartagraph/scenario-type.md）の表示名と、宣言と中身の食い違いの検査
// （docs/plans/2026-10-10-冒険者だけにする.md C2-T2・C2-T3・C2-T5）。

import { describe, expect, it } from 'vitest';
import type { AutoCombatEnemy } from '../autoCombat/model';
import type { DeckNode, Scenario } from './model';
import { findScenarioRefErrors } from './refs';
import { findScenarioTypeErrors, scenarioTypeLabel } from './type';

const enemy: AutoCombatEnemy = {
  card: { id: 'en', kind: 'enemy', name: '試験官', tags: [] },
  hp: 10,
  baseActionValue: 10,
  priority: [],
};

const examNode: DeckNode = {
  id: 'exam',
  kind: 'scene',
  name: '試験',
  cards: [],
  autoCombat: { enemy, maxRounds: 20 },
};

const scenario = (o: Partial<Scenario> = {}): Scenario => ({
  id: 'sc-x',
  title: 't',
  authorId: 'u',
  authorName: 'n',
  summary: '',
  scenarioType: { noCombat: false, noCheck: false },
  prerequisiteTags: [],
  partySize: { min: 1, max: 1 },
  spaceModel: null,
  recommendedCp: 0,
  baseCp: 0,
  proposalHandling: 'auto-resolve',
  deck: [{ id: 'intro', kind: 'intro', name: '導入', cards: [] }],
  endings: [],
  libraryStatus: 'draft',
  updatedAt: '2026-10-10T00:00:00.000Z',
  ...o,
});

/** 導入の下（children）に自動戦闘のシーンを置いたデッキ */
const nestedExam: DeckNode[] = [
  { id: 'intro', kind: 'intro', name: '導入', cards: [], children: [examNode] },
];

describe('scenarioTypeLabel', () => {
  it.each([
    [{ noCombat: false, noCheck: false }, '冒険'],
    [{ noCombat: true, noCheck: false }, '戦闘なし'],
    [{ noCombat: false, noCheck: true }, '判定なし'],
    [{ noCombat: true, noCheck: true }, '読み物'],
  ])('%o は「%s」', (t, label) => {
    expect(scenarioTypeLabel(t)).toBe(label);
  });
});

describe('findScenarioTypeErrors（宣言と中身の食い違い）', () => {
  it('戦闘なしなのに自動戦闘のシーン（入れ子も）があれば、ノードの id を含む誤り', () => {
    const errors = findScenarioTypeErrors(
      scenario({ scenarioType: { noCombat: true, noCheck: false }, deck: nestedExam }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('戦闘なし');
    expect(errors[0]).toContain('exam');
  });

  it('読み物（戦闘なし・判定なし）でも、自動戦闘のシーンがあれば誤り', () => {
    expect(
      findScenarioTypeErrors(
        scenario({ scenarioType: { noCombat: true, noCheck: true }, deck: nestedExam }),
      ),
    ).toHaveLength(1);
  });

  it.each(['1d', '2d'] as const)('戦闘なしなのに空間モデル %s があれば誤り', (spaceModel) => {
    const errors = findScenarioTypeErrors(
      scenario({ scenarioType: { noCombat: true, noCheck: false }, spaceModel }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('空間モデル');
  });

  it('戦闘なしで、自動戦闘のシーンも空間モデルも持てば、誤りは2つ', () => {
    expect(
      findScenarioTypeErrors(
        scenario({
          scenarioType: { noCombat: true, noCheck: false },
          spaceModel: '2d',
          deck: nestedExam,
        }),
      ),
    ).toHaveLength(2);
  });

  it('判定なしだけなら、自動戦闘のシーンや空間モデルがあっても誤りにしない', () => {
    expect(
      findScenarioTypeErrors(
        scenario({
          scenarioType: { noCombat: false, noCheck: true },
          spaceModel: '1d',
          deck: nestedExam,
        }),
      ),
    ).toEqual([]);
  });

  it('戦闘なしでも、自動戦闘のシーンと空間モデルが無ければ通る', () => {
    expect(
      findScenarioTypeErrors(scenario({ scenarioType: { noCombat: true, noCheck: true } })),
    ).toEqual([]);
  });

  it('冒険なら、自動戦闘のシーンと空間モデルがあっても通る', () => {
    expect(findScenarioTypeErrors(scenario({ spaceModel: '2d', deck: nestedExam }))).toEqual([]);
  });

  it('参照の検査（findScenarioRefErrors）は、タイプの食い違いを見ない', () => {
    // edit.ts の「どの操作も参照を壊さない（findScenarioRefErrors が空のまま）」の約束を保つため（G3）
    expect(
      findScenarioRefErrors(
        scenario({ scenarioType: { noCombat: true, noCheck: false }, deck: nestedExam }),
      ),
    ).toEqual([]);
  });
});
