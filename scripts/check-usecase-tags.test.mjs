import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { findUsecaseTagProblems } from './check-usecase-tags.mjs';
import { readE2eTestFiles, USE_CASES_FILE } from './usecases.mjs';

const MD = `## シナリオ製作

| ID | ユースケース | アクター | 書き換える集約 | 起きるイベント |
|---|---|---|---|---|
| SC-1 | 下書きを作る | a | b | — |
| SC-2 | シナリオデッキを組む | a | b | — |
| SC-3 | 結末を決める | a | b | — |
`;

const U = 'apps/web/e2e/usecases/a.test.ts';
const problems = (files) => findUsecaseTagProblems({ useCasesMd: MD, files });
const ok = `
  test('a', { tag: ['@SC-1', '@SC-2'] }, async () => {
    await test.step('SC-1 下書き', async () => {});
    await test.step('SC-2 デッキ', async () => {});
  });
`;

test('T6: タグとステップがそろっていれば誤り無し', () => {
  assert.deepEqual(problems([{ path: U, source: ok }]), []);
});

test('T5: 表に無い ID のタグ・ステップで誤り（ファイル名と ID を出す）。小文字も誤り', () => {
  const found = problems([
    {
      path: 'apps/web/e2e/x.test.ts',
      source: `test('a', { tag: ['@SC-9', '@sc-1'] }, async () => {
        await test.step('SC-8 無い', async () => {});
        await test.step('sc-2 小文字', async () => {});
      });`,
    },
  ]);
  assert.equal(found.length, 4);
  assert.ok(found.some((m) => m.includes('x.test.ts') && m.includes('@SC-9')));
  assert.ok(found.some((m) => m.includes('SC-8')));
  assert.ok(found.some((m) => m.includes('@sc-1')));
  assert.ok(found.some((m) => m.includes('sc-2')));
});

test('T6: usecases/ で、タグにあってステップに無い・ステップにあってタグに無い ID で誤り', () => {
  const found = problems([
    {
      path: U,
      source: `test('a', { tag: ['@SC-1', '@SC-2'] }, async () => {
        await test.step('SC-1 下書き', async () => {});
        await test.step('SC-3 結末', async () => {});
      });`,
    },
  ]);
  assert.equal(found.length, 2);
  assert.ok(found.some((m) => m.includes('@SC-2') && m.includes('ステップ')));
  assert.ok(found.some((m) => m.includes('SC-3') && m.includes('タグ')));
});

test('T7: usecases/ の書き方の制限（直書きでない題・題と describe のタグ・skip 系・複数本）', () => {
  const bad = (source, needle) => {
    const found = problems([{ path: U, source: `${ok}\n${source}` }]);
    assert.ok(
      found.some((m) => m.includes(needle)),
      `${needle} が出ない: ${found.join(' / ')}`,
    );
  };
  bad(['await test.step(`SC-1 $', '{x}`, async () => {});'].join(''), '直書きでない');
  bad('await test.step(title, async () => {});', '直書きでない');
  bad("test('題 @SC-1', async () => {});", '題の中にタグ');
  bad("test.describe('g', { tag: ['@SC-1'] }, () => {});", 'test.describe にタグ');
  bad("test.only('b', async () => {});", 'test.only');
  bad("test.fail('b', async () => {});", 'test.fail');
  bad("await test.step('SC-1 もう一度', async () => {});", '複数ある');
  bad("test.skip('b', async () => {});", 'test.skip');
  bad("test.fixme('b', async () => {});", 'test.fixme');
  bad("await test.step.skip('SC-1 x', async () => {});", 'test.step.skip');
  bad('expect.soft(1).toBe(1);', 'expect.soft');
  bad("test('b', async () => {});", '1ファイルに1本');
});

test('T7: usecases/ の外（smoke など）は書き方の制限の対象にしない', () => {
  const source = `test.skip('a', async () => {});\ntest('b', async () => {});\ntest('c', async () => {});`;
  assert.deepEqual(problems([{ path: 'apps/web/e2e/smoke.test.ts', source }]), []);
});

test('T8: テストの無いユースケースは誤りにしない', () => {
  assert.deepEqual(problems([]), []);
});

test('T9: 今の use-cases.md と apps/web/e2e/ で検査が通る', () => {
  const found = findUsecaseTagProblems({
    useCasesMd: readFileSync(USE_CASES_FILE, 'utf8'),
    files: readE2eTestFiles(),
  });
  assert.deepEqual(found, []);
});
