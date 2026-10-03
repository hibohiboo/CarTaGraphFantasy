// シナリオの変更。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { title: string }) => api.post<Scenario>('/scenarios', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useUpdateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: Partial<Scenario> }) =>
      api.patch<Scenario>(`/scenarios/${v.id}`, v.patch),
    onSuccess: (s) => {
      qc.setQueryData(keys.scenario(s.id), s);
      void qc.invalidateQueries({ queryKey: ['scenarios'] });
    },
  });
}
