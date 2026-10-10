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
- テスト … Vitest（`apps/web/src/test/`、`packages/domain/src/**/*.test.ts`）。E2E は Playwright（`apps/web/e2e/`、CIのみ）
- 将来 … AWS + CDK（`infra/`）、Neon Postgres。方針は `docs/architecture/index.md`

## ディレクトリ構成

- `docs/concept/`, `docs/cartagraph/`, `docs/architecture/`, `docs/glossary.md`, `docs/open-questions.md` … 正式仕様（SSOT）
- `docs/notes/` … デザイナーノート。ゲームの仕様のページと1対1で、決めた理由・経緯・将来の拡張候補を置く。正式仕様ではない（仕様のページとの書き分けは `docs/process/rules/spec-writing.md`）
- `docs/interviews/` … 議論ログの一次資料。正式仕様ではない
- `docs/process/` … 開発プロセス（開発サイクル・ルール・依頼文雛形・体制の進化ログ）。**正式仕様の一部**
- `docs/public/teaser/` … プレイヤー向けのティザー映像（自動再生する HTML 1枚）。作り直すときは版ごとにファイルを分け（`movie-v1.html`・`movie-v2.html` …）、古い版も残す。GitHub Pages の `/CarTaGraphFantasy/teaser/<ファイル名>` で見られる
- `docs/plans/` … プランドキュメント（作業単位の設計書。VitePress のビルド対象外）
- `docs/provisional/` … 仮ルール（決着を待たずに仮に置いたルール）を1仮ルール1ファイルで置く。決めたら消す。トップページのダッシュボードが一覧にする（書き方は `docs/provisional/index.md`）
- `docs/backlog/` … 要望（PBI）を1要望1ファイルで置く。先頭の状態・判断待ちから、トップページのダッシュボードをビルド時に組み立てる（`docs/.vitepress/*.data.ts`）
- `docs/public/preview/` … HTML/CSS のみのUI試作。未React化の画面だけを残し、React 化したら削除する（`docs/architecture/web-app.md`「未React化の画面」）
- `apps/`・`packages/`・`scenarios/`・`rules/`・`scripts/` … コード（`rules/` はシステム製作者のルールの JSON）。ディレクトリ構成と依存の向きは `docs/process/rules/architecture.md`「構造」「依存の向き」が正（ここには書き写さない）
- `.claude/` … Claude Code 固有の設定。中身と決まりは `CLAUDE.md` に書く（ここには書かない）。手順の本文は `docs/process/` が正

## コマンド

```sh
pnpm web:dev          # http://localhost:5173（MSW 有効）。人間が手で起動する用
pnpm web:dev:agent    # http://localhost:5174。エージェントがブラウザで確かめる用（人間の開発サーバーと取り合わない。公開したシナリオを scenarios/ に書かない）
pnpm web:dev:agent:stop # 上の開発サーバーと、エージェントの preview（4174 番の vite preview）を止める。ほかのプロセスには触らない
pnpm web:check:publish # 開発サーバーでのシナリオの公開をブラウザで通しで確かめる（書き込みを開いた web:dev:agent が要る。CIでは回さない）
pnpm web:check:authoring # 画面だけでシナリオを作り GM 不在で結末まで遊べるかをブラウザで通しで確かめる（web:dev:agent が要る。CIでは回さない）
pnpm web:check:character # キャラクター作成と村はずれの一歩のお店が rules/ のルールどおりかをブラウザで通しで確かめる（web:dev:agent が要る。CIでは回さない）
pnpm web:test         # Vitest（MSW の node サーバーで全ページを描画）
pnpm web:typecheck    # tsc
pnpm domain:test      # Vitest（packages/domain の純粋関数）
pnpm tools:test       # node --test（scripts/ と .claude/hooks/ の補助スクリプト）
pnpm domain:typecheck # tsc（packages/domain。テストファイルも含む）
pnpm sim:auto-combat  # 自動戦闘のシミュレーションを回し docs/cartagraph/auto-combat-simulation.md を作り直す（任意。CIでは回さない）
pnpm docs:dev         # 仕様書サイトをローカルで確認
pnpm docs:build       # 仕様書サイトのビルド（リンク切れ・見出しへのリンクの食い違い・用語の旧称（scripts/check-terms.mjs）・画面一覧とルート定義の食い違い（scripts/check-screens.mjs）・正式仕様のページにある実装のパス（scripts/check-spec-paths.mjs）・仮ルールの一覧と仕様ページの「仮」の印の食い違い（scripts/check-provisional.mjs）・下の「開発ルールの適用」の表や .claude/rules/ とルールのページの paths の食い違い（scripts/sync-claude-rules.mjs --check）があると失敗する）
pnpm build:pages      # docs + app をまとめてビルド（CI と同じ）
pnpm lint             # Biome（フォーマット・import整理・lintをまとめてチェック）
pnpm lint:fix         # 同上、安全な修正を自動適用
node scripts/replace-once.mjs <spec.json>  # ファイルの文字列を置き換える。件数（既定1件・count で指定）と二重の当たりを確かめてから書く
node scripts/mutate-check.mjs <spec.json>  # 守る条件を1つずつ外し、テストが落ちることを確かめて元に戻す（testing.md「骨抜き禁止」）
node scripts/sync-claude-rules.mjs          # ルールのページの frontmatter の paths から .claude/rules/ の入口ファイルを作り直す
```

コミット前に最低限 `pnpm web:typecheck && pnpm web:test` を通す。`packages/domain` を触ったら `pnpm domain:typecheck && pnpm domain:test` も通す。`docs/` を触ったら `pnpm docs:build` も通す。`scripts/`・`.claude/hooks/` を触ったら `pnpm tools:test` も通す。`scenarios/`・`rules/` を触ったら `pnpm web:test` が通ることを確かめる（形・参照の整合の検査と、シナリオ・ルールを使うテストが走る。pre-push でも走る）。

lint・型検査・テスト・docsビルドは、AI にトークンを使わせず git フックで機械的に止める。
- `.githooks/pre-commit` … ステージ済みファイルだけ `biome check --staged --write` を実行し、安全な指摘（フォーマット崩れ等）は自動修正して再ステージする。`--unsafe`が要る指摘（意図的に自動適用しない方針）だけコミットを止める
- `.githooks/commit-msg` … 進め方に関わるファイル（ルール・`AGENTS.md`・`CLAUDE.md`・`.claude/`・git フック・CI・検査のスクリプトなど。範囲は `scripts/check-evolution-log.mjs`）を変えたのに、体制の進化ログ（`docs/process/evolution.md`）が変わっていないコミットを止める。記録が要らない変更は、コミットメッセージに `進化ログ不要: <理由>` の行を書く
- `.githooks/pre-push` … push前に `pnpm web:typecheck && pnpm domain:typecheck && pnpm domain:test && pnpm web:test && pnpm tools:test && pnpm docs:build`（CIと同じ）を実行する

`pnpm install` すると `prepare` スクリプトが `git config --local core.hooksPath .githooks` を自動で設定するので、通常は何もしなくてよい。設定されていない場合は手動で同じコマンドを実行する。CI（`.github/workflows/ci.yml`）にも同じチェック（lint・型検査・テスト・docsビルド）があり、フック未設定や `--no-verify` の取りこぼしを検出する。

## 開発ルールの適用

ファイルを読む・変更する・レビューするときは、対象パスに一致するルールを先に読む。複数一致した場合はすべて適用する。

対象のパス（`…` で囲んだもの）の正は、各ルールのページの先頭（frontmatter）の `paths`。この表と Claude Code の `.claude/rules/`（そのパスのファイルを開くと自動で読み込まれる入口ファイル）は、それに合わせる。パスを変えるときは frontmatter を直し、`node scripts/sync-claude-rules.mjs` を流してこの表も直す（食い違いは `pnpm docs:build` が止める）。

| 対象 | 必ず読むルール |
|---|---|
| `apps/**`, `packages/**` | `docs/process/rules/architecture.md` |
| `apps/**/*.test.*`, `packages/**/*.test.*`, `apps/web/src/test/**`, `apps/web/src/mocks/**`, `scenarios/**`, `rules/**`, `apps/web/vite.config.ts`, `apps/web/vite/**`, `apps/web/e2e/**`, `apps/web/playwright.config.ts`、テストの追加・変更 | `docs/process/rules/testing.md` |
| `biome.json`、lint のルール・しきい値を変えるとき | `docs/process/rules/static-analysis.md` |
| push・マージ前、レビュー実行時 | `docs/process/rules/review.md` |
| `docs/plans/**`、機能追加・振る舞いの変更（プラン作成から） | `docs/process/index.md`（開発サイクル） |
| `docs/cartagraph/**`, `docs/concept/**`, `docs/glossary.md` | `docs/process/rules/spec-writing.md`（仕様のページの書き方） |
| `docs/notes/**` | `docs/notes/index.md`（デザイナーノートの書き方） |
| `docs/provisional/**` | `docs/provisional/index.md`（仮ルールの書き方） |
| `docs/backlog/**` | `docs/backlog/index.md`（要望の書き方） |

## 最重要ルール

1. **ルールと仕様書が矛盾したら止める。** `AGENTS.md`・`docs/process/` に書かれた開発運用ルールと、`docs/` 配下の仕様書（設計仕様・議論ログなど）の内容が矛盾する場合、推測でどちらかを優先して作業を進めてはいけない。作業を止め、矛盾の内容（どのルールと、どの仕様書のどの記述が食い違っているか）を人間に報告し、判断を仰ぐ。
2. **唯一の信頼できる情報源（SSOT）。** 同じ情報を複数箇所に重複して書かず、常にどこか一箇所を正とする。仕様の正は `docs/` 配下の正式ページ（`docs/interviews/` を除く）。議論ログの原文と正式ページが食い違う場合は、原文を優先せず矛盾として報告する。
3. **重複・分散に気づいたら、その場で直して報告する。** どちらを正にするかが明らかなら（用語の揺れ、古い記述、同じ説明の書き写しなど）、その場で1か所に寄せて直し、直したことを人間に報告する。正が決められないとき（どちらも正式なページで、寄せると仕様の意味が変わる）だけ、作業を止めて人間に判断を仰ぐ。
4. **プランにない変更は実装しない。** 必要になったら立ち止まって報告する（`docs/process/index.md`）。
5. **改行コードは LF**（Windows でも）。
