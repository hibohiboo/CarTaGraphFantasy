// mutate-check.mjs の判定と、必ず元に戻すこと（pnpm tools:test）

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { checkMutation } from './mutate-check.mjs';

const ORIGINAL = 'const allowed = user.isGm;\nexport default allowed;\n';

/** 対象のファイルを持つ一時ディレクトリと、「ファイルに isGm が残っていれば通る」テストのコマンド */
function setup() {
  const cwd = mkdtempSync(join(tmpdir(), 'mutate-check-'));
  writeFileSync(join(cwd, 'target.js'), ORIGINAL);
  const test = `node -e "process.exit(require('fs').readFileSync('target.js','utf8').includes('isGm') ? 0 : 1)"`;
  return { cwd, test, read: () => readFileSync(join(cwd, 'target.js'), 'utf8') };
}

describe('checkMutation', () => {
  it('条件を外すとテストが落ちれば caught で、ファイルは元に戻る', () => {
    const { cwd, test, read } = setup();
    const r = checkMutation({ file: 'target.js', from: 'user.isGm', to: 'true', test }, { cwd });
    assert.equal(r.status, 'caught');
    assert.equal(read(), ORIGINAL);
  });

  it('条件を外してもテストが通れば survived で、ファイルは元に戻る', () => {
    const { cwd, test, read } = setup();
    const r = checkMutation(
      { file: 'target.js', from: 'export default', to: 'export default /* x */', test },
      { cwd },
    );
    assert.equal(r.status, 'survived');
    assert.equal(read(), ORIGINAL);
  });

  it('置換前の文字列が無い・2件以上なら not-applied で、ファイルは書き換えない', () => {
    const { cwd, test, read } = setup();
    assert.equal(
      checkMutation({ file: 'target.js', from: 'nowhere', to: 'x', test }, { cwd }).status,
      'not-applied',
    );
    assert.equal(
      checkMutation({ file: 'target.js', from: 'allowed', to: 'x', test }, { cwd }).status,
      'not-applied',
    );
    assert.equal(read(), ORIGINAL);
  });

  it('置換後の文字列の $ を、置換のパターンとして解釈しない', () => {
    const { cwd, read } = setup();
    const r = checkMutation(
      {
        file: 'target.js',
        from: 'user.isGm',
        to: '$&',
        test: `node -e "process.exit(require('fs').readFileSync('target.js','utf8').includes('$&') ? 1 : 0)"`,
      },
      { cwd },
    );
    assert.equal(r.status, 'caught');
    assert.equal(read(), ORIGINAL);
  });

  it('テストのコマンドが例外で終わっても、ファイルは元に戻る', () => {
    const { cwd, read } = setup();
    checkMutation(
      { file: 'target.js', from: 'user.isGm', to: 'true', test: 'node -e "throw new Error()"' },
      { cwd },
    );
    assert.equal(read(), ORIGINAL);
  });
});
