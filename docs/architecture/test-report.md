# テストレポート

main への push ごとに、デプロイ（`.github/workflows/deploy.yml`）がテストを流し、その結果の HTML レポートをこのサイトに載せる。テストが落ちてもデプロイは止めず、落ちたままのレポートを載せる（落ちたことはレポートと CI で気づく）。手元の `pnpm docs:dev` にはレポートが無いので、下のリンクは公開したサイトを開く。

| レポート | 中身 | 手元で流すコマンド |
|---|---|---|
| [E2E（Playwright）](https://hibohiboo.github.io/CarTaGraphFantasy/e2e-report/) | ビルドした画面をブラウザで操作するテスト。スクリーンショット付き | `pnpm web:e2e` |
| [Vitest：Webアプリ](https://hibohiboo.github.io/CarTaGraphFantasy/vitest-report/web/) | `apps/web` のテスト（MSW の node サーバーで全ページを描画） | `pnpm web:test` |
| [Vitest：ドメイン](https://hibohiboo.github.io/CarTaGraphFantasy/vitest-report/domain/) | `packages/domain` の純粋関数のテスト | `pnpm domain:test` |
| [Vitest：API のスキーマ](https://hibohiboo.github.io/CarTaGraphFantasy/vitest-report/schemas/) | `packages/schemas` のテスト | `pnpm schemas:test` |

Vitest の HTML レポートを手元で作るときは `pnpm test:report`（各パッケージの `vitest-report/` に書く。git には載せない）。レポートを dist に写すのは `scripts/copy-test-reports-to-pages.mjs`。テストの書き方は[テストのルール](../process/rules/testing.md)。
