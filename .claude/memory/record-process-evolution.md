---
name: record-process-evolution
description: 進め方の変更は、採らなかった案も含めて docs/process/evolution.md に漏らさず残す
metadata:
  node_type: memory
  type: feedback
  originSessionId: 97f22ae5-b957-49e9-b1d8-600a90c0ce44
  modified: 2026-10-10T02:39:42.374Z
---

ルール・CLAUDE.md・AGENTS.md・.claude/・検査スクリプトなど、進め方に関わる変更をしたら、同じ作業の中で docs/process/evolution.md に記録する。複数の案を出して人間が一部だけを選んだときは、選ばれなかった案も「候補」に残す（理由を聞いていなければ「却下」にはしない）。

**Why:** 2026-10-10、AGENTS.md と CLAUDE.md の重複を直したコミットと、提案 A・B・C のうち選ばれなかった C を、ログに書き漏らした。人間から「どう進化してきたかは後から辿るときに大事。なるべく漏らしたくない」と言われた。

**How to apply:** 進め方の変更をコミットする前に、evolution.md の差分が含まれているかを確かめる。関連：[[prefer-mechanisms]] [[dev-process-structure]]
