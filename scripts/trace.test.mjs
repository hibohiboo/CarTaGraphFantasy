// trace.mjs（要望の frontmatter の読み手）のテスト（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { frontmatterValue, parseTrace } from './trace.mjs';

describe('frontmatterValue', () => {
  it('引用符・コメントを外し、frontmatter の外（本文）は読まない', () => {
    const md = '---\ntitle: "題 #1"\nstatus: 完了 # 暫定\n---\n\nstatus: 本文\nsummary: x\n';
    assert.equal(frontmatterValue(md, 'title'), '題 #1');
    assert.equal(frontmatterValue(md, 'status'), '完了');
    assert.equal(frontmatterValue(md, 'summary'), '');
    assert.equal(frontmatterValue('status: 完了\n', 'status'), '');
  });
});

const doc = (traceLines) => `---\nstatus: 完了\n${traceLines}\ntitle: 題\n---\n\n本文\n`;
const FILE = 'docs/backlog/x.md';

describe('T1: 読む', () => {
  it('3つのリストを読む', () => {
    const md = doc(
      [
        'trace:',
        '  usecases: [SC-6, SC-7]',
        '  screens: [/creator/scenarios/:scenarioId, GM のホーム]',
        '  rules: [scenario-flow/シナリオの公開]',
      ].join('\n'),
    );
    assert.deepEqual(parseTrace(md, FILE), {
      usecases: ['SC-6', 'SC-7'],
      screens: ['/creator/scenarios/:scenarioId', 'GM のホーム'],
      rules: ['scenario-flow/シナリオの公開'],
    });
  });

  it('リストの一部の省略と空のリストを受け付ける（省略は空として返す）', () => {
    const md = doc('trace:\n  usecases: [SC-1]\n  rules: []');
    assert.deepEqual(parseTrace(md, FILE), { usecases: ['SC-1'], screens: [], rules: [] });
  });

  it('none を読む', () => {
    assert.deepEqual(parseTrace(doc('trace:\n  none: 開発の基盤（E2E の導入）'), FILE), {
      none: '開発の基盤（E2E の導入）',
    });
  });

  it('trace が無いと null。frontmatter が無くても null', () => {
    assert.equal(parseTrace(doc(''), FILE), null);
    assert.equal(parseTrace('本文だけ\n', FILE), null);
  });

  it('CRLF でも読める', () => {
    const md = doc('trace:\n  usecases: [SC-1]').replaceAll('\n', '\r\n');
    assert.deepEqual(parseTrace(md, FILE), { usecases: ['SC-1'], screens: [], rules: [] });
  });

  it('本文の中の trace: は読まない', () => {
    assert.equal(parseTrace('---\nstatus: 完了\n---\n\ntrace:\n  none: x\n', FILE), null);
  });
});

describe('T2: 形の違いは、ファイル名と理由の入った例外', () => {
  const bad = (traceLines, reason) =>
    assert.throws(
      () => parseTrace(doc(traceLines), FILE),
      (e) => e.message.includes(FILE) && reason.test(e.message),
    );

  it('ブロック形式のリスト', () => {
    bad('trace:\n  usecases:\n    - SC-1', /フロー形式/);
  });
  it('none とリストの両方', () => {
    bad('trace:\n  none: 理由\n  usecases: [SC-1]', /none.*リスト|リスト.*none/);
  });
  it('全部が空・何も書いていない', () => {
    bad('trace:\n  usecases: []\n  screens: []', /全部が空/);
    bad('trace:\n  usecases:', /フロー形式/);
  });
  it('知らないキー', () => {
    bad('trace:\n  usecase: [SC-1]', /知らないキー.*usecase/);
  });
  it('trace の下にインデントの無い行・インデントの無い値', () => {
    bad('trace:\nusecases: [SC-1]', /インデント/);
    bad('trace: [SC-1]', /インデント/);
  });
  it('# と引用符（YAML と読み方が食い違う）', () => {
    bad('trace:\n  none: 理由 #メモ', /#/);
    bad("trace:\n  none: 'x'", /引用符/);
    bad('trace:\n  screens: ["/home"]', /引用符/);
  });
  it('none の理由が空', () => {
    bad('trace:\n  none:', /理由が空/);
    bad('trace:\n  none:   ', /理由が空/);
  });
  it('リストの中身が空の項目・閉じていない', () => {
    bad('trace:\n  usecases: [SC-1, ]', /空の項目/);
    bad('trace:\n  usecases: [SC-1', /フロー形式/);
  });
  it('同じキーが2回', () => {
    bad('trace:\n  usecases: [SC-1]\n  usecases: [SC-2]', /2回/);
  });
});
