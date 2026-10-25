// ルールのページ（docs/cartagraph/）の節（##・###）ごとに、それを確かめる Vitest のテストと最新の結果
// （確認済・落ちた・スキップのみ・テストなし・対象外）を一覧にする HTML を作る。デプロイが Vitest を流した後に回し、
// GitHub Pages の /rule-test-report/ に載せる（scripts/copy-test-reports-to-pages.mjs が写す）。
// 一覧のページへのリンクは docs/architecture/test-report.md。タグの書き方は docs/process/rules/testing.md「ルールのテストのタグ」。
//
// 入力：domain・schemas・web の Vitest の JSON（各パッケージの vitest-results/results.json）、ルールのページの見出し
//       （rule-sections.mjs）、対象外の一覧、ビルド結果の HTML（見出しへのリンクとページの並び。無ければページへのリンクとファイル名順）。
// 出力：rule-test-report/index.html
// 読めないパッケージがあっても失敗させず、先頭に「結果なし」を出す（デプロイを止めない方針のため）。
//
// 使い方: pnpm docs:build; pnpm test:report; pnpm rule:report   （docs:build が無いと、リンクがページまでになり並びがファイル名順になる）
// テストは scripts/build-rule-test-report.test.mjs（pnpm tools:test）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, reportPage } from './report-html.mjs';
import { findExclusion, readExclusions, readRulePages, TAG_PREFIX } from './rule-sections.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PACKAGES = [
  { name: 'domain', dir: 'packages/domain' },
  { name: 'schemas', dir: 'packages/schemas' },
  { name: 'web', dir: 'apps/web' },
];
const RESULTS = 'vitest-results/results.json';
const DIST_CARTAGRAPH = 'docs/.vitepress/dist/cartagraph';

/** 状態の表示順（強い順ではなく、ページの数の並び） */
const STATES = ['passed', 'failed', 'skipped', 'none', 'excluded'];
const STATE_LABELS = {
  passed: '確認済',
  failed: '落ちた',
  skipped: 'スキップのみ',
  none: 'テストなし',
  excluded: '対象外',
};
const SKIP_STATUSES = ['skipped', 'pending', 'todo', 'disabled'];

/** Vitest の JSON から [{ pkg, file, ancestors, title, status, tags }]。読めなかったパッケージ（null）は含めない */
export function collectTests(resultsByPkg) {
  return Object.entries(resultsByPkg).flatMap(([pkg, json]) =>
    (json?.testResults ?? []).flatMap((file) =>
      (file?.assertionResults ?? [])
        .filter((a) => a && typeof a.status === 'string')
        .map((a) => ({
          pkg,
          file: relativeFile(file.name),
          ancestors: a.ancestorTitles ?? [],
          title: a.title ?? a.fullName ?? '',
          status: a.status,
          tags: a.tags ?? [],
        })),
    ),
  );
}

/** 収集の時点で落ちたファイル（status が failed で assertionResults が空）。タグの打ち間違いなどで起きる */
export function collectFileFailures(resultsByPkg) {
  return Object.entries(resultsByPkg).flatMap(([pkg, json]) =>
    (json?.testResults ?? [])
      .filter((f) => f?.status === 'failed' && (f.assertionResults ?? []).length === 0)
      .map((f) => ({ pkg, file: relativeFile(f.name), message: String(f.message ?? '').trim() })),
  );
}

function relativeFile(name = '') {
  const normalized = String(name).replaceAll('\\', '/');
  return normalized.match(/(?:^|\/)((?:packages|apps)\/.*)$/)?.[1] ?? normalized;
}

/** 節の状態。対象外 ＞ 落ちた ＞ 確認済 ＞ スキップのみ ＞ テストなし */
export function sectionState(tests, excluded) {
  if (excluded) return 'excluded';
  if (tests.some((t) => t.status === 'failed')) return 'failed';
  if (tests.some((t) => t.status === 'passed')) return 'passed';
  if (tests.some((t) => SKIP_STATUSES.includes(t.status))) return 'skipped';
  return 'none';
}

/** Map<タグ, { state, tests, reason }>（reason は対象外のときの理由） */
export function computeSectionStates({ pages, exclusions, tests }) {
  const states = new Map();
  for (const page of pages) {
    for (const s of page.sections) {
      const exclusion = findExclusion(s, exclusions);
      const matched = tests.filter((t) => t.tags.includes(s.tag));
      states.set(s.tag, {
        state: sectionState(matched, exclusion !== undefined),
        tests: matched,
        reason: exclusion?.reason,
      });
    }
  }
  return states;
}

/** どの節にも当たらない `rule:` のタグ（設定が古いなど。Vitest が止めるので通常は出ない） */
export function unmatchedRuleTags(tests, pages) {
  const known = new Set(pages.flatMap((p) => p.sections.map((s) => s.tag)));
  const tags = tests
    .flatMap((t) => t.tags)
    .filter((t) => t.startsWith(TAG_PREFIX) && !known.has(t));
  return [...new Set(tags)].sort();
}

const decode = (s) =>
  s
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

/** ビルド後のページの、id 付きの h2・h3 から [{ text, id }]。HTML が無ければ null（サイドバーの id の無い h2 は拾わない） */
export function readAnchors(html) {
  if (html == null) return null;
  return [...html.matchAll(/<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
    id: decode(m[2]),
    text: decode(m[3].replace(/<[^>]+>/g, ''))
      .replaceAll('\u200b', '') // VitePress の見出しのアンカーに入るゼロ幅スペース
      .trim(),
  }));
}

/** 節の見出しの文字から、ページの中の id を引く。引けなければ null */
export function anchorFor(section, anchors) {
  return anchors?.find((a) => a.text === section.heading)?.id ?? null;
}

/** ビルド後のページのサイドバーのリンクから、ルールのページの並び（最初に出た順）。全体像は index。HTML が無ければ null */
export function readSidebarOrder(html) {
  if (html == null) return null;
  const names = [...html.matchAll(/href="[^"]*\/cartagraph\/([a-z0-9-]*)(?:\.html)?"/g)].map(
    (m) => m[1] || 'index',
  );
  return [...new Set(names)];
}

/** サイドバーの順に並べる。サイドバーに無いページは後ろにファイル名順。order が null ならファイル名順 */
export function orderPages(pages, order) {
  const rank = (p) => {
    const i = order?.indexOf(p.page) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...pages].sort((a, b) => rank(a) - rank(b) || a.page.localeCompare(b.page));
}

const pageHref = (page) => (page === 'index' ? '../cartagraph/' : `../cartagraph/${page}.html`);

function testItem(t) {
  const label = [t.file, ...t.ancestors, t.title].map(escapeHtml).join(' › ');
  const status = SKIP_STATUSES.includes(t.status) ? 'skipped' : t.status;
  const text = status === 'skipped' ? 'スキップ' : (STATE_LABELS[status] ?? t.status);
  return (
    `<li><a href="../vitest-report/${encodeURIComponent(t.pkg)}/">${escapeHtml(t.pkg)}</a> ${label}` +
    `<span class="sub ${escapeHtml(status)}">（${escapeHtml(text)}）</span></li>`
  );
}

function sectionRow(s, info, anchors) {
  const id = anchorFor(s, anchors);
  const href = id ? `${pageHref(s.page)}#${encodeURIComponent(id)}` : pageHref(s.page);
  const prov = s.provisional ? ' <span class="prov">仮</span>' : '';
  const detail = info.reason
    ? escapeHtml(info.reason)
    : info.tests.length
      ? `<ul>${info.tests.map(testItem).join('')}</ul>`
      : '';
  return (
    `<tr><td class="l${s.level}"><a href="${href}">${escapeHtml(s.heading)}</a>${prov}</td>` +
    `<td><span class="badge ${info.state}">${STATE_LABELS[info.state]}</span></td><td>${detail}</td></tr>`
  );
}

function pageSection(page, states, anchors) {
  const counts = STATES.map((st) => {
    const n = page.sections.filter((s) => states.get(s.tag).state === st).length;
    return `${STATE_LABELS[st]} ${n}`;
  }).join('・');
  const prov = page.pageProvisional ? ' <span class="prov">仮</span>' : '';
  const rows = page.sections.map((s) => sectionRow(s, states.get(s.tag), anchors)).join('\n');
  const table = rows
    ? `<table>\n<thead><tr><th>節</th><th>状態</th><th>確かめるテスト／対象外の理由</th></tr></thead>\n<tbody>\n${rows}\n</tbody></table>`
    : '<p class="meta">節（## ###）がありません。</p>';
  return (
    `<h2><a href="${pageHref(page.page)}">${escapeHtml(page.pageTitle)}</a>${prov}</h2>\n` +
    `<p class="meta">${counts}</p>\n${table}`
  );
}

const EXTRA_CSS = `td.l3 { padding-left:1.8em; } td.l3::before { content:"└ "; color:var(--muted); }
.prov { font-size:.75rem; border:1px solid var(--stopped); color:var(--stopped); border-radius:4px; padding:0 4px; white-space:nowrap; }
h2 .prov { vertical-align:middle; }`;

/** ページの HTML を組み立てる。anchors は Map<ページ, readAnchors の結果>（無い・null ならページへのリンク） */
export function buildRuleReportHtml({
  pages,
  states,
  fileFailures,
  missingPackages,
  unmatched,
  anchors,
  generatedAt,
  sha,
}) {
  const notices = [];
  if (missingPackages.length)
    notices.push(
      `<p class="notice">Vitest の結果が読めないパッケージがあります。結果なし：${missingPackages.map(escapeHtml).join('、')}（そのパッケージのテストは、どの節にも出ません）。</p>`,
    );
  if (fileFailures.length)
    notices.push(
      `<div class="notice"><p>収集で落ちたファイル（タグの打ち間違いなど。そのファイルのテストは節に出ず、「テストなし」に見えます）：</p><ul>${fileFailures
        .map(
          (f) =>
            `<li>${escapeHtml(f.pkg)}：${escapeHtml(f.file)}<br><code>${escapeHtml(f.message.split('\n')[0])}</code></li>`,
        )
        .join('')}</ul></div>`,
    );
  const body = [
    ...pages.map((p) => pageSection(p, states, anchors.get(p.page) ?? null)),
    ...(unmatched.length
      ? [
          `<h2>当たらないタグ</h2>\n<ul>${unmatched.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`,
        ]
      : []),
  ].join('\n');
  const meta = [
    `生成：${escapeHtml(generatedAt)}`,
    sha ? `コミット：${escapeHtml(String(sha).slice(0, 7))}` : null,
  ]
    .filter(Boolean)
    .join(' ／ ');
  return reportPage({
    title: 'ルールとテストの結果',
    lead:
      'ルールのページ（<a href="../cartagraph/">カルタグラフ</a>）の節ごとに、それを確かめる Vitest のテストの最新の結果。' +
      '「確認済」は、その節のタグを付けたテストが通ったという意味で、節に書いたことを全部確かめたという意味ではない。' +
      '「対象外」は<a href="../architecture/rule-test-exclusions.html">対象外の一覧</a>で宣言した節。' +
      'テストはパッケージごとの Vitest のレポートへ飛べる（<a href="../architecture/test-report.html">テストレポート</a>）。',
    meta,
    notice: notices.join('\n'),
    body,
    extraCss: EXTRA_CSS,
  });
}

/** JSON を読む。無い・壊れている・形が違うときは null */
export function readResults(file) {
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(json?.testResults) ? json : null;
  } catch {
    return null;
  }
}

export const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

/** ファイルを読んでページを書く。戻り値は書いたファイルと状態の数 */
export function main({
  root = ROOT,
  out = join(root, 'rule-test-report/index.html'),
  pages = readRulePages(),
  exclusions = readExclusions(),
} = {}) {
  const results = Object.fromEntries(
    PACKAGES.map((p) => [p.name, readResults(join(root, p.dir, RESULTS))]),
  );
  const missingPackages = PACKAGES.map((p) => p.name).filter((name) => results[name] === null);
  const tests = collectTests(results);
  const dist = join(root, DIST_CARTAGRAPH);
  const anchors = new Map(
    pages.map((p) => [p.page, readAnchors(readText(join(dist, `${p.page}.html`)))]),
  );
  const ordered = orderPages(pages, readSidebarOrder(readText(join(dist, 'index.html'))));
  const states = computeSectionStates({ pages: ordered, exclusions, tests });
  const html = buildRuleReportHtml({
    pages: ordered,
    states,
    fileFailures: collectFileFailures(results),
    missingPackages,
    unmatched: unmatchedRuleTags(tests, pages),
    anchors,
    generatedAt: new Date().toISOString(),
    sha: process.env.GITHUB_SHA,
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  const count = (s) => [...states.values()].filter((v) => v.state === s).length;
  return { out, counts: Object.fromEntries(STATES.map((s) => [s, count(s)])) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const root = arg('--root');
  const { out, counts } = main({
    ...(root ? { root } : {}),
    ...(arg('--out') ? { out: arg('--out') } : {}),
  });
  console.log(
    `${out} を作りました（${STATES.map((s) => `${STATE_LABELS[s]} ${counts[s]}`).join('・')}）`,
  );
}
