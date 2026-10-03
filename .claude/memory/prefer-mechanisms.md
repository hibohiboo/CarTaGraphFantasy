---
name: prefer-mechanisms
description: 振り返りの改善案は、ルールを書き足すより仕組み（git フック・lint・Claude Code のフック・自動生成）で止める案を優先する
metadata:
  node_type: memory
  type: feedback
  originSessionId: 372d9327-37f9-4207-9e68-7f4fa203e880
  modified: 2026-10-03T01:30:00.361Z
---

振り返りで改善案を出すときは、「ルール・注意書きを足す」より先に、「機械で止める・自動で組み立てる」仕組みの案を考える。ルールで済ませるなら、仕組みにしない理由を添える。

**Why:** 2026-10-03、PR #12 の振り返りで、heredoc の注意（CLAUDE.md）やフック省略の禁止が文書だけでは守られず、Claude Code の PreToolUse フック・Biome の設定で止める形にした。ユーザーは「今回はかなり改善が進んだいいふりかえりだった。これからも仕組みで解決していきたい」と評価した。開発プロセスの基盤の原則5（機械的な安全網を増やす。docs/process/index.md）とも同じ方向。

**How to apply:** 進化ログ（docs/process/evolution.md）の候補を書くとき、止め方（ルール／レビュー観点／機械）を意識し、機械化できるなら具体的な手段（Biome のルール名、フックの種類など）まで提案する。既存ツールで書けないかを先に調べる（docs/process/index.md プランの8項目の3）。[[dev-process-structure]] [[feedback-lint-cadence]]
