---
paths:
  - "apps/**/*.test.*"
  - "packages/**/*.test.*"
  - "apps/web/src/test/**"
  - "apps/web/src/mocks/**"
  - "scenarios/**"
  - "rules/**"
  - "apps/web/vite.config.ts"
  - "apps/web/vite/**"
  - "apps/web/e2e/**"
  - "apps/web/playwright.config.ts"
---

# テストルール（種別の切り分けと骨抜き禁止）

## 種別と実行コマンド

| 種別 | ツール | 置き場所 | 実行 | 何を守るか |
|---|---|---|---|---|
| 単体 | Vitest | `apps/web/src/test/`（対象のファイル名を反映。例：`shared/lib/japanese.ts` → `test/japanese.test.ts`） | `pnpm web:test` | ロジックの境界値・異常系 |
| ページ描画 | Vitest + Testing Library + MSW（node） | 全ルートの描画とページの小さな操作は `apps/web/src/test/pages.test.tsx`、機能の操作の連なりは機能名のファイル（例：`gmlessScreens.test.tsx`・`VillagePart.test.tsx`） | 同上 | 全ルートが描画できること、主要操作が通ること |
| ドメイン | Vitest | `packages/domain/src/**/*.test.ts`（対象と同じディレクトリに、対象のファイル名を反映。例：`autoCombat/resolve.ts` → `autoCombat/resolve.test.ts`） | `pnpm domain:test`（型検査は `pnpm domain:typecheck`） | 純粋関数の判定・変換 |
| API のスキーマ | Vitest | `packages/schemas/src/**/*.test.ts`（ドメインと同じ置き方） | `pnpm schemas:test`（型検査は `pnpm schemas:typecheck`） | 本文の形の検査と誤りのときのメッセージ、API の一覧、応答の検査（`checkResponse`）、OpenAPI の文書 |
| E2E | Playwright（Chromium） | `apps/web/e2e/smoke.test.ts`、ユースケースの通しは `apps/web/e2e/usecases/` | `pnpm web:e2e` | 全ルートが実ブラウザで例外なく描画できること（2026-09-21導入。`docs/plans/2026-09-21-e2e導入.md`参照）と、ユースケースの主な流れが画面だけで通ること（2026-10-18導入。下の「ユースケースの E2E」） |

- `pages.test.tsx` は `shared/routes/routes.ts` を走査して全ルートを描画する。ルートを追加すると自動的に対象になるので、ページ固有の操作テストだけを個別に書く
- 1つの機能の操作の連なり（複数の画面をまたぐ流れ、通しのテスト）は、`pages.test.tsx` に足さず、機能名のファイルに置く。`pages.test.tsx` が大きくなりすぎないように（2026-10-05）。描画は共有の `renderAt`（`apps/web/src/test/renderAt.tsx`）を使う
- `e2e/smoke.test.ts` も同じく `shared/routes/routes.ts` を走査する。実ブラウザでの崩れ・実行時エラーの検出が目的で、`pages.test.tsx`（MSWのnodeサーバー、描画のみ）と役割が重複しないよう、E2E に置くのはスモークと、ユースケースの ID のタグを付けた通しの流れ（下の「ユースケースの E2E」）だけにする。タグの無い深いインタラクションシナリオはE2E化しない（細かい分岐は Vitest）
- 型検査（`pnpm web:typecheck`・`pnpm domain:typecheck`・`pnpm schemas:typecheck`）もテストの一部として扱う。push前に`.githooks/pre-push`が自動で確認する（AGENTS.md参照）。E2Eはブラウザ起動を伴い重いため `.githooks/pre-push` には含めず、CIのみで実行する

## 単体とページ描画の切り分け

ページ描画で検証する：

- ルートが描画できること（h1 が出る、404 にならない）
- ユーザー操作の連なり（ボタンを押す → MSW が応答 → 表示が変わる）
- ロール・モードで表示が変わること

単体で検証する：

- 純粋な計算・整形・バリデーション（外部I/Oなし）
- ページ描画では網羅しにくい細かい分岐（境界値の両側・異常系）

ページ描画のテストがロジックの分岐を全部なぞり始めたら、そのロジックを純粋関数に切り出して単体へ落とす（[アーキテクチャルール](architecture.md)の Functional Core）。

判定に条件を足したら、既存のページ描画のテストがまだ各条件を区別できているかを見直す。シナリオのデータ上、どの画面でも新しい条件を満たしてしまうと、ほかの条件を消してもテストが通るようになる。区別できなければ、判定を純粋関数に切り出して、条件ごとに両側を単体テストで確かめる。

## シードデータ（MSW）

- モックデータの定義は、遊べるシナリオの `scenarios/*.json`、システムのカードとキャラクター作成のルールの `rules/*.json`、それ以外（デモの下書き・テスト専用のシナリオを含む）の `apps/web/src/mocks/fixtures.ts` の**3箇所**に限る。テストやページの中で独自のマジック値を作らない。テストでシナリオの値を使うときは、書き写さずに `fixtures.ts` の `scenarios` から引く。ルールの値（CP 予算・能力値・カードのコストなど）は `mocks/rulesFiles.ts` から引く（CP の組は `test/rulesHelpers.ts` の `cardsCosting`）
- テスト専用のシナリオを遊べるシナリオから作るときは、`structuredClone` で深く複製してから差し替える（`scenarios/*.json` から読んだオブジェクトを書き換えない）
- 各テストの後に `resetDb()` で状態を戻す（`src/test/setup.ts`）。テストは実行順に依存しない
- 変更を伴うテストは、既存のシードを書き換えるのではなく、テストの中で操作して結果を確認し、`resetDb()` に後始末を任せる
- 未処理のリクエストはエラーにする（`onUnhandledRequest: 'error'`）。新しい API を呼ぶなら先に `handlers.ts` へ追加する
- MSW の応答は、すべてのテストで API の一覧（`packages/schemas` の `api/endpoints.ts`）と照らす（`src/test/setup.ts` が `src/test/responseCheck.ts` を組み込む）。一覧に無い API・状態コード、形の違う本文が返ると、そのテストが落ちる（誤りの文にリクエストを出したテストの名前が付く）。ハンドラと一覧の1対1は `src/test/apiEndpoints.test.ts`。ハンドラを足す・応答を変えるときは、一覧（各ディレクトリの `endpoints.ts`）も直す。テストの中で `server.use` で差し替える応答も、一覧どおりの形にする。一覧に無い失敗（例：`GET /characters` の 500）を画面がどう見せるかを試したいときは、その API が本当に返しうるなら一覧に足し、返さないなら `HttpResponse.error()`（通信の失敗。検査されない）で試す。テストの本体が応答を待たずに終わっても、後片付けの前に応答が届くまで待つ（上限2秒。届かなければ誤り）
- 公開したシナリオの保存先（`setScenarioFileStore`）は、テストでは既定で無し（デモと同じ。`setup.ts` が毎回戻す）。ファイルへの書き込みを確かめるテストだけ、渡されたシナリオを記録する偽の保存先を差し込む。開発サーバーの書き込みの口（`apps/web/vite/`）のテストは、`mkdtemp` の一時ディレクトリに書き、リポジトリの `scenarios/` には書かない

## 骨抜き禁止

```ts
// ✖ 何も守っていない
expect(result).toBeDefined();
// ✖ 常時成功モック（本物が壊れても通る）
vi.mock('@/shared/lib/format', () => ({ formatDate: () => '2026-09-16' }));
// ✖ 条件付きスキップ（環境がないと黙って成功扱い）
if (!process.env.SOME_FLAG) return;

// ✅ 期待値を固定して assert する。境界の内側と外側を書く
expect(toDictionaryForm('扉を壊してみたい')).toBe('扉を壊す');
expect(toDictionaryForm('扉を破壊する')).toBe('扉を破壊する'); // 変換不要な入力もそのまま
```

- MSW のハンドラをテスト内で常時成功に差し替えない（シードの状態を通した結合を確かめるのがページ描画テストの仕事）
- `.only` / `.skip` を残したままコミットしない（`biome.json`の`noFocusedTests`/`noSkippedTests`がコミット前フックで機械的に検知して止める。意図的に残す場合は抑制コメントを書く）
- 新規テストは先に Red（失敗）を確認してから実装する。最初から通ったら、実装済みか assert が弱いかを判定する
- 既存の実装で最初から通るテスト（ガード・回帰のテストなど）は、守っている条件を一時的に外して**落ちることを確かめてから**元に戻す。別の経路で同じ結果になり、条件を消しても通ってしまうテストは何も守っていない
- 条件を外すときは、外す書き換えが実際に入ったこと（置換の件数や `git diff`）を確かめてからテストを流す。整形で折り返された行には文字列の置換が当たらず、「外したつもりで落ちない」と誤判定しやすい
- この確かめは `node scripts/mutate-check.mjs <spec.json>` で行う。spec.json に外す書き換え（ファイル・置換前・置換後・テストのコマンド）を並べると、置換が1件だけ当たることを確かめてから書き換え、テストが落ちるかを見て、必ず元に戻す。手で書き換えて戻すと、戻し忘れや置換の空振りが起きる

## テストの独立性

- 各テストが自分の QueryClient・ルーターを作り、共有状態を持たない（`renderAt` の型を踏襲する）
- `waitForTimeout` で待たず、`findBy*` やロケータの自動待機を使う
- 画面を移ったことは、URL（router の pathname・`toHaveURL`）ではなく、**移った先にしか無い要素**（その画面だけの見出し・リンクなど）が出るのを待って確かめる。SPA では URL が先に変わり、画面の描画はあとから追いつく。確かめたい文言が移る前の画面にもあるときは、先にその要素を待ってから文言を確かめる。待たないと、Testing Library の `findBy*` は移る前の画面の要素を掴み、画面が切り替わって外れたところで**ときどき落ちる**。Playwright の locator は毎回探し直すので外れて落ちることはないが、移る前の画面を見て**誤って通る**（2026-10-04。`docs/process/evolution.md`）
- セレクタは role / label / testid を優先し、CSS Modules のクラス名に依存しない

## ユースケースの E2E

[中核のユースケース](../../architecture/use-cases.md)（SC-1・PL-2 など）を画面だけでなぞる通しを、`apps/web/e2e/usecases/` に置く。ユースケースごとの結果は、デプロイが E2E の後に作るページ（[テストレポート](../../architecture/test-report.md)）で見られる（2026-10-18導入）。ページの中身・状態の意味はテストレポートのページが正。ここには書き方と、検査で止めるものを書く。

- **紐づけはテストの側に書く。** テストに Playwright のタグ（`{ tag: ['@SC-1', '@SC-2'] }`）を付け、テストの中を `test.step('SC-1 下書きを作る', …)` のようにユースケースごとのステップに分ける。タグ＝確かめるつもりのユースケース（手前で落ちても結果に残る）、ステップ＝実際に通ったか。use-cases.md は触らない
- **ステップの題は `<ID><空白><自由な説明>`**。ID の後ろの文言はユースケースの名前と一致しなくてよい。ID の付かない下ごしらえのステップ（セッションを始める等、補完の業務領域）は ID を付けずに書いてよい（ページには出ない）。同じ ID のステップは何度書いてもよい
- **最後の確かめ（コンソールの誤りが無いこと）は、最後の ID のステップの中に置く。** ステップの外で落ちると、どのユースケースのせいか分からない
- **画面の状態はメモリ（MSW）にしか無く、リロードで消える。** 作る→公開→遊ぶは1本のテストにしてステップで分け、`page.goto` は最初の1回だけにする。あとは画面内のリンクか `location.hash` で移り、移った先にしか無い要素を待って確かめる（「テストの独立性」）
- **1つの `e2e/usecases/` のファイルには、ユースケースのテストを1本だけ置く。** 通しのなかで細かい分岐まで確かめない（それは Vitest）。「通った」は、タグを付けたステップの主な流れが通ったという意味にとどまる
- **テストの無いユースケースがあってよい。** ページで「テストなし」と出す
- **`retries` は足さない。** 不安定なテストが CI を通り、ページでも「通った」に見えるため。長い通しで不安定が出たら、そのテストを直す。時間切れは、そのテストだけ `test.setTimeout` で延ばす（設定全体の `timeout` は変えない）

検査（`scripts/check-usecase-tags.mjs`。`pnpm docs:build` の最後。pre-push・CI でも止まる）が止めるもの：

- 全 E2E で：use-cases.md の表に無い ID のタグ・ステップ、ID の形に似て形の違うタグ・ステップ（小文字 `@sc-1`）。ID でないタグ（`@slow` など）は見ない
- `e2e/usecases/` で：タグにあってステップに無い ID／その逆、`test.step` の最初の引数が文字列の直書きでない（テンプレート文字列・変数）、題の中のタグ（`test('… @SC-1')`）・`test.describe` へのタグ（静的に読めない）、`test.skip`・`test.fixme`・`test.step.skip`・`expect.soft`（skip したステップは結果で「通った」に見えるため）、1ファイルに `test(` が2本以上

`apps/web/e2e/` を触ったら `pnpm docs:build` も通す。ステップに入れない確かめ（`web:check:*` など、CI で回らない通し）は `apps/web/e2e/dev/`（[ウェブアプリ](../../architecture/web-app.md)）。
