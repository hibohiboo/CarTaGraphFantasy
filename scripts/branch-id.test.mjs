// branch-id.mjs の、ブランチとプランの連番 id の扱い（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendId,
  branchId,
  branchName,
  checkCommitBranch,
  findUnclosedPlans,
  nextId,
  planIdNumber,
} from './branch-id.mjs';

describe('branchId', () => {
  it('種類の後の P<番号>- を読む（先頭の0は落とす）', () => {
    assert.equal(branchId('feat/P12-scenario-copy'), 'P12');
    assert.equal(branchId('docs/P007-fix-typo'), 'P7');
    assert.equal(branchId('P3-no-type'), 'P3');
    assert.equal(branchId('origin/feat/P4-x'), 'P4');
  });

  it('id の無いブランチ・名前の途中の P は読まない', () => {
    assert.equal(branchId('main'), null);
    assert.equal(branchId('feat/scenario-copy'), null);
    assert.equal(branchId('feat/api-P12-x'), null);
    assert.equal(branchId('feat/P12'), null);
  });
});

describe('planIdNumber', () => {
  it('<日付>-P<id>-<機能>.md の id を読み、日付だけのファイルは null', () => {
    assert.equal(planIdNumber('2026-10-18-P12-ブランチの連番.md'), 12);
    assert.equal(planIdNumber('2026-10-17-シナリオ製作の導線.md'), null);
    assert.equal(planIdNumber('P12-2026-10-18.md'), null);
  });
});

describe('nextId', () => {
  it('何も無ければ P1', () => {
    assert.equal(nextId({}), 'P1');
    assert.equal(nextId({ branches: ['main', 'feat/x'], planFiles: ['2026-10-17-a.md'] }), 'P1');
  });

  it('ブランチ・プラン・コミットメッセージの最大に1を足す', () => {
    assert.equal(nextId({ branches: ['feat/P3-a', 'origin/fix/P9-b'] }), 'P10');
    assert.equal(nextId({ planFiles: ['2026-10-18-P11-a.md'] }), 'P12');
    assert.equal(nextId({ messages: ['docs: x #P20', 'feat: y'] }), 'P21');
    assert.equal(
      nextId({
        branches: ['feat/P3-a'],
        planFiles: ['2026-10-18-P5-a.md'],
        messages: ['docs: x #P4'],
      }),
      'P6',
    );
  });

  it('PR の番号（#27）は数えない', () => {
    assert.equal(nextId({ messages: ['docs: 完了にする（PR #27）'] }), 'P1');
  });
});

describe('branchName', () => {
  it('<種類>/<id>-<名前> を組み立てる', () => {
    assert.equal(branchName('feat', 'scenario-copy', 'P12'), 'feat/P12-scenario-copy');
    assert.equal(branchName('docs', 'fix2', 'P1'), 'docs/P1-fix2');
  });

  it('知らない種類・大文字や日本語の名前・形の違う id は例外', () => {
    assert.throws(() => branchName('feature', 'x', 'P1'), /種類/);
    assert.throws(() => branchName('feat', 'Scenario', 'P1'), /名前/);
    assert.throws(() => branchName('feat', 'シナリオ', 'P1'), /名前/);
    assert.throws(() => branchName('feat', '-x', 'P1'), /名前/);
    assert.throws(() => branchName('feat', 'x', '12'), /id/);
  });
});

describe('checkCommitBranch', () => {
  it('main・master へのコミットを止める', () => {
    assert.match(
      checkCommitBranch({ branch: 'main', merging: false }),
      /main に直接コミットしない/,
    );
    assert.match(checkCommitBranch({ branch: 'master', merging: false }), /master/);
  });

  it('id の無いブランチでのコミットを止める', () => {
    assert.match(checkCommitBranch({ branch: 'feat/x', merging: false }), /id がありません/);
  });

  it('id のあるブランチ・main でのマージのコミット・detached HEAD は通す', () => {
    assert.equal(checkCommitBranch({ branch: 'feat/P1-x', merging: false }), null);
    assert.equal(checkCommitBranch({ branch: 'main', merging: true }), null);
    assert.equal(checkCommitBranch({ branch: null, merging: false }), null);
  });
});

describe('appendId', () => {
  it('1行目の末尾に「 #P12」を付け、本文とトレーラーは変えない', () => {
    assert.equal(
      appendId('docs: x\n\n本文\n\nCo-Authored-By: A <a@example.com>\n', 'P12'),
      'docs: x #P12\n\n本文\n\nCo-Authored-By: A <a@example.com>\n',
    );
  });

  it('先頭の空行・# のコメント行を飛ばし、1行目の末尾の空白は落とす', () => {
    assert.equal(appendId('\n# コメント\nfeat: y  \n', 'P3'), '\n# コメント\nfeat: y #P3\n');
  });

  it('id が付いていれば変えない（amend で二重に付けない）', () => {
    assert.equal(appendId('docs: x #P12\n', 'P12'), 'docs: x #P12\n');
    assert.equal(appendId('docs: x #P5\n', 'P12'), 'docs: x #P5\n');
  });

  it('PR の番号（#27）は id と見なさず付ける', () => {
    assert.equal(appendId('docs: 完了（PR #27）', 'P2'), 'docs: 完了（PR #27） #P2');
  });

  it('空のメッセージ・コメントだけのメッセージは変えない（git が中止する）', () => {
    assert.equal(appendId('', 'P1'), '');
    assert.equal(appendId('# コメント\n\n', 'P1'), '# コメント\n\n');
  });
});

describe('findUnclosedPlans', () => {
  const plan = (sections) =>
    [
      '# 機能',
      '',
      '要望：[何か](../backlog/some-wish.md)',
      '',
      ...sections.map((s) => `## ${s}`),
    ].join('\n');
  const done = new Map([['some-wish', '完了']]);

  it('PR 下書きのあるプランに、人間レビューの結果の節が無ければ止める', () => {
    const plans = [{ file: '2026-10-27-P6-x.md', text: plan(['11. PR 下書き']) }];
    assert.deepEqual(findUnclosedPlans(plans, done), [
      'docs/plans/2026-10-27-P6-x.md に「人間レビューの結果」の節が無い',
    ]);
  });

  it('要望の status が未着手・検討中・判断待ちのままなら止める', () => {
    const text = plan(['11. PR 下書き', '12. 人間レビューの結果（2026-10-28）']);
    for (const status of ['未着手', '検討中', '判断待ち'])
      assert.deepEqual(
        findUnclosedPlans([{ file: '2026-10-27-P6-x.md', text }], new Map([['some-wish', status]])),
        [
          `docs/backlog/some-wish.md の status が「${status}」のまま（docs/plans/2026-10-27-P6-x.md はマージ済み）`,
        ],
      );
  });

  it('後片付けが済んでいる（完了・進行中・見送り）なら通す', () => {
    const text = plan(['11. PR 下書き', '12. 人間レビューの結果']);
    for (const status of ['完了', '進行中', '見送り'])
      assert.deepEqual(
        findUnclosedPlans([{ file: '2026-10-27-P6-x.md', text }], new Map([['some-wish', status]])),
        [],
      );
  });

  it('PR 下書きの無いプラン・2026-10-27 より前のプランは見ない', () => {
    const plans = [
      { file: '2026-10-27-P6-x.md', text: plan(['3. 詳細設計']) },
      { file: '2026-10-26-P5-y.md', text: plan(['11. PR 下書き']) },
    ];
    assert.deepEqual(findUnclosedPlans(plans, new Map([['some-wish', '検討中']])), []);
  });
});
