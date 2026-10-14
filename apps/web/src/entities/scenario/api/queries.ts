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

/**
 * シナリオの版（セッション・募集が進む版。docs/cartagraph/scenario-flow.md「シナリオの公開」）。版の中身は変わらないので
 * 読み直さない。id が空なら取りに行かない
 */
export const useScenarioVersion = (id: string, version: number) =>
  useQuery({
    queryKey: keys.scenarioVersion(id, version),
    queryFn: () => api.get<Scenario>(`/scenarios/${id}/versions/${version}`),
    enabled: id !== '',
    staleTime: Number.POSITIVE_INFINITY,
  });

/** 自分の下書きの一覧（製作者のシナリオ管理） */
export const useScenarioDrafts = () =>
  useQuery({
    queryKey: keys.scenarioDrafts,
    queryFn: () => api.get<ScenarioDraftView[]>('/scenario-drafts'),
  });

/** 下書き（製作者だけ。製作者でなければ 403） */
export const useScenarioDraft = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.scenarioDraft(id),
    queryFn: () => api.get<ScenarioDraftView>(`/scenarios/${id}/draft`),
    enabled: enabled && id !== '',
  });

/** 編集画面で開くシナリオ。own＝自分の下書き（view あり）、読み取り専用＝製作者でない人に見せる公開版（view なし） */
export type EditableScenario =
  | { status: 'pending' }
  | { status: 'error'; error: unknown }
  | { status: 'own'; view: ScenarioDraftView; sc: Scenario }
  | { status: 'readOnly'; sc: Scenario };

/**
 * 編集画面で開くシナリオ：自分の下書きの一覧にあれば下書き、無ければ公開版（製作者でない人は読むだけ。
 * docs/cartagraph/scenario-flow.md「シナリオの公開」）。先に一覧で見分けるのは、他人のシナリオの下書きを取りに行って
 * 403 を、公開版の無い自分の下書きで公開版を取りに行って 404 を、ブラウザのコンソールに出さないため。
 * 一覧が古い（別のタブで作った直後など）ときは公開版が 404 になるので、そのときは下書きも読みに行く
 */
export function useEditableScenario(id: string): EditableScenario {
  const drafts = useScenarioDrafts();
  const listed = drafts.isSuccess ? drafts.data.some((v) => v.draft.id === id) : undefined;
  const published = useScenario(id, listed === false);
  const notPublished = published.error instanceof ApiError && published.error.status === 404;
  const draft = useScenarioDraft(id, listed === true || notPublished);
  if (drafts.error) return { status: 'error', error: drafts.error };
  // 一覧に無く公開版も無いときに、下書きも読めなければ（他人の下書き・どこにも無い）、公開版の「見つかりません」を出す
  if (notPublished && draft.error) return { status: 'error', error: published.error };
  if (listed === true || notPublished) return ownScenario(draft);
  if (listed === false) return readOnlyScenario(published);
  return { status: 'pending' };
}

function ownScenario(q: { data?: ScenarioDraftView; error: unknown }): EditableScenario {
  if (q.error) return { status: 'error', error: q.error };
  return q.data ? { status: 'own', view: q.data, sc: q.data.draft } : { status: 'pending' };
}

function readOnlyScenario(q: { data?: Scenario; error: unknown }): EditableScenario {
  if (q.error) return { status: 'error', error: q.error };
  return q.data ? { status: 'readOnly', sc: q.data } : { status: 'pending' };
}
