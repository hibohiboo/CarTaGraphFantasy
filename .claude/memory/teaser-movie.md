---
name: teaser-movie
description: プレイヤー向けティザー映像（HTML）の置き場と、M2後に作り直す予定
metadata:
  node_type: memory
  type: project
  originSessionId: a2298f96-8651-4616-9bef-a23ad0ee0e04
  modified: 2026-10-10T01:50:31.279Z
---

2026-10-10、プレイヤー体験だけを見せる約1分40秒の自動再生ティザーを作り、`docs/public/teaser/movie-v1.html` に置いた（https://hibohiboo.github.io/CarTaGraphFantasy/teaser/movie-v1.html）。置き場と版の決まりは AGENTS.md、Biome から外す理由は `docs/process/rules/static-analysis.md` にある。

ユーザーは「課題感が見えたので、M2 が終わったころに出し直したい」と言っている。

**Why:** v1 はその時点の仕様で作った演出のため、M2 で体験が変わったら作り直したい。
**How to apply:** M2 の完了が話題に出たら、作り直すかどうかを聞く。v2 は `movie-v2.html` として別ファイルにし、v1 は残す。作る前に、v1 のどこに課題を感じたかをユーザーに聞く（まだ聞いていない）。開発の話は入れず、プレイヤー体験に絞るのが要望。
