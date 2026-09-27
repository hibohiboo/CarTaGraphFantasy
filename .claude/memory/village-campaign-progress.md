---
name: village-campaign-progress
description: "村スタート冒険者キャンペーンの進み具合。C4まで完了（PR #9）、次はC5（見出しアンカー97か所の食い違いの修正）"
metadata:
  node_type: memory
  type: project
  originSessionId: db88d7eb-f4c1-448a-823f-e76e818e9fd2
  modified: 2026-09-27T04:53:40.145Z
---

村スタート冒険者キャンペーンの正は `docs/plans/2026-09-23-村スタート冒険者キャンペーン.md`（親）と各サイクルの個別プラン（C2：`2026-09-23-自動戦闘エンジン.md`、C3：`2026-09-27-村パート.md`、C4：`2026-09-27-街道と結末タグ.md`）。

- C1〜C4：マージ済み（C3＝PR #8、C4＝PR #9、どちらも 2026-09-27）。C3・C4 の振り返りは未実施
- 次は C5：docs 全体の見出しアンカー97か所の食い違いを直す（2026-09-27 人間の判断。直し方＝一括置換か VitePress の slugify 設定かは C5 のプランで決める）
- C5 の後：結末タグをカードとして持たせる（人間の判断で方針決定、サイクル未定）
- 旧チュートリアル「旅立ちの酒場」を残すか村スタートにするかは保留。キャンペーンとは**別の PBI** として扱う（C5 ではない）
- 仮ルールのページは `docs/cartagraph/solo-village.md`（名前は「GM不在のソロの進行（仮ルール）」）。見送った課題は `docs/architecture/known-issues.md` が正

**Why:** 次のセッションで「続きから」と言われたときに、どのプランを開けばよいかをすぐ辿れるようにする。
**How to apply:** 再開時はこのメモではなく、上のプランと known-issues.md を読んでから始める。関連：[[dev-process-structure]]
