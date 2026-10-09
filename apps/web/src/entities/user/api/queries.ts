// ログインユーザーと解放済みカードプール（プレイヤー単位。docs/glossary.md）の取得。
// ページからは API のパスを直接触らず、ここを経由する。

import type { CardDef } from '@cartagraph/domain/card/model';
import type { CharacterCreationRules } from '@cartagraph/domain/character/model';
import type { CurrentUser } from '@cartagraph/domain/user/model';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api.get<CurrentUser>('/me') });

export const useCardPool = () =>
  useQuery({
    queryKey: keys.cardPool,
    // 能力値の配分のルール（abilities）と作成時の HP（initialHp）もここで返す（キャラクター作成で使う。
    // rules/character-creation.json。どちらも仮ルール）
    queryFn: () =>
      api.get<{
        basic: CardDef[];
        unlocked: CardDef[];
        budget: number;
        abilities: CharacterCreationRules['abilities'];
        initialHp: CharacterCreationRules['initialHp'];
      }>('/card-pool'),
  });
