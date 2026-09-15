---
paths:
  - "apps/**/*.test.*"
  - "apps/web/src/test/**"
  - "apps/web/src/mocks/**"
  - "apps/web/vite.config.ts"
---

# テストルール（種別の切り分けと骨抜き禁止）

## 種別と実行コマンド

| 種別 | ツール | 置き場所 | 実行 | 何を守るか |
|---|---|---|---|---|
| 単体 | Vitest | `apps/web/src/test/`（対象のファイル名を反映。例：`lib/japanese.ts` → `test/japanese.test.ts`） | `pnpm web:test` | ロジックの境界値・異常系 |
| ページ描画 | Vitest + Testing Library + MSW（node） | `apps/web/src/test/pages.test.tsx` | 同上 | 全ルートが描画できること、主要操作が通ること |
| ドメイン | Vitest | `packages/domain/src/**/*.test.ts`（ロジックが入った時点で追加） | 未設定（追加時に整える） | 純粋関数の判定・変換 |
| E2E | 未導入 | — | — | バックエンド着手時に Playwright を検討 |

- `pages.test.tsx` は `app/routes.ts` を走査して全ルートを描画する。ルートを追加すると自動的に対象になるので、ページ固有の操作テストだけを個別に書く
- 型検査（`pnpm web:typecheck`）もテストの一部として扱う。コミット前に必ず通す

## 単体とページ描画の切り分け

ページ描画で検証する：

- ルートが描画できること（h1 が出る、404 にならない）
- ユーザー操作の連なり（ボタンを押す → MSW が応答 → 表示が変わる）
- ロール・モードで表示が変わること

単体で検証する：

- 純粋な計算・整形・バリデーション（外部I/Oなし）
- ページ描画では網羅しにくい細かい分岐（境界値の両側・異常系）

ページ描画のテストがロジックの分岐を全部なぞり始めたら、そのロジックを純粋関数に切り出して単体へ落とす（[アーキテクチャルール](architecture.md)の Functional Core）。

## シードデータ（MSW）

- モックデータの定義は `apps/web/src/mocks/fixtures.ts` の**1箇所**に集約する。テストやページの中で独自のマジック値を作らない
- 各テストの後に `resetDb()` で状態を戻す（`src/test/setup.ts`）。テストは実行順に依存しない
- 変更を伴うテストは、既存のシードを書き換えるのではなく、テストの中で操作して結果を確認し、`resetDb()` に後始末を任せる
- 未処理のリクエストはエラーにする（`onUnhandledRequest: 'error'`）。新しい API を呼ぶなら先に `handlers.ts` へ追加する

## 骨抜き禁止

```ts
// ✖ 何も守っていない
expect(result).toBeDefined();
// ✖ 常時成功モック（本物が壊れても通る）
vi.mock('../lib/format', () => ({ formatDate: () => '2026-09-16' }));
// ✖ 条件付きスキップ（環境がないと黙って成功扱い）
if (!process.env.SOME_FLAG) return;

// ✅ 期待値を固定して assert する。境界の内側と外側を書く
expect(toDictionaryForm('扉を壊してみたい')).toBe('扉を壊す');
expect(toDictionaryForm('扉を破壊する')).toBe('扉を破壊する'); // 変換不要な入力もそのまま
```

- MSW のハンドラをテスト内で常時成功に差し替えない（`fixtures.ts` の状態を通した結合を確かめるのがページ描画テストの仕事）
- `.only` / `.skip` を残したままコミットしない
- 新規テストは先に Red（失敗）を確認してから実装する。最初から通ったら、実装済みか assert が弱いかを判定する

## テストの独立性

- 各テストが自分の QueryClient・ルーターを作り、共有状態を持たない（`renderAt` の型を踏襲する）
- `waitForTimeout` で待たず、`findBy*` やロケータの自動待機を使う
- セレクタは role / label / testid を優先し、CSS Modules のクラス名に依存しない
