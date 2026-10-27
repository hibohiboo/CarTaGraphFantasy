// E2E のテストに付けたユースケースの ID（タグ・ステップの題）が、docs/architecture/use-cases.md の表と
// 食い違っていないかを確かめる（pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// 結果のページ（scripts/build-usecase-report.mjs）は、表の ID とテストの ID を突き合わせて作るので、
// ID の打ち間違いや書き方の揺れが、黙って「テストなし」「通った」に見えるのを機械で止める。
//
// 確かめること
// - タグ・ステップの ID が、表にある
// - ID の形に似ているが形の違うタグ・ステップ（小文字 `@sc-1`）が無い。ID でないタグ（`@slow`）は見ない
// - apps/web/e2e/usecases/ のテストで、タグとステップの ID がそろっている、ステップの題が文字列の直書き、
//   題や describe にタグを付けていない、fixme・expect.soft・条件付きの skip が無い、1ファイルに test が1本だけ
// - スキップは apps/web/e2e/usecases/ の宣言の形（test.skip('題', { tag, annotation }, fn)）だけで、直す要望の注記
//   （type: 'backlog'）がちょうど1つあり、その要望が実在して開いていて、trace.usecases にスキップしたテストのタグの UC がある。
//   スキップしていないテストに直す要望の注記・noSkippedTests の抑制コメントが残っていない。
//   e2e/usecases/ の外（smoke）ではスキップしない（docs/plans/2026-10-27-P6-不安定なE2Eのスキップ.md）
// 確かめないこと：テストの無いユースケース（ページで「テストなし」と出す）、E2E の中身が正しいか、抑制コメントの理由の文言
//
// 使い方: node scripts/check-usecase-tags.mjs
// テストは scripts/check-usecase-tags.test.mjs（pnpm tools:test）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readBacklog } from './trace.mjs';
import {
  parseTestFile,
  parseUseCases,
  readE2eTestFiles,
  USE_CASES_FILE,
  USECASE_TEST_DIR,
} from './usecases.mjs';

/**
 * 直す要望として「開いている」状態（D16）。通す側の一覧で判定し、空・打ち間違いの状態は止める。
 * branch-id.mjs の OPEN_BACKLOG_STATUSES（後片付けの漏れを探す別の用途。進行中を含まない）とは共有しない
 */
export const FIXABLE_BACKLOG_STATUSES = ['未着手', '検討中', '進行中', '判断待ち'];

/** 直す要望の注記の description の形（docs/backlog/<名前>.md。名前は / \ を含まず index でない） */
const BACKLOG_PATH_RE = /^docs\/backlog\/([^/\\]+)\.md$/;

const UNSKIP =
  'test.skip を test に戻し、annotation の backlog の注記と biome-ignore の抑制コメントを消す';

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

/** e2e/usecases/ の外（smoke）の検査：スキップと直す要望の注記を使わない（D2） */
function outsideProblems(t) {
  const words = t.forbidden.filter((w) =>
    ['test.skip', 'test.fixme', 'test.describe.skip'].includes(w),
  );
  if (t.skips.length === 0 && words.length === 0 && t.backlogs.length === 0) return [];
  return [
    'e2e/usecases/ の外では、スキップ（test.skip・test.fixme・test.describe.skip）と直す要望の注記を使わない（smoke が落ちるのは画面の不具合の合図なので、スキップで逃がさず直す）',
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
    ...[...new Set(t.forbidden)].map((word) =>
      word === 'test.skip'
        ? "test.skip は宣言の形（test.skip('題', { tag, annotation }, fn)。題は文字列の直書き）でだけ使う。本文の中の条件付きのスキップは使わない"
        : `${word} は使わない（skip したステップは結果で「通った」に見える）`,
    ),
  ];
  // 走らなかったステップは結果に記録されない。同じ ID が2つあると、1つ目が通っただけで「通った」に見える
  const duplicated = [...stepSet].filter((id) => t.stepIds.filter((x) => x === id).length > 1);
  for (const id of duplicated) {
    problems.push(`ステップの ID ${id} が複数ある。同じ ID のステップは1つにまとめる`);
  }
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

/** スキップの書き方の検査（注記の数・直書き・消し忘れ） */
function skipShapeProblems(t) {
  const problems = [];
  for (const { backlogCount } of t.skips) {
    if (backlogCount === 0) {
      problems.push(
        "test.skip に直す要望の注記（annotation: { type: 'backlog', description: 'docs/backlog/<名前>.md' }）が無い",
      );
    } else if (backlogCount > 1) {
      problems.push(
        `test.skip に直す要望の注記（type: 'backlog'）が ${backlogCount} 個ある。1つにする`,
      );
    }
  }
  if (t.backlogs.some((b) => !b.skipped)) {
    problems.push(
      "スキップしていないテストに直す要望の注記（type: 'backlog'）がある。スキップを外したら注記も消す",
    );
  }
  if (t.unreadableAnnotations > 0) {
    problems.push(
      `annotation・type・description が文字列の直書きでないものが ${t.unreadableAnnotations} 件ある。静的に読めないので直書きにする`,
    );
  }
  if (t.danglingSkipSuppressions > 0) {
    problems.push(
      'noSkippedTests の抑制コメント（biome-ignore）の次が宣言の test.skip( でない。スキップを外したら抑制コメントも消す',
    );
  }
  return problems;
}

/** スキップしたテストの直す要望の検査（形・実在・開いているか・trace.usecases）。backlog が無ければ要望を読まない */
function backlogProblems(t, backlog) {
  const skippedNotes = t.backlogs.filter((b) => b.skipped);
  if (skippedNotes.length === 0) return [];
  if (!backlog) return ['直す要望の注記があるのに、要望の一覧（docs/backlog/）が渡されていない'];
  return skippedNotes.flatMap(({ description }) => {
    const name = description?.match(BACKLOG_PATH_RE)?.[1];
    if (!name || name === 'index') {
      return [
        `直す要望の注記の description '${description ?? ''}' は docs/backlog/<名前>.md の形で書く`,
      ];
    }
    const item = backlog.find((b) => b.name === name);
    if (!item) return [`直す要望 ${description} が無い`];
    if (!FIXABLE_BACKLOG_STATUSES.includes(item.status)) {
      return [
        `直す要望 ${description} の状態が「${item.status}」で開いていない（開いているのは ${FIXABLE_BACKLOG_STATUSES.join('・')}）。` +
          `要望を閉じる前に、このファイルのスキップを外す（${UNSKIP}）か、テストを消す`,
      ];
    }
    const missing = [...new Set(t.tags)].filter((id) => !(item.trace.usecases ?? []).includes(id));
    return missing.length > 0
      ? [
          `直す要望 ${description} の trace.usecases に、スキップしたテストのタグ ${missing.map((id) => `@${id}`).join('・')} が無い（トレースでその要望を全スキップと出すため）`,
        ]
      : [];
  });
}

/**
 * 食い違いを、人が読むメッセージの配列で返す（無ければ空）。
 * backlog は要望の一覧（trace.mjs の readBacklog の { name, status, trace }）。渡さなければ要望を読まず、直す要望の注記があれば止める
 */
export function findUsecaseTagProblems({ useCasesMd, files, backlog }) {
  const known = new Set(parseUseCases(useCasesMd).map((u) => u.id));
  return files.flatMap(({ path, source }) => {
    const t = parseTestFile(source);
    const found = [
      ...commonProblems(t, known),
      ...(path.includes(USECASE_TEST_DIR)
        ? [...usecaseProblems(t), ...skipShapeProblems(t), ...backlogProblems(t, backlog)]
        : outsideProblems(t)),
    ];
    return found.map((msg) => `${path}: ${msg}`);
  });
}

/** 通ったときのメッセージ。スキップが残っていることを目に入れる（D18） */
export function successMessage(files) {
  const skips = files.reduce((n, { source }) => n + parseTestFile(source).skips.length, 0);
  return `E2E のユースケースのタグ・ステップが ${USE_CASES_FILE} と一致しています（テスト ${files.length} ファイル・スキップ中 ${skips} 件）`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = readE2eTestFiles();
  const problems = findUsecaseTagProblems({
    useCasesMd: readFileSync(USE_CASES_FILE, 'utf8'),
    files,
    backlog: readBacklog(),
  });
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error(
      `E2E のユースケースのタグ・ステップに誤りが ${problems.length} 件あります（書き方は docs/process/rules/testing.md「ユースケースの E2E」）`,
    );
    process.exit(1);
  }
  console.log(successMessage(files));
}
