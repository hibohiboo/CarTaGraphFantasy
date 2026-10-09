# CarTaGraphFantasy

進化型カードTRPG「カルタグラフ」の設計仕様書と、その閲覧・セッション管理を行う Web アプリ。

- 仕様書サイト（GitHub Pages）：https://hibohiboo.github.io/CarTaGraphFantasy/
- Web アプリ（モックAPIで動く試作版）：https://hibohiboo.github.io/CarTaGraphFantasy/app/

## ローカルで動かす

### 必要なもの

- Node.js 24
- pnpm 11（`corepack enable` で `package.json` の `packageManager` に書かれた版が使える）

### 立ち上げ

```sh
pnpm install     # 初回だけ。git フック（.githooks）も自動で設定される
pnpm web:dev     # Web アプリ → http://localhost:5173
pnpm docs:dev    # 仕様書サイト（VitePress）→ ターミナルに表示される URL
```

- Web アプリにバックエンドはまだ無い。`/api/*` はブラウザ内の MSW（Mock Service Worker）が応答し、データはメモリ上にあってリロードで初期状態に戻る
- 画面は Hash ルーターなので、URL は `http://localhost:5173/#/<パス>` の形になる。全ページの一覧はアプリ内のサイトマップ（`/#/admin/sitemap`）で見られる
- たとえば、GM不在のソロプレイ（村スタート）は `http://localhost:5173/#/pl/village-start` から始められる

### テストなど

```sh
pnpm web:typecheck && pnpm web:test   # 型検査とテスト（push 前に git フックでも自動で走る）
pnpm docs:build                       # 仕様書サイトのビルド（リンク切れ検査）
```

コマンドの全一覧と開発ルールは [AGENTS.md](AGENTS.md)、Web アプリの構成は [docs/architecture/web-app.md](docs/architecture/web-app.md) を参照。

## ディレクトリ

- ドキュメント（`docs/`）の置き場所は [AGENTS.md](AGENTS.md)「ディレクトリ構成」
- コード（`apps/web/`・`packages/domain/`・`scenarios/`・`rules/`）の構成と依存の向きは [アーキテクチャルール](docs/process/rules/architecture.md)「構造」「依存の向き」

開発の進め方（プラン→レビュー→実装→テストの開発サイクル）は [docs/process/index.md](docs/process/index.md) にある。
