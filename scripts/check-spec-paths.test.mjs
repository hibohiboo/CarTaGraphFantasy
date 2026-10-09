// check-spec-paths.mjs の、正式仕様のページにある実装のパスの検出（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findImplPaths, isSpecFile } from './check-spec-paths.mjs';

describe('findImplPaths', () => {
  it('rules/・apps/・packages/・scenarios/・scripts/ のパスを、ファイル・行つきで見つける', () => {
    const found = findImplPaths([
      {
        path: 'docs/cartagraph/a.md',
        text: '一行目\n上限は `rules/character-creation.json` の値\n(apps/web/src/x.ts) と packages/domain',
      },
      { path: 'docs/glossary.md', text: '例は scenarios/sc-x.json と scripts/sim.ts' },
    ]);
    assert.deepEqual(
      found.map((f) => [f.path, f.line, f.found]),
      [
        ['docs/cartagraph/a.md', 2, 'rules/character-creation.json'],
        ['docs/cartagraph/a.md', 3, 'apps/web/src/x.ts'],
        ['docs/cartagraph/a.md', 3, 'packages/domain'],
        ['docs/glossary.md', 1, 'scenarios/sc-x.json'],
        ['docs/glossary.md', 1, 'scripts/sim.ts'],
      ],
    );
    assert.match(found[0].message, /docs\/architecture\//);
  });

  it('ほかのディレクトリの途中・URL・相対リンクの中の語は数えない', () => {
    assert.deepEqual(
      findImplPaths([
        {
          path: 'docs/cartagraph/a.md',
          text: '[ルール](../process/rules/testing.md) https://example.com/apps/x docs/rules/a ./scripts/x',
        },
      ]),
      [],
    );
  });

  it('語としての「rules」「apps」（スラッシュが続かない）は数えない', () => {
    assert.deepEqual(
      findImplPaths([{ path: 'docs/glossary.md', text: 'house rules と apps' }]),
      [],
    );
  });
});

describe('isSpecFile', () => {
  it('仕様（cartagraph・concept・用語集）は見る', () => {
    assert.equal(isSpecFile('docs/cartagraph/solo-village.md'), true);
    assert.equal(isSpecFile('docs/concept/index.md'), true);
    assert.equal(isSpecFile('docs/glossary.md'), true);
  });

  it('生成した参考資料・仕様でないページは見ない', () => {
    assert.equal(isSpecFile('docs/cartagraph/auto-combat-simulation.md'), false);
    assert.equal(isSpecFile('docs/architecture/web-app.md'), false);
    assert.equal(isSpecFile('docs/notes/solo-village.md'), false);
    assert.equal(isSpecFile('docs/open-questions.md'), false);
  });
});
