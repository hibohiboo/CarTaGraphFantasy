// docs の見出しへのリンク（`xxx.md#見出し` と `#見出し`）が、ビルド結果の見出しIDに実在するかを確かめる。
// `vitepress build` はページへのリンク切れは見るが、見出しのアンカーまでは見ないため、その穴を埋める。
// 対象：docs/ の Markdown（ビルド対象外の docs/plans/ を除く）と、アプリのルールブック要約の出典
// （apps/web/src/content/rulebook.ts の source）。`pnpm docs:build` の最後に実行する。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const docs = join(root, 'docs');
const dist = join(docs, '.vitepress', 'dist');
const rulebook = join(root, 'apps', 'web', 'src', 'content', 'rulebook.ts');

/** docs/ 配下の Markdown（.vitepress・public・plans は除く） */
function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (['.vitepress', 'public', 'plans', 'node_modules'].includes(name)) return [];
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

const idsByPage = new Map();
/** ビルド結果のページにある id の一覧（ページが無ければ null） */
function idsOf(mdPath) {
  const html = join(dist, relative(docs, mdPath).replace(/\.md$/, '.html'));
  if (!idsByPage.has(html)) {
    idsByPage.set(
      html,
      existsSync(html)
        ? new Set(
            [...readFileSync(html, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) =>
              m[1]
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'"),
            ),
          )
        : null,
    );
  }
  return idsByPage.get(html);
}

const problems = [];
function check(from, mdPath, anchor) {
  const ids = idsOf(mdPath);
  if (ids === null)
    problems.push(`${from}: リンク先のページがビルド結果に無い（${relative(root, mdPath)}）`);
  else if (!ids.has(decodeURIComponent(anchor)))
    problems.push(`${from}: 見出し「#${anchor}」が ${relative(root, mdPath)} に無い`);
}

if (!existsSync(dist)) {
  console.error('docs/.vitepress/dist がありません。先に vitepress build docs を実行してください');
  process.exit(1);
}

let count = 0;
for (const file of markdownFiles(docs)) {
  // コードブロックの中のリンクは対象外
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const [, target, anchor] of text.matchAll(/\]\(([^)\s#]*)#([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue; // 外部リンク
    if (target && !target.endsWith('.md')) continue;
    count++;
    check(relative(root, file), target ? resolve(dirname(file), target) : file, anchor);
  }
}
for (const [, page, anchor] of readFileSync(rulebook, 'utf8').matchAll(
  /source:\s*'([^'#]+)#([^']+)'/g,
)) {
  count++;
  check(relative(root, rulebook), join(docs, `${page}.md`), anchor);
}

if (problems.length > 0) {
  console.error(
    `見出しへのリンク ${count} 件のうち ${problems.length} 件の見出しが見つかりません：`,
  );
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`見出しへのリンク ${count} 件を確かめました（すべて実在）`);
