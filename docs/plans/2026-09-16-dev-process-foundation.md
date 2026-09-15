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

機械的な安全網は GitHub Actions に置く。デプロイのワークフローとは分け、main への push（と将来の PR）で `typecheck → test → docs:build` を回す。lint はコミット前の git フック（`.githooks/`）で回し、CI では取りこぼしの検出だけを担う。

## 4. テスト影響範囲

- コードの振る舞いは変えないので既存テストへの影響なし
- `docs/` の変更は `pnpm docs:build`（リンク切れ検査）が通ることを確認する

## 5. 新規テストケース

コードのテストは増えない。代わりに各サイクルの完了条件を置く。

- C1：意図的に落ちるテストを含むコミットを push し、CI が赤くなること／直すと緑になることを確認する（直 push 運用中は一時ブランチで行う）
- C3：普段と違うモデルで「依頼文サンプル 1」を実行し、8項目のプランが `docs/plans/` に生成されること
- C4：新プロセスで1機能を完走し、振り返りが `evolution.md` に記録されること

## 6. 実装順

各サイクルは1回の push で閉じる。基盤整備の間は**スピード重視で直 push**を続け、PR 運用は基盤整備が終わってから始める（2026-09-16 決定）。「担当」は目安であり、強いモデルが使えなければ弱いモデル＋人間の確認で置き換える。

| # | サイクル | 内容 | 担当の目安 | 完了条件 |
|---|---|---|---|---|
| C0 | 文書化（完了） | サンプルを移植し `docs/process/`・`AGENTS.md`・`.claude/` を整備 | 強いモデル＋人間の校正 | このプランと `evolution.md` の採用済み欄 |
| C1 | CI の安全網 | `.github/workflows/ci.yml` を追加し、main push（と将来の PR）で `pnpm web:typecheck`・`pnpm web:test`・`pnpm docs:build` を回す | 定型作業。軽いモデルで可 | 5. の C1 |
| C2 | lint とコミット前フック | Biome を導入し `pnpm lint`（check）と `pnpm lint:fix` を用意。`.githooks/pre-commit` でステージ済みファイルだけ `biome check --staged` を実行。フックはリポジトリ管理（`git config --local core.hooksPath .githooks`。`package.json` の `prepare` で自動設定も検討）。既存コードの自動修正は別コミットに分ける。CI にも `pnpm lint` を追加（フック未設定・`--no-verify` の取りこぼし防止） | 定型作業。軽いモデルで可 | フックが lint 違反のコミットを止める。既存コードが通る |
| C3 | モデル非依存の実証 | (a) 自動メモリの運用知識を `docs/architecture/web-app.md` へ移す。(b) Claude Code のモデルを切り替えて（Sonnet / Opus 等）依頼文サンプル1〜2を試し、`AGENTS.md`・依頼文の不足を `evolution.md` に記録。余裕があれば Codex でも同じ依頼を試す | 人間がモデルを切り替えて操作 | 5. の C3 |
| C4 | 新プロセスで1機能を完走 | 題材：**シーン構築画面の React 化**（試作 `docs/public/preview/scene-builder.html` が元）。サイクル1〜8を全部回し、振り返りを記録。push は直 push のまま | プランと実装は使えるモデル、レビューは別セッション | 5. の C4 |
| C5 | 定期リファクタリング | 依頼文サンプル8で `components/index.ts` の barrel 解消と肥大ファイルの分割 | 軽いモデルで可（テストが安全網） | Green を保って完了、`evolution.md` の候補を消し込む |
| C6 | PR 運用の開始（基盤整備後） | `apps/`・`packages/` の変更はブランチ→PR→AIレビュー→CI→人間レビュー→マージ。docs のみは直 push のまま。`create-pr` スキルを初めて使う。ブランチ保護は人間が設定 | 人間が判断、AIが手順を実行 | 最初の PR がこの流れで閉じる |

C1・C2 は順不同でもよいが、先に済ませると以降のサイクルすべてが安全網の上で回る。C4 は C1・C2 の後に置く。C6 は C5 まで終わってから。

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

## 決定事項（2026-09-16、人間の判断）

1. **PR 運用は基盤整備が終わってから**（C6）。それまではスピード重視で直 push。AI レビューは「push 前に別セッションで実行する」運用ルールで担保する
2. **lint は Biome を採用し、コミット前の git フックで回す**（C2）。AI に lint 結果の確認でトークンを使わせず、コミット時に機械的に止める。フックは `.githooks/` でリポジトリ管理し、`git config --local core.hooksPath .githooks` を最初に行う
3. **モデル非依存の実証は「モデルを変える」ことが主目的**（C3）。Claude Code のまま Sonnet / Opus 等に切り替えて試し、Codex は余裕があれば
4. **C4 の題材はシーン構築画面の React 化**
