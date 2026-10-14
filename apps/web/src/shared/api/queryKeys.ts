// TanStack Query のクエリキーの一覧。エンティティをまたいでキャッシュを無効化する（例：セッションの操作で
// キャラクターも無効化する）ので、エンティティではなく shared に置く（docs/plans/2026-10-03-webのFSD移行.md）。

export const keys = {
  me: ['me'] as const,
  recruitments: ['recruitments'] as const,
  characters: ['characters'] as const,
  character: (id: string) => ['characters', id] as const,
  cardPool: ['card-pool'] as const,
  sessions: ['sessions'] as const,
  session: (id: string) => ['sessions', id] as const,
  // シナリオの公開版・下書きは、どれも ['scenarios'] で始める（保存・公開の後にまとめて作り直すため）
  scenarios: ['scenarios', 'library'] as const,
  scenario: (id: string) => ['scenarios', 'published', id] as const,
  scenarioVersion: (id: string, version: number) => ['scenarios', id, 'versions', version] as const,
  scenarioDrafts: ['scenarios', 'drafts'] as const,
  scenarioDraft: (id: string) => ['scenarios', 'draft', id] as const,
  library: ['library'] as const,
};
