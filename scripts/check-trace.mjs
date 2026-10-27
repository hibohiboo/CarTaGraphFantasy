// 要望の trace（docs/backlog/*.md の frontmatter）と、ユースケースの表の画面・集約・イベントの列が、
// 実在する UC・画面・ルールの節・集約・イベントを指しているかを確かめる（pnpm docs:build に流れる。pre-push・CI でも止まる）。
// 設計は docs/plans/2026-10-26-P5-アイデアから実装までのトレース.md「検査（D22）」。
//
// 確かめること
// - すべての要望に trace があり、形が合っている（形は trace.mjs が見る）
// - usecases の ID が use-cases.md の表にある（将来の UC も可）
// - screens が routes.ts のパスか、導線図のまだ無い画面のラベル
// - rules が実在する節で、対象外の一覧に無い
// - use-cases.md の中核の表（将来を除く）に「画面」の列があり、値が routes.ts のパスか、まだ無い画面のラベル
// - use-cases.md の中核の表の集約・イベントの名前が、aggregates.md の「集約の一覧」「ドメインイベント」にある
// - 同じリストに同じ値が2回出ない
// 確かめないこと：つなぎ方が正しいか（人間が PR で見る）。集約とイベントの対応（起こす集約）は check-events.mjs が見る。
//
// 使い方: node scripts/check-trace.mjs
// テストは scripts/check-trace.test.mjs（pnpm tools:test）。

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseAggregateEvents, parseAggregateNames } from './check-events.mjs';
import { parseMissingScreens, parseRoutes, ROUTES_FILE, SCREENS_FILE } from './check-screens.mjs';
import { findExclusion, readExclusions, readRulePages } from './rule-sections.mjs';
import { BACKLOG_DIR, parseTrace, TRACE_LIST_KEYS } from './trace.mjs';
import { parseUseCases, USE_CASES_FILE } from './usecases.mjs';

const AGGREGATES_FILE = 'docs/architecture/aggregates.md';
/** 中核の表に要る列（見出しの名前で読むので、直して消えると線が黙って消える） */
const REQUIRED_COLUMNS = ['アクター', '画面', '書き換える集約', '起きるイベント'];
const NOWHERE = `${ROUTES_FILE} にも導線図のまだ無い画面にも無い`;

/** 入力（読み込み済みのデータ）から、問題の文の配列を返す（無ければ空） */
export function findTraceProblems({
  backlog,
  useCasesMd,
  routes,
  missingScreens,
  sections,
  exclusions,
  aggregateNames,
  eventNames,
}) {
  const useCases = parseUseCases(useCasesMd);
  const known = {
    ucIds: new Set(useCases.map((u) => u.id)),
    screenNames: new Set([...routes.map((r) => r.path), ...missingScreens]),
    sectionKeys: new Set(sections.map((s) => `${s.page}/${s.heading}`)),
    exclusions,
  };
  return [
    ...backlog.flatMap(({ file, source }) => findBacklogProblems(file, source, known)),
    ...findUseCaseTableProblems({
      useCases,
      screenNames: known.screenNames,
      aggregateNames,
      eventNames,
    }),
  ];
}

/** 要望1件の trace の問題 */
function findBacklogProblems(file, source, known) {
  let trace;
  try {
    trace = parseTrace(source, file);
  } catch (e) {
    return [e.message];
  }
  if (trace === null) {
    return [`${file}: trace が無い（要望には trace を書く。書き方は docs/backlog/index.md）`];
  }
  if (trace.none !== undefined) return [];
  const at = `${file} の trace:`;
  return [
    ...TRACE_LIST_KEYS.flatMap((key) =>
      duplicates(trace[key]).map((v) => `${at} ${key} に ${v} が2回ある`),
    ),
    ...trace.usecases
      .filter((id) => !known.ucIds.has(id))
      .map((id) => `${at} usecases の ${id} が ${USE_CASES_FILE} の表に無い`),
    ...trace.screens
      .filter((s) => !known.screenNames.has(s))
      .map((s) => `${at} screens の ${s} が ${NOWHERE}`),
    ...trace.rules.flatMap((rule) =>
      ruleProblem(rule, known).map((p) => `${at} rules の ${rule} は${p}`),
    ),
  ];
}

/** ルールの節の指し方（`ページ/見出し`）の問題。無ければ空 */
function ruleProblem(rule, { sectionKeys, exclusions }) {
  if (!sectionKeys.has(rule)) return ['実在しない節（ルールのページの見出しに無い）'];
  const [page, ...heading] = rule.split('/');
  if (findExclusion({ page, heading: heading.join('/') }, exclusions)) {
    return ['対象外の節（テストの結果の意味が無い）'];
  }
  return [];
}

/** 2回以上出る値（1回ずつ） */
function duplicates(values) {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

/** use-cases.md の中核の表（将来を除く）の画面・集約・イベントの列の問題 */
function findUseCaseTableProblems({ useCases, screenNames, aggregateNames, eventNames }) {
  const core = useCases.filter((u) => !u.future);
  // 列が無い表（見出しの書き直しで黙って線が消える）。表の単位（業務領域）で1回ずつ知らせる
  const lacking = [
    ...new Set(
      core.flatMap((u) =>
        REQUIRED_COLUMNS.filter((c) => !u.columns.includes(c)).map((c) => `${u.domain}\t${c}`),
      ),
    ),
  ].map((key) => key.split('\t'));
  const at = (u) => `${USE_CASES_FILE} の ${u.id} の`;
  return [
    ...lacking.map(([d, c]) => `${USE_CASES_FILE} の「${d}」の表に「${c}」の列が無い`),
    ...core.flatMap((u) => [
      ...u.screens.filter((s) => !screenNames.has(s)).map((s) => `${at(u)}画面 ${s} が ${NOWHERE}`),
      ...u.aggregates
        .filter((a) => !aggregateNames.includes(a))
        .map((a) => `${at(u)}集約「${a}」が ${AGGREGATES_FILE} の「集約の一覧」に無い`),
      ...u.events
        .filter((e) => !eventNames.includes(e))
        .map((e) => `${at(u)}イベント「${e}」が ${AGGREGATES_FILE} の「ドメインイベント」に無い`),
    ]),
  ];
}

/** 実物のファイルから、findTraceProblems の入力を読む */
export function readTraceInputs() {
  const read = (path) => readFileSync(path, 'utf8');
  const backlog = readdirSync(BACKLOG_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'index.md')
    .sort()
    .map((f) => ({ file: `${BACKLOG_DIR}/${f}`, source: read(`${BACKLOG_DIR}/${f}`) }));
  const aggregatesMd = read(AGGREGATES_FILE);
  return {
    backlog,
    useCasesMd: read(USE_CASES_FILE),
    routes: parseRoutes(read(ROUTES_FILE)),
    missingScreens: parseMissingScreens(read(SCREENS_FILE)),
    sections: readRulePages().flatMap((p) => p.sections),
    exclusions: readExclusions(),
    aggregateNames: parseAggregateNames(aggregatesMd),
    eventNames: parseAggregateEvents(aggregatesMd).map((e) => e.event),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let inputs;
  try {
    inputs = readTraceInputs();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const problems = findTraceProblems(inputs);
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error(
      `要望の trace・ユースケースの表の画面・集約・イベントに ${problems.length} 件の問題があります`,
    );
    process.exit(1);
  }
  console.log(
    `要望 ${inputs.backlog.length} 件の trace と、ユースケースの表の画面・集約・イベントが、実在するものを指しています`,
  );
}
