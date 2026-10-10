---
paths:
  - "docs/cartagraph/**"
  - "docs/concept/**"
  - "docs/glossary.md"
---

# 仕様のページの書き方

対象：正式仕様のページ（`docs/cartagraph/`・`docs/concept/`・`docs/glossary.md`）。仕様のページを書く・直すときの決まりを、ここに集める。ノートと仮ルールのファイルそのものの書き方は、それぞれ[デザイナーノート](../../notes/index.md)・[仮ルール](../../provisional/index.md)が正。

## いまのルールだけを書く

- 仕様のページには「いまのルール」だけを端的に書く。そう決めた理由・決まるまでの経緯・採らなかった案・将来の拡張候補は、対応する[デザイナーノート](../../notes/index.md)に書く（ゲームの仕様 `docs/cartagraph/` のページは、ノートと1対1）
- 仕様を変えたら、理由をノートに足す。仕様のページの末尾から、対応するノートへ1行でリンクする
- ノートに仕様を書き写さない（食い違いの元になる）。仕様の正は仕様のページ

## 仮ルール

- 決着を待たずに仮に置いたルールも、中身（いまのルール）は仕様のページに書き、ページの題名か見出しに「（仮ルール）」などの印を付ける。あわせて `docs/provisional/` に仮ルールのファイルを作る（何を決めれば消せるか・どこで使っているか。書き方は[仮ルール](../../provisional/index.md)）
- 仮のルールも無く、決めるまで実装もしないものは、仕様のページに書かず[未解決論点](../../open-questions.md)に置く
- 決めたら、仕様のページから「仮」の印を外し、決めた理由をノートに書き、仮ルールのファイルを消す

## 実装を指さない

- 仕様のページから実装のファイル（`rules/`・`apps/`・`packages/`・`scenarios/`・`scripts/` のパス）を指さない。値や定義の出どころを実装に置くと、実装を直したときに仕様が黙って変わる。実装との対応は [Webアプリの仕組み](../../architecture/web-app.md) などの `docs/architecture/` に書く

## 機械で止めること

`pnpm docs:build` の最後に流れる（pre-push・CI でも止まる）。

- 実装のパスを指している（`scripts/check-spec-paths.mjs`。生成した参考資料 `auto-combat-simulation.md` は見ない）
- 「仮」の印と仮ルールのファイルの食い違い（`scripts/check-provisional.mjs`。中身は[仮ルール](../../provisional/index.md)「機械で止めること」）
- 用語の旧称（`scripts/check-terms.mjs`。用語の正は[用語集](../../glossary.md)）
