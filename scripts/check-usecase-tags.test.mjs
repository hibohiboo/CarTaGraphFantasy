import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, test } from 'node:test';
import { findUsecaseTagProblems, successMessage } from './check-usecase-tags.mjs';
import { readBacklog } from './trace.mjs';
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
  bad("test.skip('b', async () => {});", '直す要望の注記');
  bad("test.skip(cond, '理由');", 'test.skip は宣言の形');
  bad("test.fixme('b', async () => {});", 'test.fixme');
  bad("await test.step.skip('SC-1 x', async () => {});", 'test.step.skip');
  bad('expect.soft(1).toBe(1);', 'expect.soft');
  bad("test('b', async () => {});", '1ファイルに1本');
});

test('T7: usecases/ の外（smoke など）は、スキップ以外の書き方の制限の対象にしない', () => {
  const source = `test('a', async () => {});\ntest('b', async () => {});\ntest.describe('c', () => {});`;
  assert.deepEqual(problems([{ path: 'apps/web/e2e/smoke.test.ts', source }]), []);
});

test('T8: テストの無いユースケースは誤りにしない', () => {
  assert.deepEqual(problems([]), []);
});

test('T9: 今の use-cases.md と apps/web/e2e/ と docs/backlog/ で検査が通る', () => {
  const found = findUsecaseTagProblems({
    useCasesMd: readFileSync(USE_CASES_FILE, 'utf8'),
    files: readE2eTestFiles(),
    backlog: readBacklog(),
  });
  assert.deepEqual(found, []);
});

// ---- T2：スキップと直す要望（docs/plans/2026-10-27-P6-不安定なE2Eのスキップ.md） ----

const IGNORE =
  '// biome-ignore lint/suspicious/noSkippedTests: 不安定なため。直す要望は annotation';
const BACKLOG = [
  { name: 'fix', status: '未着手', trace: { usecases: ['SC-1', 'SC-2'], screens: [], rules: [] } },
  { name: 'only-one', status: '進行中', trace: { usecases: ['SC-1'], screens: [], rules: [] } },
  { name: 'none', status: '検討中', trace: { none: '基盤' } },
  ...['完了', '見送り', '', '進行'].map((status, i) => ({
    name: `closed${i}`,
    status,
    trace: { usecases: ['SC-1', 'SC-2'], screens: [], rules: [] },
  })),
];
/** スキップした ok（タグ SC-1・SC-2）。annotation は details に書く中身（文字列のまま入れる） */
const skipped = (annotation, { ignore = IGNORE } = {}) => `
  ${ignore}
  test.skip('a', {
    tag: ['@SC-1', '@SC-2'],
    ${annotation === undefined ? '' : `annotation: ${annotation},`}
  }, async () => {
    await test.step('SC-1 下書き', async () => {});
    await test.step('SC-2 デッキ', async () => {});
  });
`;
const note = (name) => `{ type: 'backlog', description: 'docs/backlog/${name}.md' }`;
const check = (source, { path = U, backlog = BACKLOG } = {}) =>
  findUsecaseTagProblems({ useCasesMd: MD, files: [{ path, source }], backlog });
const stops = (source, needle, options) => {
  const found = check(source, options);
  assert.ok(
    found.some((m) => m.includes(needle)),
    `${needle} が出ない: ${found.join(' / ')}`,
  );
};

describe('T2: スキップと直す要望の検査', () => {
  it('止めない：開いている要望（未着手・検討中・進行中・判断待ち）で、trace.usecases がタグを含む', () => {
    for (const status of ['未着手', '検討中', '進行中', '判断待ち']) {
      const backlog = [{ ...BACKLOG[0], status }];
      assert.deepEqual(check(skipped(note('fix')), { backlog }), [], status);
    }
    // 配列にほかの type が混ざってもよい
    assert.deepEqual(
      check(skipped(`[{ type: 'issue', description: 'https://example.com' }, ${note('fix')}]`)),
      [],
    );
  });

  it('止める：注記の無いスキップ・backlog 以外の注記だけのスキップ・backlog の注記が2つ', () => {
    stops(skipped(undefined), '直す要望の注記');
    stops(skipped("{ type: 'issue', description: 'https://example.com' }"), '直す要望の注記');
    stops(skipped(`[${note('fix')}, ${note('fix')}]`), '2 個');
  });

  it('止める：実在しない要望・開いていない要望（完了・見送り・空・未知の状態）', () => {
    stops(skipped(note('nothing')), 'docs/backlog/nothing.md が無い');
    for (const i of [0, 1, 2, 3]) stops(skipped(note(`closed${i}`)), '開いていない');
  });

  it('閉じた要望で止まったときは、スキップを外す案内とテストのファイルが出る', () => {
    const [message] = check(skipped(note('closed0')));
    assert.ok(message.startsWith(U), message);
    assert.match(message, /test\.skip を test に戻し/);
    assert.match(message, /テストを消す/);
  });

  it('止める：要望の trace.usecases にスキップしたテストのタグの UC が欠ける（1つでも・none でも）', () => {
    stops(skipped(note('only-one')), '@SC-2');
    stops(skipped(note('none')), 'trace.usecases');
  });

  it('止める：スキップしていないテストの backlog の注記・直書きでない注記', () => {
    stops(
      `test('a', { tag: ['@SC-1'], annotation: ${note('fix')} }, async () => {
        await test.step('SC-1 下書き', async () => {});
      });`,
      'スキップしていないテスト',
    );
    stops(skipped('notes'), '直書きでない');
    stops(skipped("{ type: kind, description: 'docs/backlog/fix.md' }"), '直書きでない');
  });

  it('止める：description の形の誤り', () => {
    for (const d of [
      'docs/backlog/index.md',
      'docs/backlog/sub/x.md',
      'docs/backlog/x',
      './docs/backlog/x.md',
      '../backlog/x.md',
      'docs\\\\backlog\\\\x.md',
    ]) {
      stops(skipped(`{ type: 'backlog', description: '${d}' }`), 'の形で書く');
    }
  });

  it('止める：抑制コメントの次が宣言の test.skip( でない', () => {
    stops(`${IGNORE}\n${ok}`, '抑制コメント');
  });

  it('止める：要望の一覧を渡さずに backlog の注記がある', () => {
    const found = findUsecaseTagProblems({
      useCasesMd: MD,
      files: [{ path: U, source: skipped(note('fix')) }],
    });
    assert.ok(found.some((m) => m.includes('要望の一覧')));
  });

  it('止める：e2e/usecases/ の外（smoke）のスキップ（抑制コメントあり）・fixme・describe.skip・backlog の注記', () => {
    const smoke = { path: 'apps/web/e2e/smoke.test.ts' };
    stops(skipped(note('fix')), 'e2e/usecases/ の外', smoke);
    stops("test.fixme('a', async () => {});", 'e2e/usecases/ の外', smoke);
    stops("test.describe.skip('a', () => {});", 'e2e/usecases/ の外', smoke);
    stops(
      `test('a', { annotation: ${note('fix')} }, async () => {});`,
      'e2e/usecases/ の外',
      smoke,
    );
  });

  it('成功のメッセージに「スキップ中 n 件」', () => {
    const files = [
      { path: U, source: skipped(note('fix')) },
      { path: 'apps/web/e2e/usecases/b.test.ts', source: ok },
    ];
    assert.match(successMessage(files), /テスト 2 ファイル/);
    assert.match(successMessage(files), /スキップ中 1 件/);
  });
});
