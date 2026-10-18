# テストレポート

main への push ごとに、デプロイ（`.github/workflows/deploy.yml`）がテストを流し、その結果の HTML レポートをこのサイトに載せる。テストが落ちてもデプロイは止めず、落ちたままのレポートを載せる（落ちたことはレポートと CI で気づく）。手元の `pnpm docs:dev` にはレポートが無いので、下のリンクは公開したサイトを開く。

| レポート | 中身 | 手元で流すコマンド |
|---|---|---|
| [E2E（Playwright）](https://hibohiboo.github.io/CarTaGraphFantasy/e2e-report/) | ビルドした画面をブラウザで操作するテスト。スクリーンショット付き | `pnpm web:e2e` |
| [ユースケースとの対応](https://hibohiboo.github.io/CarTaGraphFantasy/usecase-report/) | [中核のユースケース](use-cases.md)ごとの、E2E のテストと最新の結果。上の E2E のレポートの、そのテストへ飛べる | `pnpm web:e2e; pnpm usecase:report` |
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

Vitest の HTML レポートを手元で作るときは `pnpm test:report`（各パッケージの `vitest-report/` に書く。git には載せない）。レポートを dist に写すのは `scripts/copy-test-reports-to-pages.mjs`。テストの書き方は[テストのルール](../process/rules/testing.md)。
