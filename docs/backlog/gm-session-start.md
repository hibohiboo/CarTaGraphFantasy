---
title: GM が募集を出し、自分のキャラクターで応募して始める
milestone: local-flow
status: 完了
summary: GM が公開されたシナリオから募集を出し、自分のキャラクターで応募して、セッションを始められる。
plans:
  - 2026-10-03-募集からのセッション開始.md
cycles:
  - { name: 募集からのセッション開始, status: 完了, pr: 14 }
updated: 2026-10-03
---

# GM が募集を出し、自分のキャラクターで応募して始める

[ロードマップ](../roadmap.md#local-flow) local-flow の完成の条件3に当たる。[シナリオの構造とセッション開始までの流れ](../cartagraph/scenario-flow.md)の「募集→応募→開始」を、GM が1人で通せるようにする。

- いまは募集を出すことと応募することはできるが、応募からセッションを始める処理が無い
- local-flow で本来の流れを一度通しておけば、backend-1on1・multiplayer では同じ流れを複数人に広げるだけで済む
