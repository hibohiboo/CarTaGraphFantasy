---
name: feedback-lint-cadence
description: 作業中にpnpm lintを都度実行しない。コミット時のpre-commitフックに任せる。型検査・テストは節目で実行し続ける
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b8e4bbc-adde-47e0-a509-048021dd7e10
  modified: 2026-09-22T00:40:36.695Z
---

作業中（コミット前）に `pnpm lint` を毎回実行しない。`.githooks/pre-commit` が
コミット時に自動でBiomeを実行し、安全な指摘は自動修正・再ステージする。
`pnpm web:typecheck`・`pnpm web:test` は引き続き作業の節目（ファイルを書き換えた後など）で
実行してよい。

**Why:** `docs/process/index.md:39`「lint・型検査・テスト・docsビルドは…フックが自動で確認するので、
コミット・push前に手動で実行して確認する必要はない」という既存の原則があるにもかかわらず、
2026-09-22のチュートリアルUI調整セッションで、細かい変更のたびに`pnpm lint`を繰り返し実行していた。
PR前のフルサイクル（[[dev-process-structure]]参照）の癖を、こまかい反復作業にまで過剰適用していた
とユーザーから指摘された。lintの指摘はほぼ自動修正可能なスタイルの問題で、コミット時のフックに
任せて損がない。一方、型検査・テストは実際のバグを示すことが多く、フックまで待つと修正コストが
上がるため、これらは節目での実行を継続する（ユーザーが2026-09-22に明示的に確認・合意）。

**How to apply:** ファイルを編集した直後の確認として`pnpm lint`を単独で呼ばない。
コミットする段になって`.githooks/pre-commit`が指摘した場合はそこで直す。
`pnpm web:typecheck`・`pnpm web:test`は今まで通り、実装の節目や最終確認で実行する。
E2E（`pnpm web:e2e`）やdocsビルド（`pnpm docs:build`）の実行頻度は今回の合意の対象外
（変更していない）。
