// 既知の問題「複雑度・行数の上限を超える既存のコード」の一覧と、その見出しを指す biome-ignore が食い違っていないかを確かめる
// （pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// Biome は使われなくなった抑制を警告するので、コードの側は片づく。食い違うのは文書の一覧の側（2026-10-10、
// 冒険者だけにする C3 の振り返り。applySoloEffect の抑制を外したとき、一覧の件数と項目を手で直した）。
//
// 確かめること
// - 一覧の「上限を超える箇所がN件」が、見出しを指す抑制の数と同じ
// - 抑制のあるファイルの名前（拡張子を除く）が、一覧の項目のどこかに書いてある
//
// 使い方: node scripts/check-suppressions.mjs
// テストは scripts/check-suppressions.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const KNOWN_ISSUES = 'docs/architecture/known-issues.md';
const TITLE = '複雑度・行数の上限を超える既存のコード';
const HEADING = `「${TITLE}」`;

/** 既知の問題の見出しを指す biome-ignore を拾う。[{ path, line }] */
export function findSuppressions(files) {
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .flatMap((lineText, i) =>
        lineText.includes('biome-ignore') && lineText.includes(HEADING)
          ? [{ path, line: i + 1 }]
          : [],
      ),
  );
}

/** 一覧の項目（見出しから次の見出しまで）。見出しが無ければ null */
export function listSection(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l === `### ${TITLE}`);
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,3} /.test(l));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

/** 食い違いの文の一覧（無ければ空） */
export function findListErrors(md, suppressions) {
  const section = listSection(md);
  if (section === null) return [`${KNOWN_ISSUES} に見出し${HEADING}が無い`];
  const errors = [];
  const count = Number(section.match(/上限を超える箇所が(\d+)件/)?.[1]);
  if (count !== suppressions.length)
    errors.push(
      `${KNOWN_ISSUES} の一覧は ${count}件 だが、見出しを指す biome-ignore は ${suppressions.length}件（抑制を外したら一覧からも消す）`,
    );
  for (const { path, line } of suppressions) {
    const name = basename(path).replace(/\.[^.]+$/, '');
    if (!section.includes(name))
      errors.push(`${path}:${line} の抑制が、既知の問題の一覧に無い（「${name}」を一覧に書く）`);
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = spawnSync('git', ['ls-files', 'apps', 'packages'], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((p) => /\.(ts|tsx|mts|mjs|js)$/.test(p));
  const suppressions = findSuppressions(
    paths.map((path) => ({ path, text: readFileSync(path, 'utf8') })),
  );
  const errors = findListErrors(readFileSync(KNOWN_ISSUES, 'utf8'), suppressions);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log(`既知の問題の一覧（${suppressions.length} 件）が biome-ignore と一致しています`);
}
