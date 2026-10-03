// キャラクターの取得。ページからは API のパスを直接触らず、ここを経由する。

import type { Character } from '@cartagraph/domain/character/model';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export const useCharacters = () =>
  useQuery({ queryKey: keys.characters, queryFn: () => api.get<Character[]>('/characters') });

/** id が空なら取りに行かない（プレイ画面で、キャラクターが要らないセッションのとき） */
export const useCharacter = (id: string) =>
  useQuery({
    queryKey: keys.character(id),
    queryFn: () => api.get<Character>(`/characters/${id}`),
    enabled: id !== '',
  });
