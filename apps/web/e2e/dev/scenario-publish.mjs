// 開発サーバーでのシナリオの公開を、ブラウザで通しで確かめる（CI では回さない）。
// 単体テストでは確かめられない、Vite の HMR とファイルの監視に頼る振る舞いを見る（2026-10-07、PR #17 の振り返り。
// 書き直しで全体リロードが起きる競合は、ブラウザで初めて見つかった）。
//
// 使い方（リポジトリ直下で）:
//   1. CARTAGRAPH_WRITE_SCENARIOS=1 pnpm -w web:dev:agent をバックグラウンドで起動する（書き込みを開く）
//   2. pnpm -w web:check:publish
//   3. pnpm -w web:dev:agent:stop
// 確かめること：公開でファイルができ Biome の整形どおり／画面はリロードされない／リロード後に GM の一覧に出る／
// 公開中に保存しただけではファイルは変わらず、リロードで公開していない編集が消える／公開し直すと書き直す／
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

    // 保存は下書きだけ。ファイルは変わらず、リロードすると公開していない編集は消える
    // （docs/plans/2026-10-11-シナリオの下書きのAPI.md D5・G7）
    const titleInFile = () => JSON.parse(readFileSync(file, 'utf8')).title;
    await page.goto(`${BASE}#/creator/scenarios/${id}`);
    await page.getByLabel('タイトル').fill(`${title}（直しかけ）`);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('下書きを保存しました。').waitFor();
    await page.getByText('公開版と違う変更あり').waitFor();
    check(titleInFile() === title, '公開中に保存しただけではファイルは変わらない');
    await page.reload();
    await page.getByRole('heading', { level: 1, name: title }).waitFor();
    check(
      (await page.getByText('公開版と違う変更あり').count()) === 0,
      'リロードすると公開していない編集は消え、下書きが公開版から作り直される',
    );

    await page.getByLabel('タイトル').fill(`${title}（改）`);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('下書きを保存しました。').waitFor();
    await markReload(3);
    await page.getByRole('button', { name: '公開し直す' }).click();
    await page.getByText(`scenarios/${id}.json に保存しました`).waitFor();
    await page.waitForTimeout(2500);
    check(titleInFile() === `${title}（改）`, '公開し直すとファイルを書き直す');
    check(await notReloaded(3), '公開し直しで書き直しても画面はリロードされない');

    await page.getByRole('button', { name: '非公開にする' }).waitFor();
    await markReload(2);
    await page.getByRole('button', { name: '非公開にする' }).click();
    await page.getByText(`scenarios/${id}.json に保存しました`).waitFor();
    await page.waitForTimeout(2500);
    check(
      JSON.parse(readFileSync(file, 'utf8')).libraryStatus === 'draft',
      '非公開でシナリオ集から外した状態（draft）に書き直す',
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
