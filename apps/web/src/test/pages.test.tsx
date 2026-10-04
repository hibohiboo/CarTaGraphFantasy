// 全ルートを MSW（node）＋メモリルーターで描画し、見出しが出ることと主要な操作が通ることを確認する。

import type { Character } from '@cartagraph/domain/character/model';
import type { Session } from '@cartagraph/domain/session/model';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routeObjects } from '@/app/router';
import * as fx from '@/mocks/fixtures';
import { ApiError, api } from '@/shared/api/api';
import { routes } from '@/shared/routes/routes';
import { server } from '../mocks/node';
import { clearVillageWith, createGmlessRecruitment, playFromRecruitment } from './gmlessHelpers';

/** 「＋名を名乗る」の提案カードから名乗る（旅立ちの酒場・村スタート共通の操作） */
async function introduceAs(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: /名を名乗る/ }));
  await user.type(screen.getByLabelText('名前'), name);
  await user.click(screen.getByRole('button', { name: '名乗る' }));
}

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
  it('人間GMのセッションでは、スクリプトの無い選択肢を選ぶと、ほかの選択肢も外れてGMの描写を待つ', async () => {
    // GMが採用した提案カード（説明文もスクリプトも無い）を使う。GM不在の「描写を返して留まる」挙動にならないこと
    const pending = await api.get<Session>('/sessions/ss-mansion');
    const proposal = pending.proposals.find((p) => p.status === 'pending');
    const approved = await api.post<Session>(
      `/sessions/ss-mansion/proposals/${proposal?.id}/approve`,
      { cardName: '扉に耳を当てる' },
    );
    const card = approved.hand.find((c) => c.name === '扉に耳を当てる');
    const after = await api.post<Session>('/sessions/ss-mansion/play', { cardId: card?.id });
    expect(after.flavor).toBe('「扉に耳を当てる」を選んだ。GMの描写を待っている。');
    expect(after.hand.filter((c) => c.kind === 'choice')).toEqual([]);
  });

  it('卓上の描写は「GM」の台詞カードとして出る（人間GMのセッションでも）', async () => {
    renderAt('/pl/sessions/ss-mansion/play');
    const flavor = await screen.findByText('古びた扉の向こうから、かすかな音が聞こえる。');
    expect(within(flavor.closest('main') as HTMLElement).getByText('GM')).toBeInTheDocument();
  });

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

// docs/plans/2026-10-03-募集からのセッション開始.md「5. 新規テストケース（pages.test.tsx）」
describe('GMのセッション管理：自分の募集から始める', () => {
  const MY_NOTE = fx.recruitments.find((r) => r.id === 'rc-mine')?.note ?? '';
  const grayMansionScenes = fx.scenarios.find((s) => s.id === 'sc-gray-mansion')?.deck.length ?? 0;
  /** 「自分の募集」の枠にある、シードの自分の募集 rc-mine */
  const myRecruitment = async () => (await screen.findByText(MY_NOTE)).closest('article')!;

  it('自分の募集と応募が出て、他の GM の募集は出ない', async () => {
    renderAt('/gm/sessions');
    const panel = (await screen.findByRole('heading', { name: '自分の募集' })).closest('section')!;
    const rc = await myRecruitment();
    expect(within(rc).getByLabelText('迅（ユウ）を参加させる')).toBeInTheDocument();
    expect(within(rc).getByLabelText('澪（カヤ）を参加させる')).toBeInTheDocument();
    expect(within(panel).queryByText(/霧乃|柊/)).not.toBeInTheDocument();
  });

  it('PC とドライバーを選び、パーティー名を付けて始めると、進行管理画面へ移り、募集は消える', async () => {
    const user = userEvent.setup();
    const router = renderAt('/gm/sessions');
    const rc = await myRecruitment();
    await user.click(within(rc).getByLabelText('迅（ユウ）を参加させる'));
    await user.click(within(rc).getByLabelText('澪（カヤ）を参加させる'));
    await user.click(within(rc).getByLabelText('迅をドライバーにする'));
    await user.type(within(rc).getByLabelText('パーティー名'), '夜更かし組');
    await user.click(within(rc).getByRole('button', { name: 'セッションを始める' }));
    // GM のセッション一覧にも同じパーティー名が出る。画面の切り替えは router の pathname より遅れることが
    // あるので、進行管理画面にしか無い見出しが出るのを待ってから確かめる
    await screen.findByRole('heading', { name: '参加者' });
    expect(screen.getByText(/パーティー「夜更かし組」/)).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/gm\/sessions\/ss-/);
    const members = screen.getByRole('heading', { name: '参加者' }).closest('section')!;
    expect(within(members).getByText('迅（ユウ）').closest('div')).toHaveTextContent('ドライバー');
    expect(within(members).getByText('澪（カヤ）').closest('div')).toHaveTextContent(
      'ナビゲーター',
    );
    await router.navigate('/gm/sessions');
    const running = (await screen.findByRole('heading', { name: 'GMとして進行中' })).closest(
      'section',
    )!;
    expect(within(running).getByRole('link', { name: '灰色館の一夜' })).toBeInTheDocument();
    expect(screen.queryByText(MY_NOTE)).not.toBeInTheDocument();
  });

  it('想定人数の下限（2）に届かないと注意が出るが始められる。2件なら注意は出ない', async () => {
    const user = userEvent.setup();
    renderAt('/gm/sessions');
    const rc = await myRecruitment();
    await user.click(within(rc).getByLabelText('迅（ユウ）を参加させる'));
    await user.click(within(rc).getByLabelText('迅をドライバーにする'));
    expect(within(rc).getByText('想定人数（2〜4人）に届いていません')).toBeInTheDocument();
    expect(within(rc).getByRole('button', { name: 'セッションを始める' })).toBeEnabled();
    await user.click(within(rc).getByLabelText('澪（カヤ）を参加させる'));
    expect(within(rc).queryByText(/届いていません|超えています/)).not.toBeInTheDocument();
  });

  it('PC を選ばないと始められず、ドライバーの PC を選択から外すとドライバーも外れる', async () => {
    const user = userEvent.setup();
    renderAt('/gm/sessions');
    const rc = await myRecruitment();
    const startButton = within(rc).getByRole('button', { name: 'セッションを始める' });
    expect(startButton).toBeDisabled();
    await user.click(within(rc).getByLabelText('迅（ユウ）を参加させる'));
    await user.click(within(rc).getByLabelText('澪（カヤ）を参加させる'));
    await user.click(within(rc).getByLabelText('迅をドライバーにする'));
    expect(startButton).toBeEnabled();
    await user.click(within(rc).getByLabelText('迅（ユウ）を参加させる'));
    expect(within(rc).getByLabelText('澪をドライバーにする')).not.toBeChecked();
    expect(startButton).toBeDisabled();
    expect(within(rc).getByText('ドライバーのPCを選んでください')).toBeInTheDocument();
  });

  it('応募が無い自分の募集は、始められないことが分かる', async () => {
    const user = userEvent.setup();
    const router = renderAt('/gm/scenarios/sc-galleon');
    await user.click(await screen.findByRole('button', { name: /この構成で募集を出す/ }));
    await screen.findByRole('heading', { name: '自分の募集' });
    expect(router.state.location.pathname).toBe('/gm/sessions');
    const rc = (await screen.findByRole('heading', { name: '鉄鎖のガレオン船' })).closest(
      'article',
    )!;
    expect(within(rc).getByText(/まだ応募がありません/)).toBeInTheDocument();
    expect(within(rc).getByRole('button', { name: 'セッションを始める' })).toBeDisabled();
  });

  it('別の画面で先に始められていたら、断られた理由がカードに出る', async () => {
    const user = userEvent.setup();
    renderAt('/gm/sessions');
    const rc = await myRecruitment();
    // 画面を開いたあとで、別の画面から先に始められた状態にする
    await api.post('/recruitments/rc-mine/start', {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
      partyName: '',
    });
    await user.click(within(rc).getByLabelText('迅（ユウ）を参加させる'));
    await user.click(within(rc).getByLabelText('迅をドライバーにする'));
    await user.click(within(rc).getByRole('button', { name: 'セッションを始める' }));
    expect(await within(rc).findByText('この募集はもう始まっています')).toBeInTheDocument();
    // 進行管理画面へは移らない
    expect(screen.getByRole('heading', { name: '自分の募集' })).toBeInTheDocument();
  });

  it('通し：シーンを外して募集を出し、自分の PC で応募して始めると、シーン数が減っている', async () => {
    const user = userEvent.setup();
    const router = renderAt('/gm/scenarios/sc-gray-mansion');
    const library = (await screen.findByText('3-3 隠し書庫')).parentElement!;
    await user.click(within(library).getByRole('button', { name: '外す' }));
    await user.click(screen.getByRole('button', { name: /この構成で募集を出す（1件を外す）/ }));
    await screen.findByRole('heading', { name: '自分の募集' });
    expect(router.state.location.pathname).toBe('/gm/sessions');

    await router.navigate('/pl/sessions');
    const card = (await screen.findAllByText('GM：ユウ'))
      .map((el) => el.closest('article')!)
      .find((a) => within(a).queryByText(/応募 0\//))!;
    await user.click(within(card).getByRole('button', { name: '応募する' }));
    expect(await within(card).findByText(/応募済み/)).toBeInTheDocument();

    await router.navigate('/gm/sessions');
    await screen.findByRole('heading', { name: '自分の募集' });
    const fresh = (await screen.findAllByRole('heading', { name: '灰色館の一夜' }))
      .map((el) => el.closest('article')!)
      .find((a) => !within(a).queryByText(MY_NOTE))!;
    await user.click(within(fresh).getByLabelText('迅（ユウ）を参加させる'));
    await user.click(within(fresh).getByLabelText('迅をドライバーにする'));
    await user.click(within(fresh).getByRole('button', { name: 'セッションを始める' }));
    await screen.findByRole('heading', { name: '参加者' });
    expect(screen.getByText(/パーティー「迅の一行」/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`/ ${grayMansionScenes - 1}$`))).toBeInTheDocument();
  });
});

// docs/plans/2026-10-03-GMがPLを兼ねて遊ぶ.md「5. 新規テストケース（pages.test.tsx）」
describe('GMのセッション管理：描写と選択肢を配る（GM が PL を兼ねる）', () => {
  const PANEL = '描写と選択肢を配る';
  const MY_NOTE_OF_RC_MINE = fx.recruitments.find((r) => r.id === 'rc-mine')?.note ?? '';
  const panel = async () =>
    (await screen.findByRole('heading', { name: PANEL })).closest('section') as HTMLElement;
  /** 灰色館の一夜（rc-mine）を、自分の PC をドライバーにして API で始める（導入に選択肢は無い） */
  const startMansion = () =>
    api.post<Session>('/recruitments/rc-mine/start', {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
      partyName: '',
    });
  /** 村はずれの一歩で、お店を外した募集を出し、自分の PC で応募して API で始める */
  const startVillageWithoutShop = async () => {
    const rc = await api.post<{ id: string }>('/scenarios/sc-village-start/recruitments', {
      capacity: 1,
      excludedNodeIds: ['vs-shop'],
    });
    await api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' });
    return api.post<Session>(`/recruitments/${rc.id}/start`, {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
      partyName: '',
    });
  };

  it('自分が GM の進行中のセッションに枠が出て、他の GM のセッションには出ない', async () => {
    renderAt('/gm/sessions/ss-galleon');
    expect(await panel()).toBeInTheDocument();
    cleanup();
    renderAt('/gm/sessions/ss-mansion');
    await screen.findByRole('heading', { name: '提案の裁定' });
    expect(screen.queryByRole('heading', { name: PANEL })).not.toBeInTheDocument();
  });

  it('初期状態では送れず、描写を書くと送れる。名前の空の行を足すとエラーが出て、行を消すと消える', async () => {
    const user = userEvent.setup();
    renderAt('/gm/sessions/ss-galleon');
    const p = await panel();
    const send = within(p).getByRole('button', { name: '送る' });
    expect(send).toBeDisabled();
    expect(within(p).queryByText(/描写を書くか/)).not.toBeInTheDocument();
    await user.type(within(p).getByLabelText('描写'), '甲板が揺れる。');
    expect(send).toBeEnabled();
    await user.click(within(p).getByRole('button', { name: '選択肢を足す' }));
    expect(send).toBeDisabled();
    expect(within(p).getByText('配る選択肢の名前を入力してください')).toBeInTheDocument();
    await user.click(within(p).getByRole('button', { name: '選択肢1を消す' }));
    expect(within(p).queryByText('配る選択肢の名前を入力してください')).not.toBeInTheDocument();
    expect(send).toBeEnabled();
  });

  it('移り先には、外したシーン・自動戦闘のシーン・いま居るシーンが出ない', async () => {
    const user = userEvent.setup();
    const s = await startVillageWithoutShop();
    renderAt(`/gm/sessions/${s.id}`);
    const p = await panel();
    await user.click(within(p).getByRole('button', { name: '選択肢を足す' }));
    const select = within(p).getByLabelText('選択肢1の移り先');
    const options = await within(select).findAllByRole('option');
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain('村の広場');
    expect(labels).toContain('冒険者として旅立つ');
    expect(labels).not.toContain('村のお店');
    expect(labels).not.toContain('冒険者試験');
    expect(labels).not.toContain('村はずれ');
  });

  it('取り下げだけでも送れ、チェックした選択肢だけが手札から消える', async () => {
    const user = userEvent.setup();
    const s = await startVillageWithoutShop();
    renderAt(`/gm/sessions/${s.id}`);
    const p = await panel();
    await user.click(within(p).getByLabelText('「辺りを見回す」を取り下げる'));
    await user.click(within(p).getByRole('button', { name: '送る' }));
    expect(await screen.findByText(/選択肢「辺りを見回す」を取り下げた/)).toBeInTheDocument();
    expect(within(p).queryByLabelText('「辺りを見回す」を取り下げる')).not.toBeInTheDocument();
    expect(within(p).getByLabelText('「村の広場へ向かう」を取り下げる')).not.toBeChecked();
  });

  it('移り先なしで配ると成功し、送ったあとは入力が空に戻る', async () => {
    const user = userEvent.setup();
    const s = await startMansion();
    renderAt(`/gm/sessions/${s.id}`);
    const p = await panel();
    await user.type(within(p).getByLabelText('描写'), '静かな夜だ。');
    await user.click(within(p).getByRole('button', { name: '選択肢を足す' }));
    await user.type(within(p).getByLabelText('選択肢1の名前'), '耳を澄ます');
    expect(within(p).getByLabelText('選択肢1の移り先')).toHaveValue('');
    await user.click(within(p).getByRole('button', { name: '送る' }));
    expect(await within(p).findByLabelText('「耳を澄ます」を取り下げる')).toBeInTheDocument();
    expect(within(p).getByText('静かな夜だ。')).toBeInTheDocument();
    expect(within(p).getByLabelText('描写')).toHaveValue('');
    expect(within(p).queryByLabelText('選択肢1の名前')).not.toBeInTheDocument();
  });

  it('GM が PL を兼ねるときだけ、GM の画面とプレイ画面を行き来するリンクが出る', async () => {
    const s = await startMansion();
    renderAt(`/gm/sessions/${s.id}`);
    expect(
      await screen.findByRole('link', { name: 'ドライバーとしてプレイ画面へ' }),
    ).toHaveAttribute('href', `/pl/sessions/${s.id}/play`);
    cleanup();
    renderAt(`/pl/sessions/${s.id}/play`);
    expect(await screen.findByRole('link', { name: 'GMの画面へ' })).toHaveAttribute(
      'href',
      `/gm/sessions/${s.id}`,
    );
    cleanup();
    // GM は自分だがドライバーは柊／ドライバーは自分だが GM は霧乃
    for (const id of ['ss-galleon', 'ss-mansion']) {
      renderAt(`/gm/sessions/${id}`);
      await screen.findByRole('heading', { name: '提案の裁定' });
      expect(
        screen.queryByRole('link', { name: 'ドライバーとしてプレイ画面へ' }),
      ).not.toBeInTheDocument();
      cleanup();
    }
    renderAt('/pl/sessions/ss-mansion/play');
    await screen.findByText('古びた扉の向こうから、かすかな音が聞こえる。');
    expect(screen.queryByRole('link', { name: 'GMの画面へ' })).not.toBeInTheDocument();
  });

  it('通し：募集から始め、描写・配る・提案の裁定・シーンを進める、をしながら結末まで遊び、終了する', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const router = renderAt('/gm/sessions');
    const rc = (await screen.findByText(MY_NOTE_OF_RC_MINE)).closest('article')!;
    await user.click(within(rc).getByLabelText('迅（ユウ）を参加させる'));
    await user.click(within(rc).getByLabelText('迅をドライバーにする'));
    await user.click(within(rc).getByRole('button', { name: 'セッションを始める' }));

    // GM：描写を書き、地下回廊へ移る選択肢を配る
    let p = await panel();
    await user.type(within(p).getByLabelText('描写'), '湿った石段が、地下へ続いている。');
    await user.click(within(p).getByRole('button', { name: '選択肢を足す' }));
    await user.type(within(p).getByLabelText('選択肢1の名前'), '地下へ降りる');
    await user.selectOptions(within(p).getByLabelText('選択肢1の移り先'), '3-1 地下回廊');
    await user.click(within(p).getByRole('button', { name: '送る' }));
    await within(p).findByLabelText('「地下へ降りる」を取り下げる');

    // ドライバー：描写と配られたカードが見え、提案を送る
    await user.click(screen.getByRole('link', { name: 'ドライバーとしてプレイ画面へ' }));
    // 描写は GM の画面にも出るので、プレイ画面にしか無いリンクが出るのを待ってから確かめる
    await screen.findByRole('link', { name: 'GMの画面へ' });
    expect(screen.getByText('湿った石段が、地下へ続いている。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^選択肢\s*地下へ降りる/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '灯りを掲げてみたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    await screen.findByText('GM裁定待ち');

    // GM：提案を採用する
    await user.click(screen.getByRole('link', { name: 'GMの画面へ' }));
    const ticket = (await screen.findByText('灯りを掲げてみたい')).closest('article')!;
    await user.click(within(ticket).getByRole('button', { name: '採用してカード化' }));
    await within(ticket).findByText('採用済み');

    // ドライバー：採用したカードが手札にある。配られたカードをプレイして地下回廊へ
    await user.click(screen.getByRole('link', { name: 'ドライバーとしてプレイ画面へ' }));
    expect(
      await screen.findByRole('button', { name: /^選択肢\s*灯りを掲げる/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^選択肢\s*地下へ降りる/ }));
    await screen.findByText('3-1 地下回廊へ進んだ。');

    // GM：シーンが進んでいる。結末へ移る選択肢を配る
    await user.click(screen.getByRole('link', { name: 'GMの画面へ' }));
    expect(await screen.findByText('3-1 / 6')).toBeInTheDocument();
    expect(screen.getByText('「3-1 地下回廊」へ進んだ')).toBeInTheDocument();
    p = await panel();
    await user.click(within(p).getByRole('button', { name: '選択肢を足す' }));
    await user.type(within(p).getByLabelText('選択肢1の名前'), '館を出る');
    await user.selectOptions(within(p).getByLabelText('選択肢1の移り先'), '結末');
    await user.click(within(p).getByRole('button', { name: '送る' }));
    await within(p).findByLabelText('「館を出る」を取り下げる');

    // ドライバー：結末へ
    await user.click(screen.getByRole('link', { name: 'ドライバーとしてプレイ画面へ' }));
    await user.click(await screen.findByRole('button', { name: /^選択肢\s*館を出る/ }));
    await screen.findByText('結末へ進んだ。');

    // GM：結末の案内が出る。結末の描写を書いて、終了する
    await user.click(screen.getByRole('link', { name: 'GMの画面へ' }));
    expect(
      await screen.findByText('結末「結末」に着いた。結末の描写を書いて、セッションを終了できる。'),
    ).toBeInTheDocument();
    p = await panel();
    await user.type(within(p).getByLabelText('描写'), '夜が明け、館は静まり返った。');
    await user.click(within(p).getByRole('button', { name: '送る' }));
    await within(p).findByText('夜が明け、館は静まり返った。');
    await user.click(screen.getByRole('button', { name: 'セッションを終了する' }));
    expect(await screen.findByText('終了')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: PANEL })).not.toBeInTheDocument();

    // ドライバー：終わったセッションに、結末の描写と見出しが出る
    const sessionId = router.state.location.pathname.split('/')[3];
    await router.navigate(`/pl/sessions/${sessionId}/play`);
    expect(await screen.findByText('このセッションは終了しています。')).toBeInTheDocument();
    expect(screen.getByText('夜が明け、館は静まり返った。')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '結末「結末」' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('結末以外のシーンで終わったセッションには、プレイ画面に結末の見出しが出ない', async () => {
    const s = await startMansion();
    await api.post(`/sessions/${s.id}/end`);
    renderAt(`/pl/sessions/${s.id}/play`);
    expect(await screen.findByText('このセッションは終了しています。')).toBeInTheDocument();
    await screen.findByRole('link', { name: 'GMの画面へ' });
    expect(screen.queryByRole('heading', { name: /^結末「/ })).not.toBeInTheDocument();
  });

  it('フォームを開いたあとで手札・シーンが変わったら、古くなった取り下げのチェックと移り先は外れ、送れる', async () => {
    const user = userEvent.setup();
    const s = await startVillageWithoutShop();
    renderAt(`/gm/sessions/${s.id}`);
    const p = await panel();
    await user.click(within(p).getByLabelText('「辺りを見回す」を取り下げる'));
    await user.click(within(p).getByRole('button', { name: '選択肢を足す' }));
    await user.type(within(p).getByLabelText('選択肢1の名前'), '広場を見渡す');
    await user.selectOptions(within(p).getByLabelText('選択肢1の移り先'), '村の広場');
    // 別の画面でドライバーが広場へ進み（手札の選択肢が配り直される）、GM の画面のセッションが新しくなる
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    await user.click(screen.getByRole('button', { name: '次のシーンを濃密モードにする' }));
    await screen.findByRole('button', { name: '軽量モードに戻す' });
    expect(within(p).queryByLabelText('「辺りを見回す」を取り下げる')).not.toBeInTheDocument();
    expect(within(p).getByLabelText('選択肢1の移り先')).toHaveValue('');
    expect(
      within(p).getByText('シーンが変わったため、選べなくなった移り先を外した。'),
    ).toBeInTheDocument();
    const send = within(p).getByRole('button', { name: '送る' });
    expect(send).toBeEnabled();
    await user.click(send);
    expect(await within(p).findByLabelText('「広場を見渡す」を取り下げる')).toBeInTheDocument();
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.hand.find((c) => c.name === '広場を見渡す')?.nextNodeId).toBeUndefined();
    expect(after.hand.some((c) => c.id === 'vs-look-around')).toBe(false);
  });

  it('送る前に別の画面で終了されていたら、断られた理由が出る', async () => {
    const user = userEvent.setup();
    const s = await startMansion();
    renderAt(`/gm/sessions/${s.id}`);
    const p = await panel();
    await api.post(`/sessions/${s.id}/end`);
    await user.type(within(p).getByLabelText('描写'), '風が吹く。');
    await user.click(within(p).getByRole('button', { name: '送る' }));
    expect(
      await within(p).findByText('進行中のセッションでだけ、描写・選択肢を配れます'),
    ).toBeInTheDocument();
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

  it('定員まで埋まった募集は、応募できない表示になる', async () => {
    renderAt('/pl/sessions');
    // シードの rc-full（村はずれの一歩・柊）は定員1に応募1。村はずれの一歩には GM 不在の募集（ユウ）もあるので、GM で絞る
    const full = (await screen.findAllByText('村はずれの一歩'))
      .map((el) => el.closest('article')!)
      .find((a) => within(a).queryByText('GM：柊'))!;
    expect(within(full).getByText('募集枠が埋まっています。')).toBeInTheDocument();
    expect(within(full).queryByRole('button', { name: '応募する' })).not.toBeInTheDocument();
  });

  it('始めた募集は出なくなる', async () => {
    // rc-mine（灰色館の一夜・ユウ）。ユウは GM 不在の募集（村はずれの一歩）も出しているので、題名と GM で特定する
    const mine = () =>
      screen
        .queryAllByText('灰色館の一夜')
        .map((el) => el.closest('article')!)
        .filter((a) => within(a).queryByText('GM：ユウ'));
    renderAt('/pl/sessions');
    await screen.findAllByText('GM：ユウ');
    expect(mine()).toHaveLength(1);
    await api.post('/recruitments/rc-mine/start', {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
      partyName: '',
    });
    cleanup();
    renderAt('/pl/sessions');
    await screen.findAllByText('GM：霧乃');
    expect(mine()).toHaveLength(0);
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

describe('村はずれの一歩（GM不在のソロの入口）', () => {
  it('名前を入力して始めると、GMレスのセッションが開始されプレイページへ進む', async () => {
    const user = userEvent.setup();
    const router = renderAt('/pl/village-start');
    await screen.findByRole('heading', { level: 1, name: '村はずれの一歩' });
    await introduceAs(user, '新人');
    expect(await screen.findByRole('button', { name: /新たな選択肢を提案/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/pl\/sessions\/ss-\d+\/play$/);
  });

  it('名前が空だと名乗れない', async () => {
    const user = userEvent.setup();
    renderAt('/pl/village-start');
    await user.click(await screen.findByRole('button', { name: /名を名乗る/ }));
    expect(screen.getByRole('button', { name: '名乗る' })).toBeDisabled();
  });

  it('GMの情景描写が台詞カードで出て、名乗りは「＋名を名乗る」の提案カードから行う', async () => {
    renderAt('/pl/village-start');
    const flavor = await screen.findByText(/朝もやの中、村はずれの道が街へと続いている/);
    expect(within(flavor.closest('main') as HTMLElement).getByText('GM')).toBeInTheDocument();
    // 名前の入力欄は、提案カードを選ぶまで出ない
    expect(screen.queryByLabelText('名前')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /名を名乗る/ })).toBeInTheDocument();
  });

  it('GM不在で「辺りを見回す」を選ぶと、描写が返り、そのカードだけが手札から消えて先へ進める', async () => {
    const user = userEvent.setup();
    const session = await api.post<Session>('/scenarios/sc-village-start/start-solo', {
      name: '新人',
    });
    renderAt(`/pl/sessions/${session.id}/play`);
    await user.click(await screen.findByRole('button', { name: /辺りを見回す/ }));
    expect(await screen.findByText(/畑仕事/)).toBeInTheDocument();
    expect(screen.queryByText(/GMの描写を待っている/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /辺りを見回す/ })).not.toBeInTheDocument();
    // 先へ進む選択肢が残っていて、行き止まりにならない
    expect(screen.getByRole('button', { name: /村の広場へ向かう/ })).toBeInTheDocument();
  });

  it('GM不在で、自動採用された提案カードを選んでも行き止まりにならない', async () => {
    const user = userEvent.setup();
    renderAt('/pl/village-start');
    await introduceAs(user, '新人');
    await user.click(await screen.findByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '足跡を調べてみたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    await user.click(await screen.findByRole('button', { name: /足跡を調べる/ }));
    expect(await screen.findByText(/新人は「足跡を調べる」を試みた/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /足跡を調べる/ })).not.toBeInTheDocument();
    // 先へ進む選択肢が残っていて、行き止まりにならない
    expect(screen.getByRole('button', { name: /村の広場へ向かう/ })).toBeInTheDocument();
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
    await introduceAs(user, '新人');
    expect(await screen.findByText('シナリオ が見つかりません')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/pl/village-start');
  });

  it('新たな選択肢を提案すると、人間の操作なしに即座に採用される', async () => {
    const user = userEvent.setup();
    renderAt('/pl/village-start');
    await introduceAs(user, '新人');
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
    await introduceAs(user, '新人');
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

  it('所持キャラクターが0件のときだけ、村はずれの一歩へのリンクも出る', async () => {
    server.use(http.get('/api/characters', () => HttpResponse.json([])));
    renderAt('/home');
    expect(
      await screen.findByRole('link', { name: /村はずれの一歩から始める/ }),
    ).toBeInTheDocument();
  });

  it('所持キャラクターが1件以上あれば、村はずれの一歩へのリンクも出ない', async () => {
    renderAt('/home');
    await screen.findByRole('heading', { level: 1, name: 'ホーム' });
    expect(
      screen.queryByRole('link', { name: /村はずれの一歩から始める/ }),
    ).not.toBeInTheDocument();
  });
});

// docs/plans/2026-10-04-GM不在の募集.md「5. 新規テストケース（画面）」
describe('GM 不在の募集', () => {
  const recruitPanel = async () =>
    (await screen.findByRole('heading', { name: '募集を出す' })).closest('section') as HTMLElement;
  const DEAD_END = /先へ進む選択肢の無いシーンがあります/;
  /** PL の募集一覧で、題名と GM で募集のカードを特定する */
  const recruitCard = async (title: string, gm: string) => {
    await screen.findByRole('heading', { name: '参加できるセッション' });
    const found = (await screen.findAllByRole('heading', { name: title }))
      .map((el) => el.closest('article')!)
      .find((a) => within(a).queryByText(`GM：${gm}`));
    if (!found) throw new Error(`募集のカード（${title}・${gm}）がありません`);
    return found;
  };
  const optionOf = (card: HTMLElement, name: RegExp) =>
    within(card).getByRole('option', { name }) as HTMLOptionElement;

  it('GM のシナリオ一覧に、公開済みになった村はずれの一歩が出る', async () => {
    renderAt('/gm/scenarios');
    expect(await screen.findByText('村はずれの一歩')).toBeInTheDocument();
  });

  it('シナリオ詳細：GM 不在を選ぶと募集人数が消え、提案の扱いが出る。提案不可のシナリオでは提案不可に固定', async () => {
    const user = userEvent.setup();
    renderAt('/gm/scenarios/sc-village-start');
    let p = await recruitPanel();
    expect(within(p).getByLabelText('募集人数（ドライバー候補＋PC）')).toBeInTheDocument();
    expect(within(p).queryByLabelText('提案の扱い')).not.toBeInTheDocument();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(p).queryByLabelText('募集人数（ドライバー候補＋PC）')).not.toBeInTheDocument();
    expect(within(p).getByLabelText('提案の扱い')).toHaveValue('gm-required');
    cleanup();
    renderAt('/gm/scenarios/sc-village-no-propose');
    p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(p).getByLabelText('提案の扱い')).toHaveValue('disabled');
    expect(within(p).getByLabelText('提案の扱い')).toBeDisabled();
  });

  it('シナリオ詳細：先へ進めないシーンの注意は、灰色館で出て村はずれでは出ない。外したシーンは注意から消え、提案不可なら抜けられないと出る', async () => {
    const user = userEvent.setup();
    renderAt('/gm/scenarios/sc-gray-mansion');
    const p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(p).getByText(DEAD_END)).toHaveTextContent('3-3 隠し書庫');
    expect(
      within(p).getByText(/提案を GM が移り先付きで採用すると抜けられます/),
    ).toBeInTheDocument();
    const deckPanel = screen
      .getByRole('heading', { name: 'シナリオデッキの取捨選択' })
      .closest('section')!;
    const library = within(deckPanel).getByText('3-3 隠し書庫').parentElement!;
    await user.click(within(library).getByRole('button', { name: '外す' }));
    expect(within(p).getByText(DEAD_END)).not.toHaveTextContent('3-3 隠し書庫');
    await user.selectOptions(within(p).getByLabelText('提案の扱い'), 'disabled');
    expect(within(p).getByText(/提案不可なので、行き止まりから抜けられません/)).toBeInTheDocument();
    cleanup();
    renderAt('/gm/scenarios/sc-village-start');
    const v = await recruitPanel();
    await user.click(within(v).getByLabelText('GM 不在（PL が自由に始める）'));
    expect(within(v).queryByText(DEAD_END)).not.toBeInTheDocument();
  });

  it('シナリオ詳細：通常の募集では、自動戦闘のシーンがあるシナリオ（村はずれ）だけに注意が出る', async () => {
    renderAt('/gm/scenarios/sc-village-start');
    expect(
      within(await recruitPanel()).getByText(/通常の募集では、自動戦闘のシーンへ進めません/),
    ).toBeInTheDocument();
    cleanup();
    renderAt('/gm/scenarios/sc-gray-mansion');
    expect(
      within(await recruitPanel()).queryByText(/自動戦闘のシーンへ進めません/),
    ).not.toBeInTheDocument();
  });

  it('GM 不在で募集を出すと、GM のセッション管理の「自分の募集」に始まったセッション 0 件で出る', async () => {
    const user = userEvent.setup();
    renderAt('/gm/scenarios/sc-gray-mansion');
    const p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    await user.click(within(p).getByRole('button', { name: /この構成で募集を出す/ }));
    const mine = (await screen.findByRole('heading', { name: '自分の募集' })).closest('section')!;
    const card = (await within(mine).findAllByRole('heading', { name: '灰色館の一夜' }))
      .map((el) => el.closest('article')!)
      .find((a) => within(a).queryByText(/GM 不在/))!;
    expect(within(card).getByText(/始まったセッション 0 件/)).toBeInTheDocument();
  });

  it('PL の募集一覧：「GM 不在の募集だけ」で絞り込める', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions');
    await recruitCard('村はずれの一歩', 'ユウ');
    expect(screen.getAllByRole('heading', { name: '灰色館の一夜' }).length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText('GM 不在の募集だけ'));
    expect(screen.queryByRole('heading', { name: '灰色館の一夜' })).not.toBeInTheDocument();
    expect(await recruitCard('村はずれの一歩', 'ユウ')).toBeInTheDocument();
    await user.click(screen.getByLabelText('GM 不在の募集だけ'));
    expect(
      (await screen.findAllByRole('heading', { name: '灰色館の一夜' })).length,
    ).toBeGreaterThan(0);
  });

  it('PL の募集一覧：GM 不在の募集では自分の PC だけを選べ、「この PC で始める」でプレイ画面へ移る', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions');
    const card = await recruitCard('村はずれの一歩', 'ユウ');
    expect(within(card).getByText('GM 不在')).toBeInTheDocument();
    expect(optionOf(card, /^迅/)).toBeInTheDocument();
    expect(within(card).queryByRole('option', { name: /彰/ })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'この PC で始める' }));
    expect(await screen.findByRole('button', { name: /村の広場へ向かう/ })).toBeInTheDocument();
  });

  it('再挑戦不可：結末タグを得た迅は、GM 不在の募集・通常の募集で「再挑戦不可」で選べず、初期値にならない。灰色館では選べる', async () => {
    await clearVillageWith('pc-jin');
    await api.post('/scenarios/sc-village-start/recruitments', { capacity: 2, note: '通常の村' });
    renderAt('/pl/sessions');
    await screen.findByRole('heading', { name: '参加できるセッション' });
    // テストで足した通常の村の募集も「村はずれの一歩・GM：ユウ」なので、シードの GM 不在の募集はメモで特定する
    const gmless = (await screen.findByText('誰でもどうぞ。旅人から冒険者へ')).closest('article')!;
    await waitFor(() => expect(optionOf(gmless, /迅.*再挑戦不可/).disabled).toBe(true));
    expect(within(gmless).getByLabelText('始める PC')).toHaveValue('pc-akari');
    const normal = (await screen.findByText('通常の村')).closest('article')!;
    await waitFor(() => expect(optionOf(normal, /迅.*再挑戦不可/).disabled).toBe(true));
    const mansion = await recruitCard('灰色館の一夜', '霧乃');
    expect(optionOf(mansion, /^迅/).disabled).toBe(false);
  });

  it('プレイ画面：提案すると中断し、手札と提案のカードを押せない。却下のあと「続きを遊ぶ」で再開する', async () => {
    const user = userEvent.setup();
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    renderAt(`/pl/sessions/${s.id}/play`);
    await user.click(await screen.findByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '鍬を借りたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    expect(await screen.findByText('GM の裁定を待っています（中断中）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /村の広場へ向かう/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/裁定を待たず/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '続きを遊ぶ' })).not.toBeInTheDocument();

    const suspended = await api.get<Session>(`/sessions/${s.id}`);
    await api.post(`/sessions/${s.id}/proposals/${suspended.proposals[0].id}/reject`, {
      reason: '鍬は貸せない',
    });
    cleanup();
    renderAt(`/pl/sessions/${s.id}/play`);
    expect(await screen.findByText(/鍬は貸せない/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '続きを遊ぶ' }));
    expect(await screen.findByRole('button', { name: /村の広場へ向かう/ })).toBeEnabled();
  });

  it('プレイ画面：提案不可の GM 不在の募集から始めると、提案のカードが出ない', async () => {
    const rc = await createGmlessRecruitment('sc-village-start', { proposalHandling: 'disabled' });
    const s = await playFromRecruitment(rc.id, 'pc-jin');
    renderAt(`/pl/sessions/${s.id}/play`);
    await screen.findByRole('button', { name: /村の広場へ向かう/ });
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
  });

  it('プレイ画面：GM 不在の募集のセッションでも、使える条件で選べないカードと仮ルールの表示が出る', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    renderAt(`/pl/sessions/${s.id}/play`);
    const guild = await screen.findByRole('button', { name: /街の冒険者ギルドへ向かう/ });
    await waitFor(() => expect(guild).toBeDisabled());
    expect(screen.getByText(/仮ルール（GM不在）/)).toBeInTheDocument();
  });

  it('GM のセッション管理：GM 不在のセッションに印と、中断中なら「提案の裁定待ち」が出る。募集の件数が増える', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    await api.post(`/sessions/${s.id}/proposals`, { text: '鍬を借りたい' });
    renderAt('/gm/sessions');
    const mine = (await screen.findByRole('heading', { name: '自分の募集' })).closest('section')!;
    const card = (await within(mine).findByText('誰でもどうぞ。旅人から冒険者へ')).closest(
      'article',
    )!;
    expect(within(card).getByText(/始まったセッション 1 件/)).toBeInTheDocument();
    const running = screen.getByRole('heading', { name: 'GMとして進行中' }).closest('section')!;
    const row = within(running)
      .getAllByRole('link', { name: '村はずれの一歩' })
      .map((el) => el.closest('[data-session-row]') as HTMLElement)
      .find((r) => within(r).queryByText('提案の裁定待ち'))!;
    expect(within(row).getByText('GM 不在')).toBeInTheDocument();
  });

  it('GM の進行管理画面：GM 不在のセッションでは描写の枠が出ない。中断中も採用でき、状態は中断、終了できる。採用に移り先を選べる', async () => {
    const user = userEvent.setup();
    const s = await playFromRecruitment(
      (await createGmlessRecruitment('sc-gray-mansion')).id,
      'pc-jin',
    );
    await api.post(`/sessions/${s.id}/proposals`, { text: '地下へ降りたい' });
    renderAt(`/gm/sessions/${s.id}`);
    await screen.findByRole('heading', { name: '提案の裁定' });
    expect(screen.queryByRole('heading', { name: '描写と選択肢を配る' })).not.toBeInTheDocument();
    expect(screen.getByText('中断（提案の裁定待ち）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'セッションを終了する' })).toBeEnabled();
    const ticket = screen.getByText('地下へ降りたい').closest('article')!;
    const select = await within(ticket).findByLabelText('移り先');
    await within(select).findByRole('option', { name: '3-1 地下回廊' });
    await user.selectOptions(select, '3-1 地下回廊');
    await user.click(within(ticket).getByRole('button', { name: '採用してカード化' }));
    await within(ticket).findByText('採用済み');
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.hand.find((c) => c.tags.includes('GM生成'))?.nextNodeId).toBe('d-s1');
  });

  it('GM の進行管理画面：進行中の GM 不在のセッションでも、描写と選択肢の枠は出ない（GM は自分）', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    renderAt(`/gm/sessions/${s.id}`);
    await screen.findByRole('link', { name: 'ドライバーとしてプレイ画面へ' });
    expect(screen.queryByRole('heading', { name: '描写と選択肢を配る' })).not.toBeInTheDocument();
    // GM 不在のセッションの GM は、提案の裁定と終了だけ（モードは切り替えない）
    expect(screen.queryByRole('button', { name: /濃密モード/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'セッションを終了する' })).toBeEnabled();
  });

  it('ホーム：中断中のセッションが出て、リンク先はプレイ画面', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    await api.post(`/sessions/${s.id}/proposals`, { text: '鍬を借りたい' });
    renderAt('/home');
    // ルート一覧にも「村はずれの一歩」のリンクがあるので、セッションへのリンクが出るまで待つ
    await waitFor(() =>
      expect(
        screen.getAllByRole('link', { name: '村はずれの一歩' }).map((l) => l.getAttribute('href')),
      ).toContain(`/pl/sessions/${s.id}/play`),
    );
    expect(screen.getByText('中断中：GM の裁定待ち')).toBeInTheDocument();
    expect(screen.queryByText('中断中：再開できます')).not.toBeInTheDocument();
  });

  it('ホーム：GM が裁定すると、中断中のセッションに「再開できます」と出る', async () => {
    const s = await playFromRecruitment('rc-gmless', 'pc-jin');
    const suspended = await api.post<Session>(`/sessions/${s.id}/proposals`, {
      text: '鍬を借りたい',
    });
    await api.post(`/sessions/${s.id}/proposals/${suspended.proposals[0].id}/approve`, {
      cardName: '鍬を借りる',
    });
    renderAt('/home');
    expect(await screen.findByText('中断中：再開できます')).toBeInTheDocument();
    expect(screen.queryByText('中断中：GM の裁定待ち')).not.toBeInTheDocument();
  });

  it('通し：GM が GM 不在で募集 → PL が絞り込んで迅で始める → 提案して中断 → GM が採用 → 再開 → 結末 → 迅は再挑戦不可', async () => {
    const user = userEvent.setup();
    const router = renderAt('/gm/scenarios/sc-village-always-win');
    const p = await recruitPanel();
    await user.click(within(p).getByLabelText('GM 不在（PL が自由に始める）'));
    await user.click(within(p).getByRole('button', { name: /この構成で募集を出す/ }));
    await screen.findByRole('heading', { name: '自分の募集' });

    await router.navigate('/pl/sessions');
    await screen.findByRole('heading', { name: '参加できるセッション' });
    await user.click(screen.getByLabelText('GM 不在の募集だけ'));
    const card = await recruitCard('（テスト用）必ず合格する村はずれ', 'ユウ');
    await user.selectOptions(within(card).getByLabelText('始める PC'), 'pc-jin');
    await user.click(within(card).getByRole('button', { name: 'この PC で始める' }));
    await screen.findByRole('button', { name: /村の広場へ向かう/ });

    await user.click(screen.getByRole('button', { name: /新たな選択肢を提案/ }));
    await user.type(screen.getByLabelText('提案する行動'), '鍬を借りたい');
    await user.click(screen.getByRole('button', { name: '提案を送る' }));
    await screen.findByText('GM の裁定を待っています（中断中）');

    await user.click(screen.getByRole('link', { name: 'GMの画面へ' }));
    const ticket = (await screen.findByText('鍬を借りたい')).closest('article')!;
    await user.click(within(ticket).getByRole('button', { name: '採用してカード化' }));
    await within(ticket).findByText('採用済み');
    await user.click(screen.getByRole('link', { name: 'ドライバーとしてプレイ画面へ' }));
    await user.click(await screen.findByRole('button', { name: '続きを遊ぶ' }));

    const press = async (name: RegExp) => {
      const button = await screen.findByRole('button', { name });
      await waitFor(() => expect(button).toBeEnabled());
      await user.click(button);
      await waitFor(() => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
    };
    for (const name of [
      /村の広場へ向かう/,
      /依頼「畑を荒らす猪」/,
      /柵で畑を囲む/,
      /お店へ行く/,
      /斬撃を習う/,
      /お店を出る/,
      /街の冒険者ギルドへ向かう/,
      /街の門をくぐる/,
    ])
      await press(name);
    const tactics = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(tactics).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(tactics).getByRole('button', { name: '戦闘を始める' }));
    await screen.findByText(/^1回目：\d+ラウンドで試験官に勝利した$/);
    await press(/合格の証を受け取る/);
    expect(
      await screen.findByRole('heading', { name: '結末「冒険者として旅立つ」' }),
    ).toBeInTheDocument();

    await router.navigate('/pl/sessions');
    const again = await recruitCard('（テスト用）必ず合格する村はずれ', 'ユウ');
    await waitFor(() => expect(optionOf(again, /迅.*再挑戦不可/).disabled).toBe(true));
  });
});
