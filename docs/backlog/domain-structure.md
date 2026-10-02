---
title: packages/domain をドメインごとのディレクトリに分ける
status: 未着手
summary: 開発者向け。packages/domain の直下に並んだファイルと、型を全部持つ index.ts を、仕様ページに合わせたドメインごとのディレクトリ（card・scenario・session など）に分け、読みやすくする。振る舞いは変えない。
updated: 2026-10-03
---

# packages/domain をドメインごとのディレクトリに分ける

PR #11（[シナリオを JSON でリポジトリ管理する](scenario-json.md)）のコードレビューで、「`packages/domain` の配下がフラットで読みづらい」と指摘があった。比べた結果、次の指針に決めた（2026-10-03、人間が裁定）。着手するのは PR #11 のマージ後で、振る舞いを変えないリファクタリングとしてフルルートで回す。

## 決めた指針

1. **分け方は仕様ページに合わせる。** 型・zod スキーマ・ロジック・テストを、同じディレクトリに置く。目安は次のとおり
   - `card/`：カード（card-and-deck.md）
   - `character/`：キャラクター（character-growth.md）
   - `scenario/`：シナリオ・デッキ・結末・募集（scenario-flow.md）
   - `session/`：セッション・参加者・提案・遷移（party-and-session.md・play-and-field.md）
   - `autoCombat/`：自動戦闘（auto-combat.md）
   - `soloVillage/`：GM不在のソロ（solo-village.md）
2. **依存の向きを固定する。** `card/` を土台にし、ほかは `card/` に依存してよいが、逆は禁止する。循環を避けるため、カードが持つ属性の型は、ルールの出典が自動戦闘や村でも `card/` に置く（`CombatEffect`・`DiceExpr`・`CardCondition`・`SoloEffect`）。それを使うロジック（`resolveAutoCombat` など）は、各ドメインに置く
3. **zod スキーマもドメインごとに分ける。** 今の `scenarioSchema.ts` は `card/`・`autoCombat/`・`scenario/` のスキーマに分解する。シナリオの型の正が zod スキーマであることは変えない
4. **入口のファイルは作らない。** `index.ts` を廃止し、利用側は `@cartagraph/domain/scenario/schema` のように実ファイルを直接 import する（barrel 禁止のルールどおり）。`package.json` の `exports` はワイルドカード（`"./*": "./src/*.ts"`）にする

## 採らなかった案

- **フラットのまま命名規則だけ決める** — `index.ts` が膨らみ続け、まとまりがファイル名にしか表れない
- **技術の種類ごと（`types/`・`schemas/`・`logic/`）** — 1つのドメインが3か所に散らばり、読みづらさが解決しない
- **パッケージに分割する** — 今の規模では過剰
- **`index.ts` を入口として残す** — 利用側（約30か所）は無変更で済むが、barrel 禁止のルールの例外になる

## 着手するときにすること

- 指針を [アーキテクチャルール](../process/rules/architecture.md)「構造」に書き、[Webアプリの構成](../architecture/web-app.md)のディレクトリの図を直す
- 移行は、型の移動と import の書き換えだけにする（中身は変えない）
