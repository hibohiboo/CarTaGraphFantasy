---
paths:
  - "docs/concept/**"
  - "docs/cartagraph/**"
  - "docs/architecture/**"
  - "docs/process/rules/**"
  - "docs/screens/**"
  - "docs/roadmap.md"
  - "docs/backlog/**"
  - "docs/provisional/**"
  - "docs/open-questions.md"
  - "docs/glossary.md"
---

# docs の1ファイル1責務

docs の1つのページは、1つの問いに答える。コードの「1ファイル1責務」（[アーキテクチャルール](architecture.md)）を docs に広げたもの。混ぜると、片方を直したときにもう片方が古いまま残り、SSOT が崩れる。

## 対象

- 対象：`concept/`・`cartagraph/`・`architecture/`・`process/rules/`・`screens/`・`roadmap.md`・`backlog/`・`provisional/`・`open-questions.md`・`glossary.md`
- 対象外：
  - `interviews/` … 一次資料
  - `plans/` … 作業単位の設計書。混ざるのが本来の形
  - `process/evolution.md`・`process/evolution/`・`process/timeline.md` … 経緯そのもの
  - `notes/` … 経緯の置き場そのもの
  - `cartagraph/auto-combat-simulation.md` … 生成ページ

## 5つの問い

| 問い | 種類 | 置き場 |
|---|---|---|
| いまどうなっているか（仕様・構成・決まり・手順） | **定義** | 仕様（`cartagraph/`・`concept/`）・`architecture/`・`process/` のルール・`glossary.md`・`roadmap.md`（ゴールとマイルストーンの定義）・`screens/index.md` |
| どこまで進んだか | **状態と進捗** | 要望の frontmatter（ダッシュボードが計算する）・既知の問題・画面ごとの課題（`screens/issues.md`） |
| 次に何をやるか | **優先順位** | `roadmap.md` の frontmatter の並び・未解決論点の「次に詰める候補」 |
| なぜそう決めたか（理由・採らなかった案・将来の候補） | **経緯** | `notes/`（ゲームの仕様以外も置く。パスは[デザイナーノート](../../notes/index.md)）・進化ログ（`process/` の経緯） |
| まだ決まっていないこと（開発の仕組みの未決も含む） | **未決** | [未解決論点](../../open-questions.md)・[仮ルール](../../provisional/index.md) |

1つのページにこれらを混ぜない。ほかの種類の内容が要るときは、置き場へ**1行のリンク**だけを置く（書き写さない）。

## 線引き

- 定義のページには、決まりの目的を述べる一句（「〜のため」）まで書いてよい
- 次の3つは、経緯の置き場（`notes/`、`process/` なら進化ログ）へ移す
  - いつ・誰の指摘で・どの案から選んだか
  - 採らなかった案
  - 将来の候補
- 「（2026-10-11）」のように、決まりに付けた採用日は、進化ログを引く目印として残してよい。移すのは経緯の本文だけ
- 手順（how-to）は定義に含める
- 状態・未決のページ（既知の問題・画面ごとの課題・仮ルール）の1件には、出どころを1行（日付・PR・プランへのリンク）まで書いてよい。「追記（日付）」の段落・決定の経緯の本文・「ここへ移した」などの移動の記録は書かない（移動の記録は git に残る）

## 例外：要望の1ファイル

`backlog/` の1要望のファイルは「この要望は何で、いまどうなっているか」に答える1枚のカードとみなす。先頭（frontmatter）の状態と本文の背景・経緯を分けない。

## 機械では止めていない

混ざりは機械で検査していない（[開発プロセス](../index.md)「仕組みにするのは2回目から」）。このページのパスのファイルを開くと、ルールが自動で読み込まれる。ゲームの仕様のページに固有の書き分け（仕様とノートの1対1など）は[仕様のページの書き方](spec-writing.md)が正。
