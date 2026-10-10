// キャラクターの変更。

import type { Character } from '@cartagraph/domain/character/model';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; abilities: Character['abilities']; cardIds: string[] }) =>
      api.post<Character>('/characters', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.characters }),
  });
}

/**
 * チュートリアル用。ステップごとにPCへカードを足す（docs/plans/2026-09-22-チュートリアル導線.md）。
 * 能力値・HP・行動値は作成したときに決まるので、ここでは送らない
 */
export function useUpdateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: { addCardIds: string[] } }) =>
      api.patch<Character>(`/characters/${v.id}`, v.patch),
    onSuccess: (c) => {
      qc.setQueryData(keys.character(c.id), c);
      void qc.invalidateQueries({ queryKey: keys.characters });
    },
  });
}
