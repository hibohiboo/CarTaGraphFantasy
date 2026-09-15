---
name: web-app-react-phase
description: React実装フェーズ（apps/web）の状況。バックエンド未実装でMSWがAPIを代替、GitHub Pagesの/app/配下に同時デプロイ
metadata: 
  node_type: memory
  type: project
  originSessionId: e1e55704-3c05-4d1e-b0bd-78c1c38c4e1c
  modified: 2026-09-15T22:31:41.943Z
---

2026-09-16に、試作フェーズ（[[cartagraph-viewer-site-phase]]）の次として `apps/web`（Vite + React + react-router(Hash) + TanStack Query + MSW）と `packages/domain`（ドメイン型）を追加した。ロール別に全18ルート（PL／GM／シナリオ作成者／ルールブック／管理者）を1回で作った。構成と方針は `docs/architecture/web-app.md` に書いてある（**このフェーズについて聞かれたらまずそこを読む**）。

## 運用上の前提

- **バックエンドはまだ作らない。** `/api/*` は `apps/web/src/mocks/handlers.ts` のMSWが応答し、本番ビルド（GitHub Pages）でもMSWを起動している。状態はメモリ上でリロードで消える。
- デプロイは既存のPagesワークフローで `pnpm run build:pages`（docs→app→`docs/.vitepress/dist/app/`へコピー）。URLは `https://hibohiboo.github.io/CarTaGraphFantasy/app/`。Pagesはサブパス配下のSPAフォールバックが無いためHashルーター。
- ローカルのGit Bashで `WEB_BASE=/CarTaGraphFantasy/app/` を渡すとMSYSがパス変換してしまう。ローカル検証時は `MSYS_NO_PATHCONV=1` を付ける（CIのubuntuでは不要）。
- pnpm 11 は workspace root（vitepressのvite 5）からpeerを解決してvitestがvite 5を掴んだので、`.npmrc` に `resolve-peers-from-workspace-root=false` を置き、vitestは4系にした。
- 長いheredocはBashツール側で切れて壊れるので、大きなファイルはWriteツールで書く（LFで書かれることは確認済み）。

## 仕様との関係で意識すること

- ルールブック本文（`src/content/rulebook.ts`）はdocsの要約で出典リンク付き。docsが正。
- キャラ作成の体・技・心の初期配分は未決（open-questions）のため、アプリでは「合計9を1〜5で配分」の仮ルール。決着したら `CharacterCreatePage.tsx` の `ABILITY_TOTAL` 周辺を直す。
- シーン内のカード編集（シーン構築画面相当）と戦闘画面（1次元／2次元）はまだReact化していない。試作HTML（`docs/public/preview/`）は残してあり、サイトマップから「試作元」として参照している。
