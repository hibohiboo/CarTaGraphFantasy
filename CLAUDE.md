# CarTaGraphFantasy プロジェクトルール

開発ルール・技術スタック・ディレクトリ構成・最重要ルールは、ツールに依存しない入口ファイル `AGENTS.md` に集約している（ここに重複して書かない）。

@AGENTS.md

## Claude Code 固有の補足

- `.claude/agents/`（design-reviewer / edge-case-reviewer / spec-reviewer）と `.claude/skills/`（dev-cycle / grilling / tdd / eng-practices / create-pr）は、`docs/process/` に書かれた手順の**呼び出し口**である。手順の本文を変えるときは `docs/process/` 側を直す。`.claude/skills/react-best-practices` だけは例外で、Vercel Labs の配布物をそのまま取り込んだ参照資料（手で直さない。使い方の正は `docs/process/rules/architecture.md`「React の書き方」）。
- サブエージェントの `model` は `inherit`（セッションのモデルを引き継ぐ）にし、特定モデルを固定しない。
- プランドキュメントは `docs/plans/`（`settings.json` の `plansDirectory`）に置く。
- 自動メモリ（`.claude/memory/`）は Claude 固有の記憶であり、他のエージェントからは見えない。プロジェクトとして残すべき知識（構成・運用上の注意・決定事項）は `docs/` に書き、メモリにはそこへのポインタと個人的な作業上の学びだけを残す。
- Bash ツールで長い heredoc（`cat <<'EOF' ... EOF` 等）を使って大きなファイルを書くと、内容が途中で切れて壊れることがある。大きなファイルは Write ツールで書く（LF 改行で書かれることは確認済み）。
- 同じ理由で、複数のファイルを書き換えるスクリプト（Python など）も heredoc で渡さず、Write でスクラッチパッドにファイルとして書いてから実行する（インタプリタへの heredoc と、git フックの省略は `.claude/hooks/guard-bash.mjs` が止める）。heredoc ではバックスラッシュの解釈が崩れ、途中まで書き換えて止まることがある。日本語を出力するスクリプトは `PYTHONIOENCODING=utf-8` を付けて実行する（Windows のコンソールは cp932 で、出力の途中で例外になる）。
- Bash ツールは Git Bash で動くので、`/` で始まる値（`WEB_BASE=/CarTaGraphFantasy/app/` など）を渡すと Windows のパスに書き換えられる。ビルドやサーバーを起動する前に `docs/architecture/web-app.md`「ローカル開発の注意」を読む。
