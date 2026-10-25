// 設計文書どうしで、ドメインイベントの名前と起こす集約が食い違っていないかを確かめる
// （pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// 集約のページ（aggregates.md）を正として、イベントの流れ（event-flows.md）と実装パターン（implementation-patterns.md）が
// 同じイベント名・同じ集約で書いているかを機械で止める（2026-10-17、ドメイン駆動設計の適用で同じ種類の食い違いが2回起きた）。
//
// 確かめること
// - aggregates.md のドメインイベントの表の各イベントが、event-flows.md の表に載っている
// - 両方にあるイベントは、起こす集約が合っている（event-flows.md の集約が「（」で始まる行は、複数の集約をまたぐので見ない）
// - implementation-patterns.md「イベントの種類」の表のイベントは、aggregates.md か event-flows.md にある（「ほかのイベント」は見ない）
//
// 使い方: node scripts/check-events.mjs
// テストは scripts/check-events.test.mjs（pnpm tools:test）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = 'docs/architecture';

/** 見出し（# で始まる行）から次の同じ階層以上の見出しまでの本文。無ければ空文字 */
function section(md, heading) {
  const lines = md.split('\n');
  const start = lines.findIndex(
    (l) => /^#{1,6} /.test(l) && l.replace(/^#+ /, '').trim() === heading,
  );
  if (start < 0) return '';
  const level = lines[start].match(/^#+/)[0].length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => {
    const m = l.match(/^(#+) /);
    return m && m[1].length <= level;
  });
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** 表の行（| で始まる行）を、セルの配列にする。見出し行と区切り行は除く */
function tableRows(md) {
  return md
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) =>
      l
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    )
    .filter((cells) => !cells.every((c) => /^-+$/.test(c)))
    .slice(1);
}

/** 集約のセル（例「募集（ソロ開始は…）」）から、先頭の集約名を取る */
function aggregateName(cell) {
  return cell.replace(/（.*$/, '').trim();
}

/** aggregates.md の「ドメインイベント」の表を { event, aggregate } の配列にする */
export function parseAggregateEvents(md) {
  return tableRows(section(md, 'ドメインイベント')).map((c) => ({
    event: c[0],
    aggregate: aggregateName(c[1] ?? ''),
  }));
}

/** aggregates.md の「集約の一覧」の表から、{ context（コンテキスト）, name（集約） } を読む */
export function parseAggregateList(md) {
  return tableRows(section(md, '集約の一覧')).map((c) => ({
    context: c[0] ?? '',
    name: c[1] ?? '',
  }));
}

/** aggregates.md の「集約の一覧」の表から、集約の名前（2列目）を読む */
export function parseAggregateNames(md) {
  return parseAggregateList(md).map((a) => a.name);
}

/** event-flows.md の流れの表（イベントの列を持つ表）を { event, aggregate } の配列にする。1行に複数のイベントは「・」で分ける */
export function parseFlowEvents(md) {
  const out = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const c = line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((x) => x.trim());
    if (c.length < 5 || c[3] === 'イベント' || /^-+$/.test(c[3])) continue;
    for (const event of c[3].split('・')) {
      if (event && event !== '—') out.push({ event, aggregate: c[2] });
    }
  }
  return out;
}

/** implementation-patterns.md「イベントの種類」の表のイベント名 */
export function parsePatternEvents(md) {
  return tableRows(section(md, 'イベントの種類'))
    .map((c) => c[0])
    .filter((e) => e && e !== 'ほかのイベント');
}

/** 食い違いを、人が読むメッセージの配列で返す（無ければ空） */
export function findEventMismatches({ aggregates, flows, patterns }) {
  const agg = parseAggregateEvents(aggregates);
  const flow = parseFlowEvents(flows);
  const errors = [];
  const flowNames = new Set(flow.map((f) => f.event));
  for (const a of agg) {
    if (!flowNames.has(a.event))
      errors.push(`aggregates.md のイベント「${a.event}」が event-flows.md の流れに無い`);
  }
  for (const a of agg) {
    for (const f of flow.filter((x) => x.event === a.event && !x.aggregate.startsWith('（'))) {
      if (f.aggregate !== a.aggregate)
        errors.push(
          `イベント「${a.event}」を起こす集約が食い違う（aggregates.md は「${a.aggregate}」、event-flows.md は「${f.aggregate}」）`,
        );
    }
  }
  const known = new Set([...agg.map((a) => a.event), ...flowNames]);
  for (const e of parsePatternEvents(patterns)) {
    if (!known.has(e))
      errors.push(
        `implementation-patterns.md「イベントの種類」のイベント「${e}」が aggregates.md にも event-flows.md にも無い`,
      );
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (f) => readFileSync(`${DIR}/${f}`, 'utf8');
  const found = findEventMismatches({
    aggregates: read('aggregates.md'),
    flows: read('event-flows.md'),
    patterns: read('implementation-patterns.md'),
  });
  if (found.length) {
    for (const f of found) console.error(f);
    console.error(`設計文書どうしのイベントの食い違いが ${found.length} 件あります`);
    process.exit(1);
  }
  const n = parseAggregateEvents(read('aggregates.md')).length;
  console.log(
    `ドメインイベント ${n} 件が、集約・イベントの流れ・実装パターンの文書で一致しています`,
  );
}
