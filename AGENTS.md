# CarTaGraphFantasy

進化型カードTRPG「カルタグラフ」の設計仕様書と、その閲覧・セッション管理を行うWebアプリ。
本ファイルはAIコーディングエージェント向けの地図である。Claude Code・Codex・Cursor など、どのエージェント（どのモデル）でも、まずここを読む。
Claude Code は `CLAUDE.md` からこのファイルを読み込む。

## 技術スタック

- TypeScript のみ。pnpm workspace によるモノレポ（Node 24 / pnpm 11）
- `docs/` … VitePress 製の設計仕様書サイト（GitHub Pages で公開）
- `apps/web/` … Vite + React 19 + react-router（Hashルーター）+ TanStack Query + MSW
  - **バックエンドは未実装。** `/api/*` は MSW（Mock Service Worker）が応答し、状態はメモリ上でリロードで消える
- `packages/domain/` … ドメイン型。`docs/` の用語をそのまま型に落としたもの
- テスト … Vitest（`apps/web/src/test/`）。E2E は未導入
- 将来 … AWS + CDK（`infra/`）、Neon Postgres。方針は `docs/architecture/index.md`

## ディレクトリ構成

- `docs/concept/`, `docs/cartagraph/`, `docs/architecture/`, `docs/glossary.md`, `docs/open-questions.md` … 正式仕様（SSOT）
- `docs/interviews/` … 議論ログの一次資料。正式仕様ではない
- `docs/process/` … 開発プロセス（開発サイクル・ルール・依頼文雛形・体制の進化ログ）。**正式仕様の一部**
- `docs/plans/` … プランドキュメント（作業単位の設計書。VitePress のビルド対象外）
- `docs/public/preview/` … HTML/CSS のみのUI試作（役目を終えつつある。参照元として残置）
- `apps/web/src/` … `app/`（ルート一覧・ルーター・シェル）、`pages/`（ロール別ページ）、`components/`、`lib/`（API・クエリ）、`mocks/`（MSW）、`content/`（ルールブック要約）、`styles/`
- `packages/domain/src/` … ドメイン型
- `scripts/` … ビルド補助
- `.claude/` … Claude Code 固有の設定（agents / skills / settings）。手順の本文は `docs/process/` が正

## コマンド

```sh
pnpm web:dev          # http://localhost:5173（MSW 有効）
pnpm web:test         # Vitest（MSW の node サーバーで全ページを描画）
pnpm web:typecheck    # tsc
pnpm docs:dev         # 仕様書サイトをローカルで確認
pnpm docs:build       # 仕様書サイトのビルド（リンク切れがあると失敗する）
pnpm build:pages      # docs + app をまとめてビルド（CI と同じ）
pnpm lint             # Biome（フォーマット・import整理・lintをまとめてチェック）
pnpm lint:fix         # 同上、安全な修正を自動適用
```

コミット前に最低限 `pnpm web:typecheck && pnpm web:test` を通す。`docs/` を触ったら `pnpm docs:build` も通す。

lint・型検査・テスト・docsビルドは、AI にトークンを使わせず git フックで機械的に止める。
- `.githooks/pre-commit` … ステージ済みファイルだけ `biome check --staged --write` を実行し、安全な指摘（フォーマット崩れ等）は自動修正して再ステージする。`--unsafe`が要る指摘（意図的に自動適用しない方針）だけコミットを止める
- `.githooks/pre-push` … push前に `pnpm web:typecheck && pnpm web:test && pnpm docs:build`（CIと同じ3つ）を実行する

`pnpm install` すると `prepare` スクリプトが `git config --local core.hooksPath .githooks` を自動で設定するので、通常は何もしなくてよい。設定されていない場合は手動で同じコマンドを実行する。CI（`.github/workflows/ci.yml`）にも同じ4つのチェックがあり、フック未設定や `--no-verify` の取りこぼしを検出する。

## 開発ルールの適用

ファイルを読む・変更する・レビューするときは、対象パスに一致するルールを先に読む。複数一致した場合はすべて適用する。

| 対象 | 必ず読むルール |
|---|---|
| `apps/**`, `packages/**` | `docs/process/rules/architecture.md` |
| `apps/**/*.test.*`, `apps/web/src/test/**`, `apps/web/src/mocks/**`, テストの追加・変更 | `docs/process/rules/testing.md` |
| push・マージ前、レビュー実行時 | `docs/process/rules/review.md` |
| 機能追加・振る舞いの変更（プラン作成から） | `docs/process/index.md`（開発サイクル） |

## 最重要ルール

1. **ルールと仕様書が矛盾したら止める。** `AGENTS.md`・`docs/process/` に書かれた開発運用ルールと、`docs/` 配下の仕様書（設計仕様・議論ログなど）の内容が矛盾する場合、推測でどちらかを優先して作業を進めてはいけない。作業を止め、矛盾の内容（どのルールと、どの仕様書のどの記述が食い違っているか）を人間に報告し、判断を仰ぐ。
2. **唯一の信頼できる情報源（SSOT）。** 同じ情報を複数箇所に重複して書かず、常にどこか一箇所を正とする。仕様の正は `docs/` 配下の正式ページ（`docs/interviews/` を除く）。議論ログの原文と正式ページが食い違う場合は、原文を優先せず矛盾として報告する。
3. **重複・分散に気づいたら報告する。** 黙って統合・削除せず、その旨を人間に報告する。
4. **プランにない変更は実装しない。** 必要になったら立ち止まって報告する（`docs/process/index.md`）。
5. **改行コードは LF**（Windows でも）。
