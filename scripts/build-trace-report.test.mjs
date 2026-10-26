// build-trace-report.mjs（トレースのページ）のテスト（pnpm tools:test）

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { collectTests, computeSectionStates } from './build-rule-test-report.mjs';
import {
  buildGraph,
  buildTraceReportHtml,
  computeNodeStates,
  embedJson,
  frontmatterValue,
  traceFrom,
} from './build-trace-report.mjs';
import { computeStates } from './build-usecase-report.mjs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

// ---- 入力の部品 ----
const uc = (id, over = {}) => ({
  id,
  name: `名前${id}`,
  domain: 'シナリオ製作',
  future: false,
  actors: ['シナリオ製作者'],
  screens: [],
  aggregates: [],
  events: [],
  ...over,
});
const section = (page, heading) => ({
  tag: `rule:${page}/${heading}`,
  page,
  pageTitle: page,
  heading,
  level: 2,
  parent: null,
  provisional: false,
  pageProvisional: false,
});
const pages = [
  {
    page: 'check',
    pageTitle: '判定',
    pageProvisional: false,
    sections: [section('check', '判定')],
  },
];
/** Playwright の spec。steps は題の配列（通ったステップ） */
const spec = (title, file, tags, ...run) => {
  const [status, steps = []] = run;
  return {
    title,
    id: `id-${title}`,
    file,
    tags,
    tests: [{ results: [{ status, steps: steps.map((t) => ({ title: t, duration: 1 })) }] }],
  };
};
const e2e = (...specs) => ({
  suites: [{ specs }],
  errors: [],
  stats: { startTime: '2026-10-26T00:00:00Z' },
});
const vitestOf = (assertions, pkg = 'domain') => ({
  domain: null,
  schemas: { testResults: [] },
  web: { testResults: [] },
  [pkg]: {
    testResults: [
      {
        name: `D:/x/packages/${pkg}/src/a.test.ts`,
        status: 'passed',
        assertionResults: assertions,
      },
    ],
  },
});
const assertion = (status, tags = ['rule:check/判定']) => ({
  status,
  title: 't',
  ancestorTitles: [],
  tags,
});
const req = (name, over = {}) => ({
  name,
  title: `要望${name}`,
  status: '完了',
  trace: { usecases: [], screens: [], rules: [] },
  ...over,
});

const inputs = (over = {}) => ({
  backlog: [
    req('a', {
      trace: { usecases: ['SC-1'], screens: ['/creator', 'GM のホーム'], rules: ['check/判定'] },
    }),
    req('b', { trace: { none: '基盤' } }),
  ],
  useCases: [
    uc('SC-1', { screens: ['/creator'], aggregates: ['シナリオ'], events: ['公開した'] }),
    uc('GR-1', { domain: 'グラフ', future: true, actors: ['システム製作者'] }),
  ],
  routes: [
    { path: '/creator', title: '製作', group: 'creator' },
    { path: '/p/:id', title: '詳細', group: 'pl', example: '/p/one' },
  ],
  missingScreens: ['GM のホーム'],
  pages,
  exclusions: [],
  aggregates: [{ context: 'シナリオ製作', name: 'シナリオ' }],
  events: [{ event: '公開した', aggregate: 'シナリオ' }],
  e2eJson: e2e(
    spec('一', 'usecases/a.test.ts', ['SC-1'], 'passed', ['SC-1 下書き']),
    spec('製作（/creator）が描画できる', 'smoke.test.ts', [], 'passed'),
    spec('詳細（/p/one）が描画できる', 'smoke.test.ts', [], 'passed'),
  ),
  vitest: vitestOf([assertion('passed')]),
  ...over,
});

const hasEdge = (graph, from, to) => graph.edges.some(([f, t]) => f === from && t === to);
const node = (graph, id) => graph.nodes.find((n) => n.id === id);

describe('T8: buildGraph の要素と線', () => {
  const graph = buildGraph(inputs());

  it('線の向きは左から右（D18）', () => {
    assert.ok(hasEdge(graph, 'actor:シナリオ製作者', 'uc:SC-1'));
    assert.ok(hasEdge(graph, 'req:a', 'uc:SC-1'));
    assert.ok(hasEdge(graph, 'req:a', 'screen:/creator'));
    assert.ok(hasEdge(graph, 'req:a', 'screen:GM のホーム'));
    assert.ok(hasEdge(graph, 'req:a', 'rule:rule:check/判定'));
    assert.ok(hasEdge(graph, 'uc:SC-1', 'screen:/creator'));
    assert.ok(hasEdge(graph, 'uc:SC-1', 'agg:シナリオ'));
    assert.ok(hasEdge(graph, 'uc:SC-1', 'evt:公開した'));
    assert.ok(hasEdge(graph, 'agg:シナリオ', 'evt:公開した'));
    for (const [from, to] of graph.edges) {
      assert.ok(node(graph, from).col < node(graph, to).col, `${from} → ${to}`);
    }
  });

  it('none の要望は線を持たない', () => {
    assert.equal(graph.edges.filter(([f, t]) => f === 'req:b' || t === 'req:b').length, 0);
  });

  it('列の並び（D13）：アクター・要望・UC・画面と節・テスト・集約・イベント', () => {
    const colOf = (id) => node(graph, id).col;
    assert.deepEqual(
      ['actor:シナリオ製作者', 'req:a', 'uc:SC-1', 'screen:/creator', 'rule:rule:check/判定'].map(
        colOf,
      ),
      [0, 1, 2, 3, 3],
    );
    const cols = graph.nodes.map((n) => n.col);
    assert.deepEqual(
      cols,
      [...cols].sort((a, b) => a - b),
    );
    assert.equal(colOf('agg:シナリオ'), 5);
    assert.equal(colOf('evt:公開した'), 6);
  });

  it('列の中の並び：要望は状態の悪い順→名前、テストはファイル名順、画面はルートの順（まだ無い画面は最後）', () => {
    const ids = (kind) => graph.nodes.filter((n) => n.kind === kind).map((n) => n.id);
    assert.deepEqual(ids('screen'), ['screen:/creator', 'screen:/p/:id', 'screen:GM のホーム']);
    assert.deepEqual(ids('test'), [...ids('test')].sort());
    // a は未実装（まだ無い画面）、b はつなぐ先なし
    assert.deepEqual(ids('req'), ['req:a', 'req:b']);
  });

  it('存在しない要素への線は引かない（まだ無い画面のラベルだけ。UC の集約が表に無くても例外にならない）', () => {
    const g = buildGraph(inputs({ useCases: [uc('SC-1', { aggregates: ['無い集約'] })] }));
    assert.equal(
      g.edges.some(([, t]) => t === 'agg:無い集約'),
      false,
    );
  });
});

describe('T9: テストの要素', () => {
  const graph = buildGraph(inputs());

  it('E2E の UC のタグからテストのファイルへ、smoke の題（動的ルートは example）から画面へ', () => {
    assert.ok(hasEdge(graph, 'uc:SC-1', 'test:e2e:usecases/a.test.ts'));
    assert.ok(hasEdge(graph, 'screen:/creator', 'test:e2e:smoke.test.ts'));
    assert.ok(hasEdge(graph, 'screen:/p/:id', 'test:e2e:smoke.test.ts'));
  });

  it('ルールのタグから節へ。テストのファイルはパッケージ付き', () => {
    assert.ok(
      hasEdge(graph, 'rule:rule:check/判定', 'test:vitest:domain:packages/domain/src/a.test.ts'),
    );
  });

  it('どの UC・画面・節にも当たらないテストのファイルは出さない', () => {
    const g = buildGraph(
      inputs({
        e2eJson: e2e(
          spec('一', 'usecases/a.test.ts', ['SC-1'], 'passed', ['SC-1 下書き']),
          spec('関係ない', 'other.test.ts', ['SC-99'], 'passed'),
        ),
        vitest: vitestOf([assertion('passed', ['rule:check/判定']), assertion('passed', [])]),
      }),
    );
    assert.equal(
      g.nodes.some((n) => n.id === 'test:e2e:other.test.ts'),
      false,
    );
    assert.equal(g.nodes.filter((n) => n.kind === 'test').length, 2);
  });

  it('E2E の結果があるのに smoke の題に当たらないルートは、当たらないルートとして返す（D26）', () => {
    const g = buildGraph(
      inputs({
        e2eJson: e2e(spec('製作（/creator）が描画できる', 'smoke.test.ts', [], 'passed')),
      }),
    );
    assert.deepEqual(g.notices.unmatchedRoutes, ['/p/:id']);
    assert.equal(node(g, 'screen:/p/:id').state, 'none');
    assert.deepEqual(graph.notices.unmatchedRoutes, []);
  });
});

describe('T10: computeNodeStates（D15）', () => {
  const mk = (reqStatus, targetStates, extra = {}) => {
    const nodes = [
      { id: 'req:x', kind: 'req', reqStatus, ...extra },
      ...targetStates.map((state, i) => ({ id: `uc:${i}`, kind: 'uc', state })),
    ];
    return { nodes, edges: targetStates.map((_, i) => ['req:x', `uc:${i}`]) };
  };
  const stateOf = (graph) => computeNodeStates(graph).get('req:x').state;

  it('いちばん悪い状態になる：落ちた ＞ 結果なし ＞ 未実装 ＞ テストなし ＞ 確認済', () => {
    assert.equal(stateOf(mk('完了', ['passed', 'failed', 'planned'])), 'failed');
    assert.equal(stateOf(mk('完了', ['passed', 'noresult', 'planned'])), 'noresult');
    assert.equal(stateOf(mk('完了', ['passed', 'planned', 'none'])), 'planned');
    assert.equal(stateOf(mk('完了', ['passed', 'none'])), 'none');
    assert.equal(stateOf(mk('完了', ['passed', 'passed'])), 'passed');
  });

  it('none はつなぐ先なし、見送りは見送り（どちらも届き具合を計算しない）', () => {
    assert.equal(stateOf(mk('完了', [], { noTarget: true })), 'notarget');
    assert.equal(stateOf(mk('見送り', ['failed'])), 'dropped');
  });
});

describe('T11: 未達（D16）', () => {
  const unreachedOf = (reqStatus, states, extra) => {
    const nodes = [
      { id: 'req:x', kind: 'req', reqStatus, ...extra },
      ...states.map((state, i) => ({ id: `uc:${i}`, kind: 'uc', state })),
    ];
    const edges = states.map((_, i) => ['req:x', `uc:${i}`]);
    return computeNodeStates({ nodes, edges }).get('req:x').unreached;
  };

  it('完了で確認済でない要望だけに付く', () => {
    assert.equal(unreachedOf('完了', ['passed', 'none']), true);
    assert.equal(unreachedOf('完了', ['passed']), false);
  });

  it('完了でない要望・見送りの要望・none の要望には付かない', () => {
    assert.equal(unreachedOf('進行中', ['failed']), false);
    assert.equal(unreachedOf('未着手', ['planned']), false);
    assert.equal(unreachedOf('見送り', ['failed']), false);
    assert.equal(unreachedOf('完了', [], { noTarget: true }), false);
  });
});

describe('T12: 結果が読めない', () => {
  it('Playwright の JSON が無いとき、例外にならず現行の UC と画面が結果なし。将来の UC は未実装', () => {
    const g = buildGraph(inputs({ e2eJson: null }));
    assert.equal(node(g, 'uc:SC-1').state, 'noresult');
    assert.equal(node(g, 'screen:/creator').state, 'noresult');
    assert.equal(node(g, 'uc:GR-1').state, 'planned');
    assert.equal(node(g, 'screen:GM のホーム').state, 'planned');
    assert.equal(g.notices.e2eNoResult, true);
    assert.deepEqual(g.notices.unmatchedRoutes, []);
    assert.equal(
      g.nodes.some((n) => n.id.startsWith('test:e2e:')),
      false,
    );
  });

  it('Vitest が1つでも読めないとき、テストなしの節は結果なしに上がる（確認済・落ちたはそのまま）', () => {
    const unreadable = { domain: null, schemas: { testResults: [] }, web: { testResults: [] } };
    const none = buildGraph(inputs({ vitest: unreadable }));
    assert.equal(node(none, 'rule:rule:check/判定').state, 'noresult');
    assert.deepEqual(none.notices.missingPackages, ['domain']);
    const passed = buildGraph(inputs());
    assert.equal(node(passed, 'rule:rule:check/判定').state, 'passed');
    const failed = buildGraph(inputs({ vitest: vitestOf([assertion('failed')]) }));
    assert.equal(node(failed, 'rule:rule:check/判定').state, 'failed');
  });

  it('スキップ・todo のみの節はテストなし。スキップのみの smoke は画面がテストなし', () => {
    const skipped = buildGraph(
      inputs({ vitest: vitestOf([assertion('skipped'), assertion('todo')]) }),
    );
    assert.equal(node(skipped, 'rule:rule:check/判定').state, 'none');
    const smoke = buildGraph(
      inputs({
        e2eJson: e2e(spec('製作（/creator）が描画できる', 'smoke.test.ts', [], 'skipped')),
      }),
    );
    assert.equal(node(smoke, 'screen:/creator').state, 'none');
  });

  it('全パッケージが読めて、節にテストが無ければテストなし', () => {
    const all = {
      domain: { testResults: [] },
      schemas: { testResults: [] },
      web: { testResults: [] },
    };
    const g = buildGraph(inputs({ vitest: all }));
    assert.equal(node(g, 'rule:rule:check/判定').state, 'none');
    assert.deepEqual(g.notices.missingPackages, []);
  });

  it('収集で落ちたファイルは状態を変えず、案内に出る', () => {
    const collect = fixture('vitest-results-collect-failed.json');
    const g = buildGraph(
      inputs({
        vitest: { domain: collect, schemas: { testResults: [] }, web: { testResults: [] } },
      }),
    );
    assert.deepEqual(
      g.notices.fileFailures.map((f) => f.file),
      ['packages/domain/src/zz-bad.test.ts'],
    );
  });

  it('CLI：Playwright の JSON が無くても終了コード0で index.html を書き、先頭に結果なしが出る', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trace-'));
    try {
      const out = join(dir, 'index.html');
      const run = spawnSync(
        process.execPath,
        ['scripts/build-trace-report.mjs', '--e2e', join(dir, 'nothing.json'), '--out', out],
        { encoding: 'utf8' },
      );
      assert.equal(run.status, 0, run.stderr);
      assert.match(readFileSync(out, 'utf8'), /E2E の結果がありません/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('T13: usecase-report・rule-test-report と同じ状態', () => {
  it('UC の状態が computeStates と同じ（同じ fixtures）', () => {
    const json = fixture('playwright-results.json');
    const useCases = [uc('SC-1'), uc('SC-2'), uc('SC-3')];
    const graph = buildGraph(inputs({ useCases, e2eJson: json, routes: [] }));
    const expected = computeStates(useCases, json);
    for (const u of useCases) {
      const s = expected.get(u.id).state;
      assert.equal(node(graph, `uc:${u.id}`).state, s === 'stopped' ? 'failed' : s, u.id);
    }
  });

  it('節の状態が computeSectionStates と同じ（同じ fixtures）', () => {
    const json = fixture('vitest-results.json');
    const vitest = { domain: json, schemas: { testResults: [] }, web: { testResults: [] } };
    const rulePages = [
      {
        page: 'check',
        pageTitle: '判定',
        pageProvisional: false,
        sections: [section('check', '判定の基本メカニズム'), section('check', '失敗時の扱い')],
      },
    ];
    const backlog = [
      req('a', { trace: { rules: ['check/判定の基本メカニズム', 'check/失敗時の扱い'] } }),
    ];
    const graph = buildGraph(inputs({ pages: rulePages, backlog, vitest }));
    const expected = computeSectionStates({
      pages: rulePages,
      exclusions: [],
      tests: collectTests(vitest),
    });
    for (const s of rulePages[0].sections) {
      const e = expected.get(s.tag).state;
      assert.equal(node(graph, `rule:${s.tag}`).state, e === 'skipped' ? 'none' : e, s.tag);
    }
  });
});

describe('frontmatterValue', () => {
  it('引用符・コメントを外し、frontmatter の外（本文）は読まない', () => {
    const md = '---\ntitle: "題 #1"\nstatus: 完了 # 暫定\n---\n\nstatus: 本文\nsummary: x\n';
    assert.equal(frontmatterValue(md, 'title'), '題 #1');
    assert.equal(frontmatterValue(md, 'status'), '完了');
    assert.equal(frontmatterValue(md, 'summary'), '');
    assert.equal(frontmatterValue('status: 完了\n', 'status'), '');
  });
});

describe('T14: traceFrom', () => {
  const edges = [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'd'],
    ['a', 'x'], // x は b の兄弟
    ['y', 'c'], // y は c への別の祖先（b の兄弟の子ではない）
  ];

  it('祖先と子孫だけを返し、兄弟を含まない', () => {
    assert.deepEqual([...traceFrom(edges, 'b')].sort(), ['a', 'c', 'd']);
    assert.deepEqual([...traceFrom(edges, 'b', 'up')], ['a']);
    assert.deepEqual([...traceFrom(edges, 'b', 'down')].sort(), ['c', 'd']);
  });

  it('輪があっても止まる', () => {
    const loop = [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'a'],
    ];
    assert.deepEqual([...traceFrom(loop, 'a')].sort(), ['b', 'c']);
  });

  it('存在しない id は空', () => {
    assert.deepEqual(traceFrom(edges, 'zzz'), []);
  });
});

describe('T15: buildTraceReportHtml', () => {
  const html = (over) =>
    buildTraceReportHtml({
      graph: buildGraph(inputs(over)),
      generatedAt: '2026-10-26T00:00:00Z',
      sha: 'abcdef123',
    });

  it('名前・理由に <script>・</script> があっても、HTML と埋め込みの JSON の両方でエスケープされる', () => {
    const evil = '</script><script>alert(1)</script>';
    const page = html({ backlog: [req('a', { title: evil, trace: { none: evil } })] });
    assert.equal(page.includes(evil), false);
    assert.equal(page.split('</script>').length - 1, 2); // 埋め込みの JSON とスクリプトの2つだけ
    assert.ok(page.includes('\\u003c/script>'));
    assert.equal(embedJson({ a: '<b>' }), '{"a":"\\u003cb>"}');
  });

  it('リンクが相対パス（/ で始まらない）の形', () => {
    const page = html();
    const hrefs = [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0);
    for (const h of hrefs) assert.equal(h.startsWith('/'), false, h);
    const data = JSON.parse(
      page.match(/<script type="application\/json" id="trace-data">([\s\S]*?)<\/script>/)[1],
    );
    const links = data.nodes.flatMap((n) => n.links ?? []);
    assert.ok(links.some((l) => l.href === '../backlog/a.html'));
    assert.ok(links.some((l) => l.href.startsWith('../architecture/use-cases.html')));
    assert.ok(links.some((l) => l.href.startsWith('../cartagraph/check.html')));
    assert.ok(links.some((l) => l.href === '../e2e-report/'));
    assert.ok(links.some((l) => l.href === '../vitest-report/domain/'));
    for (const l of links) assert.equal(l.href.startsWith('/'), false, l.href);
  });

  it('ページに埋め込んだ関数の本文が traceFrom.toString() と同じ', () => {
    assert.ok(html().includes(traceFrom.toString()));
  });

  it('先頭の案内：結果なし・収集で落ちた・当たらないルート・未達', () => {
    const page = html({
      e2eJson: null,
      vitest: {
        domain: fixture('vitest-results-collect-failed.json'),
        schemas: null,
        web: { testResults: [] },
      },
    });
    assert.match(page, /E2E の結果がありません/);
    assert.match(page, /schemas/);
    assert.match(page, /収集で落ちたファイル/);
    assert.match(page, /未達 1 件/);
    const unmatched = html({
      e2eJson: e2e(spec('製作（/creator）が描画できる', 'smoke.test.ts', [], 'passed')),
    });
    assert.match(unmatched, /当たらないルート/);
    assert.match(unmatched, /\/p\/:id/);
  });
});
