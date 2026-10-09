// 正式仕様のページが、実装のファイル（rules/・apps/・packages/・scenarios/・scripts/）を指していないかを確かめる
// （pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// 仕様ページは「いまのルール」を書く場所で、値や定義の出どころを実装の仮の値に置くと、実装を直したときに仕様が
// 黙って変わる（2026-10-10、ルールとカードプールの JSON 管理の振り返り。solo-village.md を「上限は rules/ の値」と
// 書き換え、実装レビューで戻した）。実装との対応は docs/architecture/ に書く。
//
// 使い方: node scripts/check-spec-paths.mjs
// 見るのは SPEC_FILES に当たる git 管理のファイル。生成した参考資料（auto-combat-simulation.md）は見ない。
// テストは scripts/check-spec-paths.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SPEC_FILES = [
  /^docs\/cartagraph\/.+\.md$/,
  /^docs\/concept\/.+\.md$/,
  /^docs\/glossary\.md$/,
];
const EXCLUDED = [/^docs\/cartagraph\/auto-combat-simulation\.md$/];
/** 実装のパスの始まり。URL やほかのディレクトリの途中（docs/rules/ など）は数えない */
const IMPL_PATH = /(?<![\w./-])(rules|apps|packages|scenarios|scripts)\/[\w.*/-]*/g;

/** その（リポジトリからの相対）パスを見るか */
export function isSpecFile(path) {
  return SPEC_FILES.some((re) => re.test(path)) && !EXCLUDED.some((re) => re.test(path));
}

/** 実装のパスを見つける。[{ path, line, found, message }] */
export function findImplPaths(files) {
  return files.flatMap(({ path, text }) =>
    text.split('\n').flatMap((lineText, i) =>
      [...lineText.matchAll(IMPL_PATH)].map(([found]) => ({
        path,
        line: i + 1,
        found,
        message: `${path}:${i + 1} 実装のパス「${found}」を指している（実装との対応は docs/architecture/ に書く）`,
      })),
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = spawnSync('git', ['ls-files', 'docs'], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((p) => p && isSpecFile(p));
  const found = findImplPaths(paths.map((path) => ({ path, text: readFileSync(path, 'utf8') })));
  if (found.length) {
    for (const f of found) console.error(f.message);
    console.error(`正式仕様のページが実装のパスを ${found.length} 件指しています`);
    process.exit(1);
  }
  console.log(`正式仕様のページは実装のパスを指していません（${paths.length} ファイル）`);
}
