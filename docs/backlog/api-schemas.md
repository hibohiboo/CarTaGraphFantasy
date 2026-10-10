---
title: API のリクエストとレスポンスのスキーマを、バックエンドと共用する
milestone: backend-1on1
status: 未着手
summary: API の本文と応答の形を zod のスキーマとして1か所（packages/schemas など）に置き、モック（MSW）・画面・将来のバックエンドが同じものを使う。本文は検査してから使い、型を付け替えるだけの書き方は lint で止める。
updated: 2026-10-10
---

# API のリクエストとレスポンスのスキーマを、バックエンドと共用する

[ロードマップ](../roadmap.md#backend-1on1) backend-1on1（データをバックエンドに置く）の下ごしらえ。

- 2026-10-10、冒険者だけにする C3 の振り返りで採用した（[体制の進化ログ](../process/evolution.md)）。MSW のハンドラ（`apps/web/src/mocks/handlers.ts`）は本文を `(await request.json()) as {...}` で型を付け替えるだけで使う箇所が10か所あり、`null`・数・知らないキーの本文で 500 になる穴を、実装の AI レビュー（異常系）が C2・C3 と続けて1か所ずつ見つけていた（[既知の問題](../architecture/known-issues.md)「キャラクターの作成の API が…」「シナリオを非公開にしても…」）
- 人間の案（2026-10-10）：`packages/schemas` のようなパッケージに、バックエンドと共用するリクエストとレスポンスのスキーマを作る。いまの zod スキーマは `packages/domain` のドメインの型（シナリオ・キャラクター）だけで、API の契約の置き場所が無い
- 止め方の案：Biome の GritQL プラグインで `(await request.json()) as` を禁止し、スキーマの `safeParse` を通させる。既存の箇所は、直すまで既知の問題に一覧で載せて個別に抑える
- プランで決めること：パッケージの置き場所と依存の向き（`apps/web → schemas → domain` なら `docs/process/rules/architecture.md`「構造」「依存の向き」と `biome.json` を直す）、`entities/*/api` の型をスキーマから引くか、応答も検査するか
