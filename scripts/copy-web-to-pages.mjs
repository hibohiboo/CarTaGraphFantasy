// GitHub Pages 用に、React アプリのビルド成果物を VitePress の dist 配下 (app/) へコピーする。
// Pages は 1 サイト 1 アーティファクトなので、docs と app を同じ dist に同居させる。
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('apps/web/dist');
const dest = resolve('docs/.vitepress/dist/app');

if (!existsSync(src)) {
  console.error(`web build not found: ${src}`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`copied ${src} -> ${dest}`);
