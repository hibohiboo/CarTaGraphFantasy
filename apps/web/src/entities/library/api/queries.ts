// 共有設定の取得。ページからは API のパスを直接触らず、ここを経由する。

import type { LibraryEntry } from '@cartagraph/domain/library/model';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/api';
import { keys } from '@/shared/api/queryKeys';

export const useLibrary = () =>
  useQuery({ queryKey: keys.library, queryFn: () => api.get<LibraryEntry[]>('/library') });
