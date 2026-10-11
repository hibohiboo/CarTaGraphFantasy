// シナリオの取得。ページからは API のパスを直接触らず、ここを経由する。
// シナリオは公開版（GM・PL が使う）と下書き（製作者の書きかけ）に分かれる（docs/cartagraph/scenario-flow.md「シナリオの公開」）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';
import type { ScenarioDraftView } from './types';

/** シナリオ集（載っている公開版）の一覧 */
export const useScenarios = () =>
  useQuery({ queryKey: keys.scenarios, queryFn: () => api.get<Scenario[]>('/scenarios') });

/** 公開版。id が空なら取りに行かない */
export const useScenario = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.scenario(id),
    queryFn: () => api.get<Scenario>(`/scenarios/${id}`),
    enabled: enabled && id !== '',
  });

/** 自分の下書きの一覧（製作者のシナリオ管理） */
export const useScenarioDrafts = () =>
  useQuery({
    queryKey: keys.scenarioDrafts,
    queryFn: () => api.get<ScenarioDraftView[]>('/scenario-drafts'),
  });

/** 下書き（製作者だけ）。製作者でなければ 403 の ApiError（画面は公開版を読み取り専用で見せる） */
export const useScenarioDraft = (id: string) =>
  useQuery({
    queryKey: keys.scenarioDraft(id),
    queryFn: () => api.get<ScenarioDraftView>(`/scenarios/${id}/draft`),
    enabled: id !== '',
  });

/** 下書きの取得の誤りが「製作者でない」か */
export const isNotAuthorError = (error: unknown) =>
  error instanceof ApiError && error.status === 403;
