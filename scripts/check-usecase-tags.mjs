// E2E のテストに付けたユースケースの ID（タグ・ステップの題）が、docs/architecture/use-cases.md の表と
// 食い違っていないかを確かめる（pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// 結果のページ（scripts/build-usecase-report.mjs）は、表の ID とテストの ID を突き合わせて作るので、
// ID の打ち間違いや書き方の揺れが、黙って「テストなし」「通った」に見えるのを機械で止める。
//
// 確かめること
// - タグ・ステップの ID が、表にある
// - ID の形に似ているが形の違うタグ・ステップ（小文字 `@sc-1`）が無い。ID でないタグ（`@slow`）は見ない
// - apps/web/e2e/usecases/ のテストで、タグとステップの ID がそろっている、ステップの題が文字列の直書き、
//   題や describe にタグを付けていない、skip・fixme・expect.soft が無い、1ファイルに test が1本だけ
// 確かめないこと：テストの無いユースケース（ページで「テストなし」と出す）、E2E の中身が正しいか
//
// 使い方: node scripts/check-usecase-tags.mjs
// テストは scripts/check-usecase-tags.test.mjs（pnpm tools:test）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseTestFile,
  parseUseCases,
  readE2eTestFiles,
  USE_CASES_FILE,
  USECASE_TEST_DIR,
} from './usecases.mjs';

/** どのテストのファイルにも当てる検査：ID が表にある、形が合っている */
function commonProblems(t, known) {
  return [
    ...[...new Set(t.tags)]
      .filter((id) => !known.has(id))
      .map((id) => `タグ @${id} は、${USE_CASES_FILE} の表に無い ID`),
    ...[...new Set(t.stepIds)]
      .filter((id) => !known.has(id))
      .map((id) => `ステップの ID ${id} は、${USE_CASES_FILE} の表に無い`),
    ...t.badTags.map((tag) => `タグ ${tag} は ID の形（大文字2字-数字。例：@SC-1）と違う`),
    ...t.badSteps.map((title) => `ステップ '${title}' の ID は大文字2字-数字（例：SC-1）で書く`),
  ];
}

/** ユースケースの通し（usecases/）だけに当てる検査：タグとステップの突き合わせと、書き方の制限 */
function usecaseProblems(t) {
  const tagSet = new Set(t.tags);
  const stepSet = new Set(t.stepIds);
  const problems = [
    ...[...tagSet]
      .filter((id) => !stepSet.has(id))
      .map((id) => `タグ @${id} に対応するステップ（test.step('${id} …')）が無い`),
    ...[...stepSet]
      .filter((id) => !tagSet.has(id))
      .map((id) => `ステップの ID ${id} に対応するタグ（tag: ['@${id}']）が無い`),
    ...[...new Set(t.forbidden)].map(
      (word) => `${word} は使わない（skip したステップは結果で「通った」に見える）`,
    ),
  ];
  if (t.nonLiteralSteps > 0) {
    problems.push(
      `test.step の最初の引数が文字列の直書きでない（テンプレート文字列・変数）ものが ${t.nonLiteralSteps} 件ある。静的に読めないので直書きにする`,
    );
  }
  if (t.titleTagged) problems.push('テストの題の中にタグ（@SC-1 など）がある。tag: [...] に書く');
  if (t.describeTagged)
    problems.push('test.describe にタグを付けている。test の tag: [...] に書く');
  if (t.testCount > 1) {
    problems.push(`test が ${t.testCount} 本ある。ユースケースの E2E は1ファイルに1本だけ置く`);
  }
  return problems;
}

/** 食い違いを、人が読むメッセージの配列で返す（無ければ空） */
export function findUsecaseTagProblems({ useCasesMd, files }) {
  const known = new Set(parseUseCases(useCasesMd).map((u) => u.id));
  return files.flatMap(({ path, source }) => {
    const t = parseTestFile(source);
    const found = [
      ...commonProblems(t, known),
      ...(path.includes(USECASE_TEST_DIR) ? usecaseProblems(t) : []),
    ];
    return found.map((msg) => `${path}: ${msg}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = readE2eTestFiles();
  const problems = findUsecaseTagProblems({
    useCasesMd: readFileSync(USE_CASES_FILE, 'utf8'),
    files,
  });
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error(
      `E2E のユースケースのタグ・ステップに誤りが ${problems.length} 件あります（書き方は docs/process/rules/testing.md「ユースケースの E2E」）`,
    );
    process.exit(1);
  }
  console.log(
    `E2E のユースケースのタグ・ステップが ${USE_CASES_FILE} と一致しています（テスト ${files.length} ファイル）`,
  );
}
