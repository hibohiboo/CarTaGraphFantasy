// docs/plans/2026-09-27-村パート.md「5. 新規テストケース（ページ描画・API）」に対応する。
// 画面のテストは API で開始してプレイ画面を描画し、以降は同じ描画のままクリックだけで進める
// （キャラクターのキャッシュの無効化まで確かめるため、途中で API を直接呼んで状態を作らない）。
// 試験まで通すときは、試験官が必ず倒れるテスト用シナリオ sc-village-always-win を使う。

import { type Character, deriveArchetype, type Session } from '@cartagraph/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routeObjects } from '../app/router';
import { api } from '../lib/api';
import { soloGrowth } from '../mocks/fixtures';

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

const start = (scenarioId: string, name = '新人') =>
  api.post<Session>(`/scenarios/${scenarioId}/start-solo`, { name });

const characterOf = (s: Session) =>
  api.get<Character>(`/characters/${s.participants.find((p) => p.role === 'driver')?.characterId}`);

const card = (name: RegExp | string) => screen.findByRole('button', { name });

/** GM不在なので、どの段階でも「GMの描写を待っている」にならない（行き止まりにならない） */
const expectNoWaitingForGm = () =>
  expect(screen.queryByText(/GMの描写を待っている/)).not.toBeInTheDocument();

/** 手札のカードを押し、そのカードが手札から消える（＝応答が反映される）まで待つ */
async function play(user: UserEvent, name: RegExp) {
  await user.click(await card(name));
  await waitFor(() => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
}

/** 選べるようになるまで待ってから押す（キャラクターの再取得を待つ） */
async function playWhenEnabled(user: UserEvent, name: RegExp) {
  const button = await card(name);
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

/** API で開始してプレイ画面を描画し、村の広場まで進める */
async function atSquare(scenarioId = 'sc-village-always-win') {
  const user = userEvent.setup();
  const s = await start(scenarioId);
  renderAt(`/pl/sessions/${s.id}/play`);
  await play(user, /村の広場へ向かう/);
  await card(/お店へ行く/);
  return { user, s };
}

describe('村パート：画面から最後まで通す（GM不在の1人プレイ）', () => {
  it('依頼3件→お店で3つ習う→試験（素早い突きだけで勝つ）→結末まで、クリックだけで進める', async () => {
    const { user, s } = await atSquare();

    for (const [quest, solution] of [
      [/依頼「畑を荒らす猪」/, /柵で畑を囲む/],
      [/依頼「壊れた水車」/, /歯車を組み直す/],
      [/依頼「迷子の子ヤギ」/, /泣いている孫を落ち着かせ/],
    ] as const) {
      await play(user, quest);
      await play(user, solution);
      await card(/お店へ行く/);
      expectNoWaitingForGm();
    }
    // 解決した依頼は広場に残らない
    expect(screen.queryByRole('button', { name: /依頼「/ })).not.toBeInTheDocument();

    await play(user, /お店へ行く/);
    for (const learn of [/斬撃を習う/, /渾身の一撃を習う/, /素早い突きを習う/]) {
      await playWhenEnabled(user, learn);
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: learn })).not.toBeInTheDocument(),
      );
      expectNoWaitingForGm();
    }
    // 引換カードを使い切ったので、残った応急手当は選べない
    expect(await card(/応急手当を習う/)).toBeDisabled();
    await play(user, /お店を出る/);
    expectNoWaitingForGm();
    await playWhenEnabled(user, /街の冒険者ギルドへ向かう/);

    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「素早い突き」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    expect(await screen.findByText(/^1回目：\d+ラウンドで試験官に勝利した$/)).toBeInTheDocument();
    expectNoWaitingForGm();
    const won = await api.get<Session>(`/sessions/${s.id}`);
    expect(won.autoCombat?.lastResult?.log[0]).toMatchObject({
      actor: 'pl',
      cardName: '素早い突き',
    });

    await user.click(await card(/合格の証を受け取る/));
    expect(
      await screen.findByRole('heading', { name: '結末「冒険者として旅立つ」' }),
    ).toBeInTheDocument();
    expectNoWaitingForGm();

    const pc = await characterOf(s);
    expect(pc.abilities).toEqual({ body: 2, skill: 2, mind: 2 });
    expect(pc.hp).toEqual({ current: soloGrowth.hp, max: soloGrowth.hp });
    expect(pc.baseActionValue).toBe(soloGrowth.baseActionValue);
    expect(pc.deck.filter((c) => c.tags.includes('戦闘スキル')).map((c) => c.name)).toEqual([
      '斬撃',
      '渾身の一撃',
      '素早い突き',
    ]);
    expect(pc.deck.filter((c) => c.tags.includes('引換'))).toEqual([]);
    expect(deriveArchetype(pc)).toBe('adventurer');
  });

  it('本物のシナリオ（sc-village-start）でも、依頼1件→お店で斬撃→試験の戦い方の設定まで進める', async () => {
    const s = await start('sc-village-start');
    const playCard = (cardId: string) => api.post<Session>(`/sessions/${s.id}/play`, { cardId });
    await playCard('vs-to-square');
    await playCard('vs-to-quest-0');
    await playCard('vs-quest-0-body');
    await playCard('vs-to-shop');
    await playCard('vs-learn-c-slash');
    await playCard('vs-shop-leave');
    const exam = await playCard('vs-to-guild');
    expect(exam.autoCombat).toMatchObject({ status: 'awaiting-priority' });
    expect(exam.currentScene.name).toBe('冒険者試験');
  });
});

describe('村パート：旅人から始まる', () => {
  it('開始直後は旅人で、広場の「街の冒険者ギルドへ向かう」は選べず、理由が出る', async () => {
    const { s } = await atSquare();
    const pc = await characterOf(s);
    expect(pc.abilities).toBeUndefined();
    expect(pc.hp).toBeUndefined();
    expect(pc.deck).toEqual([]);
    expect(deriveArchetype(pc)).toBe('traveler');

    const guild = await card(/街の冒険者ギルドへ向かう/);
    await waitFor(() => expect(guild).toBeDisabled());
    expect(within(guild).getByText('『攻撃』のカードが必要')).toBeInTheDocument();
  });

  it('攻撃のスキルが無いままギルドへ向かうと、API は使える条件の理由で 422 を返し、何も変えない', async () => {
    const s = await start('sc-village-always-win');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vw-to-square' });
    const before = await api.get<Session>(`/sessions/${s.id}`);
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vw-to-guild' }),
    ).rejects.toMatchObject({ status: 422, message: '『攻撃』のカードが必要' });
    expect(await api.get<Session>(`/sessions/${s.id}`)).toEqual(before);
  });
});

describe('村パート：依頼', () => {
  it('依頼を1件解決すると、選んだ能力値が上がり、引換カードを得て広場に戻り、その依頼は出なくなる', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);

    // 描写は解決方法の説明文と効果の文。移った先のシーン名だけの描写ではない
    expect(await screen.findByText(/柵で畑をぐるりと囲んだ/)).toBeInTheDocument();
    expect(screen.getByText(/体が1上がった（体 2）/)).toBeInTheDocument();
    expect(screen.queryByText(/村の広場へ進んだ/)).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /依頼「畑を荒らす猪」/ })).not.toBeInTheDocument();
    expect(await card(/依頼「壊れた水車」/)).toBeInTheDocument();
    expect(await card(/依頼「迷子の子ヤギ」/)).toBeInTheDocument();

    const pc = await characterOf(s);
    expect(pc.abilities).toEqual({ body: 2, skill: 1, mind: 1 });
    expect(pc.hp).toEqual({ current: 20, max: 20 });
    expect(pc.baseActionValue).toBeUndefined();
    expect(deriveArchetype(pc)).toBe('explorer');
    expect(pc.deck.map((c) => c.name)).toEqual(['農家のおばさんからの報酬']);

    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.currentScene.name).toBe('村の広場');
    expect(after.feed.slice(0, 4).map((f) => f.text)).toEqual([
      '「村の広場」へ進んだ',
      '新人が「柵で畑を囲む」をプレイ',
      '新人：体が1上がった（体 2）',
      '新人：『農家のおばさんからの報酬』を受け取った',
    ]);
    expect(after.feed[4].text).toBe('新人：HPを得た（HP 20）');
  });

  it('2件目の依頼では、選んだ能力値だけが上がり、ほかの2つは変わらない', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await play(user, /依頼「壊れた水車」/);
    await play(user, /歯車を組み直す/);
    await card(/お店へ行く/);
    expect((await characterOf(s)).abilities).toEqual({ body: 2, skill: 2, mind: 1 });
  });

  it('達成カードは GM専用ゾーンにだけ置かれ、デッキ・画面・feed・描写には出ない', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await card(/お店へ行く/);

    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.field.gmOnly.map((c) => c.tags)).toEqual([['達成', '達成:猪']]);
    expect(after.field.plVisible).toEqual([]);
    const pc = await characterOf(s);
    expect(pc.deck.some((c) => c.tags.includes('達成'))).toBe(false);
    expect(screen.queryByText(/片づけた|達成/)).not.toBeInTheDocument();
    expect(after.feed.some((f) => /片づけた|達成/.test(f.text))).toBe(false);
    expect(after.flavor).not.toMatch(/片づけた|達成/);
  });

  it('達成は次のセッションへ持ち越さない（新しく始めれば、解決した依頼がまた出る）', async () => {
    const { user } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await card(/お店へ行く/);

    const again = await start('sc-village-always-win');
    const square = await api.post<Session>(`/sessions/${again.id}/play`, {
      cardId: 'vw-to-square',
    });
    expect(square.hand.map((c) => c.name)).toContain('依頼「畑を荒らす猪」');
  });

  it('依頼の中で「広場へ戻る」を選ぶと、その依頼は広場に残り、キャラクターは変わらない', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /広場へ戻る/);
    expect(await card(/依頼「畑を荒らす猪」/)).toBeInTheDocument();
    const pc = await characterOf(s);
    expect(pc.abilities).toBeUndefined();
    expect(pc.deck).toEqual([]);
  });

  it('解決した依頼の解決カードを API で送ると 404（手札に無い）', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await card(/お店へ行く/);
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vw-quest-0-body' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('成長の効果と遷移は一緒に失敗する（遷移先が無ければ 422 で、何も変わらない）', async () => {
    const s = await start('sc-village-always-win');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vw-to-square' });
    const before = await api.get<Session>(`/sessions/${s.id}`);
    const pcBefore = await characterOf(s);
    await expect(api.post(`/sessions/${s.id}/play`, { cardId: 'vw-lost' })).rejects.toMatchObject({
      status: 422,
    });
    expect(await api.get<Session>(`/sessions/${s.id}`)).toEqual(before);
    expect(await characterOf(s)).toEqual(pcBefore);
  });

  it('成長の効果を持つカードが手札にあるとき、仮ルールであることを表示する', async () => {
    const { user } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    expect(await screen.findByText(/仮ルール/)).toBeInTheDocument();
  });

  it('使える条件で選べないカードがある広場でも、仮ルールであることを表示する', async () => {
    // テスト用シナリオの広場には成長の効果を持つ「迷い道」があるため、本物のシナリオで確かめる
    await atSquare('sc-village-start');
    expect(await screen.findByText(/仮ルール/)).toBeInTheDocument();
  });

  it('導入（条件も効果も無いカードだけ）では、仮ルールの表示を出さない', async () => {
    const s = await start('sc-village-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    await card(/村の広場へ向かう/);
    expect(screen.queryByText(/仮ルール/)).not.toBeInTheDocument();
  });
});

describe('村パート：お店', () => {
  it('引換カードが無ければ、習うカードは4枚とも選べず、理由が出る。押しても何も起きない', async () => {
    const { user, s } = await atSquare();
    await play(user, /お店へ行く/);
    const learns = await screen.findAllByRole('button', { name: /を習う/ });
    expect(learns).toHaveLength(4);
    for (const b of learns) {
      await waitFor(() => expect(b).toBeDisabled());
      expect(within(b).getByText('『引換』のカードが必要')).toBeInTheDocument();
    }
    const feedBefore = (await api.get<Session>(`/sessions/${s.id}`)).feed.length;
    await user.click(learns[0]);
    expect((await api.get<Session>(`/sessions/${s.id}`)).feed).toHaveLength(feedBefore);
  });

  it('引換カードが無いまま API で習おうとすると 422 で、何も変えない', async () => {
    const s = await start('sc-village-always-win');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vw-to-square' });
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vw-to-shop' });
    const before = await api.get<Session>(`/sessions/${s.id}`);
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vw-learn-c-slash' }),
    ).rejects.toMatchObject({ status: 422, message: '『引換』のカードが必要' });
    expect(await api.get<Session>(`/sessions/${s.id}`)).toEqual(before);
    expect((await characterOf(s)).deck).toEqual([]);
  });

  it('引換カード1枚で斬撃を習うと冒険者になり、斬撃のカードだけが消えてお店に留まる', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await play(user, /お店へ行く/);
    expect(deriveArchetype(await characterOf(s))).toBe('explorer');

    await playWhenEnabled(user, /斬撃を習う/);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /斬撃を習う/ })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/店主の手ほどきで「斬撃」を身につけた/)).toBeInTheDocument();
    expect(screen.getByText(/行動値を得た（行動値 10）/)).toBeInTheDocument();
    // 引換カードを使い切ったので、ほかの3枚は選べない
    for (const name of [/渾身の一撃を習う/, /素早い突きを習う/, /応急手当を習う/])
      await waitFor(async () => expect(await card(name)).toBeDisabled());

    const pc = await characterOf(s);
    expect(pc.deck.map((c) => c.name)).toEqual(['斬撃']);
    expect(pc.baseActionValue).toBe(10);
    expect(deriveArchetype(pc)).toBe('adventurer');
    expect((await api.get<Session>(`/sessions/${s.id}`)).currentScene.name).toBe('村のお店');
  });

  it('習ったスキルは、お店に入り直しても並ばず、API で送ると 404', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await play(user, /依頼「壊れた水車」/);
    await play(user, /歯車を組み直す/);
    await play(user, /お店へ行く/);
    await playWhenEnabled(user, /斬撃を習う/);
    await play(user, /お店を出る/);
    await play(user, /お店へ行く/);
    await card(/渾身の一撃を習う/);
    expect(screen.queryByRole('button', { name: /斬撃を習う/ })).not.toBeInTheDocument();
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vw-learn-c-slash' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('応急手当だけでは「街の冒険者ギルドへ向かう」を選べない（攻撃の手段が要る）', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await play(user, /お店へ行く/);
    await playWhenEnabled(user, /応急手当を習う/);
    await play(user, /お店を出る/);
    const guild = await card(/街の冒険者ギルドへ向かう/);
    await waitFor(() => expect(guild).toBeDisabled());
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vw-to-guild' }),
    ).rejects.toMatchObject({ status: 422, message: '『攻撃』のカードが必要' });
  });

  it('攻撃のスキルを1つ習えば、ギルドへ向かえる。使い残した引換カードはデッキに残る', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await play(user, /依頼「壊れた水車」/);
    await play(user, /歯車を組み直す/);
    await play(user, /お店へ行く/);
    await playWhenEnabled(user, /素早い突きを習う/);
    await play(user, /お店を出る/);
    await playWhenEnabled(user, /街の冒険者ギルドへ向かう/);
    expect(await screen.findByRole('region', { name: '戦い方を決める' })).toBeInTheDocument();
    const pc = await characterOf(s);
    expect(pc.deck.filter((c) => c.tags.includes('引換')).map((c) => c.name)).toEqual([
      '粉ひきの親方からの報酬',
    ]);
  });
});

describe('村パート：人間GMのセッションでは働かない（GM不在のソロの仮ルール）', () => {
  it('成長の効果を持つカードを選んでも、キャラクターも GM専用ゾーンも変わらない', async () => {
    const before = await api.get<Character>('/characters/pc-mio');
    const after = await api.post<Session>('/sessions/ss-village-human-gm/play', {
      cardId: 'vw-quest-0-body',
    });
    expect(await api.get<Character>('/characters/pc-mio')).toEqual(before);
    expect(after.field.gmOnly).toEqual([]);
    expect(after.feed.some((f) => f.text.includes('上がった'))).toBe(false);
    // 移った先の広場では、配る条件で絞らない（解決した扱いにもならない）
    expect(after.hand.map((c) => c.name)).toContain('依頼「畑を荒らす猪」');
  });

  it('使える条件を満たさないカードも 422 にならず、成長の効果も働かない', async () => {
    const before = await api.get<Character>('/characters/pc-mio');
    const after = await api.post<Session>('/sessions/ss-village-human-gm/play', {
      cardId: 'vw-learn-c-slash',
    });
    expect(after.flavor).toMatch(/GMの描写を待っている/);
    expect(await api.get<Character>('/characters/pc-mio')).toEqual(before);
  });

  it('プレイ画面では、使える条件で選べなくしたり、仮ルールの表示を出したりしない', async () => {
    renderAt('/pl/sessions/ss-village-human-gm/play');
    const learn = await card(/斬撃を習う/);
    expect(learn).toBeEnabled();
    expect(within(learn).queryByText(/カードが必要/)).not.toBeInTheDocument();
    expect(screen.queryByText(/仮ルール/)).not.toBeInTheDocument();
  });
});
