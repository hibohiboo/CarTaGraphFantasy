---
paths:
  - "biome.json"
  - "apps/**"
  - "packages/**"
---

# 静的解析ルール（Biome で止めるもの）

コードの品質を、人やAIの注意ではなく機械で保つための設定と、その理由を置く。検査は Biome（lint・整形）が担い、コミット前のフック（`.githooks/pre-commit`）と CI の `pnpm lint` で必ず回る（コマンドは `AGENTS.md`）。型の検査は `tsc`、用語の旧称は `pnpm docs:build` の `scripts/check-terms.mjs`、画面一覧・導線図とルート定義の食い違いは同じく `scripts/check-screens.mjs` が止める。

**設定の正は `biome.json`、理由はこのページ。** `biome.json` にはコメントを書けない（書くと設定の読み込みが失敗し、既定の整形が当たる）。ルールを足す・外す・しきい値を変えるときは、`biome.json` とこのページを一緒に直す。

## 有効にしているルール

Biome の推奨ルール（`"preset": "recommended"`）に加えて、次のルールを有効にしている。理由をほかのページに書いているものは、そのページが正。

| 目的 | ルール | 理由の置き場所 |
|---|---|---|
| コードの複雑さ | `complexity/noExcessiveCognitiveComplexity` など4つ | 下の「コードの複雑さ」 |
| 依存の向き・置き場所 | `style/noRestrictedImports`（層・ディレクトリごとの overrides）、`suspicious/noImportCycles`、`performance/noBarrelFile`・`noReExportAll` | [アーキテクチャルール](architecture.md)「依存の向き」「packages/domain の中の置き場所」「境界」 |
| React の書き方 | `correctness/noNestedComponentDefinitions`・`useHookAtTopLevel` | [アーキテクチャルール](architecture.md)「React の書き方」 |
| 消し忘れ | `correctness/noUnusedVariables`・`noUnusedImports`、`suspicious/noConsole` | [アーキテクチャルール](architecture.md)「境界」（`console.*`） |
| テスト | `suspicious/noSkippedTests`・`noFocusedTests`（`linter.domains.test` は `"all"`） | [テストルール](testing.md) |

## コードの複雑さ

読みにくく、壊れやすい関数を早めに止める。SonarJS（SonarQube の JavaScript 用ルール）の中心にある考え方を、Biome に同じ考えのルールがあるものだけ入れた（2026-10-09）。しきい値は、迷ったら SonarJS の既定に合わせる。

| ルール | しきい値 | SonarJS の対応 | 何を止めるか |
|---|---|---|---|
| `complexity/noExcessiveCognitiveComplexity` | 15 | `cognitive-complexity`（既定15） | 分岐・ループ・入れ子が深く、頭の中で追いきれない関数 |
| `complexity/noExcessiveLinesPerFunction` | 200行 | S138（関数の行数、既定200） | 1つの関数に詰め込みすぎた処理。テストは対象外（下の overrides） |
| `style/noExcessiveLinesPerFile` | 1000行 | S104（ファイルの行数、既定1000） | 責務の割れていないファイル（「1ファイル1責務」の機械的な目安） |
| `complexity/useMaxParams` | 4個 | S107（既定7） | 引数の多い関数。オブジェクト1つで受ける。導入時の違反が0件だったので、Biome の既定（4）のまま厳しくした |

- **引っかかったら** — 関数を分ける（判定・計算は純粋関数へ出す。[アーキテクチャルール](architecture.md)「副作用の分離」）。React のコンポーネントなら、画面の一区画を子コンポーネントに切り出す。しきい値を上げて通すことはしない
- **既存の違反** — 導入時に16件あった（認知的複雑度14件、関数の行数1件、ファイルの行数1件）。それぞれの箇所に `biome-ignore`（理由つき）を付けて止め、一覧と直し方は[既知の問題](../../architecture/known-issues.md)「複雑度・行数の上限を超える既存のコード」に置いた。直したら `biome-ignore` を消す
- **新しく抑えるとき** — `biome-ignore` を新しく足すのは、分けるとかえって読みにくくなる理由があるときだけにし、その理由をコメントに書く。レビューで理由を確かめる

## overrides で外しているもの

| 対象 | 外したルール | 理由 |
|---|---|---|
| テスト（`*.test.ts(x)`・`apps/web/src/test/**`・`apps/web/e2e/**`） | `style/noNonNullAssertion` | 見つけた要素の祖先（`closest` など）に `!` を付けて辿るのが定石で、見つからなければテストが落ちる |
| テスト（同上） | `complexity/noExcessiveLinesPerFunction` | `describe` の中に場面ごとの `it` を並べるので、`describe` の関数は長くなるのが自然。テストの読みやすさは場面の分け方で見る |
| `**/*.vue` | `correctness/noUnusedImports`・`noUnusedVariables` | Biome は Vue のテンプレート内での使用を解析できず、安全な自動修正（pre-commit）で必要な import を消してしまう |
| `scripts/**` | `suspicious/noConsole` | Node.js の補助スクリプトで、出力が仕事 |

## 検査の対象から外しているファイル

`files.includes` の `!` で、Biome の検査（lint・整形）から丸ごと外している。ビルドの出力・依存・自動生成のファイルのほかに、次の2つを外している。

| 対象 | 理由 |
|---|---|
| `docs/public/preview/` | HTML/CSS だけの使い捨ての UI 試作。React 化したら消すもので、コードとして保守しない |
| `docs/public/teaser/` | ティザー映像の HTML 1枚で、版ごとに丸ごと作り直す（直さない）。インラインの script を検査すると、アプリのコード向けの上限（複雑さなど）に当たる |

## 入れていないもの

- **重複コード（コピー＆ペースト）の検出** — SonarJS の「重複」の指標にあたるものは Biome に無い。入れるなら `jscpd` を CI に足す（候補）
- **意味まで見る SonarJS のルール**（同じ条件の分岐 `no-identical-conditions`、常に同じ値を返す関数など） — Biome に対応が無い。SonarJS 自体を使うには ESLint を併走させることになり、道具が2つになるので入れていない
- **`nursery/noExcessiveNestedCallbacks`** — 導入時の違反は0件だが、nursery（試験中）のルールは版の更新で名前や挙動が変わり、`biome.json` が読めなくなることがある。推奨ルールの群に上がったら入れる
- **React の書き方のうち誤検知が多いもの・既存の違反があるもの**（`suspicious/noLeakedRender`・`performance/useTopLevelRegex`） — [アーキテクチャルール](architecture.md)「React の書き方」
