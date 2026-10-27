import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, test } from 'node:test';
import {
  anchorFor,
  buildReportHtml,
  computeStates,
  idSteps,
  runStates,
} from './build-usecase-report.mjs';
import { parseUseCases, USE_CASES_FILE } from './usecases.mjs';

const readFixture = (name) => JSON.parse(readFileSync(`scripts/fixtures/${name}.json`, 'utf8'));
// 実物の Playwright 1.63 の JSON（タグに @ が付かない・ステップに status が無い形）。
// probe-pass / probe-step-fail / probe-outside-fail / probe-timeout の4本（SC-1〜3 のタグ）
const real = readFixture('playwright-results');
const serverFailed = readFixture('playwright-results-server-failed');

const USE_CASES = [
  { id: 'SC-1', name: '下書きを作る', domain: 'シナリオ製作', future: false },
  { id: 'SC-2', name: 'シナリオデッキを組む', domain: 'シナリオ製作', future: false },
  { id: 'SC-3', name: '結末を決める', domain: 'シナリオ製作', future: false },
  { id: 'SC-4', name: '目印を決める', domain: 'シナリオ製作', future: false },
  { id: 'GR-1', name: '構造を見る', domain: 'グラフ', future: true },
];

const step = (title, extra = {}) => ({ title, duration: 5, ...extra });
const fail = (title) => step(title, { error: { message: 'x' } });
/** spec 1本ぶんの JSON（結果は results に並べる。最後が最新） */
const specOf = (title, tags, ...results) => ({
  title,
  id: `id-${title}`,
  tags,
  tests: [{ status: 'x', results }],
});
const jsonOf = (...specs) => ({
  errors: [],
  stats: { startTime: '2026-10-18T00:00:00Z' },
  suites: [{ specs }],
});
const stateOf = (json, id) => computeStates(USE_CASES, json).get(id).state;

test('T10: 通った（ID のステップがすべて error 無し・duration >= 0、結果が passed）', () => {
  const json = jsonOf(
    specOf('a', ['SC-1', 'SC-2'], { status: 'passed', steps: [step('SC-1 a'), step('SC-2 b')] }),
  );
  assert.equal(stateOf(json, 'SC-1'), 'passed');
  assert.equal(stateOf(json, 'SC-2'), 'passed');
});

test('T11: 落ちた（ID のステップに error）。その後ろの ID は手前で止まった', () => {
  const json = jsonOf(
    specOf('a', ['SC-1', 'SC-2', 'SC-3'], {
      status: 'failed',
      steps: [step('SC-1 a'), fail('SC-2 b')],
    }),
  );
  assert.equal(stateOf(json, 'SC-1'), 'passed');
  assert.equal(stateOf(json, 'SC-2'), 'failed');
  assert.equal(stateOf(json, 'SC-3'), 'stopped');
});

test('T12: ステップの外で落ちたら、最後の ID のステップが落ちた。時間切れも同じ', () => {
  const outside = jsonOf(
    specOf('a', ['SC-1', 'SC-2'], { status: 'failed', steps: [step('SC-1 a'), step('SC-2 b')] }),
  );
  assert.equal(stateOf(outside, 'SC-1'), 'passed');
  assert.equal(stateOf(outside, 'SC-2'), 'failed');

  const timeout = jsonOf(
    specOf('a', ['SC-1', 'SC-2'], {
      status: 'timedOut',
      steps: [step('SC-1 a'), step('SC-2 b', { duration: -1 })],
    }),
  );
  assert.equal(stateOf(timeout, 'SC-2'), 'failed');
});

test('T12: ID のステップが1つも記録されていない failed は、タグの最初の ID が落ちた', () => {
  const json = jsonOf(specOf('a', ['SC-1', 'SC-2'], { status: 'failed', steps: [] }));
  assert.equal(stateOf(json, 'SC-1'), 'failed');
  assert.equal(stateOf(json, 'SC-2'), 'stopped');
});

test('T12: 実物の JSON（通る・ステップで落ちる・ステップの外で落ちる・時間切れ）', () => {
  // SC-1：ステップの外で落ちたテストがあるので落ちた。SC-2：ステップで落ちたテストがあるので落ちた。SC-3：落ちたテストの後ろで走らなかった
  assert.equal(stateOf(real, 'SC-1'), 'failed');
  assert.equal(stateOf(real, 'SC-2'), 'failed');
  assert.equal(stateOf(real, 'SC-3'), 'stopped');
  assert.equal(stateOf(real, 'SC-4'), 'none');
  const states = computeStates(USE_CASES, real);
  const byTitle = (id) => Object.fromEntries(states.get(id).tests.map((t) => [t.title, t.state]));
  assert.deepEqual(byTitle('SC-1'), {
    'probe-pass': 'passed',
    'probe-step-fail': 'passed',
    'probe-outside-fail': 'failed',
    'probe-timeout': 'passed',
  });
  assert.equal(byTitle('SC-2')['probe-timeout'], 'failed');
  assert.equal(byTitle('SC-2')['probe-pass'], 'passed');
});

test('T13: 混ざったとき（落ちた ＞ 手前で止まった ＞ 通った）', () => {
  const passed = specOf('p', ['SC-1'], { status: 'passed', steps: [step('SC-1 a')] });
  const stopped = specOf('s', ['SC-1', 'SC-2'], { status: 'failed', steps: [fail('SC-2 b')] });
  // SC-1 は p で通り、s では手前で止まった（SC-2 が先に落ちた）
  assert.equal(stateOf(jsonOf(passed, stopped), 'SC-1'), 'stopped');
  const failed = specOf('f', ['SC-1'], { status: 'failed', steps: [fail('SC-1 a')] });
  assert.equal(stateOf(jsonOf(passed, failed), 'SC-1'), 'failed');
  // 1本の中で同じ ID のステップが2つ。1つ目が通り、2つ目が走らなかった
  const twicePassed = specOf('t', ['SC-1'], {
    status: 'passed',
    steps: [step('SC-1 a'), step('SC-1 b', { duration: -1 })],
  });
  assert.equal(stateOf(jsonOf(twicePassed), 'SC-1'), 'stopped');
});

test('T14: ID の無い親の下の ID のステップを拾う。ID のステップの下の ID の無い子は影響しない', () => {
  const nested = [
    step('下ごしらえ', { steps: [step('SC-1 a'), fail('SC-2 b')] }),
    step('SC-3 c', { steps: [fail('内側')] }),
  ];
  assert.deepEqual(idSteps(nested), [
    { id: 'SC-1', state: 'passed' },
    { id: 'SC-2', state: 'failed' },
    { id: 'SC-3', state: 'passed' },
  ]);
  assert.equal(runStates(['SC-3'], { status: 'passed', steps: nested }).get('SC-3'), 'passed');
});

test('T15: retry は最後の結果を使う', () => {
  const retried = (second) =>
    specOf('a', ['SC-1'], { status: 'failed', steps: [fail('SC-1 a')] }, second);
  assert.equal(
    stateOf(jsonOf(retried({ status: 'passed', steps: [step('SC-1 a')] })), 'SC-1'),
    'passed',
  );
  assert.equal(
    stateOf(jsonOf(retried({ status: 'failed', steps: [fail('SC-1 a')] })), 'SC-1'),
    'failed',
  );
});

test('T16: 結果なし（JSON が無い・壊れている・起動の失敗）は全件「結果なし」で、例外を投げない', () => {
  for (const json of [null, undefined, 'x']) {
    assert.equal(stateOf(json, 'SC-1'), 'noresult');
  }
  assert.equal(stateOf(serverFailed, 'SC-1'), 'noresult');
  assert.equal(stateOf(serverFailed, 'GR-1'), 'noresult');
  // トップの errors があり、spec はあるがすべて結果が空
  const empty = {
    errors: [{ message: 'x' }],
    suites: [{ specs: [{ title: 'a', id: 'i', tags: ['SC-1'], tests: [{ results: [] }] }] }],
  };
  assert.equal(stateOf(empty, 'SC-1'), 'noresult');
  // テストが1つも無い JSON（--grep の食い違いなど）は、E2E が動いていないので結果なし
  assert.equal(stateOf({ errors: [], suites: [] }, 'SC-1'), 'noresult');
  // テストはあるが、そのタグを持つものが無ければ「テストなし」
  const other = jsonOf(specOf('a', ['SC-1'], { status: 'passed', steps: [step('SC-1 a')] }));
  assert.equal(stateOf(other, 'SC-4'), 'none');
});

test('T12: ステップの外で落ちたとき、通った ID は通ったまま、次の走らなかった ID が落ちた', () => {
  const json = jsonOf(
    specOf('a', ['PL-1', 'PL-2'], {
      status: 'failed',
      steps: [step('PL-1 a'), step('下ごしらえ', { error: { message: 'x' } })],
    }),
  );
  const states = computeStates(
    [
      { id: 'PL-1', name: 'a', domain: 'プレイ' },
      { id: 'PL-2', name: 'b', domain: 'プレイ' },
    ],
    json,
  );
  assert.equal(states.get('PL-1').state, 'passed');
  assert.equal(states.get('PL-2').state, 'failed');
});

test('T12: skipped は落ちたでなく手前で止まった', () => {
  const json = jsonOf(specOf('a', ['SC-1', 'SC-2'], { status: 'skipped', steps: [] }));
  assert.equal(stateOf(json, 'SC-1'), 'stopped');
  assert.equal(stateOf(json, 'SC-2'), 'stopped');
});

test('T17: 組み立て（題・レポートへのリンク・見出しへのリンク・開始時刻・エスケープ）', () => {
  const json = jsonOf(specOf('<b>&題', ['SC-1'], { status: 'passed', steps: [step('SC-1 a')] }));
  const ids = new Set(['シナリオ製作', 'sc-1-下書きを作る', 'グラフ将来']);
  const build = (idSet, j = json) =>
    buildReportHtml({
      useCases: USE_CASES,
      states: computeStates(USE_CASES, j),
      json: j,
      ids: idSet,
      generatedAt: '2026-10-18T01:00:00Z',
      sha: 'abcdef1234567',
    });
  const html = build(ids);
  assert.ok(html.includes('&lt;b&gt;&amp;題'));
  assert.ok(!html.includes('<b>&題'));
  assert.ok(html.includes('../e2e-report/#?testId=id-%3Cb%3E%26%E9%A1%8C'));
  assert.ok(
    html.includes(`../architecture/use-cases.html#${encodeURIComponent('sc-1-下書きを作る')}`),
  );
  // GR-1 には自分の見出しが無い（GR-n に見出しは無い）ので、業務領域の見出しへ
  assert.ok(html.includes(`#${encodeURIComponent('グラフ将来')}`));
  assert.ok(html.includes('2026-10-18T00:00:00Z'));
  assert.ok(html.includes('abcdef1'));
  assert.ok(html.includes('グラフ（将来）'));
  // dist が無ければ見出しへのリンクを付けない
  assert.ok(!build(null).includes('use-cases.html#'));
  // 結果なしのページは案内が出る
  assert.ok(build(ids, serverFailed).includes('E2E の結果がありません'));
});

// ---- 全スキップ（docs/plans/2026-10-27-P6-不安定なE2Eのスキップ.md T3・T4・T6） ----

const BACKLOG_NOTE = { type: 'backlog', description: 'docs/backlog/fix-me.md' };
/** spec 1本ぶん。注記を tests[].annotations（on: 'test'）か results[].annotations（on: 'result'）に置く */
const annotatedSpec = (title, tags, result, { annotations, on = 'test' }) => ({
  title,
  id: `id-${title}`,
  tags,
  tests: [
    {
      status: 'x',
      annotations: on === 'test' ? annotations : [],
      results: [{ ...result, annotations: on === 'result' ? annotations : [] }],
    },
  ],
});
const skippedRun = { status: 'skipped', steps: [] };
const skipSpec = (title, tags, on) =>
  annotatedSpec(title, tags, skippedRun, { annotations: [BACKLOG_NOTE, { type: 'skip' }], on });
const passSpec = (title, tags) =>
  specOf(title, tags, { status: 'passed', steps: tags.map((id) => step(`${id} a`)) });

describe('T3: 全スキップ（runStates・computeStates）', () => {
  it('skipped ＋ backlog の注記で、タグの ID がすべて全スキップ', () => {
    const json = jsonOf(skipSpec('a', ['SC-1', 'SC-2']));
    assert.equal(stateOf(json, 'SC-1'), 'skipped');
    assert.equal(stateOf(json, 'SC-2'), 'skipped');
  });

  it('注記が tests[].annotations にだけ・results[].annotations にだけあっても全スキップ', () => {
    assert.equal(stateOf(jsonOf(skipSpec('a', ['SC-1'], 'test')), 'SC-1'), 'skipped');
    assert.equal(stateOf(jsonOf(skipSpec('a', ['SC-1'], 'result')), 'SC-1'), 'skipped');
  });

  it('手前で止まったのまま：skip だけ・issue だけの注記の skipped、results が空で注記あり', () => {
    for (const annotations of [[{ type: 'skip' }], [{ type: 'issue', description: 'x' }]]) {
      const json = jsonOf(annotatedSpec('a', ['SC-1'], skippedRun, { annotations }));
      assert.equal(stateOf(json, 'SC-1'), 'stopped');
    }
    const empty = jsonOf({
      title: 'a',
      id: 'id-a',
      tags: ['SC-1'],
      tests: [{ annotations: [BACKLOG_NOTE], results: [] }],
    });
    assert.equal(stateOf(empty, 'SC-1'), 'stopped');
  });

  it('注記があっても failed は落ちた・passed は確認済（注記の消し忘れで落ちたのを隠さない）', () => {
    const failed = { status: 'failed', steps: [fail('SC-1 a')] };
    assert.equal(
      stateOf(
        jsonOf(annotatedSpec('a', ['SC-1'], failed, { annotations: [BACKLOG_NOTE] })),
        'SC-1',
      ),
      'failed',
    );
    const passed = { status: 'passed', steps: [step('SC-1 a')] };
    assert.equal(
      stateOf(
        jsonOf(annotatedSpec('a', ['SC-1'], passed, { annotations: [BACKLOG_NOTE] })),
        'SC-1',
      ),
      'passed',
    );
  });

  it('UC の集約：全部スキップは全スキップ、スキップ＋確認済は確認済、＋落ちたは落ちた、＋手前で止まったは手前で止まった（並びに依らない）', () => {
    const skip = skipSpec('s', ['SC-1']);
    const failedSpec = specOf('f', ['SC-1'], { status: 'failed', steps: [fail('SC-1 a')] });
    const stoppedSpec = specOf('t', ['SC-1', 'SC-2'], {
      status: 'failed',
      steps: [fail('SC-2 b')],
    });
    const cases = [
      [[skip, skipSpec('s2', ['SC-1'])], 'skipped'],
      [[skip, passSpec('p', ['SC-1'])], 'passed'],
      [[skip, failedSpec], 'failed'],
      [[skip, stoppedSpec], 'stopped'],
    ];
    for (const [specs, expected] of cases) {
      assert.equal(stateOf(jsonOf(...specs), 'SC-1'), expected);
      assert.equal(stateOf(jsonOf(...[...specs].reverse()), 'SC-1'), expected);
    }
  });
});

describe('T4: 全スキップの組み立て', () => {
  const json = jsonOf(skipSpec('飛ばす', ['SC-1', 'SC-2']), passSpec('通る', ['SC-2']));
  const build = (backlogTitles) =>
    buildReportHtml({
      useCases: USE_CASES,
      states: computeStates(USE_CASES, json),
      json,
      ids: null,
      backlogTitles,
      generatedAt: '2026-10-27T00:00:00Z',
    });
  const rowOf = (html, id) => html.match(new RegExp(`<tr><td class="id">${id}</td>.*?</tr>`))[0];

  it('全部スキップの UC に全スキップのバッジ。一部スキップの UC は確認済のまま、スキップしたテストだけがスキップ中', () => {
    const html = build(new Map([['fix-me', '直す<要望>']]));
    assert.match(rowOf(html, 'SC-1'), /<span class="badge skipped">全スキップ<\/span>/);
    const sc2 = rowOf(html, 'SC-2');
    assert.match(sc2, /<span class="badge passed">確認済<\/span>/);
    assert.match(
      sc2,
      /飛ばす<\/a><span class="sub skipped">（スキップ中（<a href="\.\.\/backlog\/fix-me\.html">直す&lt;要望&gt;<\/a>））<\/span>/,
    );
    assert.match(sc2, /通る<\/a><span class="sub passed">（確認済）<\/span>/);
    assert.equal(sc2.includes('全スキップ'), false);
  });

  it('要望の title が読めなければファイル名。名前は符号化する', () => {
    assert.match(build(new Map()), /<a href="\.\.\/backlog\/fix-me\.html">fix-me<\/a>/);
    const odd = jsonOf(
      annotatedSpec('a', ['SC-1'], skippedRun, {
        annotations: [{ type: 'backlog', description: 'docs/backlog/直す 要望.md' }],
      }),
    );
    const html = buildReportHtml({
      useCases: USE_CASES,
      states: computeStates(USE_CASES, odd),
      json: odd,
      ids: null,
      generatedAt: 'x',
    });
    assert.ok(html.includes(`../backlog/${encodeURIComponent('直す 要望')}.html`));
  });

  it('全スキップのバッジの色は手前で止まったと別。先頭の案内にスキップ中の数と要望へのリンク', () => {
    const html = build(new Map([['fix-me', '直す要望']]));
    assert.match(html, /\.badge\.skipped, \.sub\.skipped \{ color:var\(--skipped\); \}/);
    assert.match(html, /--skipped:#[0-9a-f]{6}/);
    assert.equal(/\.badge\.stopped[^}]*\.badge\.skipped/.test(html), false);
    assert.match(html, /<div class="notice skipped">.*スキップ中のテストが 1 件/s);
    assert.match(html, /<li><a href="\.\.\/backlog\/fix-me\.html">直す要望<\/a>：飛ばす<\/li>/);
    // スキップが無ければ案内を出さない
    const none = jsonOf(passSpec('通る', ['SC-1']));
    const plain = buildReportHtml({
      useCases: USE_CASES,
      states: computeStates(USE_CASES, none),
      json: none,
      ids: null,
      generatedAt: 'x',
    });
    assert.equal(plain.includes('スキップ中のテスト'), false);
  });
});

describe('T6: 実物の JSON（gm-session.test.ts を宣言のスキップにして流した結果）', () => {
  const skippedReal = readFixture('playwright-results-skipped');
  const useCases = parseUseCases(readFileSync(USE_CASES_FILE, 'utf8'));
  const states = computeStates(useCases, skippedReal);

  it('PL-1 が全スキップ。PL-2 は確認済で、gm-session はスキップ中・scenario-authoring は確認済', () => {
    assert.equal(states.get('PL-1').state, 'skipped');
    assert.equal(states.get('PL-2').state, 'passed');
    const byTitle = Object.fromEntries(states.get('PL-2').tests.map((t) => [t.title, t.state]));
    assert.equal(
      byTitle['GM が描写を書いて選択肢を配り・取り下げ、ドライバーとしてプレイする'],
      'skipped',
    );
    assert.equal(byTitle['シナリオを画面だけで作り、公開し、GM 不在で結末まで遊ぶ'], 'passed');
  });

  it('ほかの UC（元の実行で確認済）は確認済のまま', () => {
    for (const id of ['SC-1', 'SC-2', 'SC-3', 'SC-5', 'SC-6', 'SC-8']) {
      assert.equal(states.get(id).state, 'passed', id);
    }
  });
});

test('T17: anchorFor は自分の見出し、無ければ業務領域、どちらも無ければ null', () => {
  const ids = new Set(['sc-1-下書きを作る', 'グラフ将来']);
  assert.equal(anchorFor(USE_CASES[0], ids), 'sc-1-下書きを作る');
  assert.equal(anchorFor(USE_CASES[4], ids), 'グラフ将来');
  assert.equal(anchorFor(USE_CASES[1], ids), null);
  assert.equal(anchorFor(USE_CASES[0], null), null);
});
