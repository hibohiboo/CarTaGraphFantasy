---
name: push-then-report
description: mainへのpushは確認を挟まず実行し、push後のデプロイ結果確認（gh run watch等）はユーザー側で行うので不要
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fcb20a47-5151-4109-8489-8af7d7d5cc2f
  modified: 2026-09-15T22:01:12.417Z
---

このプロジェクト（CarTaGraphFantasy）では、GitHub Pagesの確認ページなど作業内容をmainへpushする際、事前に確認を取らずそのままpushしてよい。**push後のデプロイ結果確認（`gh run watch`などでGitHub Actionsの完了を待つこと）はユーザー自身が行うので、AI側でやる必要はない。** pushしたらそのままURLを伝えて完了報告すればよく、デプロイの成否を確認してから報告する必要はない。

**Why:** ユーザーから「pushしたところで教えてもらえば大丈夫ですよ」と言われた際、最初は「push後にデプロイ結果を確認してから報告する」という意味だと誤解していたが、後日「デプロイ結果確認もこちらでやるので、AIはデプロイ結果の確認は不要という意味」と明確に訂正された。

**How to apply:** 破壊的な操作（force push、履行済みPRのクローズなど）や、公開範囲・影響が大きい変更は別途判断するが、通常の試作ページ追加・ドキュメント修正は、commit・push後に`gh run watch`等でデプロイ完了を待たず、pushした時点で変更内容とURLを報告して完了とする。[[cartagraph-viewer-site-phase]]
