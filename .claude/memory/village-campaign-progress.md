---
name: village-campaign-progress
description: "村スタート冒険者キャンペーン（C1〜C4）の進み具合。C3まで完了（PR #8 マージ済み）、次はC4（街道・旧チュートリアル置き換え）"
metadata:
  node_type: memory
  type: project
  originSessionId: db88d7eb-f4c1-448a-823f-e76e818e9fd2
  modified: 2026-09-27T00:09:10.137Z
---

村スタート冒険者キャンペーンは4サイクル構成。正は `docs/plans/2026-09-23-村スタート冒険者キャンペーン.md`（親）と各サイクルの個別プラン（C2：`2026-09-23-自動戦闘エンジン.md`、C3：`2026-09-27-村パート.md`）。

- C1（GMレス基盤）：PR #5 でマージ済み
- C2（自動戦闘エンジン）：PR #6 で 2026-09-27 マージ済み
- C3（村パート）：PR #8 で 2026-09-27 マージ済み。振り返りは未実施。仮ルールは `docs/cartagraph/solo-village.md`
- 次は C4（街道・旧チュートリアル置き換え・結末タグ「冒険者になった」）。着手時に決めること：依頼や街道のシーンに入ったときの描写（known-issues に記録済み）
- 見送った課題は `docs/architecture/known-issues.md` が正。見出しアンカー97か所の食い違いの直し方は人間の判断待ち

**Why:** 次のセッションで「C4から再開」と言われたときに、どのプランを開けばよいかをすぐ辿れるようにする。
**How to apply:** 再開時はこのメモではなく、上のプランと known-issues.md を読んでから始める。関連：[[dev-process-structure]]
