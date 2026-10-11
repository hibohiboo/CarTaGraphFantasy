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
// 5. git stash（list・show を除く）
//    → main と比べるつもりで stash → pop すると、ステージした削除（git rm）が解ける（2026-10-10、冒険者だけにする C3）。
//      main の中身は git grep <パターン> main -- <パス>・git show main:<パス> で読む
// 6. git checkout・git restore でファイルを戻す（`--` 付き、作業ツリーにあるパス、`git restore`（ステージを外すだけを除く））
//    → わざと崩した箇所を戻すつもりで、未コミットの変更ごと消える（2026-10-11、API ドキュメント。zod 化した
//      session/model.ts が main の版に戻った）。node scripts/mutate-check.mjs か replace-once の逆向きの置換で戻す。
//      ブランチの切り替え・作成（git checkout main・-b）は止めない
// 7. heredoc でソースファイル（.ts・.tsx・.js・.mjs など）に書く（cat > a.ts <<'EOF'・cat >> a.test.mjs <<'EOF'）
//    → バックスラッシュの解釈が崩れる（2026-10-11、シナリオの下書きの API の振り返り。stop-dev-agent.test.mjs の
//      Windows のパスの \\ が崩れた）。Write でファイルに書くか、replace-once で足す。JSON・Markdown などは止めない
//
// 判定の前に、heredoc の本文と、クォートした引数の中身を取り除く。引数の文字列（Markdown の箇条書きの「\n- 」、コミットメッセージに
// 書いた「--no-verify」など）を、コマンドとして読まないため（2026-10-04、PR #15 の振り返り）。
// テストは同じディレクトリの guard-bash.test.mjs（pnpm tools:test）。

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// git stash の後ろが list・show でない（サブコマンドなし・push・pop・apply・drop など）
const GIT_STASH = /(?:^|[\s;&|(])git\s+stash\b(?!\s+(?:list|show)\b)/m;

// git checkout・git restore と、同じコマンドの中の引数
const GIT_CHECKOUT = /(?:^|[\s;&|(])git\s+checkout\b([^\n|;&]*)/gm;

// 同じ行に heredoc（<<）と、ソースファイルへのリダイレクト（> か >>）がある
const SOURCE_REDIRECT = />>?\s*[^\s;&|<>]+\.[cm]?[jt]sx?(?=$|[\s;&|<>])/;
const heredocIntoSource = (bare) =>
  bare.split('\n').some((line) => line.includes('<<') && SOURCE_REDIRECT.test(line));
const GIT_RESTORE = /(?:^|[\s;&|(])git\s+restore\b([^\n|;&]*)/gm;

const argsOf = (rest) => rest.trim().split(/\s+/).filter(Boolean);

/** ファイルを戻す git checkout・git restore があるか。exists はパスが作業ツリーにあるか */
function discardsFiles(bare, exists) {
  for (const [, rest] of bare.matchAll(GIT_CHECKOUT)) {
    const args = argsOf(rest);
    // ブランチの作成は、後ろの名前がファイルと同じでもファイルを戻さない
    if (args.some((a) => ['-b', '-B', '--orphan'].includes(a))) continue;
    if (args.includes('--')) return true;
    // オプションとリダイレクト（2>/dev/null など）を除いた引数が、作業ツリーのパスなら戻す
    if (args.some((a) => !a.startsWith('-') && !/^\d*[<>]/.test(a) && exists(a))) return true;
  }
  for (const [, rest] of bare.matchAll(GIT_RESTORE)) {
    const args = argsOf(rest);
    const staged = args.includes('--staged') || args.includes('-S');
    const worktree = args.includes('--worktree') || args.includes('-W');
    // ステージを外すだけ（--staged で --worktree なし）は、作業ツリーの変更を消さない
    if (!staged || worktree) return true;
  }
  return false;
}

/** '…' と "…" の中身を空にする（"…" の中の \" は閉じとみなさない） */
const stripQuoted = (command) => command.replace(/'[^']*'|"(?:[^"\\]|\\[\s\S])*"/g, '""');

/**
 * heredoc の本文（<<'EOF' の次の行から終わりの EOF まで）を取り除く。<< の行は残す（インタプリタへの heredoc を見るため）。
 * 本文はコマンドではない（コミットメッセージに書いた「git restore」などを止めない。2026-10-11 の誤検知）
 */
const stripHeredocBodies = (command) =>
  command.replace(/(<<-?\s*(['"]?)(\w+)\2[^\n]*)\n[\s\S]*?\n\s*\3(?=\n|$)/g, '$1');

/** 止める理由（止めないなら空文字）。exists は、引数のパスが作業ツリーにあるか（既定は今のディレクトリから見る） */
export function checkCommand(command, { exists = (p) => existsSync(resolve(p)) } = {}) {
  const bare = stripQuoted(stripHeredocBodies(command));
  if (INTERPRETER_HEREDOC.test(bare))
    return 'インタプリタに heredoc でスクリプトを渡さない（バックスラッシュが崩れる）。Write でスクラッチパッドにファイルとして書いてから実行する（CLAUDE.md「Claude Code 固有の補足」）。';
  if (INTERPRETER_STDIN.test(bare))
    return 'インタプリタに `-`（標準入力からスクリプトを読む）を渡さない（入力が来ないと止まったままになる）。Write でスクラッチパッドにファイルとして書いてから実行する（CLAUDE.md「Claude Code 固有の補足」）。';
  if (SED_IN_PLACE.test(bare))
    return 'sed -i でファイルを書き換えない（同じ語に2回当たって化けても気づけない）。node scripts/replace-once.mjs <spec.json>（件数を確かめ、二重の当たりを止める）か Edit を使う（CLAUDE.md「Claude Code 固有の補足」）。';
  if (GIT_STASH.test(bare))
    return 'git stash を使わない（stash → pop でステージした削除などが解ける）。main と比べるなら git grep <パターン> main -- <パス> か git show main:<パス> で読む（CLAUDE.md「Claude Code 固有の補足」）。';
  if (heredocIntoSource(bare))
    return 'heredoc でソースファイル（.ts・.tsx・.mjs など）に書かない（バックスラッシュの解釈が崩れる）。Write でファイルに書くか、node scripts/replace-once.mjs で足す（CLAUDE.md「Claude Code 固有の補足」）。';
  if (discardsFiles(bare, exists))
    return 'git checkout・git restore でファイルを戻さない（未コミットの変更ごと消える）。わざと崩した箇所は node scripts/mutate-check.mjs か replace-once の逆向きの置換で戻し、main の中身は git show main:<パス> で読む。本当に戻すなら人間に確認する（CLAUDE.md「Claude Code 固有の補足」）。';
  if (NO_VERIFY.test(bare))
    return 'git commit・git push に --no-verify を付けない（git フックを飛ばすのは人間の許可が要る）。フックが止めた理由を直すか、人間に確認する。';
  return '';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd();
  const reason = checkCommand(String(input.tool_input?.command ?? ''), {
    exists: (p) => existsSync(resolve(cwd, p)),
  });
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
