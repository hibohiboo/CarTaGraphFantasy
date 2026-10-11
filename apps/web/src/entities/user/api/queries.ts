// ログインユーザーと解放済みカードプール（プレイヤー単位。docs/glossary.md）の取得。
// ページからは API のパスを直接触らず、ここを経由する。

import type { CurrentUser } from '@cartagraph/domain/user/model';
import type { CardPool } from '@cartagraph/schemas/card-pool/response';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api.get<CurrentUser>('/me') });

export const useCardPool = () =>
  useQuery({
    queryKey: keys.cardPool,
    // 能力値の配分のルール（abilities）と作成時の HP・行動値（initialHp・initialBaseActionValue）もここで返す
    // （キャラクター作成・村はずれの一歩の開始画面で使う。rules/character-creation.json。どれも仮ルール）
    // 形の正は packages/schemas の card-pool/response.ts
    queryFn: () => api.get<CardPool>('/card-pool'),
  });
