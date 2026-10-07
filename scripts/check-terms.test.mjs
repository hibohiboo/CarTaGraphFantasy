// check-terms.mjs の、旧称の検出（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findOldTerms, isChecked } from './check-terms.mjs';

describe('findOldTerms', () => {
  it('旧称を、ファイル・行・今の名前つきで見つける', () => {
    const found = findOldTerms([
      { path: 'docs/a.md', text: '一行目\nGMは共有ライブラリから選ぶ\n選択肢の行き先' },
      { path: 'apps/web/src/b.tsx', text: "const s = 'シナリオ作成者';" },
    ]);
    assert.deepEqual(
      found.map((f) => [f.path, f.line, f.term]),
      [
        ['docs/a.md', 2, '共有ライブラリ'],
        ['docs/a.md', 3, '行き先'],
        ['apps/web/src/b.tsx', 1, 'シナリオ作成者'],
      ],
    );
    assert.match(found[0].message, /シナリオ集.*共有設定/);
  });

  it('今の名前（結末のノード・シナリオ製作者・移り先）は見つけない', () => {
    assert.deepEqual(
      findOldTerms([{ path: 'docs/a.md', text: '結末のノード、シナリオ製作者、移り先、結末タグ' }]),
      [],
    );
  });

  it('1行に複数の旧称があれば、全部見つける', () => {
    const found = findOldTerms([{ path: 'x.md', text: '結末ノードと配る前提タグ' }]);
    assert.deepEqual(
      found.map((f) => f.term),
      ['結末ノード', '配る前提タグ'],
    );
  });
});

describe('isChecked', () => {
  it('docs・apps・packages・scenarios と入口の文書を見る', () => {
    for (const p of [
      'docs/cartagraph/scenario-flow.md',
      'apps/web/src/a.tsx',
      'packages/domain/src/a.ts',
      'AGENTS.md',
    ])
      assert.ok(isChecked(p), p);
  });

  it('経緯の記録（plans・interviews・進化ログ）、この検査自身、ビルドの成果物は見ない', () => {
    for (const p of [
      'docs/plans/2026-10-06-x.md',
      'docs/interviews/a.md',
      'docs/process/evolution.md',
      'scripts/check-terms.mjs',
      'scripts/check-terms.test.mjs',
      'docs/.vitepress/dist/a.html',
      'pnpm-lock.yaml',
    ])
      assert.ok(!isChecked(p), p);
  });
});
