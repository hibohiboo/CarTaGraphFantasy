// キャラクター作成と村はずれの一歩のお店が rules/*.json のルールどおりに動くことを、ブラウザで通しで確かめる（CI では回さない）。
// 2026-10-10、ルールとカードプールの JSON 管理の振り返り：確かめのスクリプトを使い捨てにせず残す。
//
// 使い方（リポジトリ直下で）:
//   1. pnpm -w web:dev:agent をバックグラウンドで起動する
//   2. pnpm -w web:check:character
//   3. pnpm -w web:dev:agent:stop
// 値（合計・範囲・CP 予算）は rules/character-creation.json と rules/cards.json から読み、ここに書き写さない。
// 画面の移動は location.hash で行う（書き込みを閉じた開発サーバーでは、リロードするとメモリの状態が消える）。

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5174/';
const SHOT = process.env.SHOT; // 指定するとスクリーンショットを残す
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const readJson = (p) => JSON.parse(readFileSync(resolve(repo, p), 'utf8'));
const creation = readJson('rules/character-creation.json');
const cards = readJson('rules/cards.json').cards;
const { total, min, max } = creation.abilities;

const failures = [];
const check = (ok, label) => {
  process.stdout.write(`${ok ? 'OK' : 'NG'} ${label}\n`);
  if (!ok) failures.push(label);
};

/** 基本カードプールから、CP コストの合計がちょうど target になる組（apps/web/src/test/rulesHelpers.ts と同じ考え方） */
function cardsCosting(target) {
  const pool = creation.basicPoolCardIds.map((id) => cards.find((c) => c.id === id));
  const pick = (from, rest) => {
    if (rest === 0) return [];
    for (let i = from; i < pool.length; i++) {
      const cost = pool[i].cpCost ?? 0;
      if (cost > 0 && cost <= rest) {
        const tail = pick(i + 1, rest - cost);
        if (tail) return [pool[i], ...tail];
      }
    }
    return null;
  };
  const found = pick(0, target);
  if (!found) throw new Error(`CP の合計が ${target} になるカードの組が基本カードプールに無い`);
  return found;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = async (name) =>
  SHOT && page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
const go = (hash) =>
  page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
const ability = (label) => page.getByRole('spinbutton', { name: label });
const setAbilities = async (body, skill, mind) => {
  await ability('体').fill(String(body));
  await ability('技').fill(String(skill));
  await ability('心').fill(String(mind));
};
/** 名前に合う、押せるボタンを待ってから押す */
const click = async (name) => {
  await page.waitForFunction(
    (src) =>
      [...document.querySelectorAll('button')].some(
        (b) => new RegExp(src).test(b.textContent ?? '') && !b.disabled,
      ),
    name.source,
  );
  await page.getByRole('button', { name }).first().click();
};

try {
  // ---- キャラクター作成 ----
  await page.goto(`${BASE}#/pl/characters/new`);
  await page.getByText('基本カードプール').first().waitFor();
  await page.getByLabel('名前').fill('確かめ');
  const create = page.getByRole('button', { name: 'このPCを作成する' });
  check(
    await page.getByText(`合計 ${total} / ${total}（配分方法は未決の仮ルール）`).isVisible(),
    '能力値の初期値の合計がルールの合計で、仮ルールと示す',
  );
  check(
    await page.getByText(`HP ${creation.initialHp} で始める（仮ルール）`).isVisible(),
    '作成時の HP をルールの値で、仮ルールと示す',
  );
  check(
    (await ability('体').getAttribute('max')) === String(max) &&
      (await ability('体').getAttribute('min')) === String(min),
    '入力欄の範囲がルールの範囲',
  );
  // 合計は合うが、体が上限を1超える
  await setAbilities(max + 1, total - (max + 1) - min, min);
  check(await create.isDisabled(), '合計は合うが範囲外の能力値では作成できない');
  await shot('character-out-of-range');
  await setAbilities(max, total - max - min, min);
  check(await create.isEnabled(), '範囲内で合計がちょうどなら作成できる');
  for (const c of cardsCosting(creation.cpBudget))
    await page
      .getByRole('button', { name: new RegExp(c.name) })
      .first()
      .click();
  check(
    await page.getByText(`${creation.cpBudget} / ${creation.cpBudget}`).isVisible(),
    'CP 予算をちょうど使い切る',
  );
  check(await create.isEnabled(), 'CP 予算をちょうど使い切っても作成できる');
  await shot('character-budget');

  // ---- 村はずれの一歩：お店で斬撃を習って試験まで ----
  const session = await page.evaluate(async () => {
    const r = await fetch('/api/scenarios/sc-village-start/start-solo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '新人' }),
    });
    return r.json();
  });
  await go(`/pl/sessions/${session.id}/play`);
  for (const name of [
    /村の広場へ向かう/,
    /依頼「畑を荒らす猪」/,
    /柵で畑を囲む/,
    /お店へ行く/,
    /斬撃を習う/,
  ])
    await click(name);
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('button')].some((b) => /斬撃を習う/.test(b.textContent ?? '')),
  );
  for (const name of [/お店を出る/, /街の冒険者ギルドへ向かう/, /街の門をくぐる/])
    await click(name);
  const panel = page.getByRole('region', { name: '戦い方を決める' });
  await panel.waitFor();
  const slash = cards.find((c) => c.id === 'c-slash');
  check(
    await panel.getByRole('button', { name: `「${slash.name}」をリストに入れる` }).isVisible(),
    'お店で習った斬撃（rules/cards.json）を、試験の戦い方に入れられる',
  );
  check(
    (await panel.getByText(`コスト${slash.actionCost}`).count()) > 0,
    '斬撃のコストが rules/cards.json の値',
  );
  await shot('village-exam');
  check(
    errors.length === 0,
    `コンソールにエラーが無い${errors.length ? `：${errors.join(' / ')}` : ''}`,
  );
} finally {
  await browser.close();
}
process.exit(failures.length ? 1 : 0);
