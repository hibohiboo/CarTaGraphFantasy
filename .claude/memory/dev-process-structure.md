---
name: dev-process-structure
description: 開発プロセスの置き場所（docs/process がSSOT、AGENTS.md が入口、.claude は呼び出し口）と、フル／ライトの2ルート運用。2026-09-16に整備
metadata: 
  node_type: memory
  type: project
  originSessionId: 3e5f04df-9f84-4409-af85-7a72b948a1af
  modified: 2026-09-15T23:00:34.816Z
---

2026-09-16に『プロフェッショナルAI駆動開発』のサンプル（`proffesional-ai/`、git管理外のローカル資料）を移植して、開発プロセスを文書化した。

- **正（SSOT）は `docs/process/`**：`index.md`（開発サイクル8ステップ＋体制の進化＋モデル非依存の原則）、`rules/`（architecture / testing / review）、`prompt-sample.md`（依頼文雛形1〜9）、`evolution.md`（候補→採用／却下のログ）
- **入口は `AGENTS.md`**。`CLAUDE.md` は `@AGENTS.md` で読み込むだけ。最重要ルール（矛盾で止める・SSOT・重複報告・プラン外は実装しない・LF）はAGENTS.md側にある
- **`.claude/` は薄い層**：agents（design / edge-case / spec-reviewer、`model: inherit`）、skills（dev-cycle / grilling / tdd / eng-practices / create-pr）。本文は docs/process を指す
- プランは `docs/plans/<日付>-<機能>.md`（VitePress の `srcExclude` で公開サイトからは除外）
- 基盤整備の計画は `docs/plans/2026-09-16-dev-process-foundation.md`（C1 CI → C2 PR運用 → C3 lint → C4 別ツール試走 → C5 1機能完走 → C6 リファクタ）。**C2以降はユーザーの判断待ち**（PR運用の是非、lintツール、別ツール、C5の題材）

**How to apply:** `apps/`・`packages/` の振る舞いを変える依頼はフルルート（`/dev-cycle`：プランから）。docs のみ・試作・小修正はライトルートで、[[push-then-report]] の通り直 push でよい。プロセスに不満・不足を感じたら `docs/process/evolution.md` の候補に追記し、採用はユーザーが決める。運用知識をメモリにだけ残さず docs に書く（[[web-app-react-phase]] の内容は C4 で docs へ移す予定）。
