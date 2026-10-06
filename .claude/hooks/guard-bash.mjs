// Claude Code の PreToolUse フック（Bash・PowerShell）。ルールを読ませるだけでは止まらなかった操作を、実行前に機械的に止める
// （docs/process/evolution.md 2026-10-03「domain のディレクトリ分割（PR #12）の振り返りから4件を採用」）。
//
// 1. インタプリタ（python・node・tsx など）に heredoc（<<）でスクリプトを渡す
//    → バックスラッシュの解釈が崩れて、途中まで書き換えて止まることがある（CLAUDE.md「Claude Code 固有の補足」）
// 2. git commit・git push の --no-verify
//    → git フック（.githooks）を飛ばすのは、人間の許可が無い限りしない
// 3. インタプリタに `-`（標準入力からスクリプトを読む）を渡す
//    → 入力が来ないとコマンドが止まったままになる（2026-10-03、PR #14 の作業中に2回）。1. と同じく Write でファイルにする
//
// 4. sed の書き換え（-i・--in-place）
//    → 同じ語を2回当てて化けても気づけない（2026-10-07、「製製作者」。テストの期待値も同じ置換で化けて通った）。
//      node scripts/replace-once.mjs（件数と二重の当たりを確かめてから書く）か Edit を使う
//
// 判定の前に、クォートした引数の中身を取り除く。引数の文字列（Markdown の箇条書きの「\n- 」、コミットメッセージに
// 書いた「--no-verify」など）を、コマンドとして読まないため（2026-10-04、PR #15 の振り返り）。
// テストは同じディレクトリの guard-bash.test.mjs（pnpm tools:test）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// インタプリタの名前は、行頭・空白・区切り記号・パスの / のあとにあるときだけ見る。`cat >> Page.tsx <<'EOF'` の
// 拡張子 .tsx・.py をインタプリタと読まないため（2026-10-05、PR #16 の振り返り。\b は . のあとも切れ目になる）
const INTERPRETER_HEREDOC = /(?:^|[\s;&|(/])(?:python3?|py|node|tsx|deno|bun)\b[^\n|;&]*<</m;
const NO_VERIFY = /\bgit\b[^\n|;&]*\b(?:commit|push)\b[^\n|;&]*--no-verify\b/;
// `python -`・`node -` のように、引数に単独の `-` を渡す（`python -c` や `--` は止めない）。
// インタプリタがコマンドの先頭（行頭か ; & | の後、環境変数の代入の後）にあるときだけ見る
const INTERPRETER_STDIN =
  /(?:^|[;&|]\s*)(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:python3?|py|node|tsx|deno|bun)(?:\s+[^\s|;&<>]+)*?\s+-(?=\s|$|[|;&<>])/m;

// sed の後ろ（同じコマンドの中）に、-i・-ni のような i を含む短いオプションか --in-place がある
const SED_IN_PLACE = /(?:^|[\s;&|(])sed\b[^\n|;&]*?\s(?:-[a-zA-Z]*i[^\s]*|--in-place\S*)(?=\s|$)/m;

/** '…' と "…" の中身を空にする（"…" の中の \" は閉じとみなさない） */
const stripQuoted = (command) => command.replace(/'[^']*'|"(?:[^"\\]|\\[\s\S])*"/g, '""');

/** 止める理由（止めないなら空文字） */
export function checkCommand(command) {
  const bare = stripQuoted(command);
  if (INTERPRETER_HEREDOC.test(bare))
    return 'インタプリタに heredoc でスクリプトを渡さない（バックスラッシュが崩れる）。Write でスクラッチパッドにファイルとして書いてから実行する（CLAUDE.md「Claude Code 固有の補足」）。';
  if (INTERPRETER_STDIN.test(bare))
    return 'インタプリタに `-`（標準入力からスクリプトを読む）を渡さない（入力が来ないと止まったままになる）。Write でスクラッチパッドにファイルとして書いてから実行する（CLAUDE.md「Claude Code 固有の補足」）。';
  if (SED_IN_PLACE.test(bare))
    return 'sed -i でファイルを書き換えない（同じ語に2回当たって化けても気づけない）。node scripts/replace-once.mjs <spec.json>（件数を確かめ、二重の当たりを止める）か Edit を使う（CLAUDE.md「Claude Code 固有の補足」）。';
  if (NO_VERIFY.test(bare))
    return 'git commit・git push に --no-verify を付けない（git フックを飛ばすのは人間の許可が要る）。フックが止めた理由を直すか、人間に確認する。';
  return '';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const reason = checkCommand(String(input.tool_input?.command ?? ''));
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
}
