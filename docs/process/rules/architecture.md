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
  src/
    app/        routes.ts（ルート一覧＝ナビ・サイトマップの唯一の情報源）、router.tsx、AppShell.tsx
    pages/<ロール>/  ページ。1ページ1ファイル（pl / gm / creator / rulebook / admin）
    components/ 複数ページで共有するUI（GameCard / HandDock / Hud / DeckTree など）
    lib/        api.ts（fetchラッパー）、queries.ts（TanStack Query のフック）、整形・変換
    mocks/      fixtures.ts（モックデータのシード）、scenarioFiles.ts（scenarios/*.json の読み込み）、
                handlers.ts（MSW ハンドラ）、browser.ts / node.ts
    content/    ルールブック本文（docs の要約。出典リンク付き）
    styles/     tokens.css（デザイントークン）、global.css
    test/       Vitest のテスト（docs/process/rules/testing.md）
  e2e/          Playwright のテスト
packages/domain/src/      ドメイン型と、UIに依存しないゲームロジック（純粋関数）。
                          仕様ページに合わせたドメインごとのディレクトリ（下の「packages/domain の中の置き場所」）
scenarios/                遊べるシナリオの JSON（シードの一部。読み込みと検査は Webアプリの構成「シナリオの JSON」）
scripts/                  ビルド補助（GitHub Pages へのコピー、自動戦闘のシミュレーション）
```

迷ったらこの順で問う。

1. ゲームのルール・判定・変換で、React にも DOM にも依存しない → `packages/domain`。その中では、用語の持ち主の仕様ページに対応するディレクトリへ（下の「packages/domain の中の置き場所」）
2. 1つのページでしか使わない → `apps/web/src/pages/<ロール>/` の中で完結させる
3. 複数ページで共有するUI → `components/`。ただし2ページ目が現れるまで共通化しない
4. API へのアクセス → `lib/api.ts` と `lib/queries.ts` を経由する。ページから `fetch` を直接呼ばない
5. モックデータの追加 → 遊べるシナリオはリポジトリ直下の `scenarios/<id>.json`、それ以外（テスト専用のシナリオを含む）は `mocks/fixtures.ts` に置く。ページやテストの中で独自のデータを作らない

## 依存の向き

```text
apps/web ──→ packages/domain ──→ zod
   │
   └──→ scenarios/*.json（mocks/scenarioFiles.ts が読み、packages/domain の検査を通す）
```

- **パッケージの間** — `apps/web` は `packages/domain` を参照してよい。逆は禁止。`packages/domain` は React・DOM・MSW に依存しない（下の「境界」）
- **packages/domain の中** — 下の層だけを import してよい（下の「packages/domain の中の置き場所」の図と表。Biome で機械的に止める）
- **apps/web の中** — いまはディレクトリ間の向きを決めていない（置き場所は下の「迷ったらこの順で問う」）

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

## 1ファイル1責務

- ファイルの担当を一文で言えること。「セッション管理ページ」は合格、「GM周りのUIいろいろ」は失格
- ファイルが肥大したら、責務の境界で割る（例：ページの中の大きな一区画を `components/` へ）
- ルート・ナビ・サイトマップの情報は `app/routes.ts` だけが持つ。他のファイルにパスの一覧を書かない

## 境界

- `packages/domain` は React・DOM・MSW に依存しない。`apps/web` から `packages/domain` を参照し、逆は禁止
- `packages/domain` の型と用語は `docs/` の用語に対応させる。**用語の意味を変えるときは docs を先に更新する**（SSOT）
- 未解決論点（`docs/open-questions.md`）に関わる仮ルールは、コードのコメントと画面表示の両方で「仮」と明示する（例：キャラクター作成の能力値配分）
- barrel export（`index.ts` への集約・再エクスポート）は新規に作らない。実ファイルへ直接 import する
- 業務コードに `console.*` を残さない（`biome.json`の`noConsole`がコミット前フックで機械的に検知して止める。`scripts/`配下のNode.jsビルドスクリプトは対象外）。構造化ログの方針はバックエンド着手時に定める

## 副作用の分離（Functional Core / Imperative Shell）

- ゲームの判定・計算・変換（比較判定、デッキのフィルタ、状態遷移の可否など）は純粋関数に集め、`packages/domain` または `lib/` に置く（Functional Core）
- API 呼び出し・ローカルストレージ・時刻・乱数・環境変数の参照は、フック・ハンドラなど外側の薄い層へ寄せ、Core が返した結果を実行するだけに近づける（Imperative Shell）
- 狙いは、複雑なロジックを MSW もブラウザも無しでテストできる形に保つこと

## 将来のバックエンド（予約）

[技術スタック](../../architecture/index.md)で決着した Neon（Postgres）と AWS + CDK に着手したら、次を詳細化する。それまでは原則だけ置いておく。

- マイグレーションは前進のみ（forward only）。適用済みファイルは編集しない
- DB が守るもの（一意性・参照整合・値域・同時実行で破れる不変条件）と、アプリが守るもの（認可・業務フローの順序・外部サービスとの整合）を分ける。判断基準は「UIを通らない書き込みでも絶対に壊れてはいけないか」
- 秘密値（トークン・APIキー・生の個人情報）をログに書かない
