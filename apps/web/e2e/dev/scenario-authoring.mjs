// 画面だけでシナリオを作り、GM 不在で結末まで遊べることを、ブラウザで通しで確かめる（CI では回さない）。
// 2026-10-07、シナリオの公開 C2 の振り返り：毎回使い捨てのスクリプトを書き直し、そのたびに止まっていた。
//
// 使い方（リポジトリ直下で）:
//   1. pnpm -w web:dev:agent をバックグラウンドで起動する（書き込みは閉じたままでよい）
//   2. pnpm -w web:check:authoring
//   3. pnpm -w web:dev:agent:stop
// 書き込みを閉じた開発サーバーでは、シナリオは MSW のメモリにだけある。途中でリロードすると消えるので、
// 画面の移動は location.hash を変えて行う（page.goto・page.reload を使わない）。
// 書き込みを開いて流したときは、作ったファイルを最後に消し、scenarios/ の git の状態が戻ることを確かめる。

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5174/';
const SHOT = process.env.SHOT; // 指定するとスクリーンショットを残す
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// デッキの構造の行（種別のラベル「導入」「結末」と取り違えないよう、名前の欄で探す）
const row = (name) =>
  page.locator('[data-kind]').filter({ has: page.locator(`span:text-is("${name}")`) });
const shot = async (name) =>
  SHOT && page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
const go = (hash) =>
  page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
const save = async () => {
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].find((b) => b.textContent === '保存')?.disabled,
  );
};
const addChoice = async (name, target) => {
  await page.getByRole('button', { name: '＋カードを追加' }).click();
  await page.getByLabel('新しいカードの名前').fill(name);
  await page.getByLabel('種別').selectOption('choice');
  await page.getByRole('button', { name: '追加', exact: true }).click();
  await page
    .locator('[data-card-row]')
    .filter({ hasText: name })
    .locator('select[aria-label="移り先"]')
    .selectOption({ label: target });
};

let file = '';
try {
  const title = '村はずれの小道（作成の確かめ）';
  await page.goto(`${BASE}#/creator/scenarios`);
  await page.getByPlaceholder('シナリオのタイトル').fill(title);
  await page.getByRole('button', { name: '下書きを作成' }).click();
  await page.getByRole('heading', { level: 1, name: title }).waitFor();
  const id = page.url().split('/').pop();
  file = resolve(repo, 'scenarios', `${id}.json`);
  await page.getByRole('button', { name: 'シーンを追加' }).click();
  await save();

  await row('導入').getByRole('link', { name: '編集' }).click();
  await page.getByRole('heading', { name: '導入の情報' }).waitFor();
  await addChoice('村へ', 'シーン：1 新しいシーン');
  await shot('authoring-intro');
  await save();

  await go(`/creator/scenarios/${id}`);
  await row('1 新しいシーン').getByRole('link', { name: '編集' }).click();
  await page.getByRole('heading', { name: 'シーン情報' }).waitFor();
  await addChoice('帰る', '結末：結末');
  await save();

  await go(`/creator/scenarios/${id}`);
  await page.getByRole('heading', { level: 1, name: title }).waitFor();
  await row('1 新しいシーン').getByRole('button', { name: '削除' }).click();
  check(
    (await page.getByRole('alert').textContent())?.includes('から指されているので削除できません'),
    '移り先になっているシーンは削除できず、理由が出る',
  );
  await shot('authoring-delete-blocked');
  await page.locator('input[aria-label="結末タグ"]').fill('村を見た');
  await save();
  await page.getByRole('button', { name: 'シナリオ集へ公開' }).click();
  await page.getByText('シナリオ集に公開中').waitFor();

  await go(`/gm/scenarios/${id}`);
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '募集を出す' }) });
  await panel.getByLabel('GM 不在（PL が自由に始める）').check();
  await panel.locator('select:has(option[value="disabled"])').selectOption('disabled');
  check(
    (await panel.getByText(/先へ進む選択肢の無いシーンがあります/).count()) === 0,
    '先へ進めないシーンの注意が出ない',
  );
  await panel.getByRole('button', { name: /この構成で募集を出す/ }).click();
  await page.getByRole('heading', { name: '自分の募集' }).waitFor();

  await go('/pl/sessions');
  await page.getByLabel('GM 不在の募集だけ').check();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: title }) });
  await card.locator('select').first().selectOption('pc-jin');
  await card.getByRole('button', { name: 'この PC で始める' }).click();
  await page.getByRole('button', { name: /村へ/ }).click();
  await page.getByRole('button', { name: /帰る/ }).click();
  await page.getByRole('heading', { name: '結末「結末」' }).waitFor();
  check(
    (await page.getByText(/結末タグ『村を見た』を得た/).count()) > 0,
    'GM 不在で結末まで進み、結末タグを得る',
  );
  await shot('authoring-ending');
  check(
    errors.length === 0,
    `コンソールにエラーが無い${errors.length ? `：${errors.join(' / ')}` : ''}`,
  );
} finally {
  await browser.close();
  if (file) rmSync(file, { force: true });
  check(gitStatus() === before, 'scenarios/ の git の状態が始める前と同じ');
}
process.exit(failures.length ? 1 : 0);
