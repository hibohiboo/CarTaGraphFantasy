// シナリオの取得。ページからは API のパスを直接触らず、ここを経由する。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export const useScenarios = (mine = false) =>
  useQuery({
    queryKey: keys.scenarios(mine),
    queryFn: () => api.get<Scenario[]>(`/scenarios${mine ? '?mine=1' : ''}`),
  });

/** id が空なら取りに行かない */
export const useScenario = (id: string) =>
  useQuery({
    queryKey: keys.scenario(id),
    queryFn: () => api.get<Scenario>(`/scenarios/${id}`),
    enabled: id !== '',
  });
