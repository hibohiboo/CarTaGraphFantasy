// TanStack Query のフック集。ページからは API のパスを直接触らず、ここを経由する。

import type {
  CardDef,
  Character,
  CurrentUser,
  LibraryEntry,
  Recruitment,
  Scenario,
  Session,
} from '@cartagraph/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const keys = {
  me: ['me'] as const,
  recruitments: ['recruitments'] as const,
  characters: ['characters'] as const,
  character: (id: string) => ['characters', id] as const,
  cardPool: ['card-pool'] as const,
  sessions: ['sessions'] as const,
  session: (id: string) => ['sessions', id] as const,
  scenarios: (mine: boolean) => ['scenarios', { mine }] as const,
  scenario: (id: string) => ['scenarios', id] as const,
  library: ['library'] as const,
};

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api.get<CurrentUser>('/me') });

export const useRecruitments = () =>
  useQuery({ queryKey: keys.recruitments, queryFn: () => api.get<Recruitment[]>('/recruitments') });

export const useCharacters = () =>
  useQuery({ queryKey: keys.characters, queryFn: () => api.get<Character[]>('/characters') });

export const useCharacter = (id: string) =>
  useQuery({
    queryKey: keys.character(id),
    queryFn: () => api.get<Character>(`/characters/${id}`),
  });

export const useCardPool = () =>
  useQuery({
    queryKey: keys.cardPool,
    queryFn: () => api.get<{ basic: CardDef[]; unlocked: CardDef[]; budget: number }>('/card-pool'),
  });

export const useSessions = () =>
  useQuery({ queryKey: keys.sessions, queryFn: () => api.get<Session[]>('/sessions') });

export const useSession = (id: string) =>
  useQuery({ queryKey: keys.session(id), queryFn: () => api.get<Session>(`/sessions/${id}`) });

export const useScenarios = (mine = false) =>
  useQuery({
    queryKey: keys.scenarios(mine),
    queryFn: () => api.get<Scenario[]>(`/scenarios${mine ? '?mine=1' : ''}`),
  });

export const useScenario = (id: string) =>
  useQuery({ queryKey: keys.scenario(id), queryFn: () => api.get<Scenario>(`/scenarios/${id}`) });

export const useLibrary = () =>
  useQuery({ queryKey: keys.library, queryFn: () => api.get<LibraryEntry[]>('/library') });

// ---------- mutations ----------

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { recruitmentId: string; characterId: string }) =>
      api.post<Recruitment>(`/recruitments/${v.recruitmentId}/apply`, {
        characterId: v.characterId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recruitments }),
  });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; abilities?: Character['abilities']; cardIds: string[] }) =>
      api.post<Character>('/characters', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.characters }),
  });
}

/** チュートリアル用。ステップごとにPCへ段階的に反映する（docs/plans/2026-09-22-チュートリアル導線.md） */
export function useUpdateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      id: string;
      patch: { abilities?: Character['abilities']; addCardIds?: string[] };
    }) => api.patch<Character>(`/characters/${v.id}`, v.patch),
    onSuccess: (c) => {
      qc.setQueryData(keys.character(c.id), c);
      void qc.invalidateQueries({ queryKey: keys.characters });
    },
  });
}

/** セッション操作系は、いずれもサーバーが返す最新の Session でキャッシュを置き換える */
function useSessionMutation<V>(fn: (v: V) => Promise<Session>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.sessions });
    },
  });
}

export const usePlayCard = () =>
  useSessionMutation((v: { sessionId: string; cardId: string }) =>
    api.post<Session>(`/sessions/${v.sessionId}/play`, { cardId: v.cardId }),
  );

export const usePropose = () =>
  useSessionMutation((v: { sessionId: string; text: string }) =>
    api.post<Session>(`/sessions/${v.sessionId}/proposals`, { text: v.text }),
  );

export const useApproveProposal = () =>
  useSessionMutation((v: { sessionId: string; proposalId: string; cardName: string }) =>
    api.post<Session>(`/sessions/${v.sessionId}/proposals/${v.proposalId}/approve`, {
      cardName: v.cardName,
    }),
  );

export const useRejectProposal = () =>
  useSessionMutation((v: { sessionId: string; proposalId: string; reason: string }) =>
    api.post<Session>(`/sessions/${v.sessionId}/proposals/${v.proposalId}/reject`, {
      reason: v.reason,
    }),
  );

export const useSetMode = () =>
  useSessionMutation((v: { sessionId: string; mode: Session['mode'] }) =>
    api.post<Session>(`/sessions/${v.sessionId}/mode`, { mode: v.mode }),
  );

export const useEndSession = () =>
  useSessionMutation((v: { sessionId: string }) =>
    api.post<Session>(`/sessions/${v.sessionId}/end`),
  );

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

export function useCreateRecruitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      scenarioId: string;
      capacity: number;
      note?: string;
      excludedNodeIds?: string[];
    }) => api.post<Recruitment>(`/scenarios/${v.scenarioId}/recruitments`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recruitments }),
  });
}
