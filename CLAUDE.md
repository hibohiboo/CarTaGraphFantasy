# CarTaGraphFantasy プロジェクトルール

開発ルール・技術スタック・ディレクトリ構成・最重要ルールは、ツールに依存しない入口ファイル `AGENTS.md` に集約している（ここに重複して書かない）。

@AGENTS.md

## Claude Code 固有の補足

- `.claude/agents/`（design-reviewer / edge-case-reviewer / spec-reviewer）と `.claude/skills/`（dev-cycle / grilling / tdd / eng-practices / create-pr）は、`docs/process/` に書かれた手順の**呼び出し口**である。手順の本文を変えるときは `docs/process/` 側を直す。
- サブエージェントの `model` は `inherit`（セッションのモデルを引き継ぐ）にし、特定モデルを固定しない。
- プランドキュメントは `docs/plans/`（`settings.json` の `plansDirectory`）に置く。
- 自動メモリ（`.claude/memory/`）は Claude 固有の記憶であり、他のエージェントからは見えない。プロジェクトとして残すべき知識（構成・運用上の注意・決定事項）は `docs/` に書き、メモリにはそこへのポインタと個人的な作業上の学びだけを残す。
