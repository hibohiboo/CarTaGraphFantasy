// check-suppressions.mjs の、既知の問題の一覧と biome-ignore の突き合わせ（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findListErrors, findSuppressions, listSection } from './check-suppressions.mjs';

const HEADING = '「複雑度・行数の上限を超える既存のコード」';
const ignore = (rule) =>
  `// biome-ignore lint/complexity/${rule}: 既存の違反。分けるまで個別に抑える（docs/architecture/known-issues.md${HEADING}）`;

const knownIssues = (count, names) => `# 既知の問題

### 複雑度・行数の上限を超える既存のコード

- **起きること** — 上限を超える箇所が${count}件あり、\`biome-ignore\` で個別に抑えている
  - 認知的複雑度：${names}

## ドキュメント・用語

### 別の項目

- TutorialPage はここに書いても数えない
`;

describe('findSuppressions', () => {
  it('既知の問題の見出しを指す抑制だけを、ファイルと行で拾う', () => {
    const found = findSuppressions([
      {
        path: 'apps/web/src/pages/pl/tutorial/ui/TutorialPage.tsx',
        text: `a\n${ignore('noExcessiveCognitiveComplexity')}\n${ignore('noExcessiveLinesPerFunction')}`,
      },
      {
        path: 'apps/web/src/shared/ui/ui.tsx',
        text: '// biome-ignore lint/suspicious/noArrayIndexKey: 丸を並べるだけ',
      },
    ]);
    assert.deepEqual(
      found.map((s) => [s.path, s.line]),
      [
        ['apps/web/src/pages/pl/tutorial/ui/TutorialPage.tsx', 2],
        ['apps/web/src/pages/pl/tutorial/ui/TutorialPage.tsx', 3],
      ],
    );
  });
});

describe('listSection', () => {
  it('見出しから次の見出しまでを返し、ほかの項目を含めない', () => {
    const section = listSection(knownIssues(1, 'TutorialPage'));
    assert.match(section, /1件/);
    assert.doesNotMatch(section, /別の項目/);
  });

  it('見出しが無ければ null', () => {
    assert.equal(listSection('# 既知の問題\n'), null);
  });
});

describe('findListErrors', () => {
  const sup = (path) => ({ path, line: 1 });
  const tutorial = sup('apps/web/src/pages/pl/tutorial/ui/TutorialPage.tsx');
  const resolve = sup('packages/domain/src/autoCombat/resolve.ts');

  it('件数と名前がそろっていれば誤りは無い', () => {
    const md = knownIssues(
      2,
      '`TutorialPage` 60、`resolveAutoCombat`（`autoCombat/resolve.ts`）29',
    );
    assert.deepEqual(findListErrors(md, [tutorial, resolve]), []);
  });

  it('件数が抑制の数と違えば誤り（抑制を外したのに一覧を直し忘れた）', () => {
    const errors = findListErrors(knownIssues(3, 'TutorialPage、resolve.ts'), [tutorial, resolve]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /3件.*2件/);
  });

  it('抑制のあるファイルの名前が一覧に無ければ、ファイルと行つきで誤り', () => {
    const errors = findListErrors(knownIssues(2, 'TutorialPage'), [tutorial, resolve]);
    assert.deepEqual(errors, [
      'packages/domain/src/autoCombat/resolve.ts:1 の抑制が、既知の問題の一覧に無い（「resolve」を一覧に書く）',
    ]);
  });

  it('ほかの項目にだけ名前があっても、一覧にあるとはみなさない', () => {
    const errors = findListErrors(knownIssues(1, 'resolve.ts'), [tutorial]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /TutorialPage/);
  });

  it('見出しが無ければ誤り', () => {
    assert.deepEqual(findListErrors('# 既知の問題\n', [tutorial]), [
      `docs/architecture/known-issues.md に見出し${HEADING}が無い`,
    ]);
  });
});
