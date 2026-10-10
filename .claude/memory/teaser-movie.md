---
name: teaser-movie
description: プレイヤー向けティザー映像（HTML）の置き場と、ui-polish（画面の体験を一段上げる、旧M2）の後に作り直す予定
metadata:
  node_type: memory
  type: project
  originSessionId: a2298f96-8651-4616-9bef-a23ad0ee0e04
  modified: 2026-10-10T01:50:31.279Z
---

2026-10-10、プレイヤー体験だけを見せる約1分40秒の自動再生ティザーを作り、`docs/public/teaser/movie-v1.html` に置いた（https://hibohiboo.github.io/CarTaGraphFantasy/teaser/movie-v1.html）。置き場と版の決まりは AGENTS.md、Biome から外す理由は `docs/process/rules/static-analysis.md` にある。

ユーザーは「課題感が見えたので、M2 が終わったころに出し直したい」と言っている（当時の M2 は、2026-10-10 に id を振り直した ui-polish。その前に adventurer-only（冒険者だけにする）が入った。v1 を見て旅人・探索者・冒険者の区切りをやめると決めたのが adventurer-only のきっかけ）。

**Why:** v1 はその時点の仕様で作った演出のため、adventurer-only・ui-polish で体験が変わったら作り直したい。
**How to apply:** ui-polish の完了が話題に出たら、作り直すかどうかを聞く。v2 は `movie-v2.html` として別ファイルにし、v1 は残す。作る前に、v1 のどこに課題を感じたかをユーザーに聞く（まだ聞いていない）。開発の話は入れず、プレイヤー体験に絞るのが要望。

2026-10-10、ユーザーの依頼で「今の実装を見ず、展望とコンセプト（docs/concept・docs/cartagraph/index.md・docs/roadmap.md）だけから、魅力が伝わる30秒のテンポのよい映像」を `movie-v1-b.html` として作った。素材（カード・タグ・判子・ロゴ・ループ図・アイコン）は同じ HTML の下の素材集に並び、1つずつ HTML／SVG で書き出せる。`cartagraphSeek(秒)` でその時刻の絵で止まる（Playwright で静止画を撮って確かめた）。ui-polish 後の体験を見せる版は、まだ作っていない（v2 になる）。
