# 開発体制の進化ログ

開発プロセス自体の変更を「候補 → 評価 → 採用／却下」の型で記録する。運用は[開発プロセス](index.md#体制の進化)が正。カルタグラフ本体の[進化候補の評価](../concept/index.md#進化候補の評価決着)と同じく、却下も削除せず理由付きで残す。

記録するのは「ルール・依頼文・スキル・サブエージェント・CI など、進め方に関する変更」であり、機能の設計判断はプランドキュメント（`docs/plans/`）に書く。

## 候補（未評価）

サイクルの途中で気づいた人（人間・AIどちらでも）が追記する。書式：`- [ ] <候補> — <気づいた状況・根拠>（<日付>）`

- [ ] `apps/web/src/components/index.ts` の barrel export を解消する — アーキテクチャルールで barrel 禁止を採用した結果、既存コードが唯一の逸脱になった。テスト駆動リファクタリングの定期作業で扱う（2026-09-16）
- [ ] CI で `pnpm web:typecheck && pnpm web:test` を必ず回す — 現状の GitHub Actions はビルドとデプロイのみで、テストが落ちていてもデプロイされる。モデルに依存しない安全網として最優先（2026-09-16）
- [ ] `apps/`・`packages/` の変更を PR 経由にする — 現状は main へ直 push。AI相互レビューと CI をマージ条件にするなら PR が要る。docs のみの修正は直 push のまま（2026-09-16）。**判断：基盤整備が終わってから採用（プランの C6）。それまでスピード重視で直 push**
- [ ] lint・フォーマッタの導入（Biome か ESLint + Prettier） — 命名・未使用変数・import 順などを機械で弾き、P2 指摘をレビューから減らす（2026-09-16）。**判断：Biome を採用。AI にトークンを使わせず、コミット前の git フック（`.githooks/`、リポジトリ管理）で止める（プランの C2）**
- [ ] Claude Code の自動メモリにある運用知識を `docs/` へ移す — `MSYS_NO_PATHCONV`、pnpm の peer 解決、大きなファイルの書き方など、Claude 以外のツールからは見えない（2026-09-16）
- [ ] 普段と違うモデルで1サイクル試走し、`AGENTS.md`・依頼文の不足を洗う — 「Fable が使えなくても回る」ことの実証。主目的はモデルの切り替え（Sonnet / Opus 等）で、Codex など別ツールは余裕があれば（2026-09-16 に目的を修正）
- [ ] E2E（Playwright）の導入時期 — バックエンド着手時に再評価。それまではページ描画テストで代替（2026-09-16）

## 採用済み

新しいものを上に。書式：`### <日付> <タイトル>` の下に、内容・理由・反映先。

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
