# Webアプリ（apps/web）の仕組み

[技術スタック](index.md)のモノレポ方針に沿って追加した、React製フロントエンドの構成をまとめる。[試作フェーズの引き継ぎ](prototype-handover.md)で決めたデザイントークン・コンポーネント境界を、そのままReactに移植したもの。

公開先：`https://hibohiboo.github.io/CarTaGraphFantasy/app/`（このdocsサイトと同じGitHub Pagesの `app/` 配下）
E2Eレポート：`https://hibohiboo.github.io/CarTaGraphFantasy/e2e-report/`（Playwrightのスクリーンショット付きHTMLレポート。mainへのpushごとに更新）

## 位置づけ

- **バックエンドはまだ作らない。** `/api/*` はすべて [MSW](https://mswjs.io/)（Mock Service Worker）が横取りして応答する。状態はブラウザのメモリ上にあり、リロードで初期化される。本番ビルド（GitHub Pages）でもMSWを起動している。
- 本物のAPIができたら、`apps/web/src/shared/api/api.ts` の接続先を差し替え、`src/mocks/` を開発時のみ有効にする想定。
- TanStack Queryの `QueryClient`（`src/main.tsx`）は `retry: false, staleTime: 5_000` のみを設定している。実レイテンシ・更新頻度を測定できる材料がまだ無いため、データ種別ごとのキャッシュチューニングは実バックエンド接続後に実測してから見直す。
- [フェーズ分け](index.md#開発フェーズの段階分け決着)（まず閲覧サイト→後にセッション管理）の方針は変えていない。セッション管理系の画面も含めて先に画面を作っているのは、モックで体験を検証するためであり、バックエンド実装の着手順は改めて判断する。

## ディレクトリ

コードのディレクトリ構成と依存の向きは、[アーキテクチャルール](../process/rules/architecture.md)の「構造」「依存の向き」が正。ここでは、そこに書いていない GitHub Pages 用のスクリプトだけを挙げる。

- `scripts/copy-web-to-pages.mjs` … ビルド成果物を docs の dist 配下 `app/` へコピー
- `scripts/copy-e2e-report-to-pages.mjs` … Playwright の HTML レポートを docs の dist 配下 `e2e-report/` へコピー

## シナリオの JSON

公開したことのあるシナリオ（村はずれの一歩・灰色館の一夜など）は、リポジトリ直下の `scenarios/<id>.json` に1シナリオ1ファイルで置く。非公開にしたシナリオも `libraryStatus: draft` のまま残る（消すかは人間が git で決める）。将来バックエンドができたら、同じ JSON を投入データとして使う。テスト専用のシナリオと下書きのデモデータは `src/mocks/fixtures.ts` に置く。

- **読み込み** — `src/mocks/scenarioFiles.ts` が `import.meta.glob` で読み、`packages/domain` の `parseScenarioFile` で検査してから `fixtures.ts` の `scenarios` に入れる。GitHub Pages のビルドにも入る。開発サーバーの起動中に手で新しいファイルを足したときは、再起動すると拾う（既存のファイルの編集はそのまま反映される）。画面から公開して書いたファイルは、次に手でリロードしたときに拾う（下の「画面から公開する」）
- **検査** — 形（`scenarioSchema`。知らないキーは誤り、省略可能な項目に `null` は書けない）、ファイル名と `id` の一致、参照の整合（`findScenarioRefErrors`。`nextNodeId`・`endingId`・id の重複）。誤りがあれば、アプリ（MSW）の起動とテストがファイル名つきで止まる
- **注記** — JSON にはコメントが書けないので、なぜそのデータかの注記は `"$comment"` に書く（シナリオ・ノード・カード・自動戦闘の敵）。画面には出さない
- **整形** — Biome が正（コミット前フックが整形する）
- **直したら** — `pnpm web:test` を通す（ライトルート。[開発プロセス](../process/index.md)）
- **画面から公開する** — シナリオ製作者が「シナリオ集へ公開」すると、開発サーバー（`pnpm web:dev`）では `scenarios/<id>.json` に書く。公開中のシナリオの保存（シーン編集を含む）と「非公開にする」（`draft` で書き直す）でも書き直す。下書きはメモリだけ。書けるのは作者が自分のシナリオだけで、`fixtures.ts` にしか無いデモ・テスト用のシナリオは公開できない。カード画像（`data:` の URL）は書かない。GitHub Pages のデモは書かず、画面で「保存されません」と知らせる。書き込みの口は `apps/web/vite/scenarioFilePlugin.ts`、ブラウザ側の保存先は `src/mocks/devScenarioFileStore.ts`（`docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md`）

## ページ一覧（グループ別）

ページの一覧は、アプリ内のサイトマップ（`/admin/sitemap`）が `src/shared/routes/routes.ts` から生成している。ここでは概要だけ示す。

| グループ | ページ |
|---|---|
| PL | ホーム（参加中のセッション。中断中も出して「GM の裁定待ち／再開できます」を示し、自分がドライバーならプレイ画面へ）、セッション選択（募集一覧・応募。GM 不在の募集に絞り込み、自分のPCですぐに始める）、プレイページ（手札のプレイ・提案。GM 不在の募集のセッションでは、提案すると中断し、GM の裁定後に「続きを遊ぶ」で再開）、キャラクター一覧／作成／シート |
| GM | シナリオ管理（シナリオ集から選ぶ→カードの取捨選択→募集。通常の募集か GM 不在の募集かを選び、先へ進めないシーン・自動戦闘のシーンの注意を見る）、セッション管理（自分の募集から始める・描写と選択肢を配る（取り下げ・移り先の指定）・参加者・ゾーン・進行・提案の裁定（移り先付きで採用できる）・モード切り替え・終了）。GM 不在のセッションでは、描写と選択肢の枠を出さず、提案の裁定と終了だけを行う（中断中も裁定・終了できる）。GM が自分のキャラクターでドライバーも務めるときは、進行管理画面とプレイ画面をリンクで行き来する |
| シナリオ製作者 | シナリオ管理（一覧・新規作成・メタデータ／デッキ構造／結末タグの編集・シナリオ集へ公開と非公開。開発サーバーでは公開中のシナリオを `scenarios/<id>.json` に書き、保存したかを画面で知らせる） |
| ルールブック | 遊び方、判定ルール、共有設定（正史グラフから格上げされた設定・カード） |
| システム管理者 | サイトマップ、コンポーネントカタログ |

## 仕様との関係（SSOT）

- 仕様の正は引き続き `docs/` 配下。アプリ内のルールブック（`src/shared/content/rulebook.ts`）は docs の**要約**で、各節に出典リンクを持つ。docs 側と食い違ったら docs を正としてアプリ側を直す。
- `packages/domain` の型は docs の用語（カード種別・ロール・ゾーン・提案の状態など）に対応する。用語の意味を変える場合は docs を先に更新する。
- キャラクター作成の体・技・心の初期配分は[未決](../open-questions.md#次に詰める候補)のため、アプリでは「合計9を1〜5で配分」という**仮ルール**で動かしている（画面にもその旨を表示）。

## ルーティングと配信

- GitHub Pages はサブパス配下でSPAのフォールバック（404→index.html）ができないため、**Hashルーター**（`/app/#/pl/sessions` の形）を使う。S3＋CloudFrontへ移行したら通常のパスに切り替えられる。
- `WEB_BASE=/CarTaGraphFantasy/app/` を付けてビルドすると、そのサブパス用の成果物になる（GitHub Actions がこれを使う）。ローカル開発時は `/`。

## コマンド

```sh
pnpm web:dev         # http://localhost:5173（MSW 有効）。人間が手で起動する用
pnpm web:dev:agent   # http://localhost:5174。エージェントがブラウザで確かめる用
pnpm web:test        # vitest（MSW の node サーバーで全ページを描画）
pnpm web:e2e         # Playwright（Chromium）。ビルド→vite previewに対して全ルートを実ブラウザで巡回
pnpm web:typecheck
pnpm domain:test     # vitest（packages/domain の純粋関数。自動戦闘・シーン遷移など）
pnpm domain:typecheck # tsc（packages/domain。テストファイルも含む）
pnpm build:pages     # docs + app を docs/.vitepress/dist にまとめてビルド（CI と同じ）
pnpm sim:auto-combat # 自動戦闘の数値シミュレーション（任意実行。下記）
```

## 自動戦闘の数値シミュレーション

[自動戦闘（仮ルール）](../cartagraph/auto-combat.md)の数値バランスを確かめるスクリプト（`scripts/simulate-auto-combat.ts`）。村スタートのシナリオ `sc-village-start`（`scenarios/sc-village-start.json`）で村パートを終えたときの HP・行動値（`soloGrowth`）、お店で習える戦闘スキル、試験官の数値のまま、代表的な戦い方ごとに5,000回ずつ戦わせ、勝率と決着ラウンドの表を [シミュレーション結果](../cartagraph/auto-combat-simulation.md) に書き出す。

- **実行** — `pnpm sim:auto-combat`。回数・乱数の種は `pnpm sim:auto-combat -- --runs=10000 --seed=42` のように変えられる
- **いつ回すか** — CI・git フックでは回さない。次のようなときに手で回し、書き出された `docs/cartagraph/auto-combat-simulation.md` も一緒にコミットする
  - 村パートで得る HP・行動値、お店のスキル、試験官・戦闘スキルカードの数値（HP・行動値・コスト・ダイス）を `scenarios/sc-village-start.json` で変えたとき
  - 自動戦闘のエンジン（`packages/domain/src/autoCombat/resolve.ts`）の判定を変えたとき
  - 比べる戦い方を増やしたいとき（スクリプト内の `STRATEGIES` に足す）
- **結果の読み方** — 乱数は種つきなので、数値が同じなら何度回しても同じ表になる。回し直して表に差分が出たら、数値かエンジンが変わったということ
- **注意** — 結果のページはスクリプトが丸ごと作り直すので、手で編集しない（説明文を変えたいときはスクリプト側を直す）。スクリプトは `tsx` で実行し、型検査（`web:typecheck`・`domain:typecheck`）の対象外

## ローカル開発の注意（つまずきやすい点）

- **Git Bash で `WEB_BASE` を渡すとき** — `WEB_BASE=/CarTaGraphFantasy/app/ pnpm web:build` のように環境変数でパスを渡すと、Windows の Git Bash（MSYS2）がパス文字列をWindows形式に変換してしまい壊れる。ローカルで確認する場合は `MSYS_NO_PATHCONV=1 WEB_BASE=/CarTaGraphFantasy/app/ pnpm web:build` のように付ける。GitHub Actions（Ubuntu）では不要（`.github/workflows/deploy.yml` 参照）。
- **開発サーバーは決まったポートでだけ起動する** — `vite.config.ts` の `server.strictPort: true` で、ポートが埋まっていると起動は失敗する（別のポートで黙って起動しない）。人間が手で起動する `pnpm web:dev` は 5173 番、エージェントがブラウザで確かめるときの `pnpm web:dev:agent` は 5174 番に分けている。人間の開発サーバーと取り合わず、エージェントの確かめのスクリプトが開く URL も 5174 番に決まる。失敗したら、別の作業ツリー・ブランチの開発サーバーが同じポートで動いていないか確かめ、止めてから起動する
- **開発サーバーで公開すると、`scenarios/` にファイルが書かれる** — 「シナリオの JSON」の「画面から公開する」。書いても画面はリロードしない（メモリ上の募集・セッションを消さないため）。次に手でリロードしたとき、書いた JSON を読む（新しいファイルも拾う）。書き込みの口（`PUT /__dev/scenarios/:id`）はループバックからだけ受け付けるので、`http://localhost:5173` で開く（LAN の IP で開いた画面から公開すると失敗する）。整形はリポジトリ直下の Biome で行う（`@biomejs/biome` は apps/web の依存ではない）。エージェント用の `pnpm web:dev:agent`（5174番）は、既定で口を閉じ、デモと同じく書かない。書き込みを確かめるときだけ `CARTAGRAPH_WRITE_SCENARIOS=1` を付けて起動し、終わったら `git status scenarios/` を見て、作ったファイルを消し、書き直したファイルを `git checkout` で戻す。`vite build`・`vite preview`・Vitest には口が無い
- **vitest のバージョンを上げるときは pnpm workspace の peer 解決に注意** — pnpm workspace のルート（VitePress が使う vite 5 系）から peer 依存を解決してしまうと、`apps/web` の vitest が意図せず vite 5 系を掴んで動かなくなることがある。そのため `.npmrc` に `resolve-peers-from-workspace-root=false` を置き、`apps/web` の vitest は vite 7 系と整合する 4 系に固定している。`.npmrc` を消したり pnpm の設定を変えたりする際はこの依存関係を思い出すこと。

## 未React化の画面

次の画面は、まだ React 化していない。試作 HTML は `docs/public/preview/` に残しており、このdocsサイトのサイドバー「試作」（`docs/.vitepress/config.mts`）から見られる。

- 戦闘画面（2次元／1次元）：`combat-play.html`・`combat-play-1d.html`
- チャット：`session-chat.html`
- シーン進行（GM視点）：`scene-play.html`
- 場の状況：`session-field.html`

**React 化したら、その画面の試作 HTML は削除する**（サイドバー「試作」の項目も外す）。React 化済みだった10画面の試作は 2026-09-27 に削除した（`docs/plans/2026-09-27-試作HTMLの整理.md`）。削除した試作を見たいときは、git 履歴から取り出す（例：`git show 89845da:docs/public/preview/session-play.html`）。

シーン構築画面（カード編集）は`/creator/scenarios/:scenarioId/scenes/:sceneId`（`CreatorSceneEditPage.tsx`）としてReact化済み（`docs/plans/2026-09-16-scene-builder.md`、開発サイクルC4）。シーンの「目的」「終了条件」は未決の仮ルールとして実装しており、[未解決論点トラッカー](../open-questions.md)の該当項目は決着していない。

React 化する際は、この試作の見た目・情報設計を踏襲しつつ、既存の React コンポーネント（`entities/card/ui/GameCard.tsx`・`shared/ui/ui.tsx` 等）を再利用する。試作HTML自体のクラス構造をそのまま持ち込むのではない（[試作フェーズの引き継ぎ](prototype-handover.md)参照）。
