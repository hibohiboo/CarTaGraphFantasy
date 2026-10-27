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
  let headers = [];
  for (const line of md.split('\n')) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      future = heading[1].includes('（将来）');
      domain = heading[1].replace('（将来）', '').trim();
      headers = [];
      continue;
    }
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells[0] === 'ID') {
      headers = cells;
      continue;
    }
    if (!ID_RE.test(cells[0] ?? '') || cells.length < 2) continue;
    found.push(readRow(cells, headers, { domain, future }));
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

/** 表の1行を読む。列は見出しの名前で探す（位置で読まない）。見出しに無い列は空 */
function readRow(cells, headers, { domain, future }) {
  const cell = (name) => cells[headers.indexOf(name)] ?? '';
  return {
    id: cells[0],
    name: headers.includes('ユースケース') ? cell('ユースケース') : cells[1],
    domain,
    future,
    columns: headers,
    screens: splitList(cell('画面')).map((s) => s.replace(/^`|`$/g, '')),
    // 列が無いときに「システム」にしない（列を足し損ねた表は check-trace.mjs が止める）
    actors: headers.includes('アクター') ? normalizeActors(cell('アクター')) : [],
    aggregates: splitList(cell('書き換える集約')),
    events: splitList(cell('起きるイベント')),
  };
}

/** 表のセルを `・` で区切る。`—` と、全体が（…）のセル（`（読むだけ）`）は空として読む */
function splitList(cell) {
  const text = cell.trim();
  if (text === '' || text === '—' || /^（[^）]*）$/.test(text)) return [];
  return text
    .split('・')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * アクターの列を正規化する。`・` で区切り、`（…）` の注記を除く（`GM（自動解決ならシステム）` → `GM`）。
 * 注記だけ（`（セッションの正常終了）`）は「システム」。`誰でも` はそのまま1つのアクター。
 */
export function normalizeActors(cell) {
  const names = splitList(cell.replace(/（[^）]*）/g, ''));
  return names.length > 0 ? names : ['システム'];
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
 * - forbidden: skip・fixme・`expect.soft`（skip したステップは結果で「通った」に見えるため）。
 *   宣言のスキップ（`test.skip('題', { … }, fn)`。最初の引数が `'`・`"` の文字列の直書き）は入れない
 * - testCount: `test(` と宣言の `test.skip(` の数
 * - skips: 宣言の `test.skip(` ごとの { backlogCount（`type: 'backlog'` の注記の数） }
 * - backlogs: `type: 'backlog'` の注記ごとの { description, skipped（宣言のスキップの注記か） }
 * - unreadableAnnotations: 直書きでない `annotation`・`type`・`description`（変数・テンプレート文字列）の数
 * - danglingSkipSuppressions: 次の文が宣言の `test.skip(` でない `noSkippedTests` の抑制コメントの数（スキップを外した後の消し忘れ）
 * 書き方の正は docs/process/rules/testing.md「ユースケースの E2E」（docs/plans/2026-10-27-P6-不安定なE2Eのスキップ.md D9・D10・D19）
 */
export function parseTestFile(source) {
  const code = stripComments(source);
  const calls = readTestCalls(code);
  const declaredSkips = new Set(calls.filter((c) => c.skip).map((c) => c.index));
  const titleTagged = [
    ...code.matchAll(/(?<![.\w])test(?:\.skip)?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g),
  ].some((m) => /@[A-Za-z]{2}-\d+/.test(m[2]));
  const forbidden = [
    ...code.matchAll(
      /\b(test(?:\.describe|\.step)?\.(?:skip|fixme|only|fail|slow)|expect\.soft)\b/g,
    ),
  ]
    .filter((m) => !(m[1] === 'test.skip' && declaredSkips.has(m.index)))
    .map((m) => m[1]);
  const testCount = calls.filter((c) => c.kind === 'test').length;

  return {
    ...readTags(code, calls),
    ...readSteps(code),
    ...readAnnotations(code, calls),
    titleTagged,
    forbidden,
    testCount,
    danglingSkipSuppressions: countDanglingSuppressions(source, code),
  };
}

/** 最初の引数が `'`・`"` の文字列の直書きか（テンプレート文字列・変数・条件は直書きでない） */
const startsWithLiteral = (rest) => /^\s*(['"])(?:\\.|(?!\1)[^\\\n])*\1/.test(rest);

/**
 * テストを宣言する呼び出し（`test(`・宣言の `test.skip(`・`test.describe(`）を出てくる順に返す。
 * kind は 'test' か 'test.describe'、skip は宣言のスキップか
 */
function readTestCalls(code) {
  const callRe = /(?<![.\w])(test|test\.describe)(?:\.(parallel|serial|skip))?\(/g;
  return [...code.matchAll(callRe)]
    .map((m) => {
      const skip = m[1] === 'test' && m[2] === 'skip';
      // 本文の中の条件付きの test.skip(cond) は宣言でない（forbidden に残る）
      if (skip && !startsWithLiteral(code.slice(m.index + m[0].length))) return null;
      if (m[1] === 'test' && m[2] && !skip) return null;
      return { index: m.index, kind: m[1], skip };
    })
    .filter(Boolean);
}

/** `tag:` に書いたタグを読む。tags は ID のタグ、badTags は形の違うタグ、describeTagged は test.describe に付いたタグがあるか */
function readTags(code, calls) {
  const tags = [];
  const badTags = [];
  let describeTagged = false;
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

/**
 * `annotation:` を読む。値は1つのオブジェクトか、オブジェクトの配列で、`type`・`description` は文字列の直書きに限る。
 * 持ち主は、`annotation:` の手前でいちばん近いテストの宣言（タグと同じ見方）
 */
function readAnnotations(code, calls) {
  const skips = calls.filter((c) => c.skip).map((c) => ({ index: c.index, backlogCount: 0 }));
  const backlogs = [];
  let unreadableAnnotations = 0;
  for (const m of code.matchAll(/\bannotation:\s*/g)) {
    const objects = annotationObjects(code, m.index + m[0].length);
    if (!objects) {
      unreadableAnnotations++;
      continue;
    }
    const owner = calls.filter((c) => c.index < m.index).at(-1);
    const skip = skips.find((s) => owner?.skip && s.index === owner.index);
    for (const props of objects) {
      if (!props) {
        unreadableAnnotations++;
        continue;
      }
      if (props.type !== 'backlog') continue;
      backlogs.push({ description: props.description ?? null, skipped: Boolean(skip) });
      if (skip) skip.backlogCount++;
    }
  }
  return {
    skips: skips.map(({ backlogCount }) => ({ backlogCount })),
    backlogs,
    unreadableAnnotations,
  };
}

/**
 * annotation の値（start から）を、オブジェクトごとの { type, description } の配列で返す。
 * 値がオブジェクト・配列でなければ null。読めないオブジェクト（直書きでない値・知らない書き方）は配列の中で null
 */
function annotationObjects(code, start) {
  const open = code[start];
  if (open !== '{' && open !== '[') return null;
  const end = closingIndex(code, start);
  if (end === -1) return null;
  if (open === '{') return [readAnnotationObject(code.slice(start + 1, end))];
  return splitTopLevel(code.slice(start + 1, end)).map((item) =>
    item.startsWith('{') && closingIndex(item, 0) === item.length - 1
      ? readAnnotationObject(item.slice(1, -1))
      : null,
  );
}

/** オブジェクトの中身（`{` と `}` の間）を { type, description } にする。直書きでない値・知らない書き方なら null */
function readAnnotationObject(inner) {
  const props = {};
  for (const part of splitTopLevel(inner)) {
    const m = part.match(/^(type|description)\s*:\s*(['"])((?:\\.|(?!\2)[^\\\n])*)\2$/);
    if (!m) return null;
    props[m[1]] = m[3];
  }
  return typeof props.type === 'string' ? props : null;
}

/** 文字列を飛ばしながら、start の括弧に対応する閉じ括弧の位置を返す（無ければ -1） */
function closingIndex(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      i = stringEnd(text, i);
      if (i === -1) return -1;
    } else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch) && --depth === 0) return i;
  }
  return -1;
}

/** text[start] の引用符で始まる文字列の閉じる引用符の位置（無ければ -1） */
function stringEnd(text, start) {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === text[start]) return i;
  }
  return -1;
}

/** 括弧・文字列の外の `,` で区切り、前後の空白を除く（末尾の `,` の後の空は除く） */
function splitTopLevel(text) {
  const parts = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '"' || ch === '`') i = stringEnd(text, i);
    else if ('([{'.includes(ch)) i = closingIndex(text, i);
    else if (ch === ',') {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
    if (i === -1) return [text];
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const SKIP_SUPPRESSION_RE = /\/\/\s*biome-ignore\s+lint\/suspicious\/noSkippedTests\b/;

/** 次の文が宣言の `test.skip(` でない抑制コメントの数。code はコメントを空にした source（行数は同じ） */
function countDanglingSuppressions(source, code) {
  const codeLines = code.split('\n');
  return source.split('\n').filter((line, i) => {
    if (!SKIP_SUPPRESSION_RE.test(line)) return false;
    const next = codeLines.slice(i + 1).join('\n');
    const m = next.match(/^\s*test\.skip\(/);
    return !(m && startsWithLiteral(next.slice(m[0].length)));
  }).length;
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
