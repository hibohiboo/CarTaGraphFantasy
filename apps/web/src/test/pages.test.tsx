// 全ルートを MSW（node）＋メモリルーターで描画し、見出しが出ることと主要な操作が通ることを確認する。

import type { Character, Session } from '@cartagraph/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routeObjects } from '../app/router';
import { routes } from '../app/routes';
import { ApiError, api } from '../lib/api';
import { server } from '../mocks/node';

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

describe('全ページの描画', () => {
  for (const r of routes) {
    const path = r.example ?? r.path;
    it(`${path} に h1 が表示される`, async () => {
      renderAt(path);
      const h1 = await screen.findByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
      expect(h1.textContent).not.toBe('ページが見つかりません');
    });
  }

  it('未定義のパスは 404 ページになる', async () => {
    renderAt('/nowhere');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ページが見つかりません' }),
    ).toBeInTheDocument();
  });

  it('router のパス一覧と routes.ts が一致する', () => {
    const declared = new Set(routes.map((r) => r.path));
    const children = routeObjects[0].children ?? [];
    const actual = new Set(
      children.filter((c) => c.path && c.path !== '*').map((c) => `/${c.path}`),
    );
    actual.add('/');
    expect([...actual].sort()).toEqual([...declared].sort());
  });
});

describe('プレイページ', () => {
  it('選択肢をプレイすると卓の描写が変わり、提案は「今回は未使用」になる', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    expect(
      await screen.findByText('古びた扉の向こうから、かすかな音が聞こえる。'),
    ).toBeInTheDocument();
    expect(screen.getByText('GM裁定待ち')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^選択肢\s*開ける/ }));
    expect(await screen.findByText(/扉が軋みながら開いた/)).toBeInTheDocument();
    expect(screen.queryByText('GM裁定待ち')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /書庫へ入る/ })).toBeInTheDocument();
  });

  it('新たな選択肢を提案できる', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    await screen.findByText('古びた扉の向こうから、かすかな音が聞こえる。');
    // 既存の裁定待ちがあると提案できないので、先に選択肢「戻る」をプレイして待ち状態を解消する
    await user.click(screen.getByRole('button', { name: /^選択肢\s*戻る/ }));
    await screen.findByText(/地下回廊へ引き返した/);
    await user.click(screen.getByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '扉の下に何か差し込んでみたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    expect(await screen.findByText('GM裁定待ち')).toBeInTheDocument();
  });
});

describe('GMのセッション管理', () => {
  it('提案を採用すると手札にカードが生成される', async () => {
    const user = userEvent.setup();
    renderAt('/gm/sessions/ss-galleon');
    const ticket = (await screen.findByText('鎖を切って亡霊を海に落としたい')).closest('article')!;
    await user.click(within(ticket).getByRole('button', { name: '採用してカード化' }));
    expect(await within(ticket).findByText('採用済み')).toBeInTheDocument();
    expect(within(ticket).getByText('鎖を切って亡霊を海に落とす')).toBeInTheDocument();
  });

  it('提案を却下すると理由が残る', async () => {
    const user = userEvent.setup();
    renderAt('/gm/sessions/ss-mansion');
    const ticket = (await screen.findByText('扉を壊してみたい')).closest('article')!;
    await user.click(within(ticket).getByRole('button', { name: '却下' }));
    await user.type(within(ticket).getByLabelText('却下理由（PLにも見える）'), '扉は物語の要');
    await user.click(within(ticket).getByRole('button', { name: '却下を確定' }));
    expect(await within(ticket).findByText(/却下理由：扉は物語の要/)).toBeInTheDocument();
  });
});

describe('キャラクター作成', () => {
  it('CP予算を超えると作成ボタンが無効になる', async () => {
    const user = userEvent.setup();
    renderAt('/pl/characters/new');
    await screen.findByText('基本カードプール');
    await user.type(screen.getByLabelText('名前'), '新人');
    // 炎の剣(4) + 渾身の一撃(3) = 7 > 5
    await user.click(screen.getByRole('button', { name: /炎の剣/ }));
    await user.click(screen.getByRole('button', { name: /渾身の一撃/ }));
    expect(screen.getByText('7 / 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'このPCを作成する' })).toBeDisabled();
  });

  it('予算内なら作成でき、シートへ遷移する', async () => {
    const user = userEvent.setup();
    const router = renderAt('/pl/characters/new');
    await screen.findByText('基本カードプール');
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: /灯火のランタン/ }));
    await user.click(screen.getByRole('button', { name: 'このPCを作成する' }));
    expect(await screen.findByRole('heading', { level: 1, name: '新人' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/pl\/characters\/pc-/);
  });
});

describe('セッション選択', () => {
  it('応募すると応募済み表示になる', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions');
    const card = (await screen.findByText('灯りの回廊・後日談')).closest('article')!;
    await user.click(within(card).getByRole('button', { name: '応募する' }));
    expect(await within(card).findByText(/応募済み/)).toBeInTheDocument();
  });
});

describe('チュートリアル（旅立ちの酒場）', () => {
  it('NPCとの問答に集中させるため、ヘッダー・フッターを出さない', async () => {
    renderAt('/pl/tutorial');
    await screen.findByRole('heading', { level: 1, name: '旅立ちの酒場' });
    expect(screen.queryByLabelText('主要ナビゲーション')).not.toBeInTheDocument();
    expect(screen.queryByText(/設計ドキュメント（docs）/)).not.toBeInTheDocument();
  });

  it('右下のプレイマットを開くと今の場の様子が見える', async () => {
    const user = userEvent.setup();
    renderAt('/pl/tutorial');
    await user.click(await screen.findByRole('button', { name: 'プレイマットで見る' }));
    expect(screen.getByText('シーン・場所')).toBeInTheDocument();
    expect(screen.getByText('話し相手')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'プレイマットを閉じる' }));
    expect(screen.queryByText('シーン・場所')).not.toBeInTheDocument();
  });

  it('名前が空だと名乗れない', async () => {
    const user = userEvent.setup();
    renderAt('/pl/tutorial');
    // 台詞カードは1枚ずつ出るので、GMの情景描写カードをクリックしてNPCの問いかけまで進める
    await user.click(await screen.findByRole('button', { name: /次へ/ }));
    await user.click(await screen.findByRole('button', { name: /名を名乗る/ }));
    expect(screen.getByRole('button', { name: '名乗る' })).toBeDisabled();
  });

  it('保存に失敗すると次のステップへ進まずエラーを表示する', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('/api/characters/:id', () =>
        HttpResponse.json({ message: 'CP予算（5）を超えています' }, { status: 422 }),
      ),
    );
    renderAt('/pl/tutorial');
    // 台詞カードは1枚ずつ出るので、GMの情景描写カード→NPCの問いかけの順にクリックして進める
    await user.click(await screen.findByRole('button', { name: /次へ/ }));
    await user.click(await screen.findByRole('button', { name: /名を名乗る/ }));
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '名乗る' }));
    await user.click(await screen.findByRole('button', { name: /腕試しをしていく/ }));
    await user.click(await screen.findByRole('button', { name: /力自慢/ }));
    expect(await screen.findByText('CP予算（5）を超えています')).toBeInTheDocument();
    expect(screen.queryByText('旅には何か持たせてやろう')).not.toBeInTheDocument();
  });

  it('全ステップを進めると（離脱の選択肢はなく一本道）冒険者になる', async () => {
    const user = userEvent.setup();
    const router = renderAt('/pl/tutorial');
    // 台詞カードは1枚ずつ出るので、GMの情景描写カード→NPCの問いかけの順にクリックして進める
    await user.click(await screen.findByRole('button', { name: /次へ/ }));
    await user.click(await screen.findByRole('button', { name: /名を名乗る/ }));
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '名乗る' }));
    await user.click(await screen.findByRole('button', { name: /腕試しをしていく/ }));
    await user.click(await screen.findByRole('button', { name: /力自慢/ }));
    await user.click(await screen.findByRole('button', { name: /灯火のランタン/ }));
    await user.click(await screen.findByRole('button', { name: /冒険者として登録する/ }));
    expect(await screen.findByText('冒険者')).toBeInTheDocument();
    // 実際に保存されたPCへのリンクになっていることを確認する（キャラクター一覧にも反映される）
    await user.click(screen.getByRole('button', { name: 'キャラクターシートへ' }));
    expect(await screen.findByRole('heading', { level: 1, name: '新人' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/pl\/characters\/pc-/);
  });
});

describe('村はずれの一歩（C1: GMレス基盤の検証用）', () => {
  it('名前を入力して始めると、GMレスのセッションが開始されプレイページへ進む', async () => {
    const user = userEvent.setup();
    const router = renderAt('/pl/village-start');
    await screen.findByRole('heading', { level: 1, name: '（仮）村はずれの一歩' });
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '始める' }));
    expect(await screen.findByRole('button', { name: /新たな選択肢を提案/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/pl\/sessions\/ss-\d+\/play$/);
  });

  it('名前が空だと始められない', async () => {
    renderAt('/pl/village-start');
    await screen.findByRole('heading', { level: 1, name: '（仮）村はずれの一歩' });
    expect(screen.getByRole('button', { name: '始める' })).toBeDisabled();
  });

  it('異常系：名前が空だとAPIレベルでも拒否され、Character・Sessionが増えない（中途半端な状態が残らない）', async () => {
    const charactersBefore = await api.get<Character[]>('/characters');
    await expect(
      api.post('/scenarios/sc-village-start/start-solo', { name: '' }),
    ).rejects.toBeInstanceOf(ApiError);
    const charactersAfter = await api.get<Character[]>('/characters');
    expect(charactersAfter.length).toBe(charactersBefore.length);
  });

  it('開始に失敗するとエラーを表示し、プレイページへは進まない', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/scenarios/:id/start-solo', () =>
        HttpResponse.json({ message: 'シナリオ が見つかりません' }, { status: 404 }),
      ),
    );
    const router = renderAt('/pl/village-start');
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '始める' }));
    expect(await screen.findByText('シナリオ が見つかりません')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/pl/village-start');
  });

  it('新たな選択肢を提案すると、人間の操作なしに即座に採用される', async () => {
    const user = userEvent.setup();
    renderAt('/pl/village-start');
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '始める' }));
    await user.click(await screen.findByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '足跡を調べてみたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    // GMレスなので裁定待ちにならず、即座に「足跡を調べる」が手札に加わる
    expect(screen.queryByText('GM裁定待ち')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /足跡を調べる/ })).toBeInTheDocument();
  });

  it('長い提案文でも、自動応答で正しいカード名が採用される（境界値）', async () => {
    const user = userEvent.setup();
    const longText = '足跡をひとつひとつ辿って夜明けまで歩き続けてみたい';
    renderAt('/pl/village-start');
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '始める' }));
    await user.click(await screen.findByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), longText);
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    expect(
      await screen.findByRole('button', {
        name: /足跡をひとつひとつ辿って夜明けまで歩き続ける/,
      }),
    ).toBeInTheDocument();
  });

  it('境界値：導入シーン（introノード）を持たないシナリオでは開始できず、Characterも増えない', async () => {
    const charactersBefore = await api.get<Character[]>('/characters');
    await expect(
      api.post('/scenarios/sc-no-intro/start-solo', { name: '新人' }),
    ).rejects.toBeInstanceOf(ApiError);
    const charactersAfter = await api.get<Character[]>('/characters');
    expect(charactersAfter.length).toBe(charactersBefore.length);
  });

  it('シナリオが「提案不可」なら、プレイページに「新たな選択肢を提案」カードが出ない', async () => {
    const session = await api.post<Session>('/scenarios/sc-village-no-propose/start-solo', {
      name: '新人',
    });
    renderAt(`/pl/sessions/${session.id}/play`);
    await screen.findByText('村はずれ（提案不可）');
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
  });

  it('シナリオが「提案不可」なら、提案APIも拒否する', async () => {
    const session = await api.post<Session>('/scenarios/sc-village-no-propose/start-solo', {
      name: '新人',
    });
    await expect(
      api.post(`/sessions/${session.id}/proposals`, { text: '調べてみたい' }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('ホーム画面のチュートリアル導線', () => {
  it('所持キャラクターが0件のときだけ「旅立ちの酒場へ行く」が出る', async () => {
    server.use(http.get('/api/characters', () => HttpResponse.json([])));
    renderAt('/home');
    expect(await screen.findByRole('link', { name: '旅立ちの酒場へ行く' })).toBeInTheDocument();
  });

  it('所持キャラクターが1件以上あれば出ない', async () => {
    renderAt('/home');
    await screen.findByRole('heading', { level: 1, name: 'ホーム' });
    expect(screen.queryByRole('link', { name: '旅立ちの酒場へ行く' })).not.toBeInTheDocument();
  });

  it('所持キャラクターが0件のときだけ、村はずれの一歩（C1検証用）へのリンクも出る', async () => {
    server.use(http.get('/api/characters', () => HttpResponse.json([])));
    renderAt('/home');
    expect(
      await screen.findByRole('link', { name: /（仮）村はずれの一歩を試す/ }),
    ).toBeInTheDocument();
  });

  it('所持キャラクターが1件以上あれば、村はずれの一歩へのリンクも出ない', async () => {
    renderAt('/home');
    await screen.findByRole('heading', { level: 1, name: 'ホーム' });
    expect(
      screen.queryByRole('link', { name: /（仮）村はずれの一歩を試す/ }),
    ).not.toBeInTheDocument();
  });
});
