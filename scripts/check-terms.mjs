// 用語の旧称が残っていないかを確かめる（pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// 用語をそろえたあと、旧称がまた書かれるのを機械で止める（2026-10-07、シナリオの公開 C2 の振り返り。
// 仕様整合のレビューが、同じ種類の揺れを毎回見つけていた）。旧称を足すときは TERMS に足す。今の名前の正は docs/glossary.md。
//
// 使い方: node scripts/check-terms.mjs
// 見るのは git で管理しているファイルのうち、isChecked が真のもの。経緯の記録（plans・interviews・体制の進化ログ）は見ない。
// テストは scripts/check-terms.test.mjs（pnpm tools:test）。

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 旧称と、今の名前の案内 */
export const TERMS = [
  ['共有ライブラリ', '「シナリオ集」（シナリオの公開先）か「共有設定」（格上げしたカード・設定）'],
  ['シナリオ作成者', '「シナリオ製作者」'],
  ['シナリオ制作者', '「シナリオ製作者」'],
  ['シナリオ作者', '「シナリオ製作者」'],
  ['行き先', '「移り先」（選択肢カードの nextNodeId）'],
  ['結末ノード', '「結末のノード」'],
  ['配る前提タグ', '「結末タグ」'],
  ['探索者向けの判定ルール', '「判定ルール」（docs/cartagraph/check.md）'],
  ['PCのロールとシナリオタイプ', '「シナリオタイプ」（docs/cartagraph/scenario-type.md）'],
];

const EXCLUDED = [
  /^docs\/plans\//,
  /^docs\/interviews\//,
  /^docs\/process\/evolution\.md$/,
  /^scripts\/check-terms(\.test)?\.mjs$/,
  /\/dist\//,
];
const CHECKED_EXT = /\.(md|mts|ts|tsx|mjs|js|json|css|html)$/;

/** その（リポジトリからの相対）パスを見るか */
export function isChecked(path) {
  return CHECKED_EXT.test(path) && !EXCLUDED.some((re) => re.test(path));
}

/** 旧称を見つける。[{ path, line, term, message }] */
export function findOldTerms(files) {
  return files.flatMap(({ path, text }) =>
    text.split('\n').flatMap((lineText, i) =>
      TERMS.filter(([term]) => lineText.includes(term)).map(([term, now]) => ({
        path,
        line: i + 1,
        term,
        message: `${path}:${i + 1} 旧称「${term}」→ ${now}`,
      })),
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = spawnSync('git', ['ls-files'], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((p) => p && isChecked(p));
  const found = findOldTerms(paths.map((path) => ({ path, text: readFileSync(path, 'utf8') })));
  if (found.length) {
    for (const f of found) console.error(f.message);
    console.error(`用語の旧称が ${found.length} 件あります（今の名前の正は docs/glossary.md）`);
    process.exit(1);
  }
  console.log(`用語の旧称は見つかりませんでした（${paths.length} ファイル）`);
}
