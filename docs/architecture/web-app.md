# Webアプリ（apps/web）の構成

[技術スタック](index.md)のモノレポ方針に沿って追加した、React製フロントエンドの構成をまとめる。[試作フェーズの引き継ぎ](prototype-handover.md)で決めたデザイントークン・コンポーネント境界を、そのままReactに移植したもの。

公開先：`https://hibohiboo.github.io/CarTaGraphFantasy/app/`（このdocsサイトと同じGitHub Pagesの `app/` 配下）

## 位置づけ

- **バックエンドはまだ作らない。** `/api/*` はすべて [MSW](https://mswjs.io/)（Mock Service Worker）が横取りして応答する。状態はブラウザのメモリ上にあり、リロードで初期化される。本番ビルド（GitHub Pages）でもMSWを起動している。
- 本物のAPIができたら、`apps/web/src/lib/api.ts` の接続先を差し替え、`src/mocks/` を開発時のみ有効にする想定。
- [フェーズ分け](index.md#開発フェーズの段階分け決着)（まず閲覧サイト→後にセッション管理）の方針は変えていない。セッション管理系の画面も含めて先に画面を作っているのは、モックで体験を検証するためであり、バックエンド実装の着手順は改めて判断する。

## ディレクトリ

```text
apps/web/                 Vite + React + react-router + TanStack Query + MSW
├─ public/mockServiceWorker.js   MSW が生成した Service Worker（コミットする）
└─ src/
   ├─ app/       routes.ts（ルート一覧＝ナビとサイトマップの情報源）、router.tsx、AppShell.tsx
   ├─ components/ 共通UI（GameCard / HandDock / Hud / DeckTree / Badge / Pill など）
   ├─ pages/     ロール別のページ（pl / gm / creator / rulebook / admin）
   ├─ content/   ルールブックの本文（docs の要約。出典リンク付き）
   ├─ lib/       api.ts（fetch ラッパー）、queries.ts（Query フック）、format.ts
   ├─ mocks/     fixtures.ts（モックデータ）、handlers.ts（MSW ハンドラ）、browser.ts / node.ts
   └─ styles/    tokens.css（デザイントークン）、global.css
packages/domain/          ドメイン型（CardDef / Character / Scenario / Session など）。docs の用語をそのまま型にしたもの
scripts/copy-web-to-pages.mjs   ビルド成果物を docs の dist 配下 app/ へコピー（GitHub Pages 用）
```

## ページ一覧（ロール別）

ページの一覧は、アプリ内のサイトマップ（`/admin/sitemap`）が `src/app/routes.ts` から生成している。ここでは概要だけ示す。

| ロール | ページ |
|---|---|
| PL | セッション選択（募集一覧・応募）、プレイページ（手札のプレイ・提案）、キャラクター一覧／作成／シート |
| GM | シナリオ管理（共有ライブラリから選ぶ→カードの取捨選択→募集）、セッション管理（参加者・ゾーン・進行・提案の裁定・モード切り替え・終了） |
| シナリオ作成者 | シナリオ管理（一覧・新規作成・メタデータ／デッキ構造／結末タグの編集・共有ライブラリへ公開） |
| ルールブック | 遊び方、判定ルール、共有設定（共有ライブラリ） |
| システム管理者 | サイトマップ、コンポーネントカタログ |

## 仕様との関係（SSOT）

- 仕様の正は引き続き `docs/` 配下。アプリ内のルールブック（`src/content/rulebook.ts`）は docs の**要約**で、各節に出典リンクを持つ。docs 側と食い違ったら docs を正としてアプリ側を直す。
- `packages/domain` の型は docs の用語（カード種別・ロール・ゾーン・提案の状態など）に対応する。用語の意味を変える場合は docs を先に更新する。
- キャラクター作成の体・技・心の初期配分は[未決](../open-questions.md#次に詰める候補)のため、アプリでは「合計9を1〜5で配分」という**仮ルール**で動かしている（画面にもその旨を表示）。

## ルーティングと配信

- GitHub Pages はサブパス配下でSPAのフォールバック（404→index.html）ができないため、**Hashルーター**（`/app/#/pl/sessions` の形）を使う。S3＋CloudFrontへ移行したら通常のパスに切り替えられる。
- `WEB_BASE=/CarTaGraphFantasy/app/` を付けてビルドすると、そのサブパス用の成果物になる（GitHub Actions がこれを使う）。ローカル開発時は `/`。

## コマンド

```sh
pnpm web:dev         # http://localhost:5173（MSW 有効）
pnpm web:test        # vitest（MSW の node サーバーで全ページを描画）
pnpm web:typecheck
pnpm build:pages     # docs + app を docs/.vitepress/dist にまとめてビルド（CI と同じ）
```
