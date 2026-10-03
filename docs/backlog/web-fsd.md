---
title: apps/web のディレクトリ構成を Feature-Sliced Design に従わせる
status: 完了
summary: 開発者向け。apps/web/src のディレクトリ構成に決まった型が無いので、練られたパターンである Feature-Sliced Design（FSD）に従わせ、層の依存の向きを機械的に守る。振る舞いは変えない。
plans:
  - 2026-10-03-webのFSD移行.md
cycles:
  - { name: apps/web の FSD 移行, status: 完了, pr: 13 }
updated: 2026-10-03
---

# apps/web のディレクトリ構成を Feature-Sliced Design に従わせる

PR #12（[packages/domain をドメインごとのディレクトリに分ける](domain-structure.md)）の人間レビューで、「apps/web のディレクトリ構成は [Feature-Sliced Design](https://feature-sliced.design/ja) に従うようにしたい。何も無いのは問題で、練られたパターンがあるなら従っておくのがよい」と要望があった（2026-10-03）。いまの [アーキテクチャルール](../process/rules/architecture.md)「依存の向き」は、apps/web の中のディレクトリ間の向きを決めていない。

着手するときは grilling で下の「決めること」を決めてからプランにする。50ファイルほどの移動になるので、振る舞いを変えないリファクタリングとしてフルルートで回す。

## 方針（2026-10-03 決定）

- 正は FSD の1つにする。[bulletproof-react](https://github.com/alan2207/bulletproof-react) は比較の材料として一度読み、採らなかった理由をプランに残す（構成以外の API 層・テスト・状態管理の指針は参考にする）。2つを混ぜない

## FSD と bulletproof-react の違い（2026-10-03 時点の調べ）

| | Feature-Sliced Design | bulletproof-react |
|---|---|---|
| 構成 | `app / pages / widgets / features / entities / shared` の6層。層の中をスライス、スライスの中をセグメント（`ui`・`model`・`api`・`lib`・`config`）に分ける | `app / features / shared（components・hooks・lib…）` |
| 依存 | 下の層だけを import する。同じ層のスライスどうしは import しない | `shared → features → app` の一方向。features どうしは import しない |
| 入口 | スライスごとの公開 API が基本。index.ts は必須ではない。`export *` は強く非推奨。shared/ui はコンポーネントごとの入口を推奨 | barrel は Vite の tree-shaking を損なうので非推奨。直接 import する |
| 強制 | 公式の linter（Steiger） | ESLint の `import/no-restricted-paths` |

## 決めること（着手時の grilling。2026-10-03 に決めた。番号はプランの決定事項）

1. **公開 API と barrel 禁止のルール** — (a) index を作らず、スライス内のファイルを直接 import する（いまのルールのまま）／(b) apps/web だけ、スライスの入口に名前付きの再エクスポートを許す（`export *` は禁止）。いまのルール：アーキテクチャルール「境界」の barrel 禁止、`packages/domain` では Biome の `noBarrelFile`・`noReExportAll` → (a)。D1
2. **entities 層と packages/domain** — 型の正は packages/domain のまま。web の entities には UI・API（カードの見た目 `GameCard`、キャラクターのクエリなど）だけを置き、型を重ねて定義しない → 型の正は domain のまま。エンティティの分け方は domain に合わせ、依存の規則は FSD に従う（エンティティどうしは import しない）
3. **FSD の層に当てはまらないもの** — `mocks/`（MSW）、`content/`（ルールブックの要約）、`test/` の置き場所 → mocks・test・main.tsx は層の外。D4。content は shared/content
4. **pages の分け方** — いまはロールごと（`pages/gm/` など）。FSD のスライスは1ページ1つ。ルート一覧の唯一の情報源 `app/routes.ts` との対応 → ロールのフォルダで束ねて1ページ1スライス（D3）。routes.ts は shared/routes へ（D8）
5. **強制の手段** — Steiger を足すか、Biome の `noRestrictedImports` で書くか（Biome では「同じ層の別のスライスは禁止」を汎用に書きにくい） → Biome。D2
