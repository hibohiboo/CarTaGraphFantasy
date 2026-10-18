import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseTestFile, parseUseCases, USE_CASES_FILE } from './usecases.mjs';

const MD = `# 中核のユースケース

## シナリオ製作

| ID | ユースケース | アクター | 書き換える集約 | 起きるイベント |
|---|---|---|---|---|
| SC-1 | 下書きを作る | シナリオ製作者 | シナリオ | — |
| SC-2 | シナリオデッキを組む | シナリオ製作者 | シナリオ | — |

### SC-1 下書きを作る

- **ほかの流れ** — SC-2・SC-6 の検査で止まる

## グラフ（将来）

| ID | ユースケース | アクター | 起きること |
|---|---|---|---|
| GR-1 | システム全体の構造を見る | システム製作者 | — |
`;

test('T1: 5列・4列の表の行から ID・名前・業務領域を読む。ヘッダ・区切り・見出し・本文は読まない', () => {
  const list = parseUseCases(MD);
  assert.deepEqual(
    list.map((u) => [u.id, u.name, u.domain]),
    [
      ['SC-1', '下書きを作る', 'シナリオ製作'],
      ['SC-2', 'シナリオデッキを組む', 'シナリオ製作'],
      ['GR-1', 'システム全体の構造を見る', 'グラフ'],
    ],
  );
});

test('T2: （将来）の業務領域を将来として読む。1件も読めない・同じ ID が2回出るときは誤り', () => {
  const list = parseUseCases(MD);
  assert.deepEqual(
    list.map((u) => u.future),
    [false, false, true],
  );
  assert.throws(() => parseUseCases('# 表が無い\n\n| ID | 名前 |\n|---|---|\n'), /1件も読めない/);
  assert.throws(() => parseUseCases(`${MD}\n| SC-1 | 重複 | a | b | c |\n`), /SC-1 が2回/);
});

test('T2: 実際の use-cases.md を読める', () => {
  const list = parseUseCases(readFileSync(USE_CASES_FILE, 'utf8'));
  assert.ok(list.some((u) => u.id === 'SC-1' && !u.future));
  assert.ok(list.some((u) => u.id === 'PL-8'));
  assert.ok(list.some((u) => u.id === 'GR-1' && u.future));
  assert.ok(list.some((u) => u.id === 'EV-6' && u.future));
});

test('T3: タグを読む（配列・複数行・文字列1つ・ダブルクォート）', () => {
  const t = parseTestFile(`
    test('a', { tag: ['@SC-1', '@SC-2',
      '@SC-10'] }, async () => {});
  `);
  assert.deepEqual(t.tags, ['SC-1', 'SC-2', 'SC-10']);
  assert.deepEqual(parseTestFile(`test('a', { tag: '@SC-1' }, async () => {});`).tags, ['SC-1']);
  assert.deepEqual(parseTestFile(`test("a", { tag: ["@PL-2"] }, async () => {});`).tags, ['PL-2']);
});

test('T3: ID でないタグは読まない。小文字は形の違うタグ。コメントアウトした行は読まない', () => {
  const t = parseTestFile(`
    test('a', { tag: ['@slow', '@sc-1', '@SC-1'] }, async () => {});
    // test('b', { tag: ['@SC-9'] }, async () => {});
    /* test.step('SC-8 コメント', async () => {}); */
    const url = 'http://example.com'; // test.step('SC-7 末尾のコメント', async () => {});
  `);
  assert.deepEqual(t.tags, ['SC-1']);
  assert.deepEqual(t.badTags, ['@sc-1']);
  assert.deepEqual(t.stepIds, []);
  assert.equal(t.testCount, 1);
});

test('T4: ステップの題の先頭の ID を読む。ID の無い題・空白の無い題・途中の ID は読まない', () => {
  const t = parseTestFile(`
    await test.step('SC-1 下書きを作る', async () => {});
    await test.step("PL-2 手札を出す", async () => {});
    await test.step('下ごしらえ', async () => {});
    await test.step('SC-3下書き', async () => {});
    await test.step('GM 不在で PL-2 を確かめる', async () => {});
    await test.step('sc-4 小文字', async () => {});
  `);
  assert.deepEqual(t.stepIds, ['SC-1', 'PL-2']);
  assert.deepEqual(t.badSteps, ['sc-4 小文字']);
  assert.equal(t.nonLiteralSteps, 0);
});

test('T7: 文字列の直書きでない test.step・題のタグ・describe のタグ・skip 系を読む', () => {
  const t = parseTestFile(`
    test.describe('群', { tag: ['@SC-1'] }, () => {
      test('題 @SC-1', async () => {
        await test.step(\`SC-1 \${x}\`, async () => {});
        await test.step(title, async () => {});
        await test.step.skip('SC-2 飛ばす', async () => {});
        expect.soft(1).toBe(1);
      });
      test.skip('b', async () => {});
      test.fixme('c', async () => {});
    });
  `);
  assert.equal(t.describeTagged, true);
  assert.equal(t.titleTagged, true);
  assert.equal(t.nonLiteralSteps, 2);
  assert.deepEqual([...new Set(t.forbidden)].sort(), [
    'expect.soft',
    'test.fixme',
    'test.skip',
    'test.step.skip',
  ]);
  assert.equal(t.testCount, 1);
});
