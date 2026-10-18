import { expect, type Page, test } from '@playwright/test';

/**
 * シナリオを画面だけで作り、公開し、GM 不在で結末まで遊ぶ通し（SC-1・2・3・5・6・8、PL-2）。
 * 他人のシナリオを開いても読むだけで、コンソールに誤りが出ないことも確かめる。
 *
 * 画面の状態はメモリ（MSW）にだけあり、リロードで消える。page.goto は最初の1回だけにして、
 * 画面の移動は画面内のリンクか location.hash で行う。
 * 書き方の正は docs/process/rules/testing.md「ユースケースの E2E」。
 * （2026-10-07 の scenario-authoring.mjs を移したもの。mjs の「scenarios/ の git の状態が始める前と同じ」は、
 * preview が書き込まないので外した。書き込みが閉じていることは、公開したときの表示で確かめる）
 */

const TITLE = '村はずれの小道（作成の確かめ）';

/** デッキの構造の行（種別のラベル「導入」「結末」と取り違えないよう、名前の欄で探す） */
const deckRow = (page: Page, name: string) =>
  page.locator('[data-kind]').filter({ has: page.locator(`span:text-is("${name}")`) });

const go = (page: Page, hash: string) =>
  page.evaluate((h) => {
    window.location.hash = h;
  }, hash);

const save = async (page: Page) => {
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
};

const addChoice = async (page: Page, name: string, target?: string) => {
  await page.getByRole('button', { name: '＋カードを追加' }).click();
  await page.getByLabel('新しいカードの名前').fill(name);
  await page.getByLabel('種別').selectOption('choice');
  await page.getByRole('button', { name: '追加', exact: true }).click();
  const row = page.locator('[data-card-row]').filter({ hasText: name });
  if (target) await row.locator('select[aria-label="移り先"]').selectOption({ label: target });
};

test('シナリオを画面だけで作り、公開し、GM 不在で結末まで遊ぶ', {
  tag: ['@SC-1', '@SC-2', '@SC-3', '@SC-5', '@SC-6', '@SC-8', '@PL-2'],
}, async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/#/creator/scenarios');
  let id = '';

  await test.step('SC-1 下書きを作る', async () => {
    await page.getByPlaceholder('シナリオのタイトル').fill(TITLE);
    await page.getByRole('button', { name: '下書きを作成' }).click();
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    id = page.url().split('/').pop() ?? '';
    expect(id).not.toBe('');
    await page.getByRole('button', { name: 'シーンを追加' }).click();
    await save(page);

    // 案内の「開く」で、畳んだ「公開の前に決めること」が開いて概要を入力できる（jsdom では畳んでいても操作できるので、実ブラウザで確かめる）
    const guide = page.getByRole('region', { name: '次にすること' });
    await expect(guide).toBeVisible();
    // 入力すると label の文字に textarea の中身が混ざる（getByLabel の exact が外れる）ので、見出しの span から引く
    const summary = page.locator('label:has(> span:text-is("概要")) textarea');
    await expect(summary).toBeHidden();
    await guide.getByRole('button', { name: '開く' }).click();
    await summary.fill('村はずれの小道を歩く短い話。');
    await expect(summary).toBeVisible();
    await save(page);
  });

  await test.step('SC-2 導入に選択肢を置き、シーンへ移る', async () => {
    await deckRow(page, '導入').getByRole('link', { name: '編集' }).click();
    await expect(page.getByRole('heading', { name: '導入の情報' })).toBeVisible();
    await addChoice(page, '村へ', 'シーン：1 新しいシーン');
    await save(page);
  });

  await test.step('SC-5 行き止まりを見つける', async () => {
    // シナリオ編集の「公開の前の確かめ」に、選択肢の無いシーンが挙がる
    await go(page, `/creator/scenarios/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole('region', { name: '公開の前の確かめ' })).toContainText(
      'ここで先へ進めません',
    );

    // シーン編集の「このシーンの注意」は、区画に絞って両側を確かめる（(a) 選択肢が無い (b) 移り先が空 (c) 移り先を選ぶと消える）
    await deckRow(page, '1 新しいシーン').getByRole('link', { name: '編集' }).click();
    await expect(page.getByRole('heading', { name: 'シーン情報' })).toBeVisible();
    const warnings = page.getByRole('region', { name: 'このシーンの注意' });
    await expect(warnings).toContainText('先へ進む選択肢がありません');

    // GM 不在で遊ぶとき、移り先の無い選択肢は定型の描写で返る。PL-2 で使うので足しておく
    await addChoice(page, 'ためらう');
    await expect(warnings).toContainText('先へ進む選択肢がありません');

    await addChoice(page, '帰る', '結末：結末');
    await expect(warnings).toHaveCount(0);
    await save(page);
  });

  await test.step('SC-2 移り先のシーンは消せない', async () => {
    await go(page, `/creator/scenarios/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await deckRow(page, '1 新しいシーン').getByRole('button', { name: '削除' }).click();
    await expect(page.getByRole('alert')).toContainText('から指されているので削除できません');
  });

  await test.step('SC-3 結末タグを決める', async () => {
    await page.locator('input[aria-label="結末タグ"]').fill('村を見た');
    await save(page);
  });

  await test.step('SC-2 未保存のまま移ろうとすると確かめが出る', async () => {
    // 止められるのは画面内のリンク・戻るだけ。location.hash を直接書く移動はルーターの外なので止められない
    const titleInput = page.getByLabel('タイトル', { exact: true });
    await titleInput.fill(`${TITLE}（編集中）`);

    const first = page.waitForEvent('dialog');
    const back = page.getByRole('link', { name: '一覧へ戻る' }).click();
    await (await first).dismiss();
    await back;
    // 断ると、編集の画面にしか無い要素が残り、一覧の画面にしか無い要素は出ない
    await expect(titleInput).toHaveValue(`${TITLE}（編集中）`);
    await expect(page.getByPlaceholder('シナリオのタイトル')).toHaveCount(0);

    const second = page.waitForEvent('dialog');
    const back2 = page.getByRole('link', { name: '一覧へ戻る' }).click();
    await (await second).accept();
    await back2;
    await expect(page.getByPlaceholder('シナリオのタイトル')).toBeVisible();

    // 確かめを断った編集は捨てられている
    await go(page, `/creator/scenarios/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: TITLE, exact: true })).toBeVisible();
  });

  await test.step('SC-6 シナリオ集へ公開する', async () => {
    await expect(page.getByRole('region', { name: '公開の前の確かめ' })).toContainText(
      '問題はありません',
    );
    await page.getByRole('button', { name: 'シナリオ集へ公開' }).click();
    await expect(page.getByText('シナリオ集に公開中')).toBeVisible();
    // 書き込みを閉じた preview では、ファイルに書かずメモリにだけ置く
    await expect(page.getByText('デモのため保存されません')).toBeVisible();
  });

  await test.step('SC-8 公開した版を読み、GM 不在の募集を出す', async () => {
    await go(page, `/gm/scenarios/${id}`);
    const panel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '募集を出す' }) });
    await panel.getByLabel('GM 不在（PL が自由に始める）').check();
    await panel.locator('select:has(option[value="disabled"])').selectOption('disabled');
    // 出ない側しか見られない。出る側は Vitest（gmlessHelpers.ts の DEAD_END）が守る
    await expect(panel.getByText(/先へ進む選択肢の無いシーンがあります/)).toHaveCount(0);
    await panel.getByRole('button', { name: /この構成で募集を出す/ }).click();
    await expect(page.getByRole('heading', { name: '自分の募集' })).toBeVisible();

    // 他人のシナリオは、シナリオ編集・シーン編集とも公開版を読むだけ（コンソールに 403・404 を出さない）
    await go(page, '/creator/scenarios/sc-gray-mansion');
    await expect(page.getByText(/製作者でないため編集できません/)).toBeVisible();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    await go(page, '/creator/scenarios/sc-gray-mansion/scenes/d-s2');
    await expect(page.getByText(/製作者でないため編集できません/)).toBeVisible();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);

    // 読み取り専用のつながりのリンクは、無効の fieldset の中でも実ブラウザでは押せる
    const linksPanel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'つながり' }) });
    const before = page.url();
    await linksPanel.getByRole('link').first().click();
    await expect(page).not.toHaveURL(before);
    await expect(page).toHaveURL(/\/scenes\//);
    await expect(page.getByRole('heading', { name: 'シーン情報' })).toBeVisible();
  });

  await test.step('PL-2 GM 不在で、手札のカードをプレイして結末まで進む', async () => {
    await go(page, '/pl/sessions');
    await page.getByLabel('GM 不在の募集だけ').check();
    const card = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: TITLE }) });
    await card.locator('select').first().selectOption('pc-jin');
    await card.getByRole('button', { name: 'この PC で始める' }).click();
    await page.getByRole('button', { name: /村へ/ }).click();

    // (a) 移り先の無い選択肢は、システムが描写を返し、そのカードだけが手札から消える（GM の描写は待たない）
    await expect(page.getByRole('button', { name: /ためらう/ })).toBeVisible();
    await page.getByRole('button', { name: /ためらう/ }).click();
    await expect(page.getByText('は「ためらう」を試みた。')).toBeVisible();
    await expect(page.getByRole('button', { name: /ためらう/ })).toHaveCount(0);
    await expect(page.getByText(/GMの描写を待っている/)).toHaveCount(0);

    // (b) 移り先のある選択肢で結末に達し、結末タグを得て、その場で終わる
    await page.getByRole('button', { name: /帰る/ }).click();
    await expect(page.getByRole('heading', { name: '結末「結末」' })).toBeVisible();
    await expect(page.getByText(/結末タグ『村を見た』を得た/)).toBeVisible();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
