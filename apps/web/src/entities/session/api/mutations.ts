// セッションと募集の変更。本文の型は、モック・将来のバックエンドと共用するスキーマから引く
// （packages/schemas。docs/plans/2026-10-10-APIスキーマの共用.md D3）。

import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import type { BodyInput } from '@cartagraph/schemas/body/parse';
import type {
  applyBody,
  playFromRecruitmentBody,
  startRecruitmentBody,
} from '@cartagraph/schemas/recruitments/request';
import type { createRecruitmentBody, startSoloBody } from '@cartagraph/schemas/scenarios/request';
import type {
  approveProposalBody,
  autoCombatBody,
  modeBody,
  narrateBody,
  playCardBody,
  proposeBody,
  rejectProposalBody,
} from '@cartagraph/schemas/sessions/request';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

/** 募集を経由しない、GMレスのソロセッションの直接開始（docs/plans/2026-09-23-村スタート冒険者キャンペーン.md C1） */
export function useStartSoloSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { scenarioId: string } & BodyInput<typeof startSoloBody>) =>
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
    mutationFn: ({
      recruitmentId,
      ...body
    }: { recruitmentId: string } & BodyInput<typeof startRecruitmentBody>) =>
      api.post<Session>(`/recruitments/${recruitmentId}/start`, body),
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.recruitments });
      void qc.invalidateQueries({ queryKey: keys.sessions });
    },
  });
}

/**
 * GM 不在の募集から、自分の PC で始める（docs/cartagraph/scenario-flow.md「募集とセッション」）。
 * 募集は受付中のまま残るが、募集の一覧（始まったセッションの件数）を出す画面のために無効化する
 */
export function usePlayFromRecruitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { recruitmentId: string } & BodyInput<typeof playFromRecruitmentBody>) =>
      api.post<Session>(`/recruitments/${v.recruitmentId}/play`, { characterId: v.characterId }),
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.recruitments });
      void qc.invalidateQueries({ queryKey: keys.sessions });
    },
  });
}

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { recruitmentId: string } & BodyInput<typeof applyBody>) =>
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
    mutationFn: (v: { sessionId: string } & BodyInput<typeof playCardBody>) =>
      api.post<Session>(`/sessions/${v.sessionId}/play`, { cardId: v.cardId }),
    onSuccess: (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void qc.invalidateQueries({ queryKey: keys.sessions });
      void qc.invalidateQueries({ queryKey: keys.characters });
    },
  });
}

export const usePropose = () =>
  useSessionMutation((v: { sessionId: string } & BodyInput<typeof proposeBody>) =>
    api.post<Session>(`/sessions/${v.sessionId}/proposals`, { text: v.text }),
  );

/** 移り先（nextNodeId）を付けると、作るカードでそのノードへ進める（docs/cartagraph/play-and-field.md「次のシーンへ進む」） */
export const useApproveProposal = () =>
  useSessionMutation(
    (v: { sessionId: string; proposalId: string } & BodyInput<typeof approveProposalBody>) =>
      api.post<Session>(`/sessions/${v.sessionId}/proposals/${v.proposalId}/approve`, {
        cardName: v.cardName,
        ...(v.nextNodeId && { nextNodeId: v.nextNodeId }),
      }),
  );

/** 中断したセッションを、ドライバーが再開する（docs/cartagraph/party-and-session.md「中断」） */
export const useResume = () =>
  useSessionMutation((v: { sessionId: string }) =>
    api.post<Session>(`/sessions/${v.sessionId}/resume`),
  );

export const useRejectProposal = () =>
  useSessionMutation(
    (v: { sessionId: string; proposalId: string } & BodyInput<typeof rejectProposalBody>) =>
      api.post<Session>(`/sessions/${v.sessionId}/proposals/${v.proposalId}/reject`, {
        reason: v.reason,
      }),
  );

/** 人間GMの進行：描写を書く・選択肢を配る・取り下げる（packages/domain の session/narrate.ts） */
export const useNarrate = () =>
  useSessionMutation(
    ({ sessionId, ...body }: { sessionId: string } & BodyInput<typeof narrateBody>) =>
      api.post<Session>(`/sessions/${sessionId}/narrate`, body),
  );

export const useSetMode = () =>
  useSessionMutation((v: { sessionId: string } & BodyInput<typeof modeBody>) =>
    api.post<Session>(`/sessions/${v.sessionId}/mode`, { mode: v.mode }),
  );

/**
 * 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）を優先順位リストで実行する。
 * 敗北するとキャラクターデッキに「再挑戦の記憶」が加わるため、キャラクターのキャッシュも無効化する
 */
export function useRunAutoCombat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { sessionId: string } & BodyInput<typeof autoCombatBody>) =>
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
    mutationFn: ({
      scenarioId,
      ...body
    }: { scenarioId: string } & BodyInput<typeof createRecruitmentBody>) =>
      api.post<Recruitment>(`/scenarios/${scenarioId}/recruitments`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recruitments }),
  });
}
