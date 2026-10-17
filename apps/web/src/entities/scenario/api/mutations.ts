// シナリオの変更。保存は下書きだけを変え、公開・公開し直す・非公開は公開版を変えてファイル（scenarios/<id>.json）への
// 書き込みの結果も返す（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md、docs/plans/2026-10-11-シナリオの下書きのAPI.md）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import type { BodyInput } from '@cartagraph/schemas/body/parse';
import type { createScenarioBody } from '@cartagraph/schemas/scenarios/request';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';
import type { ScenarioDraftView, ScenarioSaveResult } from './types';

/** 下書き・公開版・一覧のどれも ['scenarios'] で始まるので、まとめて作り直す */
const refreshScenarios = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ['scenarios'] });

/** 下書きを作る（公開版は作らない） */
export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: BodyInput<typeof createScenarioBody>) =>
      api.post<ScenarioDraftView>('/scenarios', v),
    onSuccess: () => refreshScenarios(qc),
  });
}

/**
 * 公開版のあるシナリオを、自分の下書きとしてコピーする（公開版は作らない）。画面の移動はページ側が行う
 * （一覧を読み直してから移らないと、新しい id の下書きを取りに行って 404 になる）
 */
export function useCopyScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ScenarioDraftView>(`/scenarios/${id}/copy`),
    onSuccess: () => refreshScenarios(qc),
  });
}

/** 下書きを保存する。公開版とファイルは変わらない（公開し直すまで GM・PL に届かない） */
export function useUpdateScenarioDraft() {
  const qc = useQueryClient();
  return useMutation({
    // 本文はシナリオの項目の型で書く（受け取る側が、上書きした結果の形を検査する）
    mutationFn: (v: { id: string; patch: Partial<Scenario> }) =>
      api.patch<ScenarioDraftView>(`/scenarios/${v.id}/draft`, v.patch),
    onSuccess: (r) => {
      qc.setQueryData(keys.scenarioDraft(r.draft.id), r);
      void refreshScenarios(qc);
    },
  });
}

const onPublished = (qc: QueryClient) => (r: ScenarioSaveResult) => {
  qc.setQueryData(keys.scenario(r.scenario.id), r.scenario);
  void refreshScenarios(qc);
};

/** シナリオ集へ公開する・公開し直す（開発サーバーではファイルに書く） */
export function usePublishScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/publish`),
    onSuccess: onPublished(qc),
  });
}

/** シナリオ集から外す（開発サーバーでは、ファイルを残して外した状態で書き直す） */
export function useUnpublishScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/unpublish`),
    onSuccess: onPublished(qc),
  });
}
