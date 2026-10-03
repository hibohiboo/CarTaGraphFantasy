---
paths:
  - "apps/**"
  - "packages/**"
---

# アーキテクチャルール（どこに何を置くか）

対象：`apps/**`、`packages/**`。技術選定の経緯は[技術スタック](../../architecture/index.md)、現在の構成は[Webアプリの構成](../../architecture/web-app.md)が正で、ここでは「新しいコードをどこに置き、何を守るか」だけを定める（例外として、`packages/domain` のディレクトリの一覧は、依存の向きと一緒にここの表が正）。

## 構造

```text
packages/domain/src/     ドメイン型と、UIに依存しないゲームロジック（純粋関数）。ドメインごとのディレクトリに分ける（下の「packages/domain の中の置き場所」）
apps/web/src/
  app/        routes.ts（ルート一覧＝ナビ・サイトマップの唯一の情報源）、router.tsx、AppShell.tsx
  pages/<ロール>/  ページ。1ページ1ファイル
  components/ 複数ページで共有するUI
  lib/        api.ts（fetchラッパー）、queries.ts（TanStack Query のフック）、整形・変換
  mocks/      fixtures.ts（モックデータのシード）、scenarioFiles.ts（scenarios/*.json の読み込み）、handlers.ts（MSW ハンドラ）
  content/    ルールブック本文（docs の要約。出典リンク付き）
  styles/     tokens.css（デザイントークン）、global.css
scenarios/    遊べるシナリオの JSON（シードの一部。packages/domain の scenarioSchema で検査する）
```

迷ったらこの順で問う。

1. ゲームのルール・判定・変換で、React にも DOM にも依存しない → `packages/domain`。その中では、用語の持ち主の仕様ページに対応するディレクトリへ（下の「packages/domain の中の置き場所」）
2. 1つのページでしか使わない → `apps/web/src/pages/<ロール>/` の中で完結させる
3. 複数ページで共有するUI → `components/`。ただし2ページ目が現れるまで共通化しない
4. API へのアクセス → `lib/api.ts` と `lib/queries.ts` を経由する。ページから `fetch` を直接呼ばない
5. モックデータの追加 → 遊べるシナリオはリポジトリ直下の `scenarios/<id>.json`、それ以外（テスト専用のシナリオを含む）は `mocks/fixtures.ts` に置く。ページやテストの中で独自のデータを作らない

## packages/domain の中の置き場所

`packages/domain/src/` は、仕様ページ（`docs/cartagraph/`）に合わせたドメインごとのディレクトリに分ける。ディレクトリの一覧は下の「依存の向き」の表が正（[Webアプリの構成](../../architecture/web-app.md)はここを指す）。

- **型は `model.ts`、ロジックは役割の名前のファイル** — 各ディレクトリの型は `model.ts` に置き、zod スキーマ・型（`z.infer`）・ラベルを隣り合わせにする。ロジックは `resolve.ts`・`refs.ts`・`transition.ts` のように役割で名づける。テストは対象と同じディレクトリに、対象のファイル名で置く
- **直下にファイルを置かない。`index.ts` を作らない** — 利用側は `@cartagraph/domain/<ディレクトリ>/<ファイル>` を直接 import する（`package.json` の `exports` はワイルドカード）。domain の中は相対パスで import し、自分のパッケージ名では import しない
- **新しいディレクトリを足すときは、下の依存の表にも足す**

### 依存の向き

各ディレクトリが import してよい先（同じディレクトリの中は自由）。`packages/domain/src/layers.test.ts` がソースを読んで機械的に確かめる。テストの中の表（`ALLOWED`）はこの表の写しで、一致しないとテストが落ちるので、表を変えるときは一緒に直す。

| ディレクトリ | 仕様ページ | import してよい先 |
|---|---|---|
| `check/` | exploration-check.md（能力値・判定） | なし |
| `user/` | graph.md（ロール）・unlock.md・character-growth.md（解放済みカードプール） | なし |
| `card/` | card-and-deck.md・card-face-back.md | `check/` |
| `library/` | graph.md（共有ライブラリ） | `card/`・`check/` |
| `character/` | character-growth.md・role-and-scenario.md（典型ロール）・comparison-and-titles.md（称号） | `card/`・`check/` |
| `autoCombat/` | auto-combat.md | `character/`・`card/`・`check/` |
| `scenario/` | scenario-flow.md | `autoCombat/`・`character/`・`card/`・`check/` |
| `session/` | party-and-session.md・play-and-field.md・scenario-flow.md（募集） | `scenario/`・`autoCombat/`・`character/`・`card/`・`check/` |
| `soloVillage/` | solo-village.md | `session/`・`scenario/`・`autoCombat/`・`character/`・`card/`・`check/` |

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
- barrel export（`index.ts` への集約・再エクスポート）は新規に作らない。実ファイルへ直接 import する。既存の `components/index.ts` は解消候補（[体制の進化ログ](../evolution.md)参照）
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
