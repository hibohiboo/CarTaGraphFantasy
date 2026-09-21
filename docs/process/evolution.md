# 開発体制の進化ログ

開発プロセス自体の変更を「候補 → 評価 → 採用／却下」の型で記録する。運用は[開発プロセス](index.md#体制の進化)が正。カルタグラフ本体の[進化候補の評価](../concept/index.md#進化候補の評価決着)と同じく、却下も削除せず理由付きで残す。

記録するのは「ルール・依頼文・スキル・サブエージェント・CI など、進め方に関する変更」であり、機能の設計判断はプランドキュメント（`docs/plans/`）に書く。

## 候補（未評価）

サイクルの途中で気づいた人（人間・AIどちらでも）が追記する。書式：`- [ ] <候補> — <気づいた状況・根拠>（<日付>）`

- [ ] `apps/web/src/components/index.ts` の barrel export を解消する — アーキテクチャルールで barrel 禁止を採用した結果、既存コードが唯一の逸脱になった。テスト駆動リファクタリングの定期作業で扱う（2026-09-16）
- [ ] `noNonNullAssertion`（5箇所）・`noDescendingSpecificity`（GameCard.module.css 2箇所）の警告を解消する — Biome導入時（2026-09-16）に検出。lintはブロックしないが、C5のリファクタリング定期作業で見直す
- [ ] `RoleBadge`/`Avatar` の `role` prop 名を ARIA の `role` 属性と衝突しない名前（例：`badgeRole`）に変える — Biome導入時（2026-09-16）に `lint/a11y/useValidAriaRole` の誤検知が19箇所見つかり、`biome-ignore` コメントで個別に抑制した。プロパティ名を変えれば誤検知自体がなくなるが、アプリコードの広範囲な書き換えになるためC2の範囲外とした
- [x] CI で `pnpm web:typecheck && pnpm web:test` を必ず回す — 2026-09-16 に `.github/workflows/ci.yml` として実施（プランの C1）。下記「採用済み」参照
- [ ] `apps/`・`packages/` の変更を PR 経由にする — 現状は main へ直 push。AI相互レビューと CI をマージ条件にするなら PR が要る。docs のみの修正は直 push のまま（2026-09-16）。**判断：基盤整備が終わってから採用（プランの C6）。それまでスピード重視で直 push**
- [x] lint・フォーマッタの導入（Biome） — 2026-09-16 に実施（プランの C2）。下記「採用済み」参照
- [x] Claude Code の自動メモリにある運用知識を `docs/` へ移す — 2026-09-16 に実施（プランの C3a）。下記「採用済み」参照
- [x] 普段と違うモデルで1サイクル試走し、`AGENTS.md`・依頼文の不足を洗う — 2026-09-16 に Opus でのサブエージェント試走を実施（プランの C3b）。下記「採用済み」参照。Codex 等の別ツールでの試走は未実施（余裕があれば別途）
- [ ] `docs/plans/<日付>-<機能>.md` のファイル名規約（機能名部分の言語）を明文化する — C3bのOpus試走で「唯一の実例（dev-process-foundation）がローマ字で、日本語かローマ字か規約に書かれていない」と指摘された（2026-09-16）。次にプランを作る際にでも一言足せばよい軽微な指摘
- [ ] E2E（Playwright）の導入時期 — バックエンド着手時に再評価。それまではページ描画テストで代替（2026-09-16）

## 採用済み

新しいものを上に。書式：`### <日付> <タイトル>` の下に、内容・理由・反映先。

### 2026-09-21 pre-commitフックが安全な指摘を自動修正・再ステージするよう変更

- **内容** — `.githooks/pre-commit` を `biome check --staged`（チェックのみ）から `biome check --staged --write`（安全な指摘は自動修正）に変更。`--write`で直った内容を`git add`で再ステージしてからコミットを続行する。`--unsafe`が要る指摘（C2で意図的に自動適用しない方針にしたもの）だけ引き続きコミットを止める
- **理由** — ユーザーが`vite.config.ts`にコードを1行足した際、ダブルクォート等のフォーマット崩れだけでコミットが止まり、`pnpm lint:fix`を別途手で挟む必要があった。フォーマット崩れは判断の要らない機械的な指摘なので、直すことも機械にやらせる方が「AIにトークンを使わせず機械的に止める」という狙いに合う
- **反映先** — `.githooks/pre-commit`、`AGENTS.md`

### 2026-09-16 モデル非依存の実証（C3）— メモリの運用知識をdocsへ移し、Opusでの試走で確認した

- **内容（C3a: メモリ→docs）** — Claude Code の自動メモリにあった `apps/web` の運用知識のうち、他ツール・他モデルにも必要なもの（`MSYS_NO_PATHCONV=1` が要る理由、pnpm workspace の peer 解決で vitest が壊れる件と `.npmrc` の意図、シーン構築・戦闘画面がまだReact化されていない旨）を `docs/architecture/web-app.md` に「ローカル開発の注意」「未React化の画面」として書き出した。Claude Code のBashツール固有の癖（長いheredocが壊れる→Writeツールを使う）は `docs` ではなく `CLAUDE.md`（Claude Code固有の補足）に置いた。元のメモリファイル（`web-app-react-phase.md`）は要点とdocsへのポインタだけに縮めた
- **内容（C3b: 別モデルでの試走）** — このセッション（Sonnet 5）から、Opus 5 のサブエージェントを1体、会話文脈ゼロの状態で起動。「シーン構築画面をReact化したい。プロジェクトのルールに従って進めてください」という一文だけを与え、ファイル変更は禁止（読み取りのみ）で、実際の挙動を再現させた
- **結果：良好。** `AGENTS.md` → `docs/process/index.md` → `dev-cycle`／`grilling` スキルを自力で発見し、①フルルートが適用されると正しく判定、②プランが無いので実装せず質問ラウンドを出す、という最重要ルール4どおりの挙動を取った。`docs/open-questions.md` の未決論点（シーンの「目的・終了条件」）に触れる箇所は、AIが決めずにユーザーへの質問にした（グリリングの「未解決論点に関わる判断だけをユーザーに委ねる」を遵守）。質問の根拠として `docs/process/rules/architecture.md`・`prototype-handover.md`・既存コードの用語を具体的に引用しており、思考の型が本セッションの振る舞いと近い水準だった
- **副産物として見つけた不具合** — Opus が「`docs/architecture/web-app.md` の『未React化の画面』が実装と食い違っている（サイトマップ`/admin/sitemap`からは辿れないのに『試作元として参照している』と書いてある）」と指摘。確認したところ事実で、**この指摘自体がC3aで数分前に私（Sonnet 5）が書いた記述の誤り**だった。サイトマップの `prototype` フィールドは `routes.ts` に既にあるルートにしか付けられないため、まだReact化されていない画面はサイトマップから辿れない。該当箇所を修正した（試作は実際にはVitePressサイドバーの「試作」から見る）
- **評価** — 「別モデルでも `AGENTS.md` だけで正しい手順に入れるか」というC3の目的に対して肯定的な結果。加えて「独立したAIレビューが自分の作業の誤りを見つける」という `docs/process/rules/review.md` の狙いも、プロセス文書自体の執筆というメタな場面で実証された
- **反映先** — `docs/architecture/web-app.md`、`CLAUDE.md`、`.claude/memory/web-app-react-phase.md`、`.claude/memory/MEMORY.md`

### 2026-09-16 Biome を導入し、コミット前フックとCIでlintを回す（C2）

- **内容** — `biome.json`（既存コードのスタイルに合わせてシングルクォート・セミコロンあり・トレイリングカンマ）を追加し、`pnpm lint` / `pnpm lint:fix` を用意。`.githooks/pre-commit` が `biome check --staged` を実行してコミットを止め、`pnpm install` の `prepare` スクリプト（`scripts/setup-git-hooks.mjs`）が `core.hooksPath` を自動設定する。CI にも `pnpm lint` を追加（フック未設定・`--no-verify` の取りこぼし検出）
- **既存コードへの適用** — 安全なフォーマット・import整理を全体に適用。a11yの指摘4件（`useAriaPropsSupportedByRole`・`noLabelWithoutControl`・`noArrayIndexKey`×2）は手で修正・理由を明記して抑制。`useValidAriaRole` の誤検知19箇所（`RoleBadge`/`Avatar` の独自 `role` prop を ARIA の role 属性と誤認）は `biome-ignore` コメントで個別に抑制した
- **`--unsafe` 自動修正は使わない方針にした** — 一度 `biome check --write --unsafe` を試したところ、上記の誤検知を「無効なARIAロール」として `role` 属性ごと削除してしまい、UIの見た目（`RoleBadge`/`Avatar` が役割を表示できなくなる）と `tsc` の型エラー（`noNonNullAssertion` の安全でない除去による）の両方を壊すことが判明した。安全網（typecheck・test）で検出できたため実害はなかったが、以降は `--write`（safeのみ）だけを使い、`--unsafe` の指摘は個別に判断する
- **残課題** — `noNonNullAssertion`（5箇所）・`noDescendingSpecificity`（2箇所）は警告のまま残した（lintはブロックしない）。`RoleBadge`/`Avatar` の `role` prop 名を変える案は「候補」に追記した
- **反映先** — `biome.json`、`package.json`、`.githooks/pre-commit`、`scripts/setup-git-hooks.mjs`、`.github/workflows/ci.yml`、`AGENTS.md`、既存の `apps/web/src/**`（フォーマット・a11y修正）

### 2026-09-16 push前に型検査・テスト・docsビルドを通す `.githooks/pre-push` を追加

- **内容** — `pre-commit`（lintのみ）に加えて `pre-push` を追加し、push前に `pnpm web:typecheck && pnpm web:test && pnpm docs:build`（CIと同じ3つ）をローカルで実行してから push させるようにした。失敗時は push を中止する
- **理由** — ユーザーから「push の前にもテストがローカルで通ることを確認する hook が欲しい」との要望。コミット単位では途中経過のコミットがテスト未通過でも構わない場合があるが、push（他者・CIに見える境界）の前には確実に通したい
- **反映先** — `.githooks/pre-push`、`AGENTS.md`

### 2026-09-16 CI に型検査・テスト・docsビルドの安全網を追加（C1）

- **内容** — `.github/workflows/ci.yml` を新設。`main` への push と PR（C6 で PR 運用を始めたときのため）で `pnpm web:typecheck` → `pnpm web:test` → `pnpm docs:build`（リンク切れ検査）を順に実行する。既存の `deploy.yml`（ビルド・デプロイ）とは分離し、デプロイは従来どおりテストの成否を待たずに走る
- **理由** — これまで型検査・テストが落ちていてもデプロイされる状態だった。lint はコミット前フック（C2）に任せ、CI では取りこぼし検出はまだ担わない（C2 実装時に `pnpm lint` を追加する）
- **反映先** — `.github/workflows/ci.yml`、`docs/plans/2026-09-16-dev-process-foundation.md`（C1 完了）

### 2026-09-16 『プロフェッショナルAI駆動開発』のサンプル構成を移植し、開発プロセスを文書化

- **内容** — ローカルにある書籍サンプル（`proffesional-ai/`、git 管理外）の AGENTS.md・rules・agents・skills・依頼文雛形を、このプロジェクトの構成（pnpm モノレポ、React + MSW、バックエンド未実装、直 push 運用）に合わせて書き直した
- **主な判断**
  - 開発プロセスの正を `docs/process/` に置き、`AGENTS.md` をツール非依存の入口、`.claude/` を呼び出し口の薄い層にした（Fable・Claude Code が使えなくても回るように）
  - サンプルの `docs/rules/` は `docs/process/rules/` に、`.claude/plans/` は既存設定に合わせて `docs/plans/` にした
  - database・logging のルールはバックエンド未着手のため独立ファイルにせず、アーキテクチャルールの「将来のバックエンド（予約）」に原則だけ残した
  - サンプルの「PR前に必ずAIレビュー」は、直 push 運用と衝突するため「`apps/`・`packages/` の振る舞いを変える変更は push 前」「docs のみは省略可」というフル／ライトの2ルートに変えた
  - サブエージェントは `model: inherit` にし、サンプルの security-reviewer の代わりに、このプロジェクトで価値の高い spec-reviewer（docs SSOT との整合）を置いた
  - `docs/prompt-sample.md` は丸写しで存在しないパスを参照していたため、`docs/process/prompt-sample.md` に移して書き直した
  - grilling スキルの「本プロジェクトでの位置づけ」節が別プロジェクト（tabifuda）の構成を参照していたため、この開発サイクルに合わせて直した
- **反映先** — `AGENTS.md`、`CLAUDE.md`、`docs/process/`、`.claude/agents/`、`.claude/skills/`、`docs/plans/2026-09-16-dev-process-foundation.md`

## 却下

（まだない）
