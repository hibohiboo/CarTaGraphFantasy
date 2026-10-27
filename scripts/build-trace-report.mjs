// アイデア（要望）から実装・テストまでのつながりを、RDRA の層の順に並べた1枚の図のページ（HTML）を作る。
// デプロイが E2E と Vitest を流した後に回し、GitHub Pages の /trace-report/ に載せる
// （scripts/copy-test-reports-to-pages.mjs が写す）。見方は docs/architecture/test-report.md「トレースの見方」。
//
// つながりは書き写さず、既にある文書から組み立てる：
//   要望の trace（trace.mjs）、use-cases.md の表（usecases.mjs）、routes.ts と導線図（check-screens.mjs）、
//   aggregates.md の表（check-events.mjs）、ルールのページ（rule-sections.mjs）、
//   テストの結果（build-usecase-report.mjs の computeStates・build-rule-test-report.mjs の computeSectionStates を共用）。
//
// 入力：要望（docs/backlog/）・各文書・Playwright の JSON・各パッケージの Vitest の JSON・ビルド結果の HTML（アンカー。無ければページへのリンク）
// 出力：trace-report/index.html
// 結果が読めないときも失敗させず、「結果なし」のページを作る（デプロイを止めない方針のため）。
//
// 使い方: pnpm docs:build; pnpm web:e2e; pnpm test:report; pnpm trace:report
// テストは scripts/build-trace-report.test.mjs（pnpm tools:test）。設計は docs/plans/2026-10-26-P5-アイデアから実装までのトレース.md。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectFileFailures,
  collectTests,
  computeSectionStates,
  PACKAGES,
  readAnchors,
  readText,
  readResults as readVitestResults,
  anchorFor as sectionAnchorFor,
} from './build-rule-test-report.mjs';
import {
  backlogLink,
  collectSpecs,
  computeStates,
  hasNoResults,
  RESULTS_FILE,
  readAnchorIds,
  readResults as readE2eResults,
  skippedSpecs,
  anchorFor as ucAnchorFor,
} from './build-usecase-report.mjs';
import { parseAggregateEvents, parseAggregateList } from './check-events.mjs';
import { parseMissingScreens, parseRoutes, ROUTES_FILE, SCREENS_FILE } from './check-screens.mjs';
import { escapeHtml, reportPage } from './report-html.mjs';
import { readExclusions, readRulePages } from './rule-sections.mjs';
import { readBacklog } from './trace.mjs';
import { parseUseCases, USE_CASES_FILE } from './usecases.mjs';

export const OUTPUT_FILE = 'trace-report/index.html';
const AGGREGATES_FILE = 'docs/architecture/aggregates.md';
const USE_CASES_DIST = 'docs/.vitepress/dist/architecture/use-cases.html';
const CARTAGRAPH_DIST = 'docs/.vitepress/dist/cartagraph';

/** 列の見出し（左から）。D13 */
export const COLUMNS = [
  'アクター',
  '要望',
  'ユースケース',
  '画面・ルールの節',
  'テスト',
  '集約',
  'イベント',
];
const COL = { actor: 0, req: 1, uc: 2, screen: 3, rule: 3, test: 4, agg: 5, evt: 6 };

/**
 * 状態の悪い順（D15）。この外の状態（つなぐ先なし・見送り）は届き具合を計算しない。
 * 全スキップは、壊れていると分かっていて直す要望がある状態なので、落ちたの次に悪い（P6 の D6。UC の段では
 * スキップがいちばん弱いが、要望の段では向きが逆になる。理由は docs/notes/architecture/test-report.md）
 */
export const STATE_ORDER = ['failed', 'skipped', 'noresult', 'planned', 'none', 'passed'];
export const STATE_LABELS = {
  failed: '落ちた',
  skipped: '全スキップ',
  noresult: '結果なし',
  planned: '未実装',
  none: 'テストなし',
  passed: '確認済',
  notarget: 'つなぐ先なし',
  dropped: '見送り',
};
const REQ_STATE_ORDER = [...STATE_ORDER, 'notarget', 'dropped'];

const stateRank = (s) => REQ_STATE_ORDER.indexOf(s);

/** 状態の配列のうち、いちばん悪いもの。状態を持つものが無ければ null */
export function worstState(states) {
  const ranked = states.filter((s) => STATE_ORDER.includes(s));
  return ranked.sort((a, b) => stateRank(a) - stateRank(b))[0] ?? null;
}

// ---------------------------------------------------------------------------
// テストの結果から、つなぐ元（UC・画面・節）ごとの状態とテストのファイルを引く
// ---------------------------------------------------------------------------

/** Playwright の spec 1件の状態。結果が無い・落ちた・時間切れは落ちた、全部スキップはテストなし */
function specState(spec) {
  const statuses = spec.runs.map((r) => r.status);
  if (statuses.length === 0) return 'failed';
  if (statuses.every((s) => s === 'skipped')) return 'none';
  return statuses.every((s) => s === 'passed') ? 'passed' : 'failed';
}

/** usecase-report の状態（passed・failed・stopped・skipped・none・noresult）をこのページの状態にする（手前で止まったは落ちた。全スキップはそのまま） */
const fromUseCaseState = (s) => (s === 'stopped' ? 'failed' : s);

/** smoke.test.ts のテストの題。動的ルートは example */
const smokeTitle = (route) =>
  `${route.title}（${route.path.includes(':') ? (route.example ?? route.path) : route.path}）が描画できる`;

/** UC の状態と、UC → テストのファイルの線。将来の UC は結果が無くても未実装（テストを持つ前の段のため。D15） */
function ucLinks(useCases, results, fileOf) {
  const states = new Map();
  const links = [];
  for (const u of useCases) {
    const info = results.get(u.id);
    states.set(u.id, u.future ? 'planned' : fromUseCaseState(info.state));
    for (const t of u.future ? [] : info.tests) {
      const file = fileOf.get(t.specId);
      if (file) links.push({ from: `uc:${u.id}`, file, state: fromUseCaseState(t.state) });
    }
  }
  return { states, links };
}

/** 画面の状態と、画面 → smoke のテストのファイルの線。smoke の題に当たらないルートは unmatched に入れる（D26） */
function screenLinks(routes, specs, noResult) {
  const states = new Map();
  const links = [];
  const unmatched = [];
  for (const r of routes) {
    const spec = specs.find((s) => s.title === smokeTitle(r));
    if (!spec) {
      states.set(r.path, noResult ? 'noresult' : 'none');
      if (!noResult) unmatched.push(r.path);
      continue;
    }
    states.set(r.path, specState(spec));
    links.push({ from: `screen:${r.path}`, file: spec.file, state: specState(spec) });
  }
  return { states, links, unmatched };
}

/**
 * E2E の結果から、UC・画面の状態とテストのファイルへの線を作る。
 * 戻り値：{ ucStates: Map<UC の id, 状態>, screenStates: Map<パス, 状態>, links: [{ from, file, state }], unmatchedRoutes,
 *          skippedTests: [{ title, backlog }]（スキップ中のテスト）, noResult }
 */
export function collectE2eLinks({ useCases, routes, e2eJson }) {
  const noResult = hasNoResults(e2eJson);
  const specs = noResult ? [] : collectSpecs(e2eJson);
  const fileOf = new Map(specs.map((s) => [s.id, s.file]));
  const uc = ucLinks(useCases, computeStates(useCases, e2eJson), fileOf);
  const screen = screenLinks(routes, specs, noResult);
  return {
    ucStates: uc.states,
    screenStates: screen.states,
    links: [...uc.links, ...screen.links],
    unmatchedRoutes: screen.unmatched,
    skippedTests: skippedSpecs(e2eJson),
    noResult,
  };
}

/** Vitest の1件の状態をこのページの状態にする（スキップ・todo はテストなし） */
const fromVitestStatus = (s) => (s === 'passed' || s === 'failed' ? s : 'none');

/**
 * Vitest の結果から、節の状態とテストのファイルへの線を作る。
 * D20：読めないパッケージが1つでもあれば、「テストなし」の節は結果なしに上げる。
 * 戻り値：{ sectionStates: Map<タグ, 状態>, links: [{ from, pkg, file, state }], missingPackages, fileFailures }
 */
export function collectVitestLinks({ pages, exclusions, vitest, referenced }) {
  const missingPackages = PACKAGES.map((p) => p.name).filter((name) => !vitest[name]);
  const tests = collectTests(vitest);
  const states = computeSectionStates({ pages, exclusions, tests });
  const sectionStates = new Map();
  const links = [];
  for (const tag of referenced) {
    const info = states.get(tag);
    if (!info) continue;
    const own = fromVitestStatus(info.state);
    sectionStates.set(tag, own === 'none' && missingPackages.length > 0 ? 'noresult' : own);
    for (const t of info.tests) {
      links.push({
        from: `rule:${tag}`,
        pkg: t.pkg,
        file: t.file,
        state: fromVitestStatus(t.status),
      });
    }
  }
  return { sectionStates, links, missingPackages, fileFailures: collectFileFailures(vitest) };
}

// ---------------------------------------------------------------------------
// 要素と線
// ---------------------------------------------------------------------------

/** 業務領域・コンテキストの名前に、枠の色の番号を振る（出てきた順） */
function contextIndex(names) {
  const unique = [...new Set(names.filter(Boolean))];
  return (name) => unique.indexOf(name);
}

const pageHref = (page) => (page === 'index' ? '../cartagraph/' : `../cartagraph/${page}.html`);

/** 要素の元の文書へのリンク（相対パス。D27）。anchors が無ければページまで */
const requestLinks = (name) => [{ text: '要望のページ', href: `../backlog/${name}.html` }];

function linksOfUseCase(useCase, anchors) {
  const anchor = ucAnchorFor(useCase, anchors?.useCaseIds ?? null);
  const href = `../architecture/use-cases.html${anchor ? `#${encodeURIComponent(anchor)}` : ''}`;
  return [
    { text: 'ユースケースの表', href },
    { text: 'ユースケースと E2E の結果', href: '../usecase-report/' },
  ];
}

function ruleLinks(section, anchors) {
  const id = sectionAnchorFor(section, anchors?.rulePages?.get(section.page) ?? null);
  return [
    {
      text: 'ルールのページ',
      href: `${pageHref(section.page)}${id ? `#${encodeURIComponent(id)}` : ''}`,
    },
    { text: 'ルールとテストの結果', href: '../rule-test-report/' },
  ];
}

/** テストのファイルの要素の id・名前・レポートへのリンク */
function testNodeOf(link) {
  if (link.pkg) {
    return {
      id: `test:vitest:${link.pkg}:${link.file}`,
      label: link.file.split('/').at(-1),
      full: link.file,
      links: [{ text: `Vitest のレポート（${link.pkg}）`, href: `../vitest-report/${link.pkg}/` }],
    };
  }
  return {
    id: `test:e2e:${link.file}`,
    label: link.file.split('/').at(-1),
    full: `apps/web/e2e/${link.file}`,
    links: [{ text: 'E2E のレポート', href: '../e2e-report/' }],
  };
}

/** 業務の層（アクター・UC・集約・イベント）の要素と線を足す */
function addDomainNodes(ctx, { useCases, aggregates, events }, e2e) {
  const colorOf = contextIndex([
    ...useCases.map((u) => u.domain),
    ...aggregates.map((a) => a.context),
  ]);
  for (const u of useCases) {
    for (const actor of u.actors) {
      ctx.add({ id: `actor:${actor}`, kind: 'actor', label: actor });
      ctx.edge(`actor:${actor}`, `uc:${u.id}`);
    }
  }
  for (const u of useCases) {
    ctx.add({
      id: `uc:${u.id}`,
      kind: 'uc',
      label: `${u.id} ${u.name}`,
      state: e2e.ucStates.get(u.id),
      domain: u.domain,
      color: colorOf(u.domain),
      future: u.future,
      links: linksOfUseCase(u, ctx.anchors),
    });
  }
  for (const a of aggregates) {
    ctx.add({
      id: `agg:${a.name}`,
      kind: 'agg',
      label: a.name,
      domain: a.context,
      color: colorOf(a.context),
      links: [{ text: '集約とドメインイベント', href: '../architecture/aggregates.html' }],
    });
  }
  for (const e of events) {
    const agg = aggregates.find((a) => a.name === e.aggregate);
    ctx.add({
      id: `evt:${e.event}`,
      kind: 'evt',
      label: e.event,
      domain: agg?.context,
      color: colorOf(agg?.context),
      links: [{ text: '集約とドメインイベント', href: '../architecture/aggregates.html' }],
    });
    ctx.edge(`agg:${e.aggregate}`, `evt:${e.event}`);
  }
  for (const u of useCases) {
    for (const s of u.screens) ctx.edge(`uc:${u.id}`, `screen:${s}`);
    for (const a of u.aggregates) ctx.edge(`uc:${u.id}`, `agg:${a}`);
    for (const e of u.events) ctx.edge(`uc:${u.id}`, `evt:${e}`);
  }
}

/** 画面の要素（ルート定義の全部と、まだ無い画面） */
function addScreenNodes(ctx, { routes, missingScreens }, e2e) {
  for (const r of routes) {
    ctx.add({
      id: `screen:${r.path}`,
      kind: 'screen',
      label: r.title,
      sub: r.path,
      state: e2e.screenStates.get(r.path),
      links: [{ text: '画面一覧と導線', href: '../screens/' }],
    });
  }
  for (const label of missingScreens) {
    ctx.add({
      id: `screen:${label}`,
      kind: 'screen',
      label,
      sub: 'まだ無い画面',
      state: 'planned',
      links: [{ text: '画面一覧と導線', href: '../screens/' }],
    });
  }
}

/** 要望が指している節だけを要素にする */
function addRuleNodes(ctx, { pages }, vitest, referenced) {
  const sections = pages.flatMap((p) => p.sections);
  // ルールのページの順（サイドバーの順ではなく、ファイル名順のページと節の出てくる順）に並べる
  for (const section of sections.filter((s) => referenced.includes(s.tag))) {
    const tag = section.tag;
    ctx.add({
      id: `rule:${tag}`,
      kind: 'rule',
      label: section.heading,
      sub: `${section.pageTitle}（${section.page}）`,
      state: vitest.sectionStates.get(tag),
      links: ruleLinks(section, ctx.anchors),
    });
  }
}

/** テストのファイルの要素と線。ファイルの状態は、そのファイルを指す線の状態のいちばん悪いもの */
function addTestNodes(ctx, links) {
  const byId = new Map();
  for (const link of links) {
    const node = testNodeOf(link);
    const entry = byId.get(node.id) ?? { node, states: [] };
    entry.states.push(link.state);
    byId.set(node.id, entry);
    ctx.edge(link.from, node.id);
  }
  for (const { node, states } of byId.values()) {
    ctx.add({ ...node, kind: 'test', state: worstState(states) ?? 'none' });
  }
}

/** 要望の要素と、つなぐ先への線 */
function addRequestNodes(ctx, backlog) {
  for (const b of backlog) {
    const id = `req:${b.name}`;
    ctx.add({
      id,
      kind: 'req',
      label: b.title,
      reqStatus: b.status,
      noTarget: b.trace.none !== undefined,
      links: requestLinks(b.name),
    });
    for (const uc of b.trace.usecases ?? []) ctx.edge(id, `uc:${uc}`);
    for (const s of b.trace.screens ?? []) ctx.edge(id, `screen:${s}`);
    for (const r of b.trace.rules ?? []) ctx.edge(id, `rule:rule:${r}`);
  }
}

/** 要望のつなぎ先の節のタグ（`rule:` + ページ/見出し）。要望ごとの重複は除く */
const referencedTags = (backlog) => [
  ...new Set(backlog.flatMap((b) => (b.trace.rules ?? []).map((r) => `rule:${r}`))),
];

/**
 * 要望の届き具合（D15・D16）。戻り値：Map<要望の要素の id, { state, unreached }>
 * state：つなぐ先の状態のうちいちばん悪いもの。つなぐ先なし・見送りは届き具合を計算しない。
 * unreached：要望の状態が完了なのに、確認済でない（つなぐ先なし・見送りは付けない）。
 */
export function computeNodeStates(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const result = new Map();
  for (const node of graph.nodes.filter((n) => n.kind === 'req')) {
    const targets = graph.edges
      .filter(([from]) => from === node.id)
      .map(([, to]) => byId.get(to)?.state);
    let state;
    if (node.reqStatus === '見送り') state = 'dropped';
    else if (node.noTarget) state = 'notarget';
    else state = worstState(targets) ?? 'none';
    const unreached =
      node.reqStatus === '完了' && STATE_ORDER.includes(state) && state !== 'passed';
    result.set(node.id, { state, unreached });
  }
  return result;
}

/** 同じ列の中の並び：要望は状態の悪い順→名前、テストはファイル名順、ほかは要素を足した順（0） */
function compareInColumn(a, b) {
  if (a.kind === 'req' && b.kind === 'req') {
    return stateRank(a.state) - stateRank(b.state) || a.label.localeCompare(b.label, 'ja');
  }
  if (a.kind === 'test' && b.kind === 'test') return a.id.localeCompare(b.id);
  return 0;
}

/** 要素を列の順（D13）に並べる（同じ並びの要素は足した順を保つ） */
function sortNodes(nodes) {
  return nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.col - b.n.col || compareInColumn(a.n, b.n) || a.i - b.i)
    .map(({ n }) => n);
}

/**
 * 要素と線を組み立てる。inputs：
 *   backlog [{ name, title, status, trace }]、useCases、routes、missingScreens、pages（ルールのページ）、exclusions、
 *   aggregates [{ context, name }]、events [{ event, aggregate }]、e2eJson、vitest { domain, schemas, web }（読めないものは null）、
 *   anchors { useCaseIds, rulePages }（任意）
 * 戻り値：{ nodes, edges: [[from, to]], notices }
 */
export function buildGraph(inputs) {
  const nodes = new Map();
  const pending = [];
  const ctx = {
    anchors: inputs.anchors ?? null,
    add: (node) => nodes.set(node.id, { col: COL[node.kind], ...node }),
    edge: (from, to) => pending.push([from, to]),
  };
  const e2e = collectE2eLinks(inputs);
  const vitest = collectVitestLinks({
    pages: inputs.pages,
    exclusions: inputs.exclusions,
    vitest: inputs.vitest,
    referenced: referencedTags(inputs.backlog),
  });

  addDomainNodes(ctx, inputs, e2e);
  addScreenNodes(ctx, inputs, e2e);
  addRuleNodes(ctx, inputs, vitest, referencedTags(inputs.backlog));
  addTestNodes(ctx, [...e2e.links, ...vitest.links]);
  addRequestNodes(ctx, inputs.backlog);

  const seen = new Set();
  const edges = pending.filter(([from, to]) => {
    const key = `${from}\t${to}`;
    if (!nodes.has(from) || !nodes.has(to) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const graph = { nodes: [...nodes.values()], edges };
  for (const [id, { state, unreached }] of computeNodeStates(graph)) {
    Object.assign(nodes.get(id), { state, unreached });
  }
  return {
    nodes: sortNodes([...nodes.values()]),
    edges,
    notices: {
      e2eNoResult: e2e.noResult,
      missingPackages: vitest.missingPackages,
      fileFailures: vitest.fileFailures,
      unmatchedRoutes: e2e.unmatchedRoutes,
      skippedTests: e2e.skippedTests,
      backlogTitles: new Map(inputs.backlog.map((b) => [b.name, b.title])),
    },
  };
}

// ---------------------------------------------------------------------------
// たどる処理（ページの JS と同じものをテストで確かめるため、本文をページへ埋め込む）
// ---------------------------------------------------------------------------

/**
 * id の祖先（左へ）と子孫（右へ）だけを返す。兄弟（同じ祖先を持つほかの要素）は含めない。
 * direction が 'up' なら祖先だけ、'down' なら子孫だけ。自分自身は含めず、線のつながらない id は空。
 * ページへ本文を埋め込むので、外の変数・import を使わない。
 */
export function traceFrom(edges, id, direction) {
  // 線 [from, to] の from 側（index 0）か to 側（index 1）をたどる。reach(1, 0) が祖先、reach(0, 1) が子孫
  const reach = (here, there) => {
    const seen = new Set();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop();
      for (const edge of edges) {
        if (edge[here] === current && edge[there] !== id && !seen.has(edge[there])) {
          seen.add(edge[there]);
          stack.push(edge[there]);
        }
      }
    }
    return seen;
  };
  const up = direction === 'down' ? [] : [...reach(1, 0)];
  const down = direction === 'up' ? [] : [...reach(0, 1)];
  return [...new Set([...up, ...down])];
}

// ---------------------------------------------------------------------------
// ページ
// ---------------------------------------------------------------------------

const KIND_LABELS = {
  actor: 'アクター',
  req: '要望',
  uc: 'ユースケース',
  screen: '画面',
  rule: 'ルールの節',
  test: 'テストのファイル',
  agg: '集約',
  evt: 'ドメインイベント',
};

/** JSON を <script> に埋め込める文字列にする（`<` をエスケープ。D19） */
export const embedJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

const EXTRA_CSS = `body { max-width:1400px; }
.layout { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:16px; align-items:start; }
@media (max-width: 800px) { .layout { grid-template-columns:minmax(0,1fr); } }
.scroll { overflow-x:auto; border:1px solid var(--line); border-radius:6px; }
#trace-svg { display:block; }
#panel { border:1px solid var(--line); border-radius:6px; padding:8px 12px; font-size:.9rem; position:sticky; top:8px; }
#panel h3 { margin:.2rem 0; font-size:1rem; }
.colhead { font-size:12px; fill:var(--muted); }
.node { cursor:pointer; outline:none; }
.node rect { stroke-width:2; }
.node text { fill:var(--fg); font-size:12px; pointer-events:none; }
.node .st { font-size:10px; fill:var(--muted); }
.node.dim, .edge.dim { opacity:.15; }
.node.sel rect { stroke-width:4; }
.node:focus-visible rect { stroke-width:4; }
.edge { fill:none; stroke:var(--line); stroke-width:1.2; }
.edge.on { stroke:var(--link); stroke-width:2.2; }
.s-passed rect { fill:#d6f0e2; } .s-failed rect { fill:#f8d7da; } .s-noresult rect { fill:#e4e4e7; stroke-dasharray:4 3; }
.s-planned rect { fill:#fff1c9; } .s-none rect { fill:#eceff3; } .s-notarget rect, .s-dropped rect { fill:#f6f6f7; stroke-dasharray:2 3; }
.s-skipped rect { fill:#ece3fb; }
.s-nostate rect { fill:var(--bg); }
@media (prefers-color-scheme: dark) {
  .s-passed rect { fill:#17382a; } .s-failed rect { fill:#4a1d22; } .s-noresult rect { fill:#2a2a2e; }
  .s-planned rect { fill:#443a1c; } .s-none rect { fill:#2a2d33; } .s-notarget rect, .s-dropped rect { fill:#232326; }
  .s-skipped rect { fill:#33264d; }
}
.unreached { color:var(--failed); font-weight:600; }
.legend span { display:inline-block; margin-right:.8em; }`;

/** ブラウザで図を描くスクリプト。DOM は textContent と属性だけで組み立てる（innerHTML は使わない）。backtick と ${ を含めない */
const CLIENT_SCRIPT = `
(function () {
  var data = JSON.parse(document.getElementById('trace-data').textContent);
  var svg = document.getElementById('trace-svg');
  var panel = document.getElementById('panel');
  var NS = 'http://www.w3.org/2000/svg';
  var COLW = 240, BOXW = 190, BOXH = 46, GAP = 10, TOP = 30, LEFT = 8;
  var byId = {}, rows = {};
  data.nodes.forEach(function (n) { byId[n.id] = n; n.row = rows[n.col] || 0; rows[n.col] = n.row + 1; });
  var maxRows = Math.max.apply(null, [1].concat(Object.keys(rows).map(function (k) { return rows[k]; })));
  var width = LEFT * 2 + COLW * data.columns.length - (COLW - BOXW);
  var height = TOP + maxRows * (BOXH + GAP) + 8;
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function short(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  var x = function (n) { return LEFT + n.col * COLW; };
  var y = function (n) { return TOP + n.row * (BOXH + GAP); };
  data.columns.forEach(function (c, i) { svg.appendChild(el('text', { x: LEFT + i * COLW, y: 18, class: 'colhead' }, c)); });
  var edgeEls = data.edges.map(function (e) {
    var a = byId[e[0]], b = byId[e[1]];
    var x1 = x(a) + BOXW, y1 = y(a) + BOXH / 2, x2 = x(b), y2 = y(b) + BOXH / 2, xm = (x1 + x2) / 2;
    var p = el('path', { class: 'edge', d: 'M' + x1 + ' ' + y1 + ' C' + xm + ' ' + y1 + ' ' + xm + ' ' + y2 + ' ' + x2 + ' ' + y2 });
    svg.appendChild(p);
    return p;
  });
  var nodeEls = {};
  data.nodes.forEach(function (n) {
    var g = el('g', { class: 'node s-' + (n.state || 'nostate'), tabindex: '0', role: 'button', 'data-id': n.id });
    var stroke = n.color >= 0 && n.color !== undefined ? 'hsl(' + ((n.color * 67) % 360) + ' 55% 48%)' : 'var(--line)';
    g.appendChild(el('title', {}, n.label + (n.sub ? '（' + n.sub + '）' : '')));
    g.appendChild(el('rect', { x: x(n), y: y(n), width: BOXW, height: BOXH, rx: 6, stroke: stroke }));
    g.appendChild(el('text', { x: x(n) + 8, y: y(n) + 18 }, short(n.label, 14)));
    var st = (data.stateLabels[n.state] || '') + (n.unreached ? '（未達）' : '') + (n.future ? '（将来）' : '');
    g.appendChild(el('text', { x: x(n) + 8, y: y(n) + 36, class: 'st' }, st));
    g.addEventListener('click', function (ev) { ev.stopPropagation(); select(n.id); });
    g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(n.id); } });
    svg.appendChild(g);
    nodeEls[n.id] = g;
  });
  var selected = null;
  function line(parent, tag, text) { var e = document.createElement(tag); e.textContent = text; parent.appendChild(e); return e; }
  function renderPanel(up, down) {
    panel.textContent = '';
    var n = selected && byId[selected];
    if (!n) { line(panel, 'p', '要素を押すと、そこから上流（なぜ作るか）と下流（どこで確かめているか）だけが濃くなります。もう一度押すか、図の余白を押すと戻ります。'); return; }
    line(panel, 'h3', n.label);
    line(panel, 'p', data.kindLabels[n.kind] + (n.sub ? '：' + n.sub : '') + (n.full ? '：' + n.full : ''));
    if (n.state) line(panel, 'p', '状態：' + data.stateLabels[n.state] + (n.unreached ? '（未達：完了なのに確認済でない）' : ''));
    if (n.reqStatus) line(panel, 'p', '要望の状態：' + n.reqStatus);
    line(panel, 'p', 'つながる要素：上流 ' + (up.size - 1) + '・下流 ' + (down.size - 1));
    (n.links || []).forEach(function (l) { var a = line(panel, 'p', '').appendChild(document.createElement('a')); a.textContent = l.text; a.href = l.href; });
  }
  function select(id) {
    selected = selected === id ? null : id;
    var up = new Set(selected ? traceFrom(data.edges, selected, 'up') : []);
    var down = new Set(selected ? traceFrom(data.edges, selected, 'down') : []);
    if (selected) { up.add(selected); down.add(selected); }
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.toggle('dim', !!selected && !up.has(k) && !down.has(k));
      nodeEls[k].classList.toggle('sel', k === selected);
    });
    data.edges.forEach(function (e, i) {
      var on = !!selected && ((up.has(e[0]) && up.has(e[1])) || (down.has(e[0]) && down.has(e[1])));
      edgeEls[i].classList.toggle('on', on);
      edgeEls[i].classList.toggle('dim', !!selected && !on);
    });
    renderPanel(up, down);
  }
  document.getElementById('trace-scroll').addEventListener('click', function () { if (selected) select(selected); });
  renderPanel(new Set(), new Set());
})();
`;

/** 状態ごとの要望の数と、未達の要望の一覧（ページの先頭に出す） */
function summarize(nodes) {
  const reqs = nodes.filter((n) => n.kind === 'req');
  const counts = REQ_STATE_ORDER.map((s) => [s, reqs.filter((r) => r.state === s).length]);
  return { counts, unreached: reqs.filter((r) => r.unreached), total: reqs.length };
}

function noticeHtml({ notices }, summary) {
  const out = [];
  if (notices.e2eNoResult) {
    out.push(
      '<p class="notice">E2E の結果がありません。現行のユースケースと画面の状態は「結果なし」です。</p>',
    );
  }
  if (notices.missingPackages.length > 0) {
    out.push(
      `<p class="notice">Vitest の結果が読めないパッケージがあります：${notices.missingPackages.map(escapeHtml).join('、')}。「テストなし」の節は「結果なし」にしています。</p>`,
    );
  }
  if (notices.fileFailures.length > 0) {
    const items = notices.fileFailures
      .map((f) => `<li>${escapeHtml(f.pkg)}：${escapeHtml(f.file)}</li>`)
      .join('');
    out.push(
      `<div class="notice"><p>収集で落ちたファイル（どの節のテストか分からないので状態に入れていません）：</p><ul>${items}</ul></div>`,
    );
  }
  if (notices.unmatchedRoutes.length > 0) {
    const items = notices.unmatchedRoutes.map((p) => `<li>${escapeHtml(p)}</li>`).join('');
    out.push(
      `<div class="notice"><p>当たらないルート（smoke の題の書き方が変わった？ 状態は「テストなし」になっています）：</p><ul>${items}</ul></div>`,
    );
  }
  if (notices.skippedTests.length > 0) {
    const items = notices.skippedTests
      .map(
        (s) => `<li>${backlogLink(s.backlog, notices.backlogTitles)}：${escapeHtml(s.title)}</li>`,
      )
      .join('');
    out.push(
      `<div class="notice skipped"><p>スキップ中のテストが ${notices.skippedTests.length} 件あります（不安定なためスキップし、直す要望を起こしたもの。確かめる UC は全部スキップなら「全スキップ」）：</p><ul>${items}</ul></div>`,
    );
  }
  if (summary.unreached.length > 0) {
    const items = summary.unreached
      .map(
        (r) =>
          `<li><a href="../backlog/${encodeURIComponent(r.id.slice('req:'.length))}.html">${escapeHtml(r.label)}</a>（${STATE_LABELS[r.state]}）</li>`,
      )
      .join('');
    out.push(
      `<div class="notice"><p class="unreached">未達 ${summary.unreached.length} 件：完了なのに、つなぐ先が確認済になっていない要望</p><ul>${items}</ul></div>`,
    );
  }
  return out.join('\n');
}

/** ページの HTML を組み立てる */
export function buildTraceReportHtml({ graph, generatedAt, sha }) {
  const summary = summarize(graph.nodes);
  const data = {
    nodes: graph.nodes,
    edges: graph.edges,
    columns: COLUMNS,
    kindLabels: KIND_LABELS,
    stateLabels: STATE_LABELS,
  };
  const counts = summary.counts
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `<span>${STATE_LABELS[s]} ${n}</span>`)
    .join('');
  const meta = [
    `生成：${escapeHtml(generatedAt)}`,
    sha ? `コミット：${escapeHtml(String(sha).slice(0, 7))}` : null,
  ]
    .filter(Boolean)
    .join(' ／ ');
  const body = `<p class="meta legend">要望 ${summary.total} 件の届き具合：${counts}</p>
<div class="layout">
<div class="scroll" id="trace-scroll"><svg id="trace-svg" role="img" aria-label="要望からテストまでのつながりの図"></svg></div>
<aside id="panel" aria-live="polite"></aside>
</div>
<script type="application/json" id="trace-data">${embedJson(data)}</script>
<script>
${traceFrom.toString()}
${CLIENT_SCRIPT}
</script>`;
  return reportPage({
    title: 'アイデアから実装までのトレース',
    lead: '要望（<a href="../backlog/">要望の一覧</a>）から、ユースケース・画面・ルールの節・テスト・集約・イベントまでのつながり。要素を押すと、そこから上流と下流だけが濃くなる。要望の色は、つなぐ先の状態のうちいちばん悪いもの。「確認済」は、つなぐ先のテストが通ったという意味で、要望の中身を全部確かめたという意味ではない（<a href="../architecture/test-report.html">テストレポート</a>）。',
    meta,
    notice: noticeHtml(graph, summary),
    body,
    extraCss: EXTRA_CSS,
  });
}

// ---------------------------------------------------------------------------
// ファイルの読み込みと CLI
// ---------------------------------------------------------------------------

/** ファイルを読んでページを書く。戻り値は書いたファイルと要望の状態ごとの数 */
export function main({ out = OUTPUT_FILE, e2eFile = RESULTS_FILE } = {}) {
  const aggregatesMd = readFileSync(AGGREGATES_FILE, 'utf8');
  const pages = readRulePages();
  const rulePages = new Map(
    pages.map((p) => [p.page, readAnchors(readText(join(CARTAGRAPH_DIST, `${p.page}.html`)))]),
  );
  const graph = buildGraph({
    backlog: readBacklog(),
    useCases: parseUseCases(readFileSync(USE_CASES_FILE, 'utf8')),
    routes: parseRoutes(readFileSync(ROUTES_FILE, 'utf8')),
    missingScreens: parseMissingScreens(readFileSync(SCREENS_FILE, 'utf8')),
    pages,
    exclusions: readExclusions(),
    aggregates: parseAggregateList(aggregatesMd),
    events: parseAggregateEvents(aggregatesMd),
    e2eJson: readE2eResults(e2eFile),
    vitest: Object.fromEntries(
      PACKAGES.map((p) => [p.name, readVitestResults(join(p.dir, 'vitest-results/results.json'))]),
    ),
    anchors: {
      useCaseIds: existsSync(USE_CASES_DIST) ? readAnchorIds(USE_CASES_DIST) : null,
      rulePages,
    },
  });
  const html = buildTraceReportHtml({
    graph,
    generatedAt: new Date().toISOString(),
    sha: process.env.GITHUB_SHA,
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return { out, counts: summarize(graph.nodes).counts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const { out, counts } = main({
    ...(arg('--out') ? { out: arg('--out') } : {}),
    ...(arg('--e2e') ? { e2eFile: arg('--e2e') } : {}),
  });
  console.log(
    `${out} を作りました（要望：${counts.map(([s, n]) => `${STATE_LABELS[s]} ${n}`).join('・')}）`,
  );
}
