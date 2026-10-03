---
paths:
  - "apps/**"
  - "packages/**"
---

# アーキテクチャルール（どこに何を置くか）

対象：`apps/**`、`packages/**`。**コードのディレクトリ構成と依存の向きは、ここが正**（README・AGENTS.md・[Webアプリの構成](../../architecture/web-app.md)はここを指す）。技術選定の経緯は[技術スタック](../../architecture/index.md)、Webアプリの動き（MSW・ルーティング・画面・シナリオの JSON の読み込み）は[Webアプリの構成](../../architecture/web-app.md)にある。

## 構造

```text
apps/web/                 Vite + React + react-router + TanStack Query + MSW
  public/mockServiceWorker.js  MSW が生成した Service Worker（コミットする）
  src/          Feature-Sliced Design（FSD）の層。上から app → pages → widgets → features → entities → shared
    app/        router.tsx（ページを並べる）、AppShell.tsx、styles/（tokens.css・global.css）
    pages/<グループ>/<ページ>/   1ページ1スライス（グループはルートのグループ＝pl / gm / creator / rulebook / admin。
                ロールの無いページは pages/<ページ>/）。ui/ にページと、そのページだけで使う部品
    widgets/    複数のページで使う、画面の大きなまとまり（play-screen：プレイ画面の HUD・卓・手札・名乗り）
    features/   利用者の操作と UI が対になったもの（いまは無い。必要になったら作る）
    entities/<エンティティ>/   card・character・scenario・session・library・user。
                api/（queries.ts：取得、mutations.ts：変更）と ui/（GameCard・DeckTree など）
    shared/     ui/（ui.tsx の部品・page.module.css）、api/（api.ts：fetch のラッパー、queryKeys.ts）、
                lib/（整形・変換）、content/（ルールブック本文。docs の要約）、
                routes/（routes.ts：ルート一覧＝ナビ・サイトマップの唯一の情報源）
    main.tsx    エントリ（層の外）
    mocks/      層の外。fixtures.ts（モックデータのシード）、scenarioFiles.ts（scenarios/*.json の読み込み）、
                handlers.ts（MSW ハンドラ）、browser.ts / node.ts
    test/       層の外。Vitest のテスト（docs/process/rules/testing.md）
  e2e/          Playwright のテスト
packages/domain/src/      ドメイン型と、UIに依存しないゲームロジック（純粋関数）。
                          仕様ページに合わせたドメインごとのディレクトリ（下の「packages/domain の中の置き場所」）
scenarios/                遊べるシナリオの JSON（シードの一部。読み込みと検査は Webアプリの構成「シナリオの JSON」）
scripts/                  ビルド補助（GitHub Pages へのコピー、自動戦闘のシミュレーション）
```

迷ったらこの順で問う。

1. ゲームのルール・判定・変換で、React にも DOM にも依存しない → `packages/domain`。その中では、用語の持ち主の仕様ページに対応するディレクトリへ（下の「packages/domain の中の置き場所」）
2. 1つのページでしか使わない → そのページのスライス（`pages/<ロール>/<ページ>/`）のセグメントに置く（部品は `ui/`、副作用は `api/`、変換は `lib/`）。一度しか使わないものは、使う側に置く
3. 複数のページで使う → 何かで分ける。エンティティ（カード・シナリオなど）の見た目・取得・変更は `entities/<エンティティ>/`、利用者の操作と UI が対になったものは `features/`、画面の大きなまとまりは `widgets/`、業務のロジックを持たず、どこからでも使う部品・関数・静的な内容（UI の部品、fetch のラッパー、ルート一覧、ルールブックの本文など）は `shared/`。ただし2ページ目が現れるまで共通化しない
4. API へのアクセス → `entities/<エンティティ>/api/` の取得（queries.ts）・変更（mutations.ts）のフックを経由する。ページから `fetch` を直接呼ばない。クエリキーは `shared/api/queryKeys.ts`
5. モックデータの追加 → 遊べるシナリオはリポジトリ直下の `scenarios/<id>.json`、それ以外（テスト専用のシナリオを含む）は `mocks/fixtures.ts` に置く。ページやテストの中で独自のデータを作らない

## 依存の向き

```text
apps/web ──→ packages/domain ──→ zod
   │
   └──→ scenarios/*.json（mocks/scenarioFiles.ts が読み、packages/domain の検査を通す）
```

- **パッケージの間** — `apps/web` は `packages/domain` を参照してよい。逆は禁止。`packages/domain` は React・DOM・MSW に依存しない（下の「境界」）
- **packages/domain の中** — 下の層だけを import してよい（下の「packages/domain の中の置き場所」の図と表。Biome で機械的に止める）
- **apps/web の中** — FSD の層の順に、下の層だけを import してよい。同じ層の別スライスは import しない（`app → pages → widgets → features → entities → shared`）
  - スライスの外は `@/<層>/…` のエイリアス、スライスの中は相対パスで import する。エイリアスに `..` を入れない
  - 層・グループのフォルダ（`pages/<グループ>/`）・スライスの直下にファイルを置かない（app を除く）。必ずセグメント（例：`ui`・`api`・`lib`・`model`。shared には `content`・`routes` もある）に入れ、セグメントの中にさらにフォルダを作らない。直下に置くと `../` だけで別のスライスに届き、深くすると同じスライスの中の import が検査に止められるため。グループのフォルダには共有コードを置かない
  - 公開 API の index.ts は作らない。スライスの外からもファイルを直接 import する（下の「境界」の barrel 禁止に従う。FSD も index を必須としていない）
  - `main.tsx`・`vite-env.d.ts`・`mocks/`・`test/` は層の外。層の外は層を import してよい（`@/` で）。層は層の外を import しない
  - packages/domain との違い：domain の中は決まった向きならディレクトリをまたげる（例：`scenario → card`）が、web の entities はエンティティどうしの import を禁止する（FSD）。複数のエンティティを組み合わせる UI は widgets か pages で組み合わせる。エンティティをまたぐキャッシュの無効化は、shared のクエリキーで行う
  - 機械的な検査は Biome（`biome.json` の `apps/web/src/<層>/**` ごとの `style/noRestrictedImports`）。禁止パターンの正は `biome.json`、理由はここ。層を足す・向きを変えるときは両方を直す。経緯は `docs/plans/2026-10-03-webのFSD移行.md`

## packages/domain の中の置き場所

`packages/domain/src/` は、仕様ページ（`docs/cartagraph/`）に合わせたドメインごとのディレクトリに分ける。ディレクトリの一覧は下の表が正。

- **型は `model.ts`、ロジックは役割の名前のファイル** — 各ディレクトリの型は `model.ts` に置き、zod スキーマ・型（`z.infer`）・ラベルを隣り合わせにする。ロジックは `resolve.ts`・`refs.ts`・`transition.ts` のように役割で名づける。テストは対象と同じディレクトリに、対象のファイル名で置く
- **直下にファイルを置かない。`index.ts` を作らない** — 利用側は `@cartagraph/domain/<ディレクトリ>/<ファイル>` を直接 import する（`package.json` の `exports` はワイルドカード）。domain の中は相対パスで import し、自分のパッケージ名では import しない
- **新しいディレクトリを足すときは、下の依存の表にも足す**

### ディレクトリと依存の向き

下の層だけを import してよい（同じディレクトリの中は自由）。`user/`・`library/` はどこからも import されない末端。

```text
check ← card ← character ← autoCombat ← scenario ← session ← soloVillage
check ← card ← library        user（どこにも依存しない）
```

| ディレクトリ | 仕様ページ |
|---|---|
| `check/` | exploration-check.md（能力値・判定） |
| `card/` | card-and-deck.md・card-face-back.md |
| `character/` | character-growth.md・role-and-scenario.md（典型ロール）・comparison-and-titles.md（称号） |
| `autoCombat/` | auto-combat.md |
| `scenario/` | scenario-flow.md |
| `session/` | party-and-session.md・play-and-field.md・scenario-flow.md（募集） |
| `soloVillage/` | solo-village.md |
| `user/` | graph.md（ロール）・unlock.md・character-growth.md（解放済みカードプール） |
| `library/` | graph.md（共有ライブラリ） |

**機械的な検査は Biome**（コミット前のフックと CI の lint）。各ディレクトリが import してよい先の正は `biome.json` の `overrides`（`style/noRestrictedImports` の許可リスト）で、表に無いディレクトリはほかのディレクトリを import できない。循環は `suspicious/noImportCycles`、barrel は `performance/noBarrelFile`・`noReExportAll` で止める。ディレクトリを足す・依存の向きを変えるときは、この節と `biome.json` を一緒に直す（`biome.json` はコメントを書けないので、理由はここに書く）。

### 仕様ページに合わせる、の例外

1. **カードが持つ属性の型は `card/`** — 自動戦闘の効果（`CombatEffect`・`DiceExpr`）、配る条件（`CardCondition`）、成長の効果（`SoloEffect`）は、出典が auto-combat.md・solo-village.md でも `card/model.ts` に置く（`CardDef` とスキーマが互いを参照するため）。それを使うロジックは各ドメインに置く
2. **カードの条件の判定も `card/`** — 配る条件・使える条件の判定（`card/condition.ts`）は、セッションの遷移と村のルールの両方が使うので、循環を避けてカードの側に置く
3. **判定（`CheckSpec`）は `check/`** — カードの属性だが、持ち主は exploration-check.md なので、例外1より優先して `check/` に置く
4. **募集は `session/`** — 募集→応募→確定は scenario-flow.md が書いているが、GM がシナリオからセッションを立てる手続きで、シナリオの定義そのものではないので `session/` に置く

## React の書き方

React のコードは、Vercel Labs の [react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)（性能の70ルール・8カテゴリ。MIT）に沿って書き、レビューする。リポジトリには `.claude/skills/react-best-practices/` に取り込んである（取り込んだコミットは同じ場所の `VENDOR.md`。Claude Code 以外のツールでも、このファイル群か配布元を読めばよい）。

- **対象外のルール** — Next.js・サーバーを前提にしたもの（`server-` で始まるルール、RSC・Server Actions・`next/dynamic`・`after()`・ハイドレーション（`rendering-hydration-`）・`client-swr-dedup`）。このアプリは Vite の SPA で、データ取得は TanStack Query を使う（2026-09-22 の適用時と同じ扱い）
- **Biome で機械的に止めているもの**（`biome.json`。コミット前のフックと CI の lint）
  - `rerender-dependencies`・`advanced-effect-event-deps` → `correctness/useExhaustiveDependencies`（推奨ルールとして有効）
  - `rerender-no-inline-components` → `correctness/noNestedComponentDefinitions`
  - フックの呼び方 → `correctness/useHookAtTopLevel`
  - `bundle-barrel-imports` → 下の「境界」の barrel 禁止
- **Biome に対応があっても有効にしていないもの**
  - `rendering-conditional-render` → `suspicious/noLeakedRender`：型を見ずに `&&` を一律に指摘するので、真偽値・文字列の条件まで誤検知する（2026-10-03 に既存コードで20件、ほぼ誤検知）。数値が漏れるかはレビューで見る
  - `js-hoist-regexp` → `performance/useTopLevelRegex`：既存コードに違反がある（本体9件・テスト11件）。直してから有効にする（[既知の問題](../../architecture/known-issues.md)）

## 1ファイル1責務

- ファイルの担当を一文で言えること。「セッション管理ページ」は合格、「GM周りのUIいろいろ」は失格
- ファイルが肥大したら、責務の境界で割る（例：ページの中の大きな一区画を、そのページのスライスの `ui/` に別ファイルとして切り出す。複数のページで使うなら widgets・entities へ）
- ルート・ナビ・サイトマップの情報は `shared/routes/routes.ts` だけが持つ。他のファイルにパスの一覧を書かない（ページから使うので shared に置く。ページを並べる `app/router.tsx` は app）

## 境界

- `packages/domain` は React・DOM・MSW に依存しない。`apps/web` から `packages/domain` を参照し、逆は禁止
- `packages/domain` の型と用語は `docs/` の用語に対応させる。**用語の意味を変えるときは docs を先に更新する**（SSOT）
- 未解決論点（`docs/open-questions.md`）に関わる仮ルールは、コードのコメントと画面表示の両方で「仮」と明示する（例：キャラクター作成の能力値配分）
- barrel export（`index.ts` への集約・再エクスポート）は新規に作らない。実ファイルへ直接 import する（`packages/domain` と `apps/web/src` は Biome の `noBarrelFile`・`noReExportAll` で止める）
- 業務コードに `console.*` を残さない（`biome.json`の`noConsole`がコミット前フックで機械的に検知して止める。`scripts/`配下のNode.jsビルドスクリプトは対象外）。構造化ログの方針はバックエンド着手時に定める

## 副作用の分離（Functional Core / Imperative Shell）

- ゲームの判定・計算・変換（比較判定、デッキのフィルタ、状態遷移の可否など）は純粋関数に集め、`packages/domain` か、apps/web のスライスの `lib/` セグメント（複数で使うなら `shared/lib/`）に置く（Functional Core）
- API 呼び出し・ローカルストレージ・時刻・乱数・環境変数の参照は、フック・ハンドラなど外側の薄い層へ寄せ、Core が返した結果を実行するだけに近づける（Imperative Shell）
- 狙いは、複雑なロジックを MSW もブラウザも無しでテストできる形に保つこと

## 将来のバックエンド（予約）

[技術スタック](../../architecture/index.md)で決着した Neon（Postgres）と AWS + CDK に着手したら、次を詳細化する。それまでは原則だけ置いておく。

- マイグレーションは前進のみ（forward only）。適用済みファイルは編集しない
- DB が守るもの（一意性・参照整合・値域・同時実行で破れる不変条件）と、アプリが守るもの（認可・業務フローの順序・外部サービスとの整合）を分ける。判断基準は「UIを通らない書き込みでも絶対に壊れてはいけないか」
- 秘密値（トークン・APIキー・生の個人情報）をログに書かない
