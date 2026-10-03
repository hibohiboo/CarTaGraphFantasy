// セッションと募集の変更。

import type { HpCondition } from '@cartagraph/domain/autoCombat/model';
import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

/** 募集を経由しない、GMレスのソロセッションの直接開始（docs/plans/2026-09-23-村スタート冒険者キャンペーン.md C1） */
export function useStartSoloSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { scenarioId: string; name: string }) =>
      api.post<Session>(`/scenarios/${v.scenarioId}/start-solo`, { name: v.name }),
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.sessions });
      void qc.invalidateQueries({ queryKey: keys.characters });
    },
  });
}

/** 募集からセッションを始める（docs/cartagraph/scenario-flow.md「全体フロー」5）。始めた募集は一覧から消える */
export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      recruitmentId: string;
      characterIds: string[];
      driverCharacterId: string;
      partyName: string;
    }) =>
      api.post<Session>(`/recruitments/${v.recruitmentId}/start`, {
        characterIds: v.characterIds,
        driverCharacterId: v.driverCharacterId,
        partyName: v.partyName,
      }),
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.recruitments });
      void qc.invalidateQueries({ queryKey: keys.sessions });
    },
    // 別の画面で先に始められた等で断られたら、一覧を取り直して古いカードを消す
    onError: () => qc.invalidateQueries({ queryKey: keys.recruitments }),
  });
}

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

/**
 * GM不在のソロでは、選んだカードの成長の効果（docs/cartagraph/solo-village.md、仮ルール）で
 * 能力値・デッキが変わるため、キャラクターのキャッシュも無効化する
 */
export function usePlayCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { sessionId: string; cardId: string }) =>
      api.post<Session>(`/sessions/${v.sessionId}/play`, { cardId: v.cardId }),
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.sessions });
      void qc.invalidateQueries({ queryKey: keys.characters });
    },
  });
}

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

/**
 * 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）を優先順位リストで実行する。
 * 敗北するとキャラクターデッキに「再挑戦の記憶」が加わるため、キャラクターのキャッシュも無効化する
 */
export function useRunAutoCombat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { sessionId: string; priority: { cardId: string; when: HpCondition }[] }) =>
      api.post<Session>(`/sessions/${v.sessionId}/auto-combat`, { priority: v.priority }),
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.sessions });
      void qc.invalidateQueries({ queryKey: keys.characters });
    },
  });
}

export const useEndSession = () =>
  useSessionMutation((v: { sessionId: string }) =>
    api.post<Session>(`/sessions/${v.sessionId}/end`),
  );

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
