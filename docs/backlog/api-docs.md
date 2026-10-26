---
title: API ドキュメントを、応答のスキーマから作って公開する
milestone: backend-1on1
status: 完了
summary: API の一覧（本文と応答の形・状態コード）を zod で1か所に置き、そこから作った OpenAPI を Redoc でサイトに公開する。モック（MSW）の応答が一覧どおりかはテストで止める。
plans:
  - 2026-10-11-APIドキュメント.md
cycles:
  - { name: API ドキュメント, status: 完了, pr: 23 }
trace:
  none: 開発の基盤（API ドキュメント）
updated: 2026-10-11
---

# API ドキュメントを、応答のスキーマから作って公開する

[ロードマップ](../roadmap.md#backend-1on1) backend-1on1（データをバックエンドに置く）の下ごしらえ。[API のリクエストのスキーマの共用](api-schemas.md)で残した「応答のスキーマ」を、この要望で足す。

- 2026-10-11、人間の要望：テストレポートの次に API ドキュメントが欲しい。MSW から OpenAPI を出して Redoc で公開できないか
- MSW のハンドラはメソッドとパスしか持たず、本文と応答の形はコードの中にしか無いので、形の出どころは zod にする（人間と確かめた）。応答の形は `packages/domain` の interface を zod に変えて1か所にする。MSW の応答が一覧どおりかを Vitest で検査して落とし、API ごとに返しうる状態コードも書く（2026-10-11、人間が決めた）
- 2026-10-11、プランの AI レビューを受けて人間が決めた：Redoc の HTML は `@redocly/cli` で作り、Redoc の本体を CDN から読むことを受け入れる。下書きのシナリオは業務の検査に通らないことがあるので、人間の案で下書きの API を分けることにし、別の要望（[シナリオの下書きの API を分ける](scenario-draft-api.md)）として次のサイクルに回した。今回は下書きを返しうる API の応答を、業務の検査を外した形で書く
- 2026-10-11、PR #23 で完了した。API ドキュメントはサイドバーの「開発」から開く（`https://hibohiboo.github.io/CarTaGraphFantasy/api-docs/`）
