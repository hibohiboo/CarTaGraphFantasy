// ルールのテストの対象外の一覧（docs/architecture/rule-test-exclusions.md）が、ルールのページの見出しと食い違っていないかを確かめる
// （pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。見出しを直したのに一覧を直し忘れて、宣言が黙って効かなくなるのを止める。
// 対象外の節にタグを付けたテストは、タグの一覧（scripts/rule-sections.mjs の vitestTags）から外れるので Vitest が止める。ここでは見ない。
//
// 確かめること
// - 表のページ・節が実在する（節が空ならページ全体）
// - 同じ節が2回出ない。ページ全体の行と、そのページの節の行が並ばない
// - 理由が空でない
// - ルールのページの見出しが読める（rule-sections.mjs の例外もここで止まる。docs だけを直す人が気づけるように）
//
// 使い方: node scripts/check-rule-test-exclusions.mjs
// テストは scripts/check-rule-test-exclusions.test.mjs（pnpm tools:test）。

import { fileURLToPath } from 'node:url';
import { readExclusions, readRulePages } from './rule-sections.mjs';

/** [{ page, sections: [{ heading }] }] と対象外の一覧から、問題の文の配列を返す（無ければ空） */
export function findExclusionProblems({ pages, exclusions }) {
  const byPage = new Map(pages.map((p) => [p.page, p]));
  const seen = new Set();
  const rowProblems = exclusions.flatMap((e) => {
    const key = `${e.page}\u0000${e.heading ?? ''}`;
    const duplicated = seen.has(key);
    seen.add(key);
    return rowProblem(e, byPage.get(e.page), duplicated);
  });
  const mixed = exclusions
    .filter(
      (e) => e.heading === null && exclusions.some((o) => o.page === e.page && o.heading !== null),
    )
    .map(
      (e) =>
        `${e.page}：ページ全体の行と節の行が並んでいる（ページ全体の行だけにするか、節の行だけにする）`,
    );
  return [...rowProblems, ...mixed];
}

/** 表の1行の問題（page はその行のページ。無ければ undefined）。無ければ空の配列 */
function rowProblem(e, page, duplicated) {
  const label = `${e.page}${e.heading ? `「${e.heading}」` : '（ページ全体）'}`;
  if (!page) return [`${label}：その名前のルールのページが無い（docs/cartagraph/${e.page}.md）`];
  const problems = [];
  if (e.heading !== null && !page.sections.some((s) => s.heading === e.heading))
    problems.push(`${label}：${e.page}.md にその見出しが無い（直した？消した？）`);
  if (!e.reason) problems.push(`${label}：理由が空`);
  if (duplicated) problems.push(`${label}：同じ行が2回ある`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let pages;
  let exclusions;
  try {
    pages = readRulePages();
    exclusions = readExclusions();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const problems = findExclusionProblems({ pages, exclusions });
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error(`ルールのテストの対象外の一覧に ${problems.length} 件の問題があります`);
    process.exit(1);
  }
  console.log(
    `ルールのテストの対象外の一覧（${exclusions.length} 行）がルールのページの見出しと一致しています`,
  );
}
