---
name: ddd-design-docs
description: DDD の設計文書（業務領域・コンテキスト・集約）の置き場と、コードの組み替えを後回しにした決定
metadata:
  node_type: memory
  type: project
  originSessionId: 7b84a992-ba73-4ab2-afc5-e467af605e4f
  modified: 2026-10-15T15:55:59.765Z
---

2026-10-16、人間の希望で DDD の考え方の整理を文書だけで行った。正は docs/architecture/domain-map.md（業務領域）・bounded-contexts.md（コンテキストマップ）・aggregates.md（集約・値オブジェクト・イベント）で、理由は docs/notes/architecture/ の同名ページ。

**Why:** コードの組み替え（Session をセッションとセッションスナップショットに分ける、CardDef からプレイ中の状態を外す、イベントを返す形）は、バックエンドで保存の単位を作るときにまとめて判断すると人間が決めた。

**How to apply:** backend-1on1 のプランを作るときは、まずこれらのページと known-issues.md「ドメインモデル」を読む。集約の操作は関数型（zod の型＋新しい集約とイベントを返す純粋関数）で書く。
