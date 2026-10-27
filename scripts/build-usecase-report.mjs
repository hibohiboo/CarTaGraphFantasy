// 中核のユースケース（docs/architecture/use-cases.md の表）ごとに、それを確かめる E2E のテストと最新の結果
// （確認済・落ちた・手前で止まった・テストなし）を一覧にする HTML を作る。デプロイが E2E を流した後に回し、
// GitHub Pages の /usecase-report/ に載せる（scripts/copy-test-reports-to-pages.mjs が写す）。
// 一覧のページへのリンクは docs/architecture/test-report.md。タグ・ステップの書き方は docs/process/rules/testing.md「ユースケースの E2E」。
//
// 入力：Playwright の JSON（apps/web/e2e-results/results.json）と use-cases.md の表。出力：apps/web/usecase-report/index.html
// E2E が起動できなかった等で結果が読めないときも失敗させず、「結果なし」のページを作る（デプロイを止めない方針のため）。
//
// 使い方: pnpm web:e2e; pnpm usecase:report   （E2E が落ちたときこそページを見たいので && でつながない）
// テストは scripts/build-usecase-report.test.mjs（pnpm tools:test）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, reportPage } from './report-html.mjs';
import { BACKLOG_DIR, frontmatterValue } from './trace.mjs';
import { parseUseCases, STEP_ID_RE, USE_CASES_FILE } from './usecases.mjs';

export const RESULTS_FILE = 'apps/web/e2e-results/results.json';
export const OUTPUT_FILE = 'apps/web/usecase-report/index.html';
const USE_CASES_DIST = 'docs/.vitepress/dist/architecture/use-cases.html';

/**
 * 強い順（落ちた ＞ 手前で止まった ＞ 通った ＞ 全スキップ）。全スキップがいちばん弱いので、UC を確かめるテストが
 * 全部スキップのときだけ UC が全スキップになり、一部だけならスキップでないテストの状態で出る（P6 の D5）
 */
const RANK = { failed: 4, stopped: 3, passed: 2, skipped: 1 };
const strongest = (a, b) => (!a || (RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : a);

/** ステップを再帰でたどり、題が ID で始まるものを [{ id, state }] で返す（ID の無い親の下も拾う） */
export function idSteps(steps = []) {
  return steps.flatMap((step) => {
    const id = step.title?.match(STEP_ID_RE)?.[1];
    // 念のため：duration が負（走りかけ）で error も無いステップは、通ったとは言わない
    const own = id
      ? [{ id, state: step.error ? 'failed' : step.duration >= 0 ? 'passed' : 'stopped' }]
      : [];
    return [...own, ...idSteps(step.steps)];
  });
}

/**
 * 1回の結果（results の1つ）から、タグの ID ごとの状態を決める。
 * ステップに status は無く、合否は error の有無。ステップの外で落ちたとき・時間切れのときに ID のステップが
 * どれも落ちていなければ、結果の status で補う（さもないと落ちたテストが全部「通った」に見える）。
 * backlog（直す要望の注記の description）のあるテストが skipped なら、タグの ID はすべて全スキップ（P6 の D12）。
 */
export function runStates(tags, result, backlog = null) {
  if (backlog && result.status === 'skipped') return new Map(tags.map((id) => [id, 'skipped']));
  const found = idSteps(result.steps);
  const states = new Map();
  for (const { id, state } of found) states.set(id, strongest(states.get(id), state));
  // skipped は落ちたのではなく走らなかった（手前で止まった扱いのまま）
  if (
    result.status !== 'passed' &&
    result.status !== 'skipped' &&
    ![...states.values()].includes('failed')
  ) {
    // 落ちた箇所に最も近い、まだ走っていない ID（無ければ最後に記録された ID）を落ちた扱いにする
    const next = tags.find((id) => !states.has(id));
    const last = next ?? found.at(-1)?.id ?? tags[0];
    if (last) states.set(last, 'failed');
  }
  return new Map(tags.map((id) => [id, states.get(id) ?? 'stopped']));
}

/**
 * 直す要望の注記（type: 'backlog'）の description。無ければ null。
 * 静的な注記は tests[].annotations に、実行時の注記は results[].annotations に載るので、どちらか片方の作りに頼らず両方を見る（D12）
 */
function backlogOf(tests) {
  const annotations = tests.flatMap((t) => [
    ...(t.annotations ?? []),
    ...(t.results ?? []).flatMap((r) => r.annotations ?? []),
  ]);
  return annotations.find((a) => a?.type === 'backlog')?.description ?? null;
}

/** JSON から spec を平たく集める（describe の入れ子をたどる）。テストごとに最後の結果（retry の最後）と、直す要望の注記を持つ */
export function collectSpecs(json) {
  const walk = (suite) => [
    ...(suite.specs ?? []).map((spec) => ({
      title: spec.title,
      id: spec.id,
      file: spec.file,
      tags: spec.tags ?? [],
      runs: (spec.tests ?? []).map((t) => t.results?.at(-1)).filter(Boolean),
      backlog: backlogOf(spec.tests ?? []),
    })),
    ...(suite.suites ?? []).flatMap(walk),
  ];
  return (json?.suites ?? []).flatMap(walk);
}

/** スキップ中のテスト（直す要望の注記があり、結果が全部 skipped）を [{ title, backlog }] で返す。結果なしなら空 */
export function skippedSpecs(json) {
  if (hasNoResults(json)) return [];
  return collectSpecs(json)
    .filter((s) => s.backlog && s.runs.length > 0 && s.runs.every((r) => r.status === 'skipped'))
    .map(({ title, backlog }) => ({ title, backlog }));
}

/** 直す要望の注記の description（docs/backlog/<名前>.md）から要望の名前 */
export const backlogName = (description) =>
  String(description)
    .replace(/^.*[/\\]/, '')
    .replace(/\.md$/, '');

/** 直す要望のページへのリンク（相対パス。トレースのページと同じ作り）。titles は名前 → 要望の title（無ければ名前） */
export function backlogLink(description, titles) {
  const name = backlogName(description);
  return `<a href="../backlog/${encodeURIComponent(name)}.html">${escapeHtml(titles?.get(name) || name)}</a>`;
}

/** 結果が読めない（JSON が無い・壊れている、起動の失敗で spec が無い／すべて結果が空）か */
export function hasNoResults(json) {
  if (!json || typeof json !== 'object') return true;
  const specs = collectSpecs(json);
  // テストが1つも無い JSON（--grep の食い違い・testDir の誤りなど）は、E2E が動いていないので「テストなし」とは区別する
  if (specs.length === 0) return true;
  if ((json.errors ?? []).length === 0) return false;
  return specs.every((spec) => spec.runs.length === 0);
}

/**
 * ユースケースごとの状態を決める。
 * 状態：failed／stopped／passed／skipped（確かめるテストが全部スキップ）／none（タグを持つテストが無い）／noresult（結果が読めない）
 * 戻り値：Map<id, { state, tests: [{ title, specId, state, backlog }] }>
 */
export function computeStates(useCases, json) {
  const result = new Map();
  if (hasNoResults(json)) {
    for (const u of useCases) result.set(u.id, { state: 'noresult', tests: [] });
    return result;
  }
  const specs = collectSpecs(json);
  for (const u of useCases) {
    const tests = [];
    for (const spec of specs) {
      if (!spec.tags.includes(u.id)) continue;
      let state = null;
      for (const run of spec.runs) {
        state = strongest(state, runStates(spec.tags, run, spec.backlog).get(u.id));
      }
      // 結果が1つも無いテスト（起動できなかった等）は手前で止まった扱い
      tests.push({
        title: spec.title,
        specId: spec.id,
        state: state ?? 'stopped',
        backlog: spec.backlog,
      });
    }
    const state = tests.reduce((acc, t) => strongest(acc, t.state), null) ?? 'none';
    result.set(u.id, { state, tests });
  }
  return result;
}

/** ビルド後の use-cases.html にある id から、ユースケースの見出しへのリンク先（#以降）を引く。無ければ null */
export function anchorFor(useCase, ids) {
  if (!ids) return null;
  const own = [...ids].find((id) => id.startsWith(`${useCase.id.toLowerCase()}-`));
  if (own) return own;
  const domain = `${useCase.domain}${useCase.future ? '将来' : ''}`;
  return ids.has(domain) ? domain : null;
}

const LABELS = {
  passed: '確認済',
  failed: '落ちた',
  stopped: '手前で止まった',
  skipped: '全スキップ',
  none: 'テストなし',
  noresult: '結果なし',
};

/** テストの一覧の1件の状態。スキップしたテストは UC の「全スキップ」でなく「スキップ中」と直す要望へのリンク（D7） */
const testStateHtml = (t, backlogTitles) =>
  t.state === 'skipped'
    ? `スキップ中（${backlogLink(t.backlog, backlogTitles)}）`
    : LABELS[t.state];

/** 先頭の案内：スキップ中のテストの数と直す要望へのリンク（D18）。無ければ空 */
function skippedNotice(json, backlogTitles) {
  const skipped = skippedSpecs(json);
  if (skipped.length === 0) return '';
  const items = skipped
    .map((s) => `<li>${backlogLink(s.backlog, backlogTitles)}：${escapeHtml(s.title)}</li>`)
    .join('');
  return `<div class="notice skipped"><p>スキップ中のテストが ${skipped.length} 件あります（不安定なためスキップし、直す要望を起こしたもの）。直したらスキップを外す：</p><ul>${items}</ul></div>`;
}

/**
 * ページの HTML を組み立てる。ids は use-cases.html の id の集合（無ければ見出しへのリンクを付けない）。
 * backlogTitles は直す要望の名前 → title（無ければリンクの文字はファイル名）
 */
export function buildReportHtml({ useCases, states, json, ids, backlogTitles, generatedAt, sha }) {
  const noResult = hasNoResults(json);
  const startTime = json?.stats?.startTime;
  const domains = [...new Set(useCases.map((u) => u.domain))];

  const sections = domains
    .map((domain) => {
      const rows = useCases
        .filter((u) => u.domain === domain)
        .map((u) => {
          const { state, tests } = states.get(u.id);
          const anchor = anchorFor(u, ids);
          const name = anchor
            ? `<a href="../architecture/use-cases.html#${encodeURIComponent(anchor)}">${escapeHtml(u.name)}</a>`
            : escapeHtml(u.name);
          const list = tests
            .map(
              (t) =>
                `<li><a href="../e2e-report/#?testId=${encodeURIComponent(t.specId)}">${escapeHtml(t.title)}</a>` +
                `<span class="sub ${t.state}">（${testStateHtml(t, backlogTitles)}）</span></li>`,
            )
            .join('');
          return (
            `<tr><td class="id">${escapeHtml(u.id)}</td><td>${name}</td>` +
            `<td><span class="badge ${state}">${LABELS[state]}</span></td>` +
            `<td>${list ? `<ul>${list}</ul>` : ''}</td></tr>`
          );
        })
        .join('\n');
      const future = useCases.find((u) => u.domain === domain)?.future ? '（将来）' : '';
      return (
        `<h2>${escapeHtml(domain)}${future}</h2>\n<table>\n` +
        `<thead><tr><th>ID</th><th>ユースケース</th><th>状態</th><th>確かめるテスト</th></tr></thead>\n` +
        `<tbody>\n${rows}\n</tbody></table>`
      );
    })
    .join('\n');

  const notice = noResult
    ? '<p class="notice">E2E の結果がありません（E2E が起動できなかった等）。状態はすべて「結果なし」です。</p>'
    : skippedNotice(json, backlogTitles);
  const meta = [
    `生成：${escapeHtml(generatedAt)}`,
    startTime ? `E2E の開始：${escapeHtml(startTime)}` : null,
    sha ? `コミット：${escapeHtml(String(sha).slice(0, 7))}` : null,
  ]
    .filter(Boolean)
    .join(' ／ ');

  return reportPage({
    title: 'ユースケースと E2E の結果',
    lead: '中核のユースケース（<a href="../architecture/use-cases.html">一覧</a>）ごとに、それを確かめる E2E のテストの最新の結果。「確認済」は、そのユースケースの正常パス（タグを付けたステップの主な流れ）を E2E で確認したという意味で、ほかの流れ（断る・分かれる）までは確認していない。テストの題から Playwright のレポートへ飛べる（<a href="../architecture/test-report.html">テストレポート</a>）。',
    meta,
    notice,
    body: sections,
  });
}

/** use-cases.html の id の集合。ビルド結果が無ければ null */
export function readAnchorIds(file) {
  if (!existsSync(file)) return null;
  return new Set(
    [...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) =>
      m[1]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    ),
  );
}

/** JSON を読む。無い・壊れているときは null */
export function readResults(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** スキップ中のテストの直す要望の名前 → title（docs/backlog/<名前>.md の frontmatter。読めなければ入れない。D13） */
export function readBacklogTitles(json) {
  const titles = new Map();
  for (const { backlog } of skippedSpecs(json)) {
    const name = backlogName(backlog);
    const file = `${BACKLOG_DIR}/${name}.md`;
    const title = existsSync(file) ? frontmatterValue(readFileSync(file, 'utf8'), 'title') : '';
    if (title) titles.set(name, title);
  }
  return titles;
}

/** ファイルを読んでページを書く。戻り値は書いたファイルと UC の状態 */
export function main({ out = OUTPUT_FILE, e2eFile = RESULTS_FILE } = {}) {
  const useCases = parseUseCases(readFileSync(USE_CASES_FILE, 'utf8'));
  const json = readResults(e2eFile);
  const states = computeStates(useCases, json);
  const html = buildReportHtml({
    useCases,
    states,
    json,
    ids: readAnchorIds(USE_CASES_DIST),
    backlogTitles: readBacklogTitles(json),
    generatedAt: new Date().toISOString(),
    sha: process.env.GITHUB_SHA,
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return { out, states };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const { out, states } = main({
    ...(arg('--out') ? { out: arg('--out') } : {}),
    ...(arg('--e2e') ? { e2eFile: arg('--e2e') } : {}),
  });
  const count = (s) => [...states.values()].filter((v) => v.state === s).length;
  console.log(
    `${out} を作りました（確認済 ${count('passed')}・落ちた ${count('failed')}・手前で止まった ${count('stopped')}・全スキップ ${count('skipped')}・テストなし ${count('none')}・結果なし ${count('noresult')}）`,
  );
}
