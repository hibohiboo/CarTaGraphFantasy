// シナリオの中の参照の整合を検査する（docs/plans/2026-10-03-シナリオのJSON管理.md D5）。
// 形の検査（scenarioSchema）を通った後にかける。scenarios/*.json の読み込みと、公開時の書き込みの前に使う。
//
// findScenarioRefErrors が検査するカードは、ノード（children を含む）直下の cards だけ。成長の効果で得るカード・
// 達成カード・自動戦闘の敵や優先順位のカードは対象にしない（遷移もノード直下の選択肢カードで起きる）。
// シナリオからシステムのカード一覧（rules/cards.json）への参照は findSystemCardRefErrors が見る
// （docs/plans/2026-10-10-ルールとカードプールのJSON管理.md E5）。

import type { CardDef } from '../card/model';
import type { DeckNode, Scenario } from './model';

/** ノードを children まで平らに並べる */
function allNodes(scenario: Scenario): DeckNode[] {
  const nodes: DeckNode[] = [];
  const collect = (list: DeckNode[]) => {
    for (const n of list) {
      nodes.push(n);
      if (n.children) collect(n.children);
    }
  };
  collect(scenario.deck);
  return nodes;
}

/** 参照の誤りを人が読める文で返す。空配列なら整合 */
export function findScenarioRefErrors(scenario: Scenario): string[] {
  const nodes = allNodes(scenario);
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

/**
 * システムのカード一覧への参照の誤り（空配列なら整合）。見るのは次の2つ（E5）。
 * - 成長の効果の gainCardIds が一覧に実在するか
 * - シナリオ固有のカード（ノードのカード・gainCards・達成カード）の id が、システムのカードの id とぶつからないか
 *   （ぶつかると、中身の違う同じ id のカードがデッキに入る）
 * 配る条件・使える条件のカードの id はシナリオ固有のカードも指すので見ない
 */
export function findSystemCardRefErrors(scenario: Scenario, systemCardIds: string[]): string[] {
  const system = new Set(systemCardIds);
  return allNodes(scenario).flatMap((n) => n.cards.flatMap((c) => systemCardErrors(n, c, system)));
}

/** ノードのカード1枚と、その成長の効果の、システムのカード一覧への参照の誤り */
function systemCardErrors(n: DeckNode, c: CardDef, system: Set<string>): string[] {
  const effect = c.soloEffect;
  const own: [CardDef, string][] = [
    [c, `ノード「${n.id}」のカード`],
    ...(effect?.gainCards ?? []).map((g): [CardDef, string] => [
      g,
      `カード「${c.id}」の gainCards のカード`,
    ]),
    ...(effect?.achievement
      ? [[effect.achievement, `カード「${c.id}」の達成カード`] as [CardDef, string]]
      : []),
  ];
  return [
    ...own
      .filter(([card]) => system.has(card.id))
      .map(([card, where]) => `${where}「${card.id}」が、システムのカードと同じ id`),
    ...(effect?.gainCardIds ?? [])
      .filter((id) => !system.has(id))
      .map(
        (id) =>
          `ノード「${n.id}」のカード「${c.id}」の gainCardIds「${id}」が、システムのカード一覧に無い`,
      ),
  ];
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
