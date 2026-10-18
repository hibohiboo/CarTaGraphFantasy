import { expect, test } from '@playwright/test';

/**
 * GM が描写を書いて選択肢を配り・取り下げ、ドライバーとして手札のカードをプレイする通し（PL-1・PL-2）。
 * 自分の募集（灰色館の一夜）から画面だけで始める。GM が PL を兼ねて、同じ画面から行き来する。
 * 提案と裁定（PL-3・PL-4）はスコープ外（Vitest の pages.test.tsx が守る）。
 * 画面の状態はメモリ（MSW）にだけあるので、page.goto は最初の1回だけにする。
 * 書き方の正は docs/process/rules/testing.md「ユースケースの E2E」。
 */

test('GM が描写を書いて選択肢を配り・取り下げ、ドライバーとしてプレイする', {
  tag: ['@PL-1', '@PL-2'],
}, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/#/gm/sessions');

  // 下ごしらえ（ユースケースではない。セッション運営の「セッションを始める」）
  await test.step('自分の募集からセッションを始める', async () => {
    const recruitment = page
      .locator('article')
      .filter({ has: page.getByLabel('ジン（ユウ）を参加させる') });
    await recruitment.getByLabel('ジン（ユウ）を参加させる').check();
    await recruitment.getByLabel('ジンをドライバーにする').check();
    await recruitment.getByRole('button', { name: 'セッションを始める' }).click();
  });

  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '描写と選択肢を配る' }) });

  await test.step('PL-1 描写を書き、選択肢を配る・取り下げる', async () => {
    await panel.getByLabel('描写', { exact: true }).fill('静かな夜だ。');
    await panel.getByRole('button', { name: '選択肢を足す' }).click();
    await panel.getByLabel('選択肢1の名前').fill('耳を澄ます');
    await panel.getByRole('button', { name: '選択肢を足す' }).click();
    await panel.getByLabel('選択肢2の名前').fill('辺りを見回す');
    await panel.getByRole('button', { name: '送る' }).click();
    await expect(panel.getByLabel('「耳を澄ます」を取り下げる')).toBeVisible();
    await expect(panel.getByLabel('「辺りを見回す」を取り下げる')).toBeVisible();

    // 1枚を取り下げる（取り下げだけでも送れる）
    await panel.getByLabel('「辺りを見回す」を取り下げる').check();
    await panel.getByRole('button', { name: '送る' }).click();
    await expect(panel.getByLabel('「辺りを見回す」を取り下げる')).toHaveCount(0);
    await expect(panel.getByLabel('「耳を澄ます」を取り下げる')).toBeVisible();
  });

  await test.step('PL-2 ドライバーとして、手札のカードをプレイする', async () => {
    await page.getByRole('link', { name: 'ドライバーとしてプレイ画面へ' }).click();
    // 描写は GM の画面にも出るので、プレイ画面にしか無いリンクが出るのを待ってから確かめる
    await expect(page.getByRole('link', { name: 'GMの画面へ' })).toBeVisible();
    await expect(page.getByText('静かな夜だ。')).toBeVisible();
    // 手札は名前をそのまま指定して探す（「選択肢＋新たな選択肢を提案」も「選択肢」で始まる）
    await expect(page.getByRole('button', { name: /耳を澄ます/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /辺りを見回す/ })).toHaveCount(0);

    // GM が人間のセッションでは、移り先の無い選択肢は GM の描写を待つ
    await page.getByRole('button', { name: /耳を澄ます/ }).click();
    await expect(page.getByText(/GMの描写を待っている/)).toBeVisible();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
