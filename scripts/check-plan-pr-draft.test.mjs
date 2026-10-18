// check-plan-pr-draft.mjs の、プランの PR 下書きの漏れの検査（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkCommands,
  definedTests,
  findDraftOmissions,
  isTarget,
  mentionedTests,
} from './check-plan-pr-draft.mjs';

const plan = (draft) =>
  [
    '# プラン',
    '## 5. 新規テストケース',
    '| # | ケース |',
    '|---|---|',
    '| T1 | 一つ目 |',
    '| T2 | 二つ目 |',
    '| T10 | 十番目 |',
    '## 6. 実装順',
    '| 1 | 実装し、`browser-check` で確かめ、`web:check:publish` を流す | 同上 | 標準 |',
    '## 7. コミット前テスト実行',
    '本文の T99 は数えない',
    ...(draft === undefined ? [] : ['## 11. PR 下書き', draft]),
  ].join('\n');

describe('definedTests', () => {
  it('表の最初のセルの T 番号だけを読む', () => {
    assert.deepEqual(definedTests('| T1 | a |\n| T12 | b |\n本文の T3\n| # | T4 |'), [1, 12]);
  });
});

describe('mentionedTests', () => {
  it('単独の番号と、〜・～・~ の範囲を読む', () => {
    assert.deepEqual(
      [...mentionedTests('T1〜T3、T5～T6、T8~T8、T10 と T13 の残り')].sort((a, b) => a - b),
      [1, 2, 3, 5, 6, 8, 10, 13],
    );
  });
  it('T1 と T10 を取り違えない。英字に続く T は読まない', () => {
    assert.deepEqual([...mentionedTests('T10 と PUT1')], [10]);
  });
});

describe('checkCommands', () => {
  it('browser-check と web:check:<名前> を読む', () => {
    assert.deepEqual(
      [...checkCommands('`browser-check` で `web:check:publish`・`web:check:character` を流す')],
      ['browser-check', 'web:check:publish', 'web:check:character'],
    );
  });
});

describe('findDraftOmissions', () => {
  it('PR 下書きの節が無ければ見ない', () => {
    assert.deepEqual(findDraftOmissions(plan()), []);
  });
  it('テストの番号と確かめの手順がすべて出てくれば誤り無し', () => {
    const draft =
      'T1〜T2・T10 は通った。`browser-check` は済み。`web:check:publish` は流していない（理由）';
    assert.deepEqual(findDraftOmissions(plan(draft)), []);
  });
  it('出てこないテストの番号と手順を返す', () => {
    assert.deepEqual(findDraftOmissions(plan('T1 は通った')), [
      'T2',
      'T10',
      'browser-check',
      'web:check:publish',
    ]);
  });
  it('PR 下書きの外（実装の結果など）に書いても数えない', () => {
    const md = plan('T1・T2 は通った。browser-check web:check:publish').replace(
      '## 7. コミット前テスト実行',
      '## 7. コミット前テスト実行\nT10 は済み',
    );
    assert.deepEqual(findDraftOmissions(md), ['T10']);
  });
  it('回帰：P2 のプランは T18・T19 の漏れで止まる', () => {
    const md = [
      '## 5. 新規テストケース',
      '| T17 | 組み立て |',
      '| T18 | authoring |',
      '| T19 | gm-session |',
      '| T20 | 骨抜き |',
      '## 6. 実装順',
      '| 7 | レビュー | x | 強い |',
      '## 11. PR 下書き',
      '**テスト**：`scripts/` の T1〜T17、E2E 2本。骨抜きの確かめ（T20）。',
    ].join('\n');
    assert.deepEqual(findDraftOmissions(md), ['T18', 'T19']);
  });
});

describe('isTarget', () => {
  it('START 以降の日付のプランだけを見る', () => {
    assert.equal(isTarget('2026-10-19-P3-なにか.md'), true);
    assert.equal(isTarget('2026-10-18-P2-ユースケースとE2Eの結果.md'), false);
    assert.equal(isTarget('README.md'), false);
  });
});
