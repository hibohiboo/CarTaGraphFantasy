import { walk } from '@cartagraph/domain/scenario/deck';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import { reachesEnding } from '@cartagraph/domain/scenario/readiness';
import type { ScenarioPublication } from '@/entities/scenario/api/types';

export type CreationStepId = 'title' | 'scene' | 'connect' | 'decide' | 'publish';
export type CreationStep = { id: CreationStepId; label: string; done: boolean };

/**
 * 初めて公開するまでの「次にすること」の段。済みは中身から判定する
 * （docs/plans/2026-10-17-シナリオ製作の導線.md D6）。最初の未済みが「次」
 */
export function creationSteps(
  scenario: Scenario,
  publication: ScenarioPublication,
): CreationStep[] {
  return [
    { id: 'title', label: 'タイトルを付ける', done: scenario.title.trim() !== '' },
    {
      id: 'scene',
      label: 'シーンを作る',
      done: walk(scenario.deck).some((n) => n.kind === 'scene'),
    },
    { id: 'connect', label: '選択肢で結末までつなぐ', done: reachesEnding(scenario.deck) },
    { id: 'decide', label: '公開の前に決めること', done: scenario.summary.trim() !== '' },
    { id: 'publish', label: 'シナリオ集へ公開', done: publication !== 'none' },
  ];
}

/** 最初の未済みの段（全部済みなら undefined） */
export const nextStep = (steps: CreationStep[]): CreationStep | undefined =>
  steps.find((st) => !st.done);
