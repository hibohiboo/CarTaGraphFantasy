// guard-bash.mjs の判定（pnpm tools:test）。止めるべきものと、止めてはいけないもの（誤検知の例）の両側を置く

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkCommand } from './guard-bash.mjs';

const blocked = (command) => checkCommand(command) !== '';

describe('インタプリタへの heredoc', () => {
  it('止める', () => {
    assert.ok(blocked("python <<'EOF'\nprint(1)\nEOF"));
    assert.ok(blocked('cd x && node <<EOF\nconsole.log(1)\nEOF'));
  });

  it('ファイル名の拡張子（.tsx・.py）をインタプリタと読まない（2026-10-05 の誤検知）', () => {
    // .tsx への heredoc は「ソースファイルへの heredoc」として止まるが、インタプリタへの heredoc とは読まない
    assert.ok(!checkCommand("cat >> HomePage.tsx <<'EOF'\nx\nEOF").includes('インタプリタ'));
    assert.ok(!blocked("cat > tool.py <<'EOF'\nprint(1)\nEOF"));
  });

  it('パスで書いたインタプリタ・2行目以降のインタプリタへの heredoc は止める', () => {
    assert.ok(blocked("/usr/bin/python3 <<'EOF'\nprint(1)\nEOF"));
    assert.ok(blocked("cat <<'A'\nx\nA\npython <<'B'\nprint(1)\nB"));
  });

  it('インタプリタ以外の heredoc・クォートの中の << は止めない', () => {
    assert.ok(!blocked("cat <<'EOF' > a.txt\nx\nEOF"));
    assert.ok(!blocked('node scripts/x.mjs "a << b"'));
  });
});

describe('インタプリタへの `-`（標準入力）', () => {
  it('止める', () => {
    assert.ok(blocked('python - < a.py'));
    assert.ok(blocked('PYTHONIOENCODING=utf-8 python -'));
    assert.ok(blocked('cd x && node - arg'));
  });

  it('-c・-e・-- は止めない', () => {
    assert.ok(!blocked('python -c "print(1)"'));
    assert.ok(!blocked("node -e 'console.log(1)'"));
    assert.ok(!blocked('node -- script.mjs'));
  });

  it('クォートした引数の中の「改行＋- 」は止めない（2026-10-04 の誤検知）', () => {
    assert.ok(!blocked('node m.mjs plan.md "前回のエラーが出たまま\n- 外したシーン\n- 同じ ID"'));
    assert.ok(!blocked("node m.mjs plan.md 'a\n- b'"));
  });

  it('コミットメッセージに「python -」と書いただけでは止めない', () => {
    assert.ok(!blocked('git commit -m "python - を止める"'));
  });
});

describe('--no-verify', () => {
  it('止める', () => {
    assert.ok(blocked('git commit --no-verify -m x'));
    assert.ok(blocked('git push --no-verify'));
  });

  it('コミットメッセージの中の --no-verify は止めない', () => {
    assert.ok(!blocked('git commit -m "--no-verify を止めるフックを足す"'));
  });
});

describe('sed の書き換え（-i）', () => {
  it('止める（2026-10-07、2回当てて「製製作者」に化けた）', () => {
    assert.ok(blocked("sed -i 's/a/b/' x.md"));
    assert.ok(blocked("sed -i.bak -e 's/a/b/' x.md"));
    assert.ok(blocked("for f in a b; do sed -i 's/a/b/g' $f; done"));
    assert.ok(blocked("sed --in-place 's/a/b/' x.md"));
    assert.ok(blocked("sed -ni 's/a/b/p' x.md"));
  });

  it('読むだけの sed・クォートの中の sed -i は止めない', () => {
    assert.ok(!blocked("sed -n '1,20p' x.md"));
    assert.ok(!blocked('git commit -m "sed -i を止めるフックを足す"'));
    assert.ok(!blocked('grep -i sed x.md'));
  });
});

describe('git stash', () => {
  it('止める（2026-10-10、stash → pop でステージしたファイルの削除が解けた）', () => {
    assert.ok(blocked('git stash'));
    assert.ok(blocked('git stash -q && grep -c x a.ts; git stash pop -q'));
    assert.ok(blocked('git stash push -m x'));
    assert.ok(blocked('git stash pop'));
    assert.ok(blocked('git stash apply stash@{0}'));
    assert.ok(blocked('git stash drop'));
  });

  it('読むだけの stash（list・show）・main との比べ方・クォートの中は止めない', () => {
    assert.ok(!blocked('git stash list'));
    assert.ok(!blocked('git stash show -p stash@{0}'));
    assert.ok(!blocked('git grep -c biome-ignore main -- apps'));
    assert.ok(!blocked('git commit -m "git stash を止めるフックを足す"'));
  });
});

describe('git checkout・git restore でファイルを戻す', () => {
  // 作業ツリーにあるパスだけをあることにする（テストの結果を、手元のファイルの有無に頼らせない）
  const files = new Set(['.', 'a.ts', 'packages/domain/src/session/model.ts']);
  const exists = (p) => files.has(p);
  const guarded = (command) => checkCommand(command, { exists }) !== '';

  it('止める（-- 付き・ファイルのパス・. ・git restore）', () => {
    assert.ok(guarded('git checkout -- a.ts'));
    assert.ok(guarded('git checkout main -- a.ts'));
    assert.ok(guarded('git checkout packages/domain/src/session/model.ts 2>/dev/null; true'));
    assert.ok(guarded('git checkout .'));
    assert.ok(guarded('cd x && git checkout a.ts'));
    assert.ok(guarded('git restore a.ts'));
    assert.ok(guarded('git restore --staged --worktree a.ts'));
    assert.ok(guarded('git restore -W a.ts'));
    assert.ok(guarded('git restore --source=main a.ts'));
  });

  it('ブランチの切り替え・作成、ステージを外すだけの restore、クォートの中は止めない', () => {
    assert.ok(!guarded('git checkout main'));
    assert.ok(!guarded('git checkout -q main && git pull'));
    assert.ok(!guarded('git checkout feat/api-docs'));
    assert.ok(!guarded('git checkout -b feat/x'));
    assert.ok(!guarded('git checkout -B a.ts'));
    assert.ok(!guarded('git restore --staged a.ts'));
    assert.ok(!guarded('git commit -m "git checkout -- a.ts を止める"'));
    assert.ok(!guarded('git show main:a.ts'));
  });

  it('heredoc の本文（コミットメッセージなど）はコマンドとして読まない（2026-10-11 の誤検知）', () => {
    const commit = [
      "git commit -q -F - <<'EOF'",
      'chore: ファイルを戻す git checkout・git restore をフックで止める',
      '',
      'git checkout -- a.ts と git stash と sed -i と --no-verify を止める',
      'EOF',
      'git push -q',
    ].join('\n');
    assert.ok(!guarded(commit));
    assert.ok(!guarded(commit.replace("<<'EOF'", '<<EOF')));
  });

  it('heredoc の終わりより後ろのコマンドは読む', () => {
    const after = ["cat > a.txt <<'EOF'", 'x', 'EOF', 'git checkout -- a.ts'].join('\n');
    assert.ok(guarded(after));
  });
});

describe('heredoc でソースファイルに書く', () => {
  const heredoc = (head) => [head, "const s = 'D:\\\\p';", 'EOF'].join('\n');

  it('止める（.ts・.tsx・.mjs・.js、> と >>、リダイレクトの前後どちらに << があっても）', () => {
    assert.ok(blocked(heredoc("cat >> scripts/x.test.mjs <<'EOF'")));
    assert.ok(blocked(heredoc("cat > apps/web/src/a.ts <<'EOF'")));
    assert.ok(blocked(heredoc("cat <<'EOF' > apps/web/src/A.tsx")));
    assert.ok(blocked(heredoc('cd x && cat >>b.js <<EOF')));
  });

  it('ソースでないファイル（JSON・Markdown・テキスト）への heredoc と、heredoc でない書き込みは止めない', () => {
    assert.ok(!blocked(heredoc("cat > scratch/spec.json <<'EOF'")));
    assert.ok(!blocked(heredoc("cat >> docs/plans/a.md <<'EOF'")));
    assert.ok(!blocked(heredoc("cat > a.txt <<'EOF'")));
    assert.ok(!blocked('cat a.ts > b.ts'));
    assert.ok(!blocked('git commit -m "cat > a.ts <<EOF を止める"'));
  });
});
