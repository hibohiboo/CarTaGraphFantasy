// 画面一覧と導線図（docs/screens/index.md）・画面ごとの課題（docs/screens/issues.md）が、ルート定義
// （apps/web/src/shared/routes/routes.ts）と食い違っていないかを確かめる（pnpm docs:build の最後に流れる。pre-push・CI でも止まる）。
// ルートを足す・消すときに、手で直す画面一覧と図がずれていくのを機械で止める（2026-10-10、画面一覧を作ったときの人間の要望）。
//
// 確かめること
// - 画面の一覧の表（パスの列）が、ルートと過不足なく一致する
// - 導線図（```mermaid のノードのラベル）に、遊ぶ人の導線に入るルート（NOT_IN_DIAGRAM のグループ以外）が過不足なく出ている
// - 画面ごとの課題の見出しの下に書いたパスが、どれも実在するルートである
// 確かめないこと：図の矢印（画面の中のリンク）が実装と合っているか。リンクを変えたら図の矢印は手で直す
//
// 使い方: node scripts/check-screens.mjs
// テストは scripts/check-screens.test.mjs（pnpm tools:test）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROUTES_FILE = 'apps/web/src/shared/routes/routes.ts';
export const SCREENS_FILE = 'docs/screens/index.md';
export const ISSUES_FILE = 'docs/screens/issues.md';

/** 導線図に描かないグループ（遊ぶ人の導線に入らない。docs/screens/index.md に理由を書いている） */
export const NOT_IN_DIAGRAM = ['admin'];

/** routes.ts から [{ path, group }] を読む */
export function parseRoutes(source) {
  return [...source.matchAll(/path:\s*'([^']+)'[\s\S]*?group:\s*'(\w+)'/g)].map(
    ([, path, group]) => ({
      path,
      group,
    }),
  );
}

/** 画面の一覧の表から、パスの列（3列目のバッククォート）を読む。（未実装）の行は読まない */
export function parseTablePaths(md) {
  return [...md.matchAll(/^\|[^|\n]*\|[^|\n]*\|\s*`(\/[^`]*)`\s*\|/gm)].map((m) => m[1]);
}

/** ```mermaid のブロックの、ノードのラベル（["…"]）に書いたパスを読む */
export function parseDiagramPaths(md) {
  const blocks = [...md.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)].map((m) => m[1]);
  return blocks.flatMap((block) =>
    [...block.matchAll(/\["([^"]*)"\]/g)].flatMap(([, label]) =>
      label
        .replaceAll('<br/>', ' ')
        .split(/\s+/)
        .filter((token) => token.startsWith('/')),
    ),
  );
}

/** 課題のページの、見出しの下に1行で書いたパス（`/home` など）を読む */
export function parseIssuePaths(md) {
  return [...md.matchAll(/^`(\/[^`]*)`$/gm)].map((m) => m[1]);
}

const diff = (a, b) => [...new Set(a)].filter((x) => !b.includes(x));

/** 食い違いを、人が読むメッセージの配列で返す（無ければ空） */
export function findScreenMismatches({ routesSource, screensMd, issuesMd }) {
  const routes = parseRoutes(routesSource);
  const all = routes.map((r) => r.path);
  const inDiagram = routes.filter((r) => !NOT_IN_DIAGRAM.includes(r.group)).map((r) => r.path);
  const table = parseTablePaths(screensMd);
  const diagram = parseDiagramPaths(screensMd);
  const issues = parseIssuePaths(issuesMd);

  return [
    ...diff(all, table).map((p) => `${SCREENS_FILE} の画面の一覧に、ルート ${p} の行が無い`),
    ...diff(table, all).map((p) => `${SCREENS_FILE} の画面の一覧の ${p} は、${ROUTES_FILE} に無い`),
    ...diff(inDiagram, diagram).map(
      (p) => `${SCREENS_FILE} の導線図に、ルート ${p} のノードが無い`,
    ),
    ...diff(diagram, inDiagram).map((p) =>
      all.includes(p)
        ? `${SCREENS_FILE} の導線図の ${p} は、図に描かないグループ（${NOT_IN_DIAGRAM.join('・')}）のルート`
        : `${SCREENS_FILE} の導線図の ${p} は、${ROUTES_FILE} に無い（まだ無い画面はパスを書かない）`,
    ),
    ...diff(issues, all).map((p) => `${ISSUES_FILE} の ${p} は、${ROUTES_FILE} に無い`),
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (path) => readFileSync(path, 'utf8');
  const found = findScreenMismatches({
    routesSource: read(ROUTES_FILE),
    screensMd: read(SCREENS_FILE),
    issuesMd: read(ISSUES_FILE),
  });
  if (found.length) {
    for (const f of found) console.error(f);
    console.error(
      `画面一覧・導線図とルート定義の食い違いが ${found.length} 件あります（ルートの正は ${ROUTES_FILE}）`,
    );
    process.exit(1);
  }
  const count = parseRoutes(read(ROUTES_FILE)).length;
  console.log(`画面一覧・導線図がルート定義（${count} 件）と一致しています`);
}
