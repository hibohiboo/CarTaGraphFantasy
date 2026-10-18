// 中核のユースケース（docs/architecture/use-cases.md の表）ごとに、それを確かめる E2E のテストと最新の結果
// （通った・落ちた・手前で止まった・テストなし）を一覧にする HTML を作る。デプロイが E2E を流した後に回し、
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
import { parseUseCases, STEP_ID_RE, USE_CASES_FILE } from './usecases.mjs';

export const RESULTS_FILE = 'apps/web/e2e-results/results.json';
export const OUTPUT_FILE = 'apps/web/usecase-report/index.html';
const USE_CASES_DIST = 'docs/.vitepress/dist/architecture/use-cases.html';

/** 強い順（落ちた ＞ 手前で止まった ＞ 通った） */
const RANK = { failed: 3, stopped: 2, passed: 1 };
const strongest = (a, b) => (!a || (RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : a);

/** ステップを再帰でたどり、題が ID で始まるものを [{ id, state }] で返す（ID の無い親の下も拾う） */
export function idSteps(steps = []) {
  return steps.flatMap((step) => {
    const id = step.title?.match(STEP_ID_RE)?.[1];
    // 時間切れで走りかけのステップは duration が負のことがある。error が無くても通ったとは言わない
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
 */
export function runStates(tags, result) {
  const found = idSteps(result.steps);
  const states = new Map();
  for (const { id, state } of found) states.set(id, strongest(states.get(id), state));
  if (result.status !== 'passed' && ![...states.values()].includes('failed')) {
    const last = found.at(-1)?.id ?? tags[0];
    if (last) states.set(last, 'failed');
  }
  return new Map(tags.map((id) => [id, states.get(id) ?? 'stopped']));
}

/** JSON から spec を平たく集める（describe の入れ子をたどる）。テストごとに最後の結果（retry の最後）を持つ */
export function collectSpecs(json) {
  const walk = (suite) => [
    ...(suite.specs ?? []).map((spec) => ({
      title: spec.title,
      id: spec.id,
      file: spec.file,
      tags: spec.tags ?? [],
      runs: (spec.tests ?? []).map((t) => t.results?.at(-1)).filter(Boolean),
    })),
    ...(suite.suites ?? []).flatMap(walk),
  ];
  return (json?.suites ?? []).flatMap(walk);
}

/** 結果が読めない（JSON が無い・壊れている、起動の失敗で spec が無い／すべて結果が空）か */
export function hasNoResults(json) {
  if (!json || typeof json !== 'object') return true;
  if ((json.errors ?? []).length === 0) return false;
  return collectSpecs(json).every((spec) => spec.runs.length === 0);
}

/**
 * ユースケースごとの状態を決める。
 * 状態：failed／stopped／passed／none（タグを持つテストが無い）／noresult（結果が読めない）
 * 戻り値：Map<id, { state, tests: [{ title, specId, state }] }>
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
      for (const run of spec.runs) state = strongest(state, runStates(spec.tags, run).get(u.id));
      // 結果が1つも無いテスト（起動できなかった等）は手前で止まった扱い
      tests.push({ title: spec.title, specId: spec.id, state: state ?? 'stopped' });
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

const escapeHtml = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const LABELS = {
  passed: '通った',
  failed: '落ちた',
  stopped: '手前で止まった',
  none: 'テストなし',
  noresult: '結果なし',
};

/** ページの HTML を組み立てる。ids は use-cases.html の id の集合（無ければ見出しへのリンクを付けない） */
export function buildReportHtml({ useCases, states, json, ids, generatedAt, sha }) {
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
                `<span class="sub ${t.state}">（${LABELS[t.state]}）</span></li>`,
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
    : '';
  const meta = [
    `生成：${escapeHtml(generatedAt)}`,
    startTime ? `E2E の開始：${escapeHtml(startTime)}` : null,
    sha ? `コミット：${escapeHtml(String(sha).slice(0, 7))}` : null,
  ]
    .filter(Boolean)
    .join(' ／ ');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ユースケースと E2E の結果</title>
<style>
:root { --bg:#fff; --fg:#213547; --muted:#67676c; --line:#e2e2e3; --link:#3451b2; --passed:#18794e; --failed:#b8272c; --stopped:#915930; --none:#67676c; --noresult:#67676c; }
@media (prefers-color-scheme: dark) { :root { --bg:#1b1b1f; --fg:#dfdfd6; --muted:#98989f; --line:#2e2e32; --link:#a8b1ff; --passed:#3dd68c; --failed:#f66f81; --stopped:#f9b44e; --none:#98989f; --noresult:#98989f; } }
body { margin:0 auto; max-width:1000px; padding:24px 16px 48px; background:var(--bg); color:var(--fg); font:16px/1.7 system-ui, sans-serif; }
a { color:var(--link); }
h1 { font-size:1.6rem; } h2 { font-size:1.2rem; margin-top:2rem; border-top:1px solid var(--line); padding-top:1rem; }
table { border-collapse:collapse; width:100%; display:block; overflow-x:auto; }
th, td { border:1px solid var(--line); padding:6px 10px; text-align:left; vertical-align:top; font-size:.9rem; }
td.id { white-space:nowrap; font-family:ui-monospace, monospace; }
ul { margin:0; padding-left:1.2em; }
.badge { white-space:nowrap; font-weight:600; }
.badge.passed, .sub.passed { color:var(--passed); } .badge.failed, .sub.failed { color:var(--failed); }
.badge.stopped, .sub.stopped { color:var(--stopped); } .badge.none, .badge.noresult { color:var(--none); }
.sub { font-size:.8rem; } .meta, .lead { color:var(--muted); font-size:.9rem; }
.notice { border:1px solid var(--failed); border-radius:6px; padding:8px 12px; color:var(--failed); }
</style>
</head>
<body>
<h1>ユースケースと E2E の結果</h1>
<p class="lead">中核のユースケース（<a href="../architecture/use-cases.html">一覧</a>）ごとに、それを確かめる E2E のテストの最新の結果。「通った」は、タグを付けたステップの主な流れが通ったという意味で、ユースケースのほかの流れまで網羅したわけではない。テストの題から Playwright のレポートへ飛べる（<a href="../architecture/test-report.html">テストレポート</a>）。</p>
<p class="meta">${meta}</p>
${notice}
${sections}
</body>
</html>
`;
}

/** use-cases.html の id の集合。ビルド結果が無ければ null */
function readAnchorIds(file) {
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
function readResults(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const useCases = parseUseCases(readFileSync(USE_CASES_FILE, 'utf8'));
  const json = readResults(RESULTS_FILE);
  const states = computeStates(useCases, json);
  const html = buildReportHtml({
    useCases,
    states,
    json,
    ids: readAnchorIds(USE_CASES_DIST),
    generatedAt: new Date().toISOString(),
    sha: process.env.GITHUB_SHA,
  });
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, html);
  const count = (s) => [...states.values()].filter((v) => v.state === s).length;
  console.log(
    `${OUTPUT_FILE} を作りました（通った ${count('passed')}・落ちた ${count('failed')}・手前で止まった ${count('stopped')}・テストなし ${count('none')}・結果なし ${count('noresult')}）`,
  );
}
