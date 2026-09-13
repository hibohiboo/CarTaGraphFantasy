---
name: push-then-report
description: mainへのpushは確認を挟まず実行し、完了後に結果を報告してよい
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fcb20a47-5151-4109-8489-8af7d7d5cc2f
  modified: 2026-09-13T13:15:40.162Z
---

このプロジェクト（CarTaGraphFantasy）では、GitHub Pagesの確認ページなど作業内容をmainへpushする際、事前に確認を取らずそのままpushしてよい。push後に結果（デプロイの成否・URL）を報告すれば十分。

**Why:** ユーザーから「pushしたところで教えてもらえば大丈夫ですよ」と明示された。試作・確認目的のpushで毎回止めるとやり取りが冗長になる。

**How to apply:** 破壊的な操作（force push、履行済みPRのクローズなど）や、公開範囲・影響が大きい変更は別途判断するが、通常の試作ページ追加・ドキュメント修正のpushはAskUserQuestionで止めずに実行し、完了後にURLと変更内容を報告する。[[cartagraph-viewer-site-phase]]
