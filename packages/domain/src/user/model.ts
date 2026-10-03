// 利用者（docs/cartagraph/graph.md「グラフの利用者とロール別の見え方」）。どこにも依存しない。

/** 利用者ロール（docs/cartagraph/graph.md「グラフの利用者とロール別の見え方」） */
export type UserRole = 'pl' | 'gm' | 'creator' | 'admin';

/** ログインユーザー（バックエンド未実装のためモックで固定） */
export interface CurrentUser {
  id: string;
  name: string;
  roles: UserRole[];
  /** 制作側の学習的アンロック：既読にしたルール（docs/cartagraph/unlock.md） */
  readRules: string[];
  /** 解放済みカードプール（プレイヤー単位。docs/cartagraph/character-growth.md） */
  unlockedCardIds: string[];
}
