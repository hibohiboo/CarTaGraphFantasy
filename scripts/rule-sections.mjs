// ルールのページ（docs/cartagraph/）の節（##・###）を読み、Vitest のタグの一覧と、対象外の一覧（docs/architecture/rule-test-exclusions.md）を返す。
// 3パッケージの Vitest の設定（packages/*/vitest.config.ts・apps/web/vite.config.ts）が test.tags に渡す。
// 結果のページ（build-rule-test-report.mjs）と対象外の検査（check-rule-test-exclusions.mjs）も共用する。
// 書き方の正は docs/process/rules/testing.md「ルールのテストのタグ」。
//
// 設定ファイルから読まれる（Vite が設定ごとバンドルする）ので、Node が解決できない import をしない（apps/web/vite/ と同じ制約）。
// Vitest は cwd がパッケージのディレクトリで動くので、読む場所は import.meta.url から組み立てたリポジトリの直下を基準にする。
// テストは scripts/rule-sections.test.mjs（pnpm tools:test）。

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasProvisionalMark, NOT_SPEC } from './check-provisional.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const RULES_DIR = join(ROOT, 'docs/cartagraph');
export const EXCLUSIONS_FILE = join(ROOT, 'docs/architecture/rule-test-exclusions.md');
export const TAG_PREFIX = 'rule:';

/** Vitest がタグ名に使わせない文字（空白・! * & | ( )）。見出しにあれば設定の解決で全テストが起動しなくなる */
const VITEST_FORBIDDEN = /[\s!*&|()]/;

/** ページの本文の行から、フロントマターとフェンスの中を除いた [{ line, text }]（line は1始まり） */
function bodyLines(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  let fence = null;
  for (; i < lines.length; i++) {
    const text = lines[i];
    if (fence) {
      const close = text.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = text.match(/^ {0,3}(`{3,}|~{3,})/);
    if (open) {
      fence = open[1];
      continue;
    }
    out.push({ line: i + 1, text });
  }
  return out;
}

function checkHeading(file, line, heading) {
  const where = `${file}:${line}「${heading}」`;
  if (VITEST_FORBIDDEN.test(heading))
    throw new Error(
      `${where}：見出しに空白か ! * & | ( ) がある。Vitest のタグ名に使えず、3パッケージの全テストが起動しなくなる。見出しを直すか、書き方を決め直す`,
    );
  if (/\{#/.test(heading) || /[`[*]/.test(heading))
    throw new Error(
      `${where}：見出しに {#id} かインラインの記法（\` [ *）がある。タグ名を「見出しの文字そのまま」にできない。書き方を決め直す`,
    );
}

/** 1ページ分のテキストから { pageTitle, pageProvisional, sections } を読む */
function parsePage(page, md) {
  const file = `${page}.md`;
  const lines = bodyLines(md);
  const title = lines.map((l) => l.text.match(/^# (.+?)\s*$/)).find(Boolean)?.[1] ?? page;
  const pageProvisional = hasProvisionalMark(`# ${title}`);
  const sections = [];
  let parent = null;
  for (const { line, text } of lines) {
    const m = text.match(/^(#{2,3}) (.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length;
    const heading = m[2];
    checkHeading(file, line, heading);
    if (sections.some((s) => s.heading === heading))
      throw new Error(
        `${file}:${line}「${heading}」：同じページに同じ見出しが2つある（タグが重なる）`,
      );
    if (level === 2) parent = heading;
    sections.push({
      tag: `${TAG_PREFIX}${page}/${heading}`,
      page,
      pageTitle: title,
      heading,
      level,
      parent: level === 3 ? parent : null,
      provisional: hasProvisionalMark(`${m[1]} ${heading}`),
      pageProvisional,
    });
  }
  return { page, pageTitle: title, pageProvisional, sections };
}

/** ページごとの [{ page, pageTitle, pageProvisional, sections }]（ファイル名順）。節が全体で1件も読めなければ例外 */
export function readRulePages(dir = RULES_DIR) {
  const pages = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !NOT_SPEC.includes(f))
    .sort()
    .map((f) => parsePage(f.slice(0, -3), readFileSync(join(dir, f), 'utf8')));
  if (pages.every((p) => p.sections.length === 0))
    throw new Error(`${dir} の見出し（## ###）を1件も読めない（置き場所か書式が変わった？）`);
  return pages;
}

/** 節の一覧 [{ tag, page, pageTitle, heading, level, parent, provisional, pageProvisional }] */
export function readRuleSections(dir = RULES_DIR) {
  return readRulePages(dir).flatMap((p) => p.sections);
}

/** 対象外の一覧の表から [{ page, heading（ページ全体なら null）, reason }] を読む。列が足りない行は例外 */
export function parseExclusions(md) {
  const lines = md.split(/\r?\n/);
  const head = lines.findIndex((l) => /^\|\s*ページ\s*\|\s*節\s*\|\s*理由\s*\|\s*$/.test(l));
  if (head < 0) return [];
  const rows = [];
  for (const [i, line] of lines.slice(head + 2).entries()) {
    if (!line.startsWith('|')) break;
    const cells = line
      .replace(/^\||\|\s*$/g, '')
      .split('|')
      .map((c) => c.trim());
    if (cells.length !== 3 || !cells[0])
      throw new Error(
        `rule-test-exclusions.md の表の ${head + 3 + i} 行目：列が「ページ｜節｜理由」の3つにそろっていない`,
      );
    rows.push({ page: cells[0], heading: cells[1] || null, reason: cells[2] });
  }
  return rows;
}

export function readExclusions(file = EXCLUSIONS_FILE) {
  return parseExclusions(readFileSync(file, 'utf8'));
}

/** 節（{ page, heading }）が載っている対象外の一覧の行（節が null の行はページ全体）。載っていなければ undefined */
export function findExclusion(section, exclusions) {
  return exclusions.find(
    (e) => e.page === section.page && (e.heading === null || e.heading === section.heading),
  );
}

export function isExcluded(section, exclusions) {
  return findExclusion(section, exclusions) !== undefined;
}

/** Vitest の設定の test.tags に渡す一覧。対象外の節は入れない（付けたテストは「not defined」で落ちる） */
export function vitestTags() {
  const exclusions = readExclusions();
  return readRuleSections()
    .filter((s) => !isExcluded(s, exclusions))
    .map((s) => ({ name: s.tag, description: `${s.pageTitle}「${s.heading}」` }));
}
