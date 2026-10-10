// sync-claude-rules.mjs の、.claude/rules/ の入口ファイルの組み立てと AGENTS.md の表との突き合わせ（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findTableMismatches,
  parsePaths,
  parseRulesTable,
  planSync,
  renderRule,
  ruleFileFor,
} from './sync-claude-rules.mjs';

describe('parsePaths', () => {
  it('frontmatter の paths を、引用符を外して読む', () => {
    assert.deepEqual(
      parsePaths('---\npaths:\n  - "apps/**"\n  - \'rules/**\'\n  - biome.json\n---\n\n# x'),
      ['apps/**', 'rules/**', 'biome.json'],
    );
  });

  it('paths の後ろにほかの項目があっても paths だけを読む', () => {
    assert.deepEqual(parsePaths('---\npaths:\n  - "a/**"\ntitle: x\n---\n'), ['a/**']);
  });

  it('frontmatter が無い・paths が無いときは null', () => {
    assert.equal(parsePaths('# x\n\npaths:\n  - "a/**"\n'), null);
    assert.equal(parsePaths('---\ntitle: x\nspec:\n  - a.md\n---\n'), null);
  });
});

describe('renderRule・ruleFileFor', () => {
  it('入口ファイルは docs/ を外したパスに置き、paths とルールのページだけを書く', () => {
    assert.equal(
      ruleFileFor('docs/process/rules/testing.md'),
      '.claude/rules/process/rules/testing.md',
    );
    const text = renderRule('docs/process/rules/testing.md', ['apps/**', 'rules/**']);
    assert.match(text, /^---\npaths:\n {2}- "apps\/\*\*"\n {2}- "rules\/\*\*"\n---\n/);
    assert.match(text, /`docs\/process\/rules\/testing\.md` を読み/);
    assert.ok(text.endsWith('\n') && !text.includes('\r'));
  });
});

describe('planSync', () => {
  const sources = [
    { source: 'docs/a.md', paths: ['x/**'] },
    { source: 'docs/b/c.md', paths: ['y/**'] },
  ];

  it('無いもの・古いものを書き、対応するページの無いものを消す。一致しているものは触らない', () => {
    const plan = planSync(sources, {
      '.claude/rules/a.md': renderRule('docs/a.md', ['x/**']),
      '.claude/rules/old.md': 'x',
    });
    assert.deepEqual(
      plan.write.map((w) => w.path),
      ['.claude/rules/b/c.md'],
    );
    assert.deepEqual(plan.remove, ['.claude/rules/old.md']);
  });

  it('paths が変わったら書き直す', () => {
    const plan = planSync(sources.slice(0, 1), {
      '.claude/rules/a.md': renderRule('docs/a.md', ['z/**']),
    });
    assert.deepEqual(
      plan.write.map((w) => w.path),
      ['.claude/rules/a.md'],
    );
  });
});

const AGENTS = `# x

## 開発ルールの適用

| 対象 | 必ず読むルール |
|---|---|
| \`apps/**\`, \`packages/**\` | \`docs/r/arch.md\` |
| push・マージ前 | \`docs/r/review.md\` |
| \`docs/plans/**\`、機能追加 | \`docs/index.md\`（開発サイクル） |

## 最重要ルール

| \`z/**\` | \`docs/other.md\` |
`;

describe('parseRulesTable', () => {
  it('「開発ルールの適用」の表だけを読み、右の列の最初のパスと左の列の `…` を取る', () => {
    assert.deepEqual(parseRulesTable(AGENTS), [
      { source: 'docs/r/arch.md', globs: ['apps/**', 'packages/**'] },
      { source: 'docs/r/review.md', globs: [] },
      { source: 'docs/index.md', globs: ['docs/plans/**'] },
    ]);
  });
});

describe('findTableMismatches', () => {
  const rows = parseRulesTable(AGENTS);
  const exists = () => true;
  const sources = [
    { source: 'docs/r/arch.md', paths: ['apps/**', 'packages/**'] },
    { source: 'docs/index.md', paths: ['docs/plans/**'] },
  ];

  it('一致していれば空。paths の無いページの行（タイミングで読むルール）は `…` が無ければよい', () => {
    assert.deepEqual(findTableMismatches(sources, rows, exists), []);
  });

  it('表に無いパス・frontmatter に無いパスを、両方とも挙げる', () => {
    const [e] = findTableMismatches(
      [{ source: 'docs/r/arch.md', paths: ['apps/**', 'biome.json'] }, sources[1]],
      rows,
      exists,
    );
    assert.match(e, /docs\/r\/arch\.md/);
    assert.match(e, /表に無い: biome\.json/);
    assert.match(e, /frontmatter に無い: packages\/\*\*/);
  });

  it('paths のあるページの行が無ければ止める', () => {
    const errors = findTableMismatches(
      [...sources, { source: 'docs/new.md', paths: ['n/**'] }],
      rows,
      exists,
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /docs\/new\.md の行が無い/);
  });

  it('paths の無いページの行に `…` のパスがあれば止める', () => {
    const errors = findTableMismatches(sources.slice(0, 1), rows, exists);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /docs\/index\.md.*frontmatter に無い: docs\/plans\/\*\*/);
  });

  it('表のルールのページが無ければ止める', () => {
    const errors = findTableMismatches(sources, rows, (p) => p !== 'docs/r/review.md');
    assert.deepEqual(errors, ['AGENTS.md「開発ルールの適用」の表の docs/r/review.md が無い']);
  });
});
