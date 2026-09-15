# プラン：開発体制の基盤整備（Fable・Claude Code に依存せず回る状態にする）

書式は `docs/process/index.md` の「プランドキュメントの8項目」。このプランは、プロセス文書を整える作業そのものを最初の題材にしている。

## 1. 概要

『プロフェッショナルAI駆動開発』のサンプル構成を移植して文書化した開発プロセス（`docs/process/`）を、実際に回る状態にする。特定のモデル（Fable）や特定のツール（Claude Code）が使えなくなっても、リポジトリの文書とCIだけで同じ品質のサイクルが回ることを目標にする。

## 2. 背景

- 現状のギャップ（2026-09-16 時点）
  - CI（`.github/workflows/deploy.yml`）はビルドとデプロイのみ。型検査・テストが落ちていてもデプロイされる
  - main へ直 push 運用。AIレビューをマージ条件にする仕組みがない
  - lint・フォーマッタ未導入。E2E 未導入
  - 運用上の知識（`MSYS_NO_PATHCONV`、pnpm の peer 解決など）が Claude Code の自動メモリにだけあり、他のツールからは見えない
  - サブエージェント・スキルは Claude Code 固有。他のエージェントで試したことがない
  - `components/index.ts` が barrel export（新ルールの唯一の逸脱）
- 関連 — `docs/process/index.md`「モデル・ツールに依存しない基盤」の原則1〜8、`docs/process/evolution.md` の候補一覧

## 3. 詳細設計

3層構造を維持する。

| 層 | 場所 | 役割 | 変更頻度 |
|---|---|---|---|
| 正（SSOT） | `docs/process/`（サイクル・ルール・依頼文・進化ログ） | 手順の本文 | 振り返りで更新 |
| 入口 | `AGENTS.md`（`CLAUDE.md` はこれを読み込む） | スタック・構成・ルール適用表・最重要ルール | 構成が変わったとき |
| ツール固有層 | `.claude/agents/`、`.claude/skills/`、`.claude/settings.json` | 呼び出し口。本文を持たない | ツールの機能が変わったとき |

機械的な安全網は GitHub Actions に置く。デプロイのワークフローとは分け、PR と main への push で `typecheck → test → docs:build` を回す。

## 4. テスト影響範囲

- コードの振る舞いは変えないので既存テストへの影響なし
- `docs/` の変更は `pnpm docs:build`（リンク切れ検査）が通ることを確認する

## 5. 新規テストケース

コードのテストは増えない。代わりに各サイクルの完了条件を置く。

- C1：意図的に落ちるテストを含む PR を作り、CI が赤くなること／直すと緑になることを確認する
- C4：Claude Code 以外のエージェントで「依頼文サンプル 1」を実行し、8項目のプランが `docs/plans/` に生成されること
- C5：新プロセスで1機能を完走し、振り返りが `evolution.md` に記録されること

## 6. 実装順

各サイクルは1回の push（C2 以降は PR）で閉じる。「担当」は目安であり、強いモデルが使えなければ弱いモデル＋人間の確認で置き換える。

| # | サイクル | 内容 | 担当の目安 | 完了条件 |
|---|---|---|---|---|
| C0 | 文書化（完了） | サンプルを移植し `docs/process/`・`AGENTS.md`・`.claude/` を整備 | 強いモデル＋人間の校正 | このプランと `evolution.md` の採用済み欄 |
| C1 | CI の安全網 | `.github/workflows/ci.yml` を追加し、PR と main push で `pnpm web:typecheck`・`pnpm web:test`・`pnpm docs:build` を回す | 定型作業。軽いモデルで可 | 5. の C1 |
| C2 | PR 運用の開始 | `apps/`・`packages/` の変更はブランチ→PR→AIレビュー→CI→人間レビュー→マージ。docs のみは直 push のまま。`create-pr` スキルを初めて使う。ブランチ保護は人間が設定 | 人間が判断、AIが手順を実行 | 最初の PR がこの流れで閉じる |
| C3 | lint・フォーマッタ | Biome か ESLint + Prettier を選び、`pnpm lint` を CI に追加。既存コードの自動修正は別コミットに分ける | 定型作業。軽いモデルで可 | CI に lint が入り、既存コードが通る |
| C4 | ツール非依存の実証 | (a) 自動メモリの運用知識を `docs/architecture/web-app.md` へ移す。(b) Claude Code 以外のエージェント（Codex CLI 等）で依頼文サンプル1〜2を試し、`AGENTS.md`・依頼文の不足を `evolution.md` に記録 | 人間が別ツールを操作 | 5. の C4 |
| C5 | 新プロセスで1機能を完走 | 題材候補：シーン構築画面の React 化、または `open-questions.md` で決着した仕様の反映。サイクル1〜8を全部回し、振り返りを記録 | プランと実装は使えるモデル、レビューは別セッション | 5. の C5 |
| C6 | 定期リファクタリング | 依頼文サンプル8で `components/index.ts` の barrel 解消と肥大ファイルの分割 | 軽いモデルで可（テストが安全網） | Green を保って完了、`evolution.md` の候補を消し込む |

C1〜C3 は順不同でもよいが、C1 を先にすると以降のサイクルすべてが安全網の上で回る。C5 は C1・C2 の後に置く。

## 7. コミット前テスト実行

```sh
pnpm web:typecheck && pnpm web:test && pnpm docs:build
```

## 8. スコープ外

- バックエンド（API・Neon・CDK）の着手。着手時にアーキテクチャルールの「将来のバックエンド（予約）」とレビュー観点のセキュリティを詳細化する
- E2E（Playwright）の導入。バックエンド着手時に再評価
- security-reviewer サブエージェントの追加（同上）
- 試作 HTML（`docs/public/preview/`）の撤去
- Claude Code の自動メモリの廃止（ポインタと個人的な学びは残す）

## 人間に決めてほしいこと

1. **C2 の PR 運用**を採るか。採らない場合、AIレビューは「push 前に別セッションで実行する」運用ルールだけで担保することになる
2. **C3 の lint ツール**（Biome を推奨。設定が1ファイルで済み、pnpm モノレポでも速い）
3. **C4 で試す別ツール**（手元で使えるもの。Codex CLI、Cursor、Gemini CLI など）
4. **C5 の題材**
