// シナリオの変更。保存・公開・非公開は、ファイル（scenarios/<id>.json）への書き込みの結果も返す
// （docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import type { BodyInput } from '@cartagraph/schemas/body/parse';
import type { createScenarioBody } from '@cartagraph/schemas/scenarios/request';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';
import type { ScenarioSaveResult } from './types';

export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: BodyInput<typeof createScenarioBody>) => api.post<Scenario>('/scenarios', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

const onSaved = (qc: QueryClient) => (r: ScenarioSaveResult) => {
  qc.setQueryData(keys.scenario(r.scenario.id), r.scenario);
  void qc.invalidateQueries({ queryKey: ['scenarios'] });
};

/** 保存。公開・非公開は変えない（usePublishScenario・useUnpublishScenario） */
export function useUpdateScenario() {
  const qc = useQueryClient();
  return useMutation({
    // 下書きの保存の本文はオブジェクトであることだけが検査される（packages/schemas の updateScenarioBody）ので、
    // 送る側はシナリオの項目の型で書く
    mutationFn: (v: { id: string; patch: Partial<Scenario> }) =>
      api.patch<ScenarioSaveResult>(`/scenarios/${v.id}`, v.patch),
    onSuccess: onSaved(qc),
  });
}

/** シナリオ集へ公開する（開発サーバーではファイルに書く） */
export function usePublishScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/publish`),
    onSuccess: onSaved(qc),
  });
}

/** 非公開にする（開発サーバーでは、ファイルを残して下書きで書き直す） */
export function useUnpublishScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/unpublish`),
    onSuccess: onSaved(qc),
  });
}
