// シナリオタイプ（docs/cartagraph/scenario-type.md）の表示名と、宣言と中身の食い違いの検査。
// 検査は参照の整合（refs.ts）とは分け、file.ts の safeParseScenarioFile から呼ぶ（読み込み・公開・公開中の保存・
// 開発サーバーの書き込み口が通る。docs/plans/2026-10-10-冒険者だけにする.md G3）。
// 機械で見分けるのは「戦闘なし」なのに自動戦闘のシーンか空間モデルを持つ場合だけ（人間 GM の濃密モードの
// 戦闘のシーンは見分けられないので見ない。docs/notes/scenario-type.md）。

import { walk } from './deck';
import type { Scenario, ScenarioType } from './model';
import { SCENARIO_TYPE_FLAG_LABEL } from './model';

/** 組み合わせの表示名：冒険／戦闘なし／判定なし／読み物 */
export function scenarioTypeLabel(t: ScenarioType): string {
  if (t.noCombat && t.noCheck) return '読み物';
  if (t.noCombat) return SCENARIO_TYPE_FLAG_LABEL.noCombat;
  if (t.noCheck) return SCENARIO_TYPE_FLAG_LABEL.noCheck;
  return '冒険';
}

/** 宣言と中身の食い違いを人が読める文で返す。空配列なら整合 */
export function findScenarioTypeErrors(
  scenario: Pick<Scenario, 'scenarioType' | 'spaceModel' | 'deck'>,
): string[] {
  if (!scenario.scenarioType.noCombat) return [];
  const label = SCENARIO_TYPE_FLAG_LABEL.noCombat;
  const errors = walk(scenario.deck)
    .filter((n) => n.autoCombat)
    .map((n) => `「${label}」なのに、ノード「${n.id}」が自動戦闘のシーンになっている`);
  if (scenario.spaceModel !== null) {
    errors.push(`「${label}」なのに、空間モデル「${scenario.spaceModel}」を持っている`);
  }
  return errors;
}
