// 仮ルールの一覧（docs/provisional/）と、仕様ページの「仮」の印が食い違っていないかを確かめる
// （pnpm docs:build の最後に流れる。pre-push・CI でも止まる。書き方は docs/provisional/index.md）。
// 仮ルールを足したのに一覧に載せ忘れる、決めたのにファイルを消し忘れる、を機械で止める（2026-10-10、仮ルールの一覧を作ったとき）。
//
// 確かめること
// - 仕様ページ（docs/cartagraph/）の題名・見出しに「（仮ルール）」「（仮マッピング）」などの印があれば、
//   どれかの仮ルールのファイルの spec に載っている
// - 仮ルールのファイルは title と decide を持ち、spec に書いたページは実在して、まだ「仮」の印がある
//
// 使い方: node scripts/check-provisional.mjs
// テストは scripts/check-provisional.test.mjs（pnpm tools:test）。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SPEC_DIR = 'docs/cartagraph';
const PROVISIONAL_DIR = 'docs/provisional';
/** 生成した参考資料は仕様ページとして見ない */
const NOT_SPEC = ['auto-combat-simulation.md'];

/** 見出し（# で始まる行）に「（仮…）」の印があるか */
export function hasProvisionalMark(md) {
  return /^#{1,6} .*（仮[^）]*）/m.test(md);
}

/** frontmatter の title・decide・spec（- の列）を読む。無ければ null */
export function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const body = m[1];
  const value = (key) => body.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
  const specBlock = body.match(/^spec:\s*\n((?:\s+- .+\n?)+)/m)?.[1] ?? '';
  const spec = [...specBlock.matchAll(/^\s+- (.+)$/gm)].map((x) => x[1].trim());
  return { title: value('title'), decide: value('decide'), spec };
}

/**
 * 食い違いを、人が読むメッセージの配列で返す（無ければ空）。
 * specPages は { path（docs/ からの相対）, text }、provisional は { path, text }、exists は docs/ からの相対パスの実在
 */
export function findProvisionalMismatches({ specPages, provisional, exists }) {
  const parsed = provisional.map((p) => ({ ...p, fm: parseFrontmatter(p.text) }));
  const errors = parsed.flatMap((p) => provisionalFileErrors(p, specPages, exists));
  const listed = new Set(parsed.flatMap((p) => p.fm?.spec ?? []));
  for (const page of specPages) {
    if (hasProvisionalMark(page.text) && !listed.has(page.path))
      errors.push(
        `docs/${page.path} に「仮」の印があるが、仮ルールの一覧（${PROVISIONAL_DIR}/）のどの spec にも無い`,
      );
  }
  return errors;
}

/** 仮ルールのファイル1つの誤り（frontmatter・title・decide・spec のページ） */
function provisionalFileErrors({ path, fm }, specPages, exists) {
  if (!fm) return [`${path} に frontmatter が無い`];
  const errors = [];
  if (!fm.title) errors.push(`${path} に title が無い`);
  if (!fm.decide) errors.push(`${path} に decide（何を決めれば消せるか）が無い`);
  for (const s of fm.spec) {
    const page = specPages.find((x) => x.path === s);
    if (!exists(s)) errors.push(`${path} の spec「${s}」のページが無い`);
    else if (page && !hasProvisionalMark(page.text))
      errors.push(
        `${path} の spec「${s}」に、もう「仮」の印が無い（決めたなら、仮ルールのファイルを消す）`,
      );
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = (dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ file: f, text: readFileSync(`${dir}/${f}`, 'utf8') }));
  const specPages = md(SPEC_DIR)
    .filter(({ file }) => !NOT_SPEC.includes(file))
    .map(({ file, text }) => ({ path: `cartagraph/${file}`, text }));
  const provisional = md(PROVISIONAL_DIR)
    .filter(({ file }) => file !== 'index.md')
    .map(({ file, text }) => ({ path: `${PROVISIONAL_DIR}/${file}`, text }));
  const found = findProvisionalMismatches({
    specPages,
    provisional,
    exists: (p) => existsSync(`docs/${p}`),
  });
  if (found.length) {
    for (const f of found) console.error(f);
    console.error(`仮ルールの一覧と仕様ページの「仮」の印の食い違いが ${found.length} 件あります`);
    process.exit(1);
  }
  console.log(`仮ルールの一覧（${provisional.length} 件）が仕様ページの「仮」の印と一致しています`);
}
