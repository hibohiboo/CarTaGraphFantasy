import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  anchorFor,
  buildRuleReportHtml,
  collectFileFailures,
  collectTests,
  computeSectionStates,
  orderPages,
  readAnchors,
  readSidebarOrder,
  sectionState,
  unmatchedRuleTags,
} from './build-rule-test-report.mjs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

const section = (page, heading, over = {}) => ({
  tag: `rule:${page}/${heading}`,
  page,
  pageTitle: `${page}の題`,
  heading,
  level: 2,
  parent: null,
  provisional: false,
  pageProvisional: false,
  ...over,
});
const pageOf = (page, sections, over = {}) => ({
  page,
  pageTitle: `${page}の題`,
  pageProvisional: false,
  sections,
  ...over,
});
const test = (pkg, status, tags, over = {}) => ({
  pkg,
  file: `packages/${pkg}/src/x.test.ts`,
  ancestors: ['d'],
  title: 't',
  status,
  tags,
  ...over,
});

describe('sectionState（T11）', () => {
  it('failed があれば落ちた（passed が混ざっていても）', () => {
    assert.equal(
      sectionState([test('domain', 'passed', []), test('domain', 'failed', [])], false),
      'failed',
    );
  });
  it('passed だけなら確認済。skipped・pending・todo は確認済にしない', () => {
    assert.equal(sectionState([test('domain', 'passed', [])], false), 'passed');
    assert.equal(
      sectionState([test('domain', 'passed', []), test('domain', 'skipped', [])], false),
      'passed',
    );
  });
  it('skipped・pending・todo だけならスキップのみ', () => {
    for (const status of ['skipped', 'pending', 'todo'])
      assert.equal(sectionState([test('domain', status, [])], false), 'skipped', status);
  });
  it('テストが無ければテストなし', () => {
    assert.equal(sectionState([], false), 'none');
  });
  it('対象外は、落ちたテストがあっても対象外', () => {
    assert.equal(sectionState([test('domain', 'failed', [])], true), 'excluded');
  });
});

describe('computeSectionStates', () => {
  const pages = [
    pageOf('check', [section('check', '判定の基本メカニズム'), section('check', '失敗時の扱い')]),
  ];

  it('T12: 実物の JSON で、describe から引き継いだタグも節に当たる', () => {
    const tests = collectTests({ domain: fixture('vitest-results.json') });
    const states = computeSectionStates({ pages, exclusions: [], tests });
    // probe の4件は describe のタグを引き継ぐ。fails は失敗時の扱いのタグも持つ
    assert.equal(states.get('rule:check/判定の基本メカニズム').tests.length, 4);
    assert.equal(states.get('rule:check/判定の基本メカニズム').state, 'failed');
    assert.equal(states.get('rule:check/失敗時の扱い').tests.length, 1);
  });

  it('T13: 1つのテストが2つの節のタグを持てば両方に当たる', () => {
    const tests = [
      test('domain', 'passed', ['rule:check/判定の基本メカニズム', 'rule:check/失敗時の扱い']),
    ];
    const states = computeSectionStates({ pages, exclusions: [], tests });
    assert.equal(states.get('rule:check/判定の基本メカニズム').state, 'passed');
    assert.equal(states.get('rule:check/失敗時の扱い').state, 'passed');
  });

  it('T13: 2つのパッケージのテストが同じ節に当たり、片方が failed なら落ちた', () => {
    const tests = [
      test('domain', 'passed', ['rule:check/失敗時の扱い']),
      test('web', 'failed', ['rule:check/失敗時の扱い']),
    ];
    const states = computeSectionStates({ pages, exclusions: [], tests });
    const s = states.get('rule:check/失敗時の扱い');
    assert.equal(s.state, 'failed');
    assert.deepEqual(s.tests.map((t) => t.pkg).sort(), ['domain', 'web']);
  });

  it('T14: ページ全体の対象外は全節が対象外。テストにタグがあっても対象外', () => {
    const tests = [test('domain', 'failed', ['rule:check/失敗時の扱い'])];
    const states = computeSectionStates({
      pages,
      exclusions: [{ page: 'check', heading: null, reason: 'r' }],
      tests,
    });
    assert.equal(states.get('rule:check/判定の基本メカニズム').state, 'excluded');
    assert.equal(states.get('rule:check/失敗時の扱い').state, 'excluded');
    assert.equal(states.get('rule:check/失敗時の扱い').reason, 'r');
  });

  it('T14: ## を対象外にしても、子の ### は対象外にならない。## に子の状態を混ぜない', () => {
    const p = [pageOf('a', [section('a', '親'), section('a', '子', { level: 3, parent: '親' })])];
    const tests = [test('domain', 'passed', ['rule:a/子'])];
    const s1 = computeSectionStates({ pages: p, exclusions: [], tests });
    assert.equal(s1.get('rule:a/親').state, 'none');
    assert.equal(s1.get('rule:a/子').state, 'passed');
    const s2 = computeSectionStates({
      pages: p,
      exclusions: [{ page: 'a', heading: '親', reason: 'r' }],
      tests,
    });
    assert.equal(s2.get('rule:a/親').state, 'excluded');
    assert.equal(s2.get('rule:a/子').state, 'passed');
  });
});

describe('collectTests / collectFileFailures', () => {
  it('T15: tags の無い古い形式・assertionResults が空・壊れた形でも落ちない', () => {
    const json = {
      testResults: [
        {
          name: 'packages/domain/src/a.test.ts',
          status: 'passed',
          assertionResults: [{ title: 'x', status: 'passed' }],
        },
        { name: 'packages/domain/src/b.test.ts', status: 'passed', assertionResults: [] },
        { name: 'packages/domain/src/c.test.ts' },
      ],
    };
    const tests = collectTests({ domain: json });
    assert.equal(tests.length, 1);
    assert.deepEqual(tests[0].tags, []);
    assert.deepEqual(collectFileFailures({ domain: json }), []);
  });

  it('T15: 読めなかったパッケージ（null）のテストは含めない', () => {
    const tests = collectTests({ domain: fixture('vitest-results.json'), web: null });
    assert.ok(tests.every((t) => t.pkg === 'domain'));
  });

  it('T16: status が failed で assertionResults が空のファイルを、パッケージ名・ファイル・メッセージつきで返す', () => {
    const failures = collectFileFailures({ domain: fixture('vitest-results-collect-failed.json') });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].pkg, 'domain');
    assert.match(failures[0].file, /zz-bad\.test\.ts$/);
    assert.match(failures[0].message, /is not defined/);
  });

  it('テストのファイルの絶対パスはリポジトリの直下からの相対にする', () => {
    const json = {
      testResults: [
        {
          name: 'D:\\x\\repo\\packages\\domain\\src\\a.test.ts',
          assertionResults: [{ title: 't', status: 'passed' }],
        },
      ],
    };
    assert.equal(collectTests({ domain: json })[0].file, 'packages/domain/src/a.test.ts');
  });
});

describe('unmatchedRuleTags（T17）', () => {
  it('どの節にも当たらない rule: のタグだけを返す。rule: で始まらないタグ・大文字は無視する', () => {
    const pages = [pageOf('a', [section('a', '節')])];
    const tests = [
      test('domain', 'passed', ['rule:a/節', 'rule:a/消えた', 'slow', 'Rule:a/x']),
      test('web', 'passed', ['rule:a/消えた', 'rule:b/別']),
    ];
    assert.deepEqual(unmatchedRuleTags(tests, pages), ['rule:a/消えた', 'rule:b/別']);
  });
});

describe('アンカー・並び（T19・T21）', () => {
  const html = `<nav><h2 class="text">サイドバー</h2></nav>
<h2 id="戦闘ルールとの関係" tabindex="-1">戦闘ルールとの関係 <a class="header-anchor" href="#戦闘ルールとの関係" aria-label="Permalink to &quot;x&quot;">\u200b</a></h2>
<h2 id="初期装備仮ルール" tabindex="-1">初期装備（仮ルール） <a class="header-anchor" href="#初期装備仮ルール">\u200b</a></h2>
<h3 id="a-b" tabindex="-1">A &amp; B <a class="header-anchor" href="#a-b">\u200b</a></h3>`;

  it('T19: 見出しの文字から id を引く。見出しの文字とアンカーの文字が違っても引ける。id の無い h2 は拾わない', () => {
    const anchors = readAnchors(html);
    assert.equal(anchorFor(section('x', '初期装備（仮ルール）'), anchors), '初期装備仮ルール');
    assert.equal(anchorFor(section('x', 'A & B', { level: 3 }), anchors), 'a-b');
    assert.equal(anchorFor(section('x', 'サイドバー'), anchors), null);
    assert.equal(anchorFor(section('x', 'ない見出し'), anchors), null);
  });

  it('T19: HTML が無い（null）ときは null', () => {
    assert.equal(anchorFor(section('x', 'a'), null), null);
    assert.equal(readAnchors(null), null);
  });

  it('T21: サイドバーのリンクの順（最初に出た順）を返し、全体像は index', () => {
    const side =
      '<a href="/CarTaGraphFantasy/cartagraph/">全体像</a><a href="/CarTaGraphFantasy/cartagraph/check.html">c</a>' +
      '<a href="/CarTaGraphFantasy/cartagraph/combat.html">c</a><a href="/CarTaGraphFantasy/cartagraph/check.html">c</a>';
    assert.deepEqual(readSidebarOrder(side), ['index', 'check', 'combat']);
    assert.equal(readSidebarOrder(null), null);
  });

  it('T21: 並びはサイドバーの順、サイドバーに無いページは後ろにファイル名順。引けなければファイル名順', () => {
    const pages = [pageOf('a', []), pageOf('b', []), pageOf('c', []), pageOf('d', [])];
    assert.deepEqual(
      orderPages(pages, ['c', 'a']).map((p) => p.page),
      ['c', 'a', 'b', 'd'],
    );
    assert.deepEqual(
      orderPages(pages, null).map((p) => p.page),
      ['a', 'b', 'c', 'd'],
    );
  });
});

describe('buildRuleReportHtml', () => {
  const base = (over = {}) => {
    const pages = over.pages ?? [
      pageOf('check', [
        section('check', '判定の基本メカニズム'),
        section('check', '細目', { level: 3, parent: '判定の基本メカニズム' }),
      ]),
    ];
    const tests = over.tests ?? [];
    const exclusions = over.exclusions ?? [];
    return buildRuleReportHtml({
      pages,
      exclusions,
      tests,
      states: computeSectionStates({ pages, exclusions, tests }),
      fileFailures: over.fileFailures ?? [],
      missingPackages: over.missingPackages ?? [],
      unmatched: over.unmatched ?? [],
      anchors: over.anchors ?? new Map(),
      generatedAt: '2026-10-25T00:00:00Z',
      sha: 'abcdef1234',
    });
  };

  it('T14: ページごとの状態の数が節の状態と合う。### は親の後ろに並ぶ', () => {
    const html = base({ tests: [test('domain', 'passed', ['rule:check/判定の基本メカニズム'])] });
    assert.match(html, /確認済 1/);
    assert.match(html, /テストなし 1/);
    assert.ok(html.indexOf('判定の基本メカニズム') < html.indexOf('細目'));
  });

  it('T15: 読めなかったパッケージは先頭に結果なしで出す', () => {
    const html = base({ missingPackages: ['schemas'] });
    assert.match(html, /schemas/);
    assert.match(html, /結果なし/);
  });

  it('T16: 収集で落ちたファイルを、パッケージ名・ファイル・メッセージつきで出す', () => {
    const html = base({
      fileFailures: [
        {
          pkg: 'domain',
          file: 'packages/domain/src/zz.test.ts',
          message: 'The tag "x" is not defined',
        },
      ],
    });
    assert.match(html, /収集で落ちたファイル/);
    assert.match(html, /packages\/domain\/src\/zz\.test\.ts/);
    assert.match(html, /is not defined/);
  });

  it('T17: 当たらないタグを末尾に出す', () => {
    const html = base({ unmatched: ['rule:a/消えた'] });
    assert.match(html, /当たらないタグ/);
    assert.match(html, /rule:a\/消えた/);
  });

  it('T18: テストの題・見出し・ファイル名・パッケージ名・理由・メッセージをエスケープする', () => {
    const pages = [pageOf('x', [section('x', '<img src=x>見出し')], { pageTitle: '<b>題</b>' })];
    const html = base({
      pages,
      tests: [
        test('domain', 'passed', ['rule:x/<img src=x>見出し'], {
          title: '<script>t</script>',
          file: 'a<b>.test.ts',
        }),
      ],
      exclusions: [],
      fileFailures: [{ pkg: '<u>', file: '<f>', message: '<m>' }],
    });
    for (const raw of ['<script>', '<img src=x>', '<b>題', '<f>', '<m>', '<u>', 'a<b>']) {
      assert.ok(!html.includes(raw), `${raw} がそのまま出ている`);
    }
    assert.ok(html.includes('&lt;script&gt;t&lt;/script&gt;'));
    const exHtml = base({
      pages: [pageOf('y', [section('y', '節')])],
      exclusions: [{ page: 'y', heading: null, reason: '<i>理由</i>' }],
    });
    assert.ok(!exHtml.includes('<i>理由'));
  });

  it('T19: アンカーが引ければ節の見出しへ、引けなければページへのリンク', () => {
    const anchors = new Map([['check', readAnchors('<h2 id="id-1">判定の基本メカニズム</h2>')]]);
    const html = base({ anchors });
    assert.ok(html.includes(`../cartagraph/check.html#${encodeURIComponent('id-1')}`));
    assert.ok(html.includes('"../cartagraph/check.html"'));
  });

  it('T20: テストのリンクが、パッケージごとのレポートの先頭を指す', () => {
    const html = base({
      tests: [
        test('domain', 'passed', ['rule:check/判定の基本メカニズム']),
        test('web', 'passed', ['rule:check/判定の基本メカニズム']),
      ],
    });
    assert.ok(html.includes('../vitest-report/domain/'));
    assert.ok(html.includes('../vitest-report/web/'));
  });

  it('T22: 仮ルールのページ・節に「仮」の印を出す。ふつうの節には出さない', () => {
    const pages = [
      pageOf('p', [section('p', '仮の節', { provisional: true }), section('p', 'ふつう')], {
        pageProvisional: true,
      }),
      pageOf('q', [section('q', '節')]),
    ];
    const html = base({ pages });
    assert.equal(html.split('class="prov"').length - 1, 2);
  });

  it('対象外の節は理由を出す', () => {
    const html = base({
      pages: [pageOf('y', [section('y', '節')])],
      exclusions: [{ page: 'y', heading: '節', reason: '説明だけの節' }],
    });
    assert.match(html, /対象外/);
    assert.match(html, /説明だけの節/);
  });
});

describe('CLI（T15）', () => {
  const dirs = [];
  after(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it('結果が1つも無くても終了コード0で、指定した場所にページを書く', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rule-report-'));
    dirs.push(dir);
    const out = join(dir, 'out', 'index.html');
    const script = fileURLToPath(new URL('./build-rule-test-report.mjs', import.meta.url));
    const root = join(dir, 'empty-root');
    mkdirSync(root);
    const r = spawnSync('node', [script, '--out', out, '--root', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(out));
    const html = readFileSync(out, 'utf8');
    assert.match(html, /結果なし：domain、schemas、web/);
  });

  it('結果があれば、そのパッケージの分で組み立てる', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rule-report-'));
    dirs.push(dir);
    const root = join(dir, 'root');
    mkdirSync(join(root, 'packages/domain/vitest-results'), { recursive: true });
    writeFileSync(
      join(root, 'packages/domain/vitest-results/results.json'),
      readFileSync(new URL('./fixtures/vitest-results.json', import.meta.url)),
    );
    // schemas は JSON として読めない（書きかけで止まった等）
    mkdirSync(join(root, 'packages/schemas/vitest-results'), { recursive: true });
    writeFileSync(join(root, 'packages/schemas/vitest-results/results.json'), '{"testResults": [');
    const out = join(dir, 'index.html');
    const script = fileURLToPath(new URL('./build-rule-test-report.mjs', import.meta.url));
    const r = spawnSync('node', [script, '--out', out, '--root', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(out, 'utf8');
    // domain は読めた。schemas（壊れている）・web（無い）は結果なし
    assert.match(html, /結果なし：schemas、web/);
    assert.match(html, /確認済/);
  });
});
