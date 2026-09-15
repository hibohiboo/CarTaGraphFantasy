---
paths:
  - "apps/**"
  - "packages/**"
---

# アーキテクチャルール（どこに何を置くか）

対象：`apps/**`、`packages/**`。技術選定の経緯は[技術スタック](../../architecture/index.md)、現在の構成は[Webアプリの構成](../../architecture/web-app.md)が正で、ここでは「新しいコードをどこに置き、何を守るか」だけを定める。

## 構造

```text
packages/domain/src/     ドメイン型と、UIに依存しないゲームロジック（純粋関数）
apps/web/src/
  app/        routes.ts（ルート一覧＝ナビ・サイトマップの唯一の情報源）、router.tsx、AppShell.tsx
  pages/<ロール>/  ページ。1ページ1ファイル
  components/ 複数ページで共有するUI
  lib/        api.ts（fetchラッパー）、queries.ts（TanStack Query のフック）、整形・変換
  mocks/      fixtures.ts（モックデータ＝唯一のシード）、handlers.ts（MSW ハンドラ）
  content/    ルールブック本文（docs の要約。出典リンク付き）
  styles/     tokens.css（デザイントークン）、global.css
```

迷ったらこの順で問う。

1. ゲームのルール・判定・変換で、React にも DOM にも依存しない → `packages/domain`
2. 1つのページでしか使わない → `apps/web/src/pages/<ロール>/` の中で完結させる
3. 複数ページで共有するUI → `components/`。ただし2ページ目が現れるまで共通化しない
4. API へのアクセス → `lib/api.ts` と `lib/queries.ts` を経由する。ページから `fetch` を直接呼ばない
5. モックデータの追加 → `mocks/fixtures.ts` に集約する。ページやテストの中で独自のデータを作らない

## 1ファイル1責務

- ファイルの担当を一文で言えること。「セッション管理ページ」は合格、「GM周りのUIいろいろ」は失格
- ファイルが肥大したら、責務の境界で割る（例：ページの中の大きな一区画を `components/` へ）
- ルート・ナビ・サイトマップの情報は `app/routes.ts` だけが持つ。他のファイルにパスの一覧を書かない

## 境界

- `packages/domain` は React・DOM・MSW に依存しない。`apps/web` から `packages/domain` を参照し、逆は禁止
- `packages/domain` の型と用語は `docs/` の用語に対応させる。**用語の意味を変えるときは docs を先に更新する**（SSOT）
- 未解決論点（`docs/open-questions.md`）に関わる仮ルールは、コードのコメントと画面表示の両方で「仮」と明示する（例：キャラクター作成の能力値配分）
- barrel export（`index.ts` への集約・再エクスポート）は新規に作らない。実ファイルへ直接 import する。既存の `components/index.ts` は解消候補（[体制の進化ログ](../evolution.md)参照）
- 業務コードに `console.*` を残さない（現状ゼロ）。構造化ログの方針はバックエンド着手時に定める

## 副作用の分離（Functional Core / Imperative Shell）

- ゲームの判定・計算・変換（比較判定、デッキのフィルタ、状態遷移の可否など）は純粋関数に集め、`packages/domain` または `lib/` に置く（Functional Core）
- API 呼び出し・ローカルストレージ・時刻・乱数・環境変数の参照は、フック・ハンドラなど外側の薄い層へ寄せ、Core が返した結果を実行するだけに近づける（Imperative Shell）
- 狙いは、複雑なロジックを MSW もブラウザも無しでテストできる形に保つこと

## 将来のバックエンド（予約）

[技術スタック](../../architecture/index.md)で決着した Neon（Postgres）と AWS + CDK に着手したら、次を詳細化する。それまでは原則だけ置いておく。

- マイグレーションは前進のみ（forward only）。適用済みファイルは編集しない
- DB が守るもの（一意性・参照整合・値域・同時実行で破れる不変条件）と、アプリが守るもの（認可・業務フローの順序・外部サービスとの整合）を分ける。判断基準は「UIを通らない書き込みでも絶対に壊れてはいけないか」
- 秘密値（トークン・APIキー・生の個人情報）をログに書かない
