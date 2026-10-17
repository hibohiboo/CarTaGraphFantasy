// 公開の前の確かめ（docs/plans/2026-10-17-シナリオ製作の導線.md G2、docs/cartagraph/scenario-flow.md「公開の前の確かめ」）。
// 公開を止める誤り（publishErrors）と、止めない注意（publishWarnings）。シナリオ編集とシーン編集の両方が使う純粋関数。

import { z } from 'zod';
import { deadEndNodes } from './deadEnd';
import { walk } from './deck';
import { type ScenarioErrorSection, scenarioContentSections } from './file';
import type { DeckNode, Scenario } from './model';
import { scenarioSchema } from './model';

const EDITABLE_KINDS: DeckNode['kind'][] = ['intro', 'scene', 'ending'];

/** シーン編集で開けるノード：最上位の導入・シーン・結末のノード（デッキの並び順。入れ子・プール用のノードは開けない） */
export const editableSceneNodes = (deck: DeckNode[]): DeckNode[] =>
  deck.filter((n) => EDITABLE_KINDS.includes(n.kind));

/**
 * 導入（kind: 'intro'）から、選択肢カードの nextNodeId を辿って届くノードの id（導入を含む。入れ子も見る）。
 * 選択肢カード以外の nextNodeId は辿らない（deadEndNodes と同じ考え方）。導入が無ければ空
 */
export function reachableNodeIds(deck: DeckNode[]): Set<string> {
  const all = walk(deck);
  const byId = new Map(all.map((n) => [n.id, n]));
  const reached = new Set<string>();
  const queue = all.filter((n) => n.kind === 'intro').map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const c of byId.get(id)?.cards ?? []) {
      if (c.kind === 'choice' && c.nextNodeId) queue.push(c.nextNodeId);
    }
  }
  return reached;
}

/** 導入から届かないシーン・結末のノード（入れ子も含む）。導入とプール用のノードは含めない */
export function unreachableNodes(deck: DeckNode[]): DeckNode[] {
  const reached = reachableNodeIds(deck);
  return walk(deck).filter(
    (n) => (n.kind === 'scene' || n.kind === 'ending') && !reached.has(n.id),
  );
}

/** 導入から届くノードに、結末のノードがあるか */
export function reachesEnding(deck: DeckNode[]): boolean {
  const reached = reachableNodeIds(deck);
  return walk(deck).some((n) => n.kind === 'ending' && reached.has(n.id));
}

export type PublishWarning =
  | { kind: 'deadEnd' | 'unreachable'; node: DeckNode }
  | { kind: 'noSummary' };

/** 公開を止めない注意。並びは行き止まり → 届かない → 概要が空、ノードはデッキの並び順 */
export function publishWarnings(scenario: Scenario): PublishWarning[] {
  return [
    ...deadEndNodes(scenario.deck).map((node) => ({ kind: 'deadEnd' as const, node })),
    ...unreachableNodes(scenario.deck).map((node) => ({ kind: 'unreachable' as const, node })),
    ...(scenario.summary.trim() === '' ? [{ kind: 'noSummary' as const }] : []),
  ];
}

/**
 * 公開を止める誤り。形が通らなければ形の節だけ、通れば参照とシナリオタイプの節を返す。
 * ファイル名と id の検査は画面では要らないので含めない。文面は safeParseScenarioFile と同じ
 */
export function publishErrors(raw: unknown): ScenarioErrorSection[] {
  const parsed = scenarioSchema.safeParse(raw);
  if (!parsed.success)
    return [{ title: '形が誤っている', errors: [z.prettifyError(parsed.error)] }];
  return scenarioContentSections(parsed.data);
}
