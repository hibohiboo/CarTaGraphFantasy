// 要望（docs/backlog/*.md）の frontmatter の `trace` を読む小さな読み手。
// YAML のライブラリは足さない（docs/plans/2026-10-26-P5-アイデアから実装までのトレース.md D21）。
// 受け付けるのは次の2つの形だけで、ほかは例外にする（ファイル名と理由を付ける）。
//
//   trace:
//     usecases: [SC-6, SC-7]
//     screens: [/creator/scenarios/:scenarioId, GM のホーム]
//     rules: [scenario-flow/シナリオの公開]
//
//   trace:
//     none: 開発の基盤（E2E の導入）
//
// VitePress も同じ frontmatter を YAML として読むので、正しい YAML であることは docs:build が確かめる。
// YAML と読み方が食い違う書き方（`#`、引用符）は、ここで例外にする（D28）。

export const TRACE_LIST_KEYS = ['usecases', 'screens', 'rules'];

/**
 * Markdown の文字列から trace を読む。
 * 返り値：trace が無ければ null、`none` なら { none }、リストなら { usecases, screens, rules }（省略は空配列）。
 * 形が違えば例外（file は誤りの文に入れる）。
 */
export function parseTrace(source, file) {
  const fail = (reason) => {
    throw new Error(`${file} の trace: ${reason}`);
  };
  const lines = frontmatterLines(source);
  const start = lines ? lines.findIndex((l) => /^trace:/.test(l)) : -1;
  if (start === -1) return null;

  if (lines[start].slice('trace:'.length).trim() !== '') {
    fail('`trace:` の同じ行に値は書けない（次の行からインデントして書く）');
  }
  const entries = readEntries(indentedBlock(lines, start + 1), fail);
  checkValues(entries, fail);
  return entries.has('none') ? buildNone(entries, fail) : buildLists(entries, fail);
}

/** `trace:` の次の行から続くインデントした行。無ければ例外 */
function indentedBlock(lines, from) {
  const body = [];
  for (const line of lines.slice(from)) {
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) break;
    body.push(line);
  }
  return body;
}

/** `  キー: 値` の行を Map にする。読めない行・知らないキー・同じキーの2回は例外 */
function readEntries(body, fail) {
  if (body.length === 0) {
    fail('`trace:` の下にインデントした行が無い（インデントの無い行は別のキーになる）');
  }
  const entries = new Map();
  for (const line of body) {
    if (/^\s*-/.test(line)) fail('ブロック形式のリストは書けない（フロー形式 [a, b] で書く）');
    const m = line.match(/^ {2}([A-Za-z]+):(.*)$/);
    if (!m) {
      fail(
        `読めない行 ${JSON.stringify(line.trim())}（インデントは半角空白2つ、「キー: 値」の形）`,
      );
    }
    const [, key, raw] = m;
    if (key !== 'none' && !TRACE_LIST_KEYS.includes(key)) {
      fail(`知らないキー ${key}（usecases・screens・rules・none のどれか）`);
    }
    if (entries.has(key)) fail(`${key} が2回書かれている`);
    entries.set(key, raw.trim());
  }
  return entries;
}

/** YAML と読み方が食い違う書き方（引用符・#）は例外 */
function checkValues(entries, fail) {
  for (const value of entries.values()) {
    if (/['"]/.test(value)) fail('引用符（\' "）は書けない（YAML と読み方が食い違う）');
    if (value.includes('#')) fail('`#` は書けない（YAML ではコメントになり、読み方が食い違う）');
  }
}

function buildNone(entries, fail) {
  if (entries.size > 1) fail('none とリスト（usecases・screens・rules）は一緒に書けない');
  const reason = entries.get('none');
  if (reason === '') fail('none の理由が空');
  return { none: reason };
}

function buildLists(entries, fail) {
  const result = { usecases: [], screens: [], rules: [] };
  for (const [key, value] of entries) result[key] = parseFlowList(value, key, fail);
  if (TRACE_LIST_KEYS.every((k) => result[k].length === 0)) fail('リストが全部が空');
  return result;
}

/** `[a, b]` を読む。ブロック形式（値が空）・閉じていない・空の項目は誤り */
function parseFlowList(value, key, fail) {
  const m = value.match(/^\[(.*)\]$/);
  if (!m) fail(`${key} はフロー形式（[a, b]）で書く`);
  const inner = m[1].trim();
  if (inner === '') return [];
  const items = inner.split(',').map((s) => s.trim());
  if (items.some((s) => s === '')) fail(`${key} に空の項目がある`);
  return items;
}

/** 先頭の frontmatter（--- と --- の間）の行を返す。無ければ null */
function frontmatterLines(source) {
  const lines = source.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  return lines.slice(1, end);
}
