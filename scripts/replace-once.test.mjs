// replace-once.mjs の置換の計算（pnpm tools:test）。書く前に全部を確かめること

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { planReplacements } from './replace-once.mjs';

const files = {
  [resolve('/w/a.ts')]: '// 古いコメント\nconst a = 1;\n',
  [resolve('/w/b.ts')]: 'x\nx\n',
};
const read = (path) => {
  if (!(path in files)) throw new Error(`no file: ${path}`);
  return files[path];
};
const plan = (specs) => planReplacements(specs, { cwd: resolve('/w'), read });

describe('planReplacements', () => {
  it('count を書くと、置換前がちょうどその件数のときに全部を置き換える', () => {
    const r = plan([{ file: 'b.ts', from: 'x', to: 'y', count: 2 }]);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.writes, [[resolve('/w/b.ts'), 'y\ny\n']]);
  });

  it('count と件数が違えば、何も書かない', () => {
    const r = plan([{ file: 'b.ts', from: 'x', to: 'y', count: 3 }]);
    assert.match(r.errors[0], /1件目.*2 件（3件であるべき）/);
    assert.deepEqual(r.writes, []);
  });

  it('置換前の文字列が、同じファイルへの前の置換の結果の中にも当たるなら、何も書かない（二重に当たって化けるのを止める）', () => {
    // 2026-10-07、「作者でない」→「製作者でない」を当てた後に、もう一度「作者でない」を当てて「製製作者」に化けた
    const r = plan([
      { file: 'a.ts', from: '古い', to: 'より古い' },
      { file: 'a.ts', from: '古い', to: '新しい' },
    ]);
    assert.match(r.errors[0], /2件目.*1件目の置換後/);
    assert.deepEqual(r.writes, []);
  });

  it('置換前がちょうど1か所なら、`//` で始まる置換後もそのまま書く内容になる', () => {
    const r = plan([{ file: 'a.ts', from: '// 古いコメント', to: '// 新しいコメント' }]);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.writes, [[resolve('/w/a.ts'), '// 新しいコメント\nconst a = 1;\n']]);
  });

  it('同じファイルへの2つの置換は、前の置換の結果に重ねる', () => {
    const r = plan([
      { file: 'a.ts', from: '古い', to: '新しい' },
      { file: 'a.ts', from: 'const a = 1', to: 'const a = 2' },
    ]);
    assert.equal(r.writes[0][1], '// 新しいコメント\nconst a = 2;\n');
  });

  it('1つでも置換前が0件・2件以上なら、何も書かない（全部を確かめてから書く）', () => {
    const r = plan([
      { file: 'a.ts', from: '古い', to: '新しい' },
      { file: 'b.ts', from: 'x', to: 'y' },
      { file: 'a.ts', from: 'nowhere', to: 'z' },
    ]);
    assert.equal(r.errors.length, 2);
    assert.match(r.errors[0], /2件目.*2 件/);
    assert.match(r.errors[1], /3件目.*0 件/);
    assert.deepEqual(r.writes, []);
  });

  it('置換後の $ を、置換のパターンとして解釈しない', () => {
    const r = plan([{ file: 'a.ts', from: 'const a = 1', to: 'const a = "$&"' }]);
    assert.equal(r.writes[0][1], '// 古いコメント\nconst a = "$&";\n');
  });
});
