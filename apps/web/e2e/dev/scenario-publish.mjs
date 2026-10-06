// 開発サーバーでのシナリオの公開を、ブラウザで通しで確かめる（CI では回さない）。
// 単体テストでは確かめられない、Vite の HMR とファイルの監視に頼る振る舞いを見る（2026-10-07、PR #17 の振り返り。
// 書き直しで全体リロードが起きる競合は、ブラウザで初めて見つかった）。
//
// 使い方（リポジトリ直下で）:
//   1. CARTAGRAPH_WRITE_SCENARIOS=1 pnpm -w web:dev:agent をバックグラウンドで起動する（書き込みを開く）
//   2. pnpm -w web:check:publish
//   3. pnpm -w web:dev:agent:stop
// 確かめること：公開でファイルができ Biome の整形どおり／画面はリロードされない／リロード後に GM の一覧に出る／
// 非公開で draft に書き直す（既にあるファイルの書き直しでもリロードされない）／コンソールにエラーが無い。
// 作ったファイルは最後に必ず消し、scenarios/ の git の状態が始める前と同じであることを確かめる。
// MODE=demo にすると、書き込みを閉じた開発サーバーや preview で「保存されません」とファイルができないことを確かめる。

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5174/';
const MODE = process.env.MODE ?? 'write';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const gitStatus = () =>
  spawnSync('git', ['status', '--porcelain', 'scenarios/'], { cwd: repo, encoding: 'utf8' }).stdout;

const failures = [];
const check = (ok, label) => {
  process.stdout.write(`${ok ? 'OK' : 'NG'} ${label}\n`);
  if (!ok) failures.push(label);
};

const before = gitStatus();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const markReload = (n) =>
  page.evaluate((v) => {
    window.__reloadMarker = v;
  }, n);
const notReloaded = (n) => page.evaluate((v) => window.__reloadMarker === v, n);

let file = '';
try {
  const title = `公開の確かめ（${MODE}）`;
  await page.goto(`${BASE}#/creator/scenarios`);
  await page.getByPlaceholder('シナリオのタイトル').fill(title);
  await page.getByRole('button', { name: '下書きを作成' }).click();
  await page.getByRole('heading', { level: 1, name: title }).waitFor();
  const id = page.url().split('/').pop();
  file = resolve(repo, 'scenarios', `${id}.json`);

  await markReload(1);
  await page.getByRole('button', { name: 'シナリオ集へ公開' }).click();
  if (MODE === 'demo') {
    await page.getByText('デモのため保存されません（リロードで消えます）').waitFor();
    check(!existsSync(file), 'デモではファイルができない');
  } else {
    await page.getByText(`scenarios/${id}.json に保存しました`).waitFor();
    check(existsSync(file), '公開でファイルができる');
    check(JSON.parse(readFileSync(file, 'utf8')).libraryStatus === 'published', 'published で書く');
    const biome = spawnSync(
      process.execPath,
      [resolve(repo, 'node_modules/@biomejs/biome/bin/biome'), 'check', `scenarios/${id}.json`],
      { cwd: repo, encoding: 'utf8' },
    );
    check(biome.status === 0, 'Biome の整形どおり');
    await page.waitForTimeout(2500);
    check(await notReloaded(1), '新しいファイルを書いても画面はリロードされない');

    await page.reload();
    await page.goto(`${BASE}#/gm/scenarios`);
    await page.getByRole('link', { name: title }).waitFor();
    check(true, 'リロード後に GM のシナリオ一覧に出る');

    await page.goto(`${BASE}#/creator/scenarios/${id}`);
    await page.getByRole('button', { name: '非公開にする' }).waitFor();
    await markReload(2);
    await page.getByRole('button', { name: '非公開にする' }).click();
    await page.getByText(`scenarios/${id}.json に保存しました`).waitFor();
    await page.waitForTimeout(2500);
    check(
      JSON.parse(readFileSync(file, 'utf8')).libraryStatus === 'draft',
      '非公開で draft に書き直す',
    );
    check(await notReloaded(2), '既にあるファイルを書き直しても画面はリロードされない');
  }
  check(
    errors.length === 0,
    `コンソールにエラーが無い${errors.length ? `：${errors.join(' / ')}` : ''}`,
  );
} finally {
  await browser.close();
  if (file) rmSync(file, { force: true });
  check(
    gitStatus() === before,
    'scenarios/ の git の状態が始める前と同じ（作ったファイルを消した）',
  );
}
process.exit(failures.length ? 1 : 0);
