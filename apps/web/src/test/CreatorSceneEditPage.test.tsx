// docs/plans/2026-09-16-scene-builder.md の「5. 新規テストケース」に対応する。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routeObjects } from '../app/router';
import { loadCardImage } from '../lib/cardImageStorage';

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const SCENE_URL = '/creator/scenarios/sc-gray-mansion/scenes/d-s2';

describe('CreatorSceneEditPage', () => {
  it('シーン名・目的・終了条件を編集して保存すると、再取得結果に反映される', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByRole('heading', { level: 1, name: '3-2 奥の扉' });

    await user.clear(screen.getByLabelText('シーン名'));
    await user.type(screen.getByLabelText('シーン名'), '3-2 奥の扉（改）');
    await user.type(screen.getByLabelText('目的（仮）'), 'PLに選択を促す');
    await user.type(screen.getByLabelText('終了条件（仮）'), '選択肢がプレイされたら次へ');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: '3-2 奥の扉（改）' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('目的（仮）')).toHaveValue('PLに選択を促す');
    expect(screen.getByLabelText('終了条件（仮）')).toHaveValue('選択肢がプレイされたら次へ');
  });

  it('目的・終了条件の欄に「仮」の表示がある', async () => {
    renderAt(SCENE_URL);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByLabelText('目的（仮）')).toBeInTheDocument();
    expect(screen.getByLabelText('終了条件（仮）')).toBeInTheDocument();
    expect(screen.getByText(/未決の仮ルール/)).toBeInTheDocument();
  });

  it('ロケーションカードを差し替えると場所が変わる', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByText('奥の扉');

    await user.click(screen.getByRole('button', { name: '差し替え' }));
    await user.clear(screen.getByLabelText('新しいロケーション名'));
    await user.type(screen.getByLabelText('新しいロケーション名'), '崩れた階段');
    await user.click(screen.getByRole('button', { name: '確定' }));

    expect(screen.getByText('崩れた階段')).toBeInTheDocument();
    expect(screen.queryByText('奥の扉')).not.toBeInTheDocument();
  });

  it('ロケーションが無いシーンでは「ロケーションを設定」ボタンが出て、設定すると1枚追加される', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon/scenes/g-s1');
    await screen.findByRole('heading', { level: 1, name: '1 鎖の桟橋' });

    expect(screen.queryByRole('button', { name: '差し替え' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ロケーションを設定' }));
    await user.type(screen.getByLabelText('新しいロケーション名'), '桟橋の先端');
    await user.click(screen.getByRole('button', { name: '確定' }));

    expect(screen.getByText('桟橋の先端')).toBeInTheDocument();
  });

  it.each([
    ['npc', 'NPC'],
    ['info', '情報'],
    ['choice', '選択肢'],
    ['enemy', 'エネミー'],
  ])('%sカードを新規追加すると、%sラベルで一覧に増える', async (kind, label) => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: '＋カードを追加' }));
    await user.type(screen.getByLabelText('新しいカードの名前'), `テスト${kind}`);
    await user.selectOptions(screen.getByLabelText('種別'), kind);
    await user.click(screen.getByRole('button', { name: '追加' }));

    const item = screen.getByText(`テスト${kind}`).closest('li');
    if (!item) throw new Error('カード行が見つからない');
    expect(within(item).getByText(label)).toBeInTheDocument();
  });

  it('カード名を空のまま追加しようとすると追加されず、インラインエラーが出る', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: '＋カードを追加' }));
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(screen.getByText('名前を入力してください')).toBeInTheDocument();
  });

  it('カードを削除すると一覧から消える', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByText('何かが書かれた紙');

    const row = screen.getByText('何かが書かれた紙').closest('[data-card-row]');
    if (!row) throw new Error('カード行が見つからない');
    await user.click(within(row as HTMLElement).getByRole('button', { name: '削除' }));

    expect(screen.queryByText('何かが書かれた紙')).not.toBeInTheDocument();
  });

  it('ゾーン（GM専用⇄PL可視）を切り替えられる', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    const row = (await screen.findByText('何かが書かれた紙')).closest(
      '[data-card-row]',
    ) as HTMLElement;

    const zoneButton = within(row).getByRole('button', { name: /ゾーン/ });
    const before = zoneButton.textContent;
    await user.click(zoneButton);
    expect(zoneButton.textContent).not.toBe(before);
  });

  it('裏表（faceDown）を切り替えられる', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    const row = (await screen.findByText('何かが書かれた紙')).closest(
      '[data-card-row]',
    ) as HTMLElement;

    // info-letter は fixtures 上 faceDown: true なので、最初は「表にする」
    const flipButton = within(row).getByRole('button', { name: /裏|表/ });
    const before = flipButton.textContent;
    await user.click(flipButton);
    expect(flipButton.textContent).not.toBe(before);
  });

  it('画像をアップロードして保存すると、localStorageに書き込まれる', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    const row = (await screen.findByText('何かが書かれた紙')).closest(
      '[data-card-row]',
    ) as HTMLElement;
    const cardId = row.dataset.cardId as string;

    const file = new File(['dummy'], 'x.png', { type: 'image/png' });
    const fileInput = within(row).getByLabelText('画像を選択') as HTMLInputElement;
    await user.upload(fileInput, file);
    await within(row).findByText('画像を設定済み（未保存）');
    expect(loadCardImage(cardId)).toBeUndefined();

    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(loadCardImage(cardId)).toMatch(/^data:/));
  });

  it('portraitUrlが無いカードで、事前にlocalStorageへ値がある場合は画面表示に反映される', async () => {
    const { saveCardImage } = await import('../lib/cardImageStorage');
    saveCardImage('loc-door', 'data:image/png;base64,PREEXISTING');

    renderAt(SCENE_URL);
    await screen.findByText('奥の扉');

    expect(screen.getByText('保存済みの画像を表示中')).toBeInTheDocument();
  });

  it('存在しないsceneIdでアクセスするとエラー表示になる', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion/scenes/no-such-scene');
    expect(await screen.findByText(/見つかりません/)).toBeInTheDocument();
  });

  it('独立プールノード（d-npc）のidをURLで直接指定してもエラー表示になる（kind!==sceneのため）', async () => {
    renderAt('/creator/scenarios/sc-gray-mansion/scenes/d-npc');
    expect(await screen.findByText(/見つかりません/)).toBeInTheDocument();
  });

  it('エネミーカードには裏表を切り替えるボタンが出ない（card-face-back.mdの決着どおり）', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: '＋カードを追加' }));
    await user.type(screen.getByLabelText('新しいカードの名前'), 'テスト敵');
    await user.selectOptions(screen.getByLabelText('種別'), 'enemy');
    await user.click(screen.getByRole('button', { name: '追加' }));

    const row = screen.getByText('テスト敵').closest('[data-card-row]');
    if (!row) throw new Error('カード行が見つからない');
    expect(
      within(row as HTMLElement).queryByRole('button', { name: /裏|表/ }),
    ).not.toBeInTheDocument();
  });

  it('カードが0枚のシーンでも一覧が空で表示され、追加できる', async () => {
    const user = userEvent.setup();
    renderAt('/creator/scenarios/sc-galleon/scenes/g-s3');
    await screen.findByRole('heading', { level: 1, name: '3 船長室' });
    expect(screen.getByText('まだカードがありません')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '＋カードを追加' }));
    await user.type(screen.getByLabelText('新しいカードの名前'), '船長の日誌');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(screen.getByText('船長の日誌')).toBeInTheDocument();
    expect(screen.queryByText('まだカードがありません')).not.toBeInTheDocument();
  });

  it('空白のみのカード名は追加できない', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: '＋カードを追加' }));
    await user.type(screen.getByLabelText('新しいカードの名前'), '   ');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(screen.getByText('名前を入力してください')).toBeInTheDocument();
  });

  it('空白のみのロケーション名では確定できない', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByText('奥の扉');

    await user.click(screen.getByRole('button', { name: '差し替え' }));
    await user.clear(screen.getByLabelText('新しいロケーション名'));
    await user.type(screen.getByLabelText('新しいロケーション名'), '   ');
    await user.click(screen.getByRole('button', { name: '確定' }));

    expect(screen.getByText('奥の扉')).toBeInTheDocument();
  });

  it('画像サイズが大きいと警告が表示される', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    const row = (await screen.findByText('何かが書かれた紙')).closest(
      '[data-card-row]',
    ) as HTMLElement;

    // data URL換算で 200KB を超えるダミーファイル（テキストでも FileReader は dataURL 化する）
    const big = new File([new Uint8Array(250 * 1024)], 'big.png', { type: 'image/png' });
    const fileInput = within(row).getByLabelText('画像を選択') as HTMLInputElement;
    await user.upload(fileInput, big);

    expect(await within(row).findByText('画像サイズが大きめです')).toBeInTheDocument();
  });

  it('画像のlocalStorage保存が失敗しても、シナリオ本体の保存は成功する', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    const row = (await screen.findByText('何かが書かれた紙')).closest(
      '[data-card-row]',
    ) as HTMLElement;

    const file = new File(['dummy'], 'x.png', { type: 'image/png' });
    const fileInput = within(row).getByLabelText('画像を選択') as HTMLInputElement;
    await user.upload(fileInput, file);
    await within(row).findByText('画像を設定済み（未保存）');

    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await user.type(screen.getByLabelText('シーン名'), '（改）');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/画像の保存に失敗しました/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /3-2 奥の扉（改）/ }),
      ).toBeInTheDocument(),
    );
    setItem.mockRestore();
  });

  it('シーンを編集・保存しても、独立プールノード（d-npc）の内容は変化しない', async () => {
    const user = userEvent.setup();
    renderAt(SCENE_URL);
    await screen.findByRole('heading', { level: 1 });
    await user.type(screen.getByLabelText('目的（仮）'), 'x');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeDisabled());

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider
          router={createMemoryRouter(routeObjects, {
            initialEntries: ['/creator/scenarios/sc-gray-mansion'],
          })}
        />
      </QueryClientProvider>,
    );
    await screen.findByText('館の老従者');
  });

  it('CreatorScenarioEditPageから「編集」リンクをクリックするとシーン編集画面へ遷移する', async () => {
    const user = userEvent.setup();
    const router = renderAt('/creator/scenarios/sc-gray-mansion');
    await screen.findByRole('heading', { level: 1, name: '灰色館の一夜' });

    const editLinks = screen.getAllByRole('link', { name: '編集' });
    await user.click(editLinks[0]);

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(
        /^\/creator\/scenarios\/sc-gray-mansion\/scenes\//,
      ),
    );
  });
});
