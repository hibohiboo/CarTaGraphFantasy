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
    assert.ok(!blocked("cat >> HomePage.tsx <<'EOF'\nx\nEOF"));
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
