import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  isExcluded,
  parseExclusions,
  readRulePages,
  readRuleSections,
  vitestTags,
} from './rule-sections.mjs';

const dirs = [];
/** { 'check.md': '...' } を一時ディレクトリに書いて、そのパスを返す */
function makeDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'rule-sections-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('readRuleSections', () => {
  it('T1: ##・###を読み、タグ名・ページの題・親・レベルを返す。####は読まない', () => {
    const dir = makeDir({
      'check.md': '# 判定ルール\n\n## 基本\n\n### 細目\n\n#### 孫\n\n## 失敗時の扱い\n',
    });
    assert.deepEqual(
      readRuleSections(dir).map((s) => [s.tag, s.page, s.pageTitle, s.heading, s.level, s.parent]),
      [
        ['rule:check/基本', 'check', '判定ルール', '基本', 2, null],
        ['rule:check/細目', 'check', '判定ルール', '細目', 3, '基本'],
        ['rule:check/失敗時の扱い', 'check', '判定ルール', '失敗時の扱い', 2, null],
      ],
    );
  });

  it('T1: 親の##は直前のもの', () => {
    const dir = makeDir({ 'a.md': '# A\n## 一\n### x\n## 二\n### y\n' });
    assert.deepEqual(
      readRuleSections(dir)
        .filter((s) => s.level === 3)
        .map((s) => [s.heading, s.parent]),
      [
        ['x', '一'],
        ['y', '二'],
      ],
    );
  });

  it('T2: フェンス（```・~~~）の中の#行を見出しとして読まない', () => {
    const dir = makeDir({
      'a.md': [
        '# A',
        '```',
        '## 中のコメント',
        '```',
        '~~~sh',
        '## 波線の中',
        '~~~',
        '````md',
        '```',
        '## 入れ子の中',
        '```',
        '````',
        '## 外',
      ].join('\n'),
    });
    assert.deepEqual(
      readRuleSections(dir).map((s) => s.heading),
      ['外'],
    );
  });

  it('T2: フロントマターの#行は読まない', () => {
    const dir = makeDir({ 'a.md': '---\ntitle: x\n## まぎらわしい\n---\n# A\n## 本物\n' });
    assert.deepEqual(
      readRuleSections(dir).map((s) => s.heading),
      ['本物'],
    );
  });

  it('T3: auto-combat-simulation.mdは読まず、index.mdは読む', () => {
    const dir = makeDir({
      'auto-combat-simulation.md': '# 生成\n## 数字\n',
      'index.md': '# 全体像\n## 概要\n',
    });
    assert.deepEqual(
      readRuleSections(dir).map((s) => s.tag),
      ['rule:index/概要'],
    );
  });

  it('T4: 同じページに同じ見出しが2つあると例外。ページをまたぐ重なりは許す', () => {
    const dup = makeDir({ 'a.md': '# A\n## 同じ\n### 同じ\n' });
    assert.throws(() => readRuleSections(dup), /a\.md.*同じ/);
    const across = makeDir({ 'a.md': '# A\n## 設計原則\n', 'b.md': '# B\n## 設計原則\n' });
    assert.deepEqual(
      readRuleSections(across).map((s) => s.tag),
      ['rule:a/設計原則', 'rule:b/設計原則'],
    );
  });

  it('T5: 1件も読めないと例外（ディレクトリが無い・.mdが無い・生成ページだけ）', () => {
    assert.throws(() => readRuleSections(join(tmpdir(), 'rule-sections-no-such-dir')));
    assert.throws(() => readRuleSections(makeDir({})), /1件も/);
    assert.throws(() => readRuleSections(makeDir({ 'auto-combat-simulation.md': '## x\n' })));
  });

  it('T5: 見出しが0件のページが混ざっても、ほかで読めれば例外にしない', () => {
    const dir = makeDir({ 'empty.md': '# 見出しなし\n本文\n', 'a.md': '# A\n## 一\n' });
    assert.deepEqual(
      readRulePages(dir).map((p) => [p.page, p.sections.length]),
      [
        ['a', 1],
        ['empty', 0],
      ],
    );
  });

  it('T6: 題・見出しに（仮…）があるとpageProvisional・provisionalが真。本文の言及には反応しない', () => {
    const dir = makeDir({
      'p.md':
        '# 自動戦闘（仮ルール）\n## 初期装備（仮ルール）\n## ふつう\nこれは仮ルールである。\n',
      'q.md': '# 通常\n## 節\n仮ルールではない（仮ルールの話）。\n',
    });
    const [p1, p2, q] = readRuleSections(dir);
    assert.deepEqual([p1.pageProvisional, p1.provisional], [true, true]);
    assert.deepEqual([p2.pageProvisional, p2.provisional], [true, false]);
    assert.deepEqual([q.pageProvisional, q.provisional], [false, false]);
  });

  it('T8: 末尾の空白と\\rは取る', () => {
    const dir = makeDir({ 'a.md': '# A\r\n## 見出し  \r\n### 子\r\n' });
    assert.deepEqual(
      readRuleSections(dir).map((s) => s.heading),
      ['見出し', '子'],
    );
  });

  it('T8: ##より前の###は親がnull', () => {
    const dir = makeDir({ 'a.md': '# A\n### 先に来た\n## 後\n' });
    assert.equal(readRuleSections(dir)[0].parent, null);
  });

  it('T8: Vitestがタグ名に使わせない文字・{#id}・インラインの記法はページと行つきの例外', () => {
    for (const heading of [
      '空白 入り',
      '括弧(半角)',
      'a|b',
      '星*',
      '{#id} 付き',
      '`code`',
      '[リンク](x)',
    ]) {
      const dir = makeDir({ 'a.md': `# A\n\n## ${heading}\n` });
      assert.throws(() => readRuleSections(dir), /a\.md:3/, heading);
    }
  });
});

describe('実物の docs/cartagraph', () => {
  it('T7: 例外なく読めて1件以上あり、cwdが違っても同じ件数を読む', () => {
    const here = readRuleSections();
    assert.ok(here.length > 0);
    const original = process.cwd();
    process.chdir(join(import.meta.dirname, '..', 'packages', 'domain'));
    try {
      assert.equal(readRuleSections().length, here.length);
    } finally {
      process.chdir(original);
    }
  });

  it('T7: vitestTagsは{name, description}を返し、対象外の節を含まない', () => {
    const tags = vitestTags();
    const check = tags.find((t) => t.name === 'rule:check/判定の基本メカニズム');
    assert.ok(check, '判定の基本メカニズムのタグがある');
    assert.equal(check.description, '判定ルール「判定の基本メカニズム」');
    assert.equal(new Set(tags.map((t) => t.name)).size, tags.length);
    // 対象外の一覧（docs/architecture/rule-test-exclusions.md）の節は入らない（ページ全体・節の両方）
    const names = new Set(tags.map((t) => t.name));
    assert.equal(names.has('rule:index/概要'), false);
    assert.equal(names.has('rule:balance/スコープ'), false);
    assert.equal(names.has('rule:character-growth/この章の設計原則'), false);
    assert.equal(names.has('rule:character-growth/成長の基本メカニズム'), true);
  });
});

describe('parseExclusions / isExcluded', () => {
  const md = [
    '説明',
    '',
    '| ページ | 節 | 理由 |',
    '|---|---|---|',
    '| index | | 概観で判定が無い |',
    '| check | この章の設計原則 | 原則の説明 |',
    '',
  ].join('\n');

  it('表の行を{page, heading, reason}で読む。節が空ならheadingはnull', () => {
    assert.deepEqual(parseExclusions(md), [
      { page: 'index', heading: null, reason: '概観で判定が無い' },
      { page: 'check', heading: 'この章の設計原則', reason: '原則の説明' },
    ]);
  });

  it('表が無いと空。列が足りない行は例外', () => {
    assert.deepEqual(parseExclusions('表なし'), []);
    assert.throws(
      () => parseExclusions('| ページ | 節 | 理由 |\n|---|---|---|\n| a | b |\n'),
      /列/,
    );
  });

  it('ページ全体の対象外は全節に効き、節の対象外はその節だけに効く', () => {
    const ex = parseExclusions(md);
    assert.equal(isExcluded({ page: 'index', heading: 'なんでも' }, ex), true);
    assert.equal(isExcluded({ page: 'check', heading: 'この章の設計原則' }, ex), true);
    assert.equal(isExcluded({ page: 'check', heading: '別の節' }, ex), false);
    assert.equal(isExcluded({ page: 'combat', heading: 'この章の設計原則' }, ex), false);
  });
});
