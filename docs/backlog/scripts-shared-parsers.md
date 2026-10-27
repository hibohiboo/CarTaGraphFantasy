---
title: 手で書いたものの読み手を共通にする
status: 未着手
summary: Markdown の表・frontmatter・routes.ts の配列を読む処理を scripts/ の共通のモジュールに寄せ、崩れた行や分からない形を黙って捨てずに止める。
trace:
  none: 開発の基盤（検査とレポートのスクリプト）
updated: 2026-10-27
---

# 手で書いたものの読み手を共通にする

2026-10-27、[アイデアから実装までをたどれるようにする](trace-report.md)の振り返りで、体制の進化の候補を人間が採用した（[体制の進化ログ 2026年10月](../process/evolution/2026-10.md)「手で書いたものの読み手を `scripts/` の共通のモジュールに寄せる」）。

## 背景

- `docs:build` の検査とレポートのスクリプトは、手で書いた Markdown の表・frontmatter・`routes.ts` を、それぞれ自前の正規表現で読んでいる
- 崩れた入力を黙って捨てる・読み違えることが3回起きた
  - 打ち間違えたマイルストーンの id の要望が、黙ってダッシュボードから消えた（2026-10）
  - ルールのテストの対象外の一覧の表で、見出しの行の崩れ・区切りの行の欠け・途中の空行があると宣言が消え、検査も通った（2026-10-26、P4）
  - `parseRoutes` が description・コメントの中の `title:`・`path:` を読み、`frontmatterValue` が引用符・コメント・本文まで読んだ（2026-10-27、P5）

## 考えていること（プランで詰める）

- 対象：`check-events.mjs`・`check-screens.mjs`・`check-provisional.mjs`・`rule-sections.mjs`・`sync-claude-rules.mjs`・`usecases.mjs`・`trace.mjs`（`frontmatterValue`・`readBacklog`。P6 で `build-trace-report.mjs` から移し、`branch-id.mjs`・`check-usecase-tags.mjs`・`build-usecase-report.mjs` も使う）
- Markdown の表は、見出しの名前で列を引き、列の数の合わない行・区切りの行の欠けは例外にする
- frontmatter は、YAML のライブラリを入れるか、受け付ける形を絞った読み手1つにするか（P5 の D21 は、ライブラリを足さず形を絞った）
- `routes.ts` は、正規表現でなく TypeScript の構文木で読むか
- 振る舞いを変えない組み替えなので、既存のテスト（`pnpm tools:test`）が通り続けることと、崩れた入力の例外のテストを足す
