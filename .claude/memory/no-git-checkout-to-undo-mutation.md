---
name: no-git-checkout-to-undo-mutation
description: テストが効くかを試すためにわざと崩した箇所を git checkout で戻さない。未コミットの変更ごと消える
metadata:
  node_type: memory
  type: feedback
  originSessionId: eb9143d0-4eb7-4ce2-a141-17fd73174675
  modified: 2026-10-11T01:48:12.548Z
---

わざと崩して検査が効くかを確かめるときは、`node scripts/mutate-check.mjs`（外して確かめて元に戻す）か、replace-once の逆向きの置換で戻す。`git checkout <file>` で戻さない。

**Why:** 2026-10-11、API ドキュメントの実装で、未コミットの zod 化を済ませた session/model.ts を `git checkout` で戻してしまい、変換ごと main の版に消えた（書いた内容が手元にあったので書き直せた）。

**How to apply:** 崩す前にコミットしておくか、mutate-check を使う。2026-10-11 の振り返りで、`.claude/hooks/guard-bash.mjs` がファイルを戻す `git checkout`・`git restore` を止めるようにした（CLAUDE.md にも記載）。[[transactional-edit-scripts]] と同じく、戻せる手段を先に用意する。
