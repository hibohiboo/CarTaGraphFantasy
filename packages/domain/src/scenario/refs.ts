// シナリオの中の参照の整合を検査する（docs/plans/2026-10-03-シナリオのJSON管理.md D5）。
// 形の検査（scenarioSchema）を通った後にかける。scenarios/*.json の読み込みと、公開時の書き込みの前に使う。
//
// 検査するカードは、ノード（children を含む）直下の cards だけ。成長の効果で得るカード・達成カード・
// 自動戦闘の敵や優先順位のカードは、キャラクターのカードと同じ id を使うので対象にしない
// （遷移もノード直下の選択肢カードで起きる）。

import type { DeckNode, Scenario } from './index';

/** 参照の誤りを人が読める文で返す。空配列なら整合 */
export function findScenarioRefErrors(scenario: Scenario): string[] {
  const nodes: DeckNode[] = [];
  const collect = (list: DeckNode[]) => {
    for (const n of list) {
      nodes.push(n);
      if (n.children) collect(n.children);
    }
  };
  collect(scenario.deck);

  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const endingIds = new Set(scenario.endings.map((e) => e.id));

  for (const id of duplicates(nodes.map((n) => n.id))) {
    errors.push(`ノード id「${id}」が重複している`);
  }
  for (const id of duplicates(nodes.flatMap((n) => n.cards.map((c) => c.id)))) {
    errors.push(`カード id「${id}」が重複している`);
  }
  for (const id of duplicates(scenario.endings.map((e) => e.id))) {
    errors.push(`結末 id「${id}」が重複している`);
  }
  for (const n of nodes) {
    for (const c of n.cards) {
      if (c.nextNodeId !== undefined && !nodeIds.has(c.nextNodeId)) {
        errors.push(`カード「${c.id}」の nextNodeId「${c.nextNodeId}」のノードが無い`);
      }
    }
    if (n.endingId !== undefined && !endingIds.has(n.endingId)) {
      errors.push(`ノード「${n.id}」の endingId「${n.endingId}」が endings に無い`);
    }
  }
  return errors;
}

/** 2回以上出てくる値（1つずつ） */
function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}
