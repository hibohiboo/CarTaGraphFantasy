// Claude Code の PreToolUse フック（Bash・PowerShell）。ルールを読ませるだけでは止まらなかった操作を、実行前に機械的に止める
// （docs/process/evolution.md 2026-10-03「domain のディレクトリ分割（PR #12）の振り返りから4件を採用」）。
//
// 1. インタプリタ（python・node・tsx など）に heredoc（<<）でスクリプトを渡す
//    → バックスラッシュの解釈が崩れて、途中まで書き換えて止まることがある（CLAUDE.md「Claude Code 固有の補足」）
// 2. git commit・git push の --no-verify
//    → git フック（.githooks）を飛ばすのは、人間の許可が無い限りしない
// 3. インタプリタに `-`（標準入力からスクリプトを読む）を渡す
//    → 入力が来ないとコマンドが止まったままになる（2026-10-03、PR #14 の作業中に2回）。1. と同じく Write でファイルにする

import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const command = String(input.tool_input?.command ?? '');

const INTERPRETER_HEREDOC = /\b(?:python3?|py|node|tsx|deno|bun)\b[^\n|;&]*<</;
const NO_VERIFY = /\bgit\b[^\n|;&]*\b(?:commit|push)\b[^\n|;&]*--no-verify\b/;
// `python -`・`node -` のように、引数に単独の `-` を渡す（`python -c` や `--` は止めない）。
// インタプリタがコマンドの先頭（行頭か ; & | の後、環境変数の代入の後）にあるときだけ見る。
// コミットメッセージなどの文字列に「python -」と書いただけでは止めない
const INTERPRETER_STDIN =
  /(?:^|[;&|]\s*)(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:python3?|py|node|tsx|deno|bun)(?:\s+[^\s|;&<>]+)*?\s+-(?=\s|$|[|;&<>])/m;

let reason = '';
if (INTERPRETER_HEREDOC.test(command)) {
  reason =
    'インタプリタに heredoc でスクリプトを渡さない（バックスラッシュが崩れる）。Write でスクラッチパッドにファイルとして書いてから実行する（CLAUDE.md「Claude Code 固有の補足」）。';
} else if (INTERPRETER_STDIN.test(command)) {
  reason =
    'インタプリタに `-`（標準入力からスクリプトを読む）を渡さない（入力が来ないと止まったままになる）。Write でスクラッチパッドにファイルとして書いてから実行する（CLAUDE.md「Claude Code 固有の補足」）。';
} else if (NO_VERIFY.test(command)) {
  reason =
    'git commit・git push に --no-verify を付けない（git フックを飛ばすのは人間の許可が要る）。フックが止めた理由を直すか、人間に確認する。';
}

if (reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
}
