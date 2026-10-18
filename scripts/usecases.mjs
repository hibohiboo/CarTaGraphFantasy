// 中核のユースケース（docs/architecture/use-cases.md の表）と、E2E のテスト（apps/web/e2e/**/*.test.ts）に付けた
// ユースケースの ID（タグ・ステップの題）を読む関数。検査（check-usecase-tags.mjs）と、結果のページを作る
// スクリプト（build-usecase-report.mjs）が共用する。書き方の正は docs/process/rules/testing.md「ユースケースの E2E」。

import { readdirSync, readFileSync } from 'node:fs';

export const USE_CASES_FILE = 'docs/architecture/use-cases.md';
export const E2E_DIR = 'apps/web/e2e';
/** ユースケースの通しを置くディレクトリ。ここのテストだけ、タグとステップの突き合わせ・書き方の制限を検査する */
export const USECASE_TEST_DIR = 'apps/web/e2e/usecases/';

export const ID_RE = /^[A-Z]{2}-\d+$/;
/** ステップの題の先頭の ID（`SC-1 下書きを作る`）。ID の後ろに空白が要る */
export const STEP_ID_RE = /^([A-Z]{2}-\d+)\s/;

/**
 * use-cases.md の表の行から [{ id, name, domain, future }] を読む。
 * 5列（SC・PL）と4列（GR・EV）の両方を読む。ヘッダ・区切りの行（ID 列が ID の形でない）と、表でない行は読まない。
 * 1件も読めない・同じ ID が2回出るときは誤りにする（表の形が変わって黙って空になるのを止める）。
 */
export function parseUseCases(md) {
  const found = [];
  let domain = '';
  let future = false;
  for (const line of md.split('\n')) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      future = heading[1].includes('（将来）');
      domain = heading[1].replace('（将来）', '').trim();
      continue;
    }
    const row = line.match(/^\|\s*([A-Z]{2}-\d+)\s*\|\s*([^|]+?)\s*\|/);
    if (row) found.push({ id: row[1], name: row[2], domain, future });
  }
  if (found.length === 0) {
    throw new Error(`${USE_CASES_FILE} の表からユースケースを1件も読めない（表の形が変わった？）`);
  }
  const seen = new Set();
  for (const { id } of found) {
    if (seen.has(id)) throw new Error(`${USE_CASES_FILE} の表に ${id} が2回出ている`);
    seen.add(id);
  }
  return found;
}

/** コメント（行コメント・ブロックコメント）を、行数を変えずに空にする */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(?<![:'"`\w])\/\/.*$/gm, '');
}

const TAG_TOKEN_RE = /@([A-Za-z0-9_-]+)/g;
const LOOKS_LIKE_ID_RE = /^[A-Za-z]{2}-\d+$/;

/**
 * テストのファイルから、ユースケースに関わる書き方を読む。
 * - tags: `tag:` に書いた ID のタグ（`@SC-1` → `SC-1`）。ID でないタグ（`@slow`）は読まない
 * - badTags: ID の形に似ているが形の違うタグ（`@sc-1`）
 * - stepIds: `test.step('SC-1 …')` の題の先頭の ID。badSteps は形の違うもの（`sc-1 …`）
 * - nonLiteralSteps: 最初の引数が文字列の直書きでない `test.step(`（テンプレート文字列・変数）の数
 * - titleTagged / describeTagged: 題の中のタグ（`test('… @SC-1')`）・`test.describe` へのタグ（静的に読まないので禁じる）
 * - forbidden: skip・fixme・`expect.soft`（skip したステップは結果で「通った」に見えるため）
 * - testCount: `test(` の数
 */
export function parseTestFile(source) {
  const code = stripComments(source);
  const titleTagged = [
    ...code.matchAll(/(?<![.\w])test\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g),
  ].some((m) => /@[A-Za-z]{2}-\d+/.test(m[2]));
  const forbidden = [
    ...code.matchAll(
      /\b(test(?:\.describe|\.step)?\.(?:skip|fixme|only|fail|slow)|expect\.soft)\b/g,
    ),
  ].map((m) => m[1]);
  const testCount = [...code.matchAll(/(?<![.\w])test\(/g)].length;

  return { ...readTags(code), ...readSteps(code), titleTagged, forbidden, testCount };
}

/** `tag:` に書いたタグを読む。tags は ID のタグ、badTags は形の違うタグ、describeTagged は test.describe に付いたタグがあるか */
function readTags(code) {
  const tags = [];
  const badTags = [];
  let describeTagged = false;
  const callRe = /(?<![.\w])(test|test\.describe)(?:\.(?:parallel|serial))?\(/g;
  const calls = [...code.matchAll(callRe)].map((m) => ({ index: m.index, kind: m[1] }));
  for (const m of code.matchAll(/\btag:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
    for (const [, token] of m[1].matchAll(TAG_TOKEN_RE)) {
      if (ID_RE.test(token)) tags.push(token);
      else if (LOOKS_LIKE_ID_RE.test(token)) badTags.push(`@${token}`);
    }
    const owner = calls.filter((c) => c.index < m.index).at(-1);
    if (owner?.kind === 'test.describe') describeTagged = true;
  }
  return { tags, badTags, describeTagged };
}

/** `test.step(` の題を読む。直書きでないものは数だけ数える */
function readSteps(code) {
  const stepIds = [];
  const badSteps = [];
  let nonLiteralSteps = 0;
  for (const m of code.matchAll(/test\.step\(\s*/g)) {
    const rest = code.slice(m.index + m[0].length);
    const literal = rest.match(/^(['"])((?:\\.|(?!\1)[^\\\n])*)\1/);
    if (!literal) {
      nonLiteralSteps++;
      continue;
    }
    const title = literal[2];
    const id = title.match(STEP_ID_RE);
    if (id) stepIds.push(id[1]);
    else if (/^[A-Za-z]{2}-\d+\s/.test(title)) badSteps.push(title);
  }
  return { stepIds, badSteps, nonLiteralSteps };
}

/** apps/web/e2e 以下の *.test.ts を [{ path, source }] で返す（path は / 区切り） */
export function readE2eTestFiles(dir = E2E_DIR) {
  return readdirSync(dir, { recursive: true })
    .map((p) => String(p).replaceAll('\\', '/'))
    .filter((p) => p.endsWith('.test.ts'))
    .sort()
    .map((p) => ({ path: `${dir}/${p}`, source: readFileSync(`${dir}/${p}`, 'utf8') }));
}
