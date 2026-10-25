# テストレポート

main への push ごとに、デプロイ（`.github/workflows/deploy.yml`）がテストを流し、その結果の HTML レポートをこのサイトに載せる。テストが落ちてもデプロイは止めず、落ちたままのレポートを載せる（落ちたことはレポートと CI で気づく）。手元の `pnpm docs:dev` にはレポートが無いので、下のリンクは公開したサイトを開く。

| レポート | 中身 | 手元で流すコマンド |
|---|---|---|
| [E2E（Playwright）](https://hibohiboo.github.io/CarTaGraphFantasy/e2e-report/) | ビルドした画面をブラウザで操作するテスト。スクリーンショット付き | `pnpm web:e2e` |
| [ユースケースとの対応](https://hibohiboo.github.io/CarTaGraphFantasy/usecase-report/) | [中核のユースケース](use-cases.md)ごとの、E2E のテストと最新の結果。上の E2E のレポートの、そのテストへ飛べる | `pnpm web:e2e; pnpm usecase:report` |
| [ルールとの対応](https://hibohiboo.github.io/CarTaGraphFantasy/rule-test-report/) | [ルールのページ](../cartagraph/index.md)の節（`##`・`###`）ごとの、Vitest のテストと最新の結果。下の Vitest のレポートへ飛べる | `pnpm docs:build; pnpm test:report; pnpm rule:report`（`docs:build` が無いと、節のリンクがページまでになり、並びがファイル名順になる） |
| [Vitest：Webアプリ](https://hibohiboo.github.io/CarTaGraphFantasy/vitest-report/web/) | `apps/web` のテスト（MSW の node サーバーで全ページを描画） | `pnpm web:test` |
| [Vitest：ドメイン](https://hibohiboo.github.io/CarTaGraphFantasy/vitest-report/domain/) | `packages/domain` の純粋関数のテスト | `pnpm domain:test` |
| [Vitest：API のスキーマ](https://hibohiboo.github.io/CarTaGraphFantasy/vitest-report/schemas/) | `packages/schemas` のテスト | `pnpm schemas:test` |

## ユースケースとの対応の見方

ユースケースごとに、次のどれかの状態が出る。

| 状態 | 意味 |
|---|---|
| 確認済 | そのユースケースの正常パス（タグを付けたステップの主な流れ）を、E2E で確認した |
| 落ちた | ステップ（またはその外）で落ちた |
| 手前で止まった | 手前のステップで落ちたため、そのステップまで届かなかった |
| テストなし | そのユースケースのタグを持つ E2E が無い |
| 結果なし | E2E が起動できなかった等で、結果が読めなかった（ページの先頭に案内が出る） |

- 「確認済」は正常パスだけで、ユースケースのほかの流れ（断る・分かれる）までは確認していない。細かい分岐は Vitest が守る
- 1つのユースケースを複数のテスト・ステップが確かめるときは、落ちた ＞ 手前で止まった ＞ 確認済 の順で強いものを出す
- ページはデプロイ時に作る（`scripts/build-usecase-report.mjs`）。E2E のテストへの ID の付け方・検査は[テストのルール](../process/rules/testing.md)の「ユースケースの E2E」

## ルールとの対応の見方

ルールのページの節（`##`・`###`）ごとに、次のどれかの状態が出る。

| 状態 | 意味 |
|---|---|
| 確認済 | その節のタグを付けたテストが通った |
| 落ちた | タグを付けたテストが1つでも落ちた |
| スキップのみ | タグを付けたテストが、すべてスキップ・保留・todo |
| テストなし | その節のタグを付けたテストが無い |
| 対象外 | テストで確かめる性質でない節として、[対象外の一覧](rule-test-exclusions.md)で宣言した |

- 「確認済」は、タグを付けたテストが通ったという意味にとどまり、節に書いたことを全部確かめたという意味ではない
- 同じ節に複数のテスト・パッケージが当たるときは、対象外 ＞ 落ちた ＞ 確認済 ＞ スキップのみ ＞ テストなし の順で強いものを出す。`##` の行には、その節に直接付いたテストだけを数える（子の `###` は混ぜない）
- ページの先頭に「結果なし」が出たときは、そのパッケージの JSON が読めなかった。「収集で落ちたファイル」が出たときは、タグの打ち間違いなどでそのファイルが丸ごと落ちていて、そのファイルのテストは節に出ない
- ページはデプロイ時に作る（`scripts/build-rule-test-report.mjs`）。タグの書き方・付ける基準は[テストのルール](../process/rules/testing.md)の「ルールのテストのタグ」

Vitest の HTML レポートを手元で作るときは `pnpm test:report`（各パッケージの `vitest-report/` に HTML、`vitest-results/` に JSON を書く。git には載せない）。レポートを dist に写すのは `scripts/copy-test-reports-to-pages.mjs`。テストの書き方は[テストのルール](../process/rules/testing.md)。
