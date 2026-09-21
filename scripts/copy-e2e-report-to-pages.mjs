// GitHub Pages 用に、Playwright の HTML レポートを VitePress の dist 配下 (e2e-report/) へコピーする。
// Pages は 1 サイト 1 アーティファクトなので、docs と app と同じ dist に同居させる。
//
// copy-web-to-pages.mjs と異なり、ソースが無くてもデプロイ全体を失敗させない（exit 0 で正常終了する）。
// このスクリプトは deploy.yml で `if: always()` 実行される（E2Eが失敗してもデプロイは止めない方針のため）。
// webServer の起動自体が失敗するなどでレポートが1つも生成されなかった場合、ここで exit 1 にすると
// 「E2E失敗時もデプロイは進める」という方針が壊れてしまうため、警告を出すだけにとどめる。
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('apps/web/playwright-report');
const dest = resolve('docs/.vitepress/dist/e2e-report');

if (!existsSync(src)) {
  console.warn(`e2e report not found (skipped): ${src}`);
  process.exit(0);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`copied ${src} -> ${dest}`);
