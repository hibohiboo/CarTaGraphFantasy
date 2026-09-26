---
name: village-campaign-progress
description: 村スタート冒険者キャンペーン（C1〜C4）の進み具合。C2まで完了、次はC3（村パート）
metadata:
  node_type: memory
  type: project
  originSessionId: 38cc8413-59aa-40fd-b817-2b8aa2621a3b
  modified: 2026-09-26T18:13:51.998Z
---

村スタート冒険者キャンペーンは4サイクル構成。正は `docs/plans/2026-09-23-村スタート冒険者キャンペーン.md`（親）と `docs/plans/2026-09-23-自動戦闘エンジン.md`（C2）。

- C1（GMレス基盤）：PR #5 でマージ済み
- C2（自動戦闘エンジン）：PR #6 で 2026-09-27 マージ済み。振り返りの5件は採用し `docs/process/` に反映済み
- 次は C3（村パート：依頼・能力値・お店）。着手時に決めることとして、シーンを移るときの場の片付け（敵カードの再入場）、`soloStarter` の置き換え、依頼内容の grilling がある
- 見送った課題は `docs/architecture/known-issues.md` が正（C3 で扱う項目が含まれる）

**Why:** 次のセッションで「C3から再開」と言われたときに、どのプランを開けばよいかをすぐ辿れるようにする。
**How to apply:** 再開時はこのメモではなく、上のプランと known-issues.md を読んでから始める。関連：[[dev-process-structure]]
