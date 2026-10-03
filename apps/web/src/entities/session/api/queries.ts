// セッションと募集（packages/domain と同じく募集はセッションの前段として session に置く）の取得。
// ページからは API のパスを直接触らず、ここを経由する。

import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export const useRecruitments = () =>
  useQuery({ queryKey: keys.recruitments, queryFn: () => api.get<Recruitment[]>('/recruitments') });

export const useSessions = () =>
  useQuery({ queryKey: keys.sessions, queryFn: () => api.get<Session[]>('/sessions') });

export const useSession = (id: string) =>
  useQuery({ queryKey: keys.session(id), queryFn: () => api.get<Session>(`/sessions/${id}`) });
