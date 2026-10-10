// docs/ のルールのページの frontmatter にある paths（そのルールを読むきっかけになるファイルのパス）から、
// Claude Code の path-scoped rule（.claude/rules/）の入口ファイルを作り、AGENTS.md「開発ルールの適用」の表との
// 食い違いを止める。対象のパスの正は frontmatter の paths の1か所で、入口ファイルと表はそれに合わせる。
// 入口ファイルは本文を書き写さず、ルールのページを指すだけにする（本文の正は docs/）。
// paths を持つページを読み込む仕組みが無く、AGENTS.md の表と frontmatter が食い違っていた（2026-10-10）。
//
// 使い方: node scripts/sync-claude-rules.mjs          入口ファイルを作り直す（要らなくなったものは消す）
//         node scripts/sync-claude-rules.mjs --check  作り直しが要る、または表が食い違うと失敗する
//                                                     （pnpm docs:build の最後に流れる。pre-push・CI でも止まる）
// .claude/rules/ には手で書かない。ルールは docs/ に書き、frontmatter の paths で結びつける。
// テストは scripts/sync-claude-rules.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES_DIR = '.claude/rules';
const TABLE_HEADING = '## 開発ルールの適用';

/** frontmatter の paths（- の列）を読む。paths が無ければ null */
export function parsePaths(md) {
  const body = md.match(/^---\n([\s\S]*?)\n---/)?.[1];
  const block = body?.match(/^paths:\s*\n((?:\s+- .+\n?)+)/m)?.[1];
  if (!block) return null;
  return [...block.matchAll(/^\s+- (.+)$/gm)].map((x) =>
    x[1].trim().replace(/^(["'])(.*)\1$/, '$2'),
  );
}

/** ルールのページ（docs/ から始まるパス）に対応する入口ファイルのパス */
export function ruleFileFor(source) {
  return `${RULES_DIR}/${source.replace(/^docs\//, '')}`;
}

/** 入口ファイルの中身 */
export function renderRule(source, paths) {
  return [
    '---',
    'paths:',
    ...paths.map((p) => `  - "${p}"`),
    '---',
    '',
    `<!-- node scripts/sync-claude-rules.mjs が ${source} の frontmatter から作る。手で直さない -->`,
    '',
    `このパスのファイルを読む・変更する・レビューする前に、\`${source}\` を読み、そこに書かれたルールに従う。ルールの本文と対象のパスの正はそちら（AGENTS.md「開発ルールの適用」）。`,
    '',
  ].join('\n');
}

/** 書く・消す入口ファイル。sources は [{ source, paths }]、existing は { 入口ファイルのパス: 中身 } */
export function planSync(sources, existing) {
  const expected = new Map(
    sources.map(({ source, paths }) => [ruleFileFor(source), renderRule(source, paths)]),
  );
  return {
    write: [...expected]
      .filter(([path, text]) => existing[path] !== text)
      .map(([path, text]) => ({ path, text })),
    remove: Object.keys(existing).filter((path) => !expected.has(path)),
  };
}

/** AGENTS.md の表の行を読む。[{ source（右の列の最初のパス）, globs（左の列の `…` の列） }] */
export function parseRulesTable(agentsMd) {
  const section = agentsMd.split(TABLE_HEADING)[1]?.split(/\n## /)[0] ?? '';
  const ticks = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  return section
    .split('\n')
    .map((line) => line.match(/^\|(.+)\|(.+)\|$/))
    .filter((m) => m && !/^-+$/.test(m[1].trim()) && ticks(m[2]).length > 0)
    .map((m) => ({ source: ticks(m[2])[0], globs: ticks(m[1]) }));
}

/** 表と frontmatter の食い違いを、人が読むメッセージの配列で返す（無ければ空） */
export function findTableMismatches(sources, rows, exists) {
  const bySource = new Map(sources.map((s) => [s.source, s.paths]));
  const errors = sources
    .filter(({ source }) => !rows.some((r) => r.source === source))
    .map(
      ({ source }) =>
        `AGENTS.md「開発ルールの適用」の表に ${source} の行が無い（frontmatter に paths がある）`,
    );
  for (const { source, globs } of rows) {
    if (!exists(source)) {
      errors.push(`AGENTS.md「開発ルールの適用」の表の ${source} が無い`);
      continue;
    }
    const paths = bySource.get(source) ?? [];
    const missing = paths.filter((p) => !globs.includes(p));
    const extra = globs.filter((g) => !paths.includes(g));
    if (missing.length || extra.length)
      errors.push(
        `AGENTS.md「開発ルールの適用」の ${source} の行が frontmatter の paths と食い違う（表に無い: ${missing.join(', ') || 'なし'}／frontmatter に無い: ${extra.join(', ') || 'なし'}）。正は frontmatter`,
      );
  }
  return errors;
}

function readSources() {
  return spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'docs'], {
    encoding: 'utf8',
  })
    .stdout.split('\n')
    .filter((p) => p.endsWith('.md'))
    .map((source) => ({ source, paths: parsePaths(readFileSync(source, 'utf8')) }))
    .filter(({ paths }) => paths?.length);
}

function readExisting(dir = RULES_DIR) {
  const entries = (() => {
    try {
      return readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  })();
  return Object.assign(
    {},
    ...entries.map((e) => {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) return readExisting(path);
      return e.name.endsWith('.md') ? { [path]: readFileSync(path, 'utf8') } : {};
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const sources = readSources();
  const { write, remove } = planSync(sources, readExisting());
  const tableErrors = findTableMismatches(
    sources,
    parseRulesTable(readFileSync('AGENTS.md', 'utf8')),
    existsSync,
  );
  if (check) {
    for (const { path } of write) console.error(`${path} が古いか無い`);
    for (const path of remove)
      console.error(`${path} に対応するルールのページ（frontmatter の paths）が無い`);
  } else {
    for (const { path, text } of write) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      console.log(`書いた: ${path}`);
    }
    for (const path of remove) {
      rmSync(path);
      console.log(`消した: ${path}`);
    }
  }
  for (const e of tableErrors) console.error(e);
  const stale = check ? write.length + remove.length : 0;
  if (stale || tableErrors.length) {
    if (stale) console.error('入口ファイルを作り直す: node scripts/sync-claude-rules.mjs');
    process.exit(1);
  }
  console.log(
    `.claude/rules/ の入口ファイル（${sources.length} 件）と AGENTS.md の表が frontmatter の paths と一致しています`,
  );
}
