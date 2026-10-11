// 利用者（docs/cartagraph/graph.md「グラフの利用者とロール別の見え方」）。どこにも依存しない。
// API の応答の型なので zod スキーマが正（方針は card/model.ts の冒頭）。

import { z } from 'zod';

/** 利用者ロール（docs/cartagraph/graph.md「グラフの利用者とロール別の見え方」） */
export const userRoleSchema = z.enum(['pl', 'gm', 'creator', 'admin']);

/** 利用者ロール（docs/cartagraph/graph.md「グラフの利用者とロール別の見え方」） */
export type UserRole = z.infer<typeof userRoleSchema>;

/** ログインユーザー（バックエンド未実装のためモックで固定） */
export const currentUserSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  roles: z.array(userRoleSchema),
  /** 制作側の学習的アンロック：既読にしたルール（docs/cartagraph/unlock.md） */
  readRules: z.array(z.string()),
  /** 解放済みカードプール（プレイヤー単位。docs/cartagraph/character-growth.md） */
  unlockedCardIds: z.array(z.string()),
});

/** ログインユーザー（バックエンド未実装のためモックで固定） */
export type CurrentUser = z.infer<typeof currentUserSchema>;
