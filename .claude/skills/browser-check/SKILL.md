---
name: browser-check
description: 変更した画面を、エージェント用の開発サーバー（pnpm web:dev:agent、5174 番）や preview（4174 番）を起動してブラウザで確かめ、終わったら止める。画面をブラウザで操作して確かめるとき、スクリーンショットを撮るとき、web:check:* のスクリプトを流すとき、dev-cycle の「7. 人間レビュー」の前に使う。
---

# browser-check（ブラウザで確かめるときの呼び出し口）

起動・後始末の決まりの正は `docs/architecture/web-app.md`「ローカル開発の注意」。起動する前に読む。このスキルは Claude Code での段取りだけを書く。

1. `pnpm -w web:dev:agent` を Bash の `run_in_background` で起動する（http://localhost:5174）。build を確かめるときは preview を `--port 4174 --strictPort` で起動する
2. ブラウザ（Playwright など）で、変更した画面を通しで操作して確かめる。画面の移動は `location.hash` で行い、読み直さない（作ったデータがメモリから消える）
3. 終わったら、タスクが時間切れで止まったときも、`pnpm web:dev:agent:stop` で止める

起動が strictPort で失敗したら、まず `pnpm web:dev:agent:stop` を流す（Windows では前のタスクの vite が残っていることがある）。それでも埋まっていれば、ほかの作業ツリーの開発サーバーを疑い、勝手に止めずに人間に聞く。公開したシナリオの書き込みを確かめるときの起動と後始末は、同じ節の「開発サーバーで公開すると」に従う。
