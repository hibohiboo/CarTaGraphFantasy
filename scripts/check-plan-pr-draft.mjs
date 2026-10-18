// プランの「PR 下書き」に、プランで決めたテストと確かめの手順が漏れていないかを確かめる
// （pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// プランに書いた手順・成果物を、PR で黙って落とすことが2回起きた（2026-10-17 C3 の browser-check・web:check:*、
// 2026-10-18 P2 の T18 の対応表）ため、PR 下書きにそれぞれの「済んだ」か「やらない理由」を書かせる。
//
// 確かめること（「PR 下書き」の節があるプランだけ。まだ PR の段に来ていないプランは見ない）
// - 「新規テストケース」の節の表の T<番号> が、PR 下書きに出てくる（「T1〜T17」の範囲で書いてもよい）
// - 「実装順」の節に出てくる `browser-check`・`web:check:<名前>` が、PR 下書きに出てくる
// 出てくるかだけを見る。済んだか・やらない理由かは書き手が添える。
//
// 対象は START 以降の日付のプラン（それより前のプランは書き方がそろっていないので見ない）。
//
// 使い方: node scripts/check-plan-pr-draft.mjs
// テストは scripts/check-plan-pr-draft.test.mjs（pnpm tools:test）。

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = 'docs/plans';
export const START = '2026-10-19';

/** 見出しに word を含む `## ` の節の本文（次の `## ` まで）。無ければ null */
export function sectionContaining(md, word) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^## /.test(l) && l.includes(word));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** 表の行の最初のセルが T<番号> のものの番号 */
export function definedTests(section) {
  const out = [];
  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*T(\d+)\s*\|/);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

/** 本文に出てくる T<番号> と、「T1〜T17」の範囲が含む番号 */
export function mentionedTests(text) {
  const out = new Set();
  for (const m of text.matchAll(/(?<![A-Za-z])T(\d+)\s*[〜～~]\s*T(\d+)/g)) {
    for (let n = Number(m[1]); n <= Number(m[2]); n++) out.add(n);
  }
  for (const m of text.matchAll(/(?<![A-Za-z])T(\d+)/g)) out.add(Number(m[1]));
  return out;
}

/** 本文に出てくる browser-check と web:check:<名前> */
export function checkCommands(text) {
  const out = new Set();
  if (text.includes('browser-check')) out.add('browser-check');
  for (const m of text.matchAll(/web:check:[a-z][a-z-]*/g)) out.add(m[0]);
  return out;
}

/** 1つのプランの漏れを、人が読むメッセージの配列で返す（無ければ空） */
export function findDraftOmissions(md) {
  const draft = sectionContaining(md, 'PR 下書き');
  if (draft === null) return [];
  const problems = [];
  const mentioned = mentionedTests(draft);
  for (const n of definedTests(sectionContaining(md, '新規テストケース') ?? '')) {
    if (!mentioned.has(n)) problems.push(`T${n}`);
  }
  for (const c of checkCommands(sectionContaining(md, '実装順') ?? '')) {
    if (!draft.includes(c)) problems.push(c);
  }
  return problems;
}

/** ファイル名の先頭の日付が START 以降のプランか */
export function isTarget(file) {
  const m = file.match(/^(\d{4}-\d{2}-\d{2})-.*\.md$/);
  return m !== null && m[1] >= START;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = readdirSync(DIR).filter(isTarget);
  let failed = 0;
  for (const f of files) {
    const found = findDraftOmissions(readFileSync(`${DIR}/${f}`, 'utf8'));
    if (found.length) {
      failed++;
      console.error(
        `${DIR}/${f}: PR 下書きに ${found.join('・')} がありません（済んだか、やらない理由を書く）`,
      );
    }
  }
  if (failed) {
    console.error(`PR 下書きの漏れがあるプランが ${failed} 件あります`);
    process.exit(1);
  }
  console.log(
    `プランの PR 下書きに、テストの番号と実装順の確かめの手順が漏れていません（${START} 以降のプラン ${files.length} 件）`,
  );
}
