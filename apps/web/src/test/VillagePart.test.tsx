// docs/plans/2026-09-27-村パート.md「5. 新規テストケース（ページ描画・API）」に対応する。
// 画面のテストは API で開始してプレイ画面を描画し、以降は同じ描画のままクリックだけで進める
// （キャラクターのキャッシュの無効化まで確かめるため、途中で API を直接呼んで状態を作らない）。
// 試験まで通すときは、試験官が必ず倒れるテスト用シナリオ sc-village-always-win を使う。

import { defaultAbilities } from '@cartagraph/domain/character/creation';
import type { Character } from '@cartagraph/domain/character/model';
import type { Session } from '@cartagraph/domain/session/model';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { scenarios } from '../mocks/fixtures';
import { characterCreation } from '../mocks/rulesFiles';
import { renderAt } from './renderAt';

/** ソロ開始の PC の能力値（合計を均等に配る。仮ルール）と、作成時の HP・行動値（rules/character-creation.json） */
const START = defaultAbilities(characterCreation.abilities);
const INITIAL = {
  hp: { current: characterCreation.initialHp, max: characterCreation.initialHp },
  baseActionValue: characterCreation.initialBaseActionValue,
};
/** 村の成長で HP・行動値を与えていたころの文（いまは出ない） */
const OLD_GROWTH_LINE = /HPを得た|行動値を得た/;

const start = (scenarioId: string, name = '新人') =>
  api.post<Session>(`/scenarios/${scenarioId}/start-solo`, { name });

const characterOf = (s: Session) =>
  api.get<Character>(`/characters/${s.participants.find((p) => p.role === 'driver')?.characterId}`);

const card = (name: RegExp | string) => screen.findByRole('button', { name });

/** fixtures のシナリオに置いたカードの説明文（テストに文面を書き写さないため） */
function descriptionOf(scenarioId: string, cardId: string): string {
  const found = scenarios
    .find((x) => x.id === scenarioId)
    ?.deck.flatMap((n) => n.cards)
    .find((c) => c.id === cardId);
  if (!found?.description) throw new Error(`${scenarioId} のカード ${cardId} に説明文がありません`);
  return found.description;
}

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
    await play(user, /街の門をくぐる/);

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
    // 結末タグを即時に付け、描写とログに出す（solo-village.md「結末タグ」、仮ルール）
    const ended = await api.get<Session>(`/sessions/${s.id}`);
    expect(ended.flavor).toBe(
      `${descriptionOf('sc-village-always-win', 'vs-accept')} 結末タグ『冒険者になった』を得た。`,
    );
    expect(ended.feed.slice(0, 4).map((f) => f.text)).toEqual([
      '新人は結末タグ『冒険者になった』を得た',
      '結末「冒険者として旅立つ」に至り、セッションが終了した',
      '「冒険者として旅立つ」へ進んだ',
      '新人が「合格の証を受け取る」をプレイ',
    ]);
    expect(screen.getByText(/結末タグの即時反映は仮ルール/)).toBeInTheDocument();

    const pc = await characterOf(s);
    expect(pc.abilities).toEqual({
      body: START.body + 1,
      skill: START.skill + 1,
      mind: START.mind + 1,
    });
    // HP・行動値は作成時の値のまま（村の成長では変わらない）
    expect(pc).toMatchObject(INITIAL);
    expect(pc.deck.filter((c) => c.tags.includes('戦闘スキル')).map((c) => c.name)).toEqual([
      '斬撃',
      '渾身の一撃',
      '素早い突き',
    ]);
    expect(pc.deck.filter((c) => c.tags.includes('引換'))).toEqual([]);
    expect(pc.endingTags).toEqual(['冒険者になった']);
  });

  it('本物のシナリオ（sc-village-start）でも、依頼1件→お店で斬撃→街道→試験の戦い方の設定まで進める', async () => {
    const scenario = scenarios.find((x) => x.id === 'sc-village-start');
    expect(scenario?.title).toBe('村はずれの一歩');
    // 結末のノードが、結末タグを持つ結末を指している
    const endNode = scenario?.deck.find((n) => n.kind === 'ending');
    expect(scenario?.endings.find((e) => e.id === endNode?.endingId)?.grantsTag).toBe(
      '冒険者になった',
    );
    const s = await start('sc-village-start');
    const playCard = (cardId: string) => api.post<Session>(`/sessions/${s.id}/play`, { cardId });
    await playCard('vs-to-square');
    await playCard('vs-to-quest-0');
    await playCard('vs-quest-0-body');
    await playCard('vs-to-shop');
    await playCard('vs-learn-c-slash');
    await playCard('vs-shop-leave');
    const road = await playCard('vs-to-guild');
    expect(road.currentScene.name).toBe('街道');
    const exam = await playCard('vs-to-exam');
    expect(exam.autoCombat).toMatchObject({ status: 'awaiting-priority' });
    expect(exam.currentScene.name).toBe('冒険者試験');
  });

  // local-flow の完成の条件5（GM 不在のシナリオを JSON から結末まで遊べる）を直接確かめる。
  // 乱数は固定せず、scenarios/sc-village-start.json の試験官のまま自動戦闘を通す。
  // 斬撃だけの勝率は6〜7割（docs/cartagraph/auto-combat-simulation.md）なので、負けたら設定からやり直す
  // 開始画面（/pl/village-start）で名乗るところから通す
  it('本物のシナリオ（sc-village-start）で、名乗る→依頼1件→お店で斬撃→試験に勝つ→結末まで、クリックだけで進める', async () => {
    const MAX_ATTEMPTS = 20;
    const user = userEvent.setup();
    const router = renderAt('/pl/village-start');
    await user.click(await screen.findByRole('button', { name: /名を名乗る/ }));
    await user.type(screen.getByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '名乗る' }));
    await play(user, /村の広場へ向かう/);
    // プレイ画面に移った後なので、URL からセッションを引ける
    const sessionId = router.state.location.pathname.split('/')[3];
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    expect(
      await screen.findByText(`体が1上がった（体 ${START.body + 1}）`, { exact: false }),
    ).toBeInTheDocument();
    await play(user, /お店へ行く/);
    await playWhenEnabled(user, /斬撃を習う/);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /斬撃を習う/ })).not.toBeInTheDocument(),
    );
    await play(user, /お店を出る/);
    await playWhenEnabled(user, /街の冒険者ギルドへ向かう/);
    await play(user, /街の門をくぐる/);

    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    let won = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !won; attempt++) {
      await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
      const headline = await screen.findByText(new RegExp(`^${attempt}回目：\\d+ラウンドで`));
      won = /試験官に勝利した$/.test(headline.textContent ?? '');
      expectNoWaitingForGm();
    }
    expect(won).toBe(true);

    await user.click(await card(/合格の証を受け取る/));
    expect(
      await screen.findByRole('heading', { name: '結末「冒険者として旅立つ」' }),
    ).toBeInTheDocument();
    const ended = await api.get<Session>(`/sessions/${sessionId}`);
    expect(ended.status).toBe('ended');
    const pc = await characterOf(ended);
    expect(pc.endingTags).toEqual(['冒険者になった']);
    expect(pc).toMatchObject(INITIAL);
    // 村の成長で HP・行動値を与えていたころの痕跡が無い（値そのものは作成時と同じなので、区別には使えない）
    expect(ended.feed.some((f) => OLD_GROWTH_LINE.test(f.text))).toBe(false);
    expect(screen.queryByText(OLD_GROWTH_LINE)).not.toBeInTheDocument();
    // 負けが続いたときのやり直し（最大20回）の分だけ、既定の5秒より長く待つ
  }, 30_000);
});

describe('村パート：開始直後', () => {
  it('作成時の能力値・HP・行動値を持ち、戦闘スキルが無いので、広場の「街の冒険者ギルドへ向かう」は選べず、理由が出る', async () => {
    const { s } = await atSquare();
    const pc = await characterOf(s);
    expect(pc).toMatchObject({ abilities: START, ...INITIAL });
    expect(pc.deck).toEqual([]);

    const guild = await card(/街の冒険者ギルドへ向かう/);
    await waitFor(() => expect(guild).toBeDisabled());
    expect(within(guild).getByText('『攻撃』のカードが必要')).toBeInTheDocument();
  });

  it('攻撃のスキルが無いままギルドへ向かうと、API は使える条件の理由で 422 を返し、何も変えない', async () => {
    const s = await start('sc-village-always-win');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    const before = await api.get<Session>(`/sessions/${s.id}`);
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-guild' }),
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
    expect(
      screen.getByText(`体が1上がった（体 ${START.body + 1}）`, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/村の広場へ進んだ/)).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /依頼「畑を荒らす猪」/ })).not.toBeInTheDocument();
    expect(await card(/依頼「壊れた水車」/)).toBeInTheDocument();
    expect(await card(/依頼「迷子の子ヤギ」/)).toBeInTheDocument();

    const pc = await characterOf(s);
    expect(pc.abilities).toEqual({ ...START, body: START.body + 1 });
    expect(pc).toMatchObject(INITIAL);
    expect(pc.deck.map((c) => c.name)).toEqual(['農家のおばさんからの報酬']);

    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.currentScene.name).toBe('村の広場');
    expect(after.feed.slice(0, 4).map((f) => f.text)).toEqual([
      '「村の広場」へ進んだ',
      '新人が「柵で畑を囲む」をプレイ',
      `新人：体が1上がった（体 ${START.body + 1}）`,
      '新人：『農家のおばさんからの報酬』を受け取った',
    ]);
    expect(after.feed.some((f) => OLD_GROWTH_LINE.test(f.text))).toBe(false);
  });

  it('2件目の依頼では、選んだ能力値だけが上がり、ほかの2つは変わらない', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await play(user, /依頼「壊れた水車」/);
    await play(user, /歯車を組み直す/);
    await card(/お店へ行く/);
    expect((await characterOf(s)).abilities).toEqual({
      ...START,
      body: START.body + 1,
      skill: START.skill + 1,
    });
  });

  // ソロ開始の能力値を均等に配るようにして、依頼3件で上限に届くようになった（F2）
  it('依頼3件をすべて体で解決すると体が上限になり、3件目の描写と feed は「これ以上上がらない」', async () => {
    const { max } = characterCreation.abilities;
    expect(START.body + 2).toBe(max);
    const s = await start('sc-village-always-win');
    const playCard = (cardId: string) => api.post<Session>(`/sessions/${s.id}/play`, { cardId });
    await playCard('vs-to-square');
    for (const n of [0, 1]) {
      await playCard(`vs-to-quest-${n}`);
      await playCard(`vs-quest-${n}-body`);
    }
    await playCard('vs-to-quest-2');
    const third = await playCard('vs-quest-2-body');
    const capped = `体はこれ以上上がらない（体 ${max}）`;
    expect(third.flavor).toContain(capped);
    expect(third.feed.map((f) => f.text)).toContain(`新人：${capped}`);
    expect((await characterOf(s)).abilities.body).toBe(max);
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
      cardId: 'vs-to-square',
    });
    expect(square.hand.map((c) => c.name)).toContain('依頼「畑を荒らす猪」');
  });

  it('依頼の中で「広場へ戻る」を選ぶと、その依頼は広場に残り、キャラクターは変わらない', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /広場へ戻る/);
    expect(await card(/依頼「畑を荒らす猪」/)).toBeInTheDocument();
    const pc = await characterOf(s);
    expect(pc.abilities).toEqual(START);
    expect(pc.deck).toEqual([]);
  });

  it('解決した依頼の解決カードを API で送ると 404（手札に無い）', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await card(/お店へ行く/);
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vs-quest-0-body' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('成長の効果と遷移は一緒に失敗する（遷移先が無ければ 422 で、何も変わらない）', async () => {
    const s = await start('sc-village-always-win');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
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

  it('導入に説明文を持つ遷移カード（村の広場へ向かう）があれば、シーンに入ったときの描写の仮ルールとして表示する', async () => {
    const s = await start('sc-village-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    await card(/村の広場へ向かう/);
    expect(screen.getByText(/シーンに入ったときの描写は仮ルール/)).toBeInTheDocument();
  });

  it('条件・効果・説明文つきの遷移カードの無い手札では、仮ルールの表示を出さない', async () => {
    // 試験用シナリオの導入は、説明文の無い「街の冒険者ギルドへ向かう」だけ
    const s = await start('sc-exam-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    await card(/街の冒険者ギルドへ向かう/);
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
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-shop' });
    const before = await api.get<Session>(`/sessions/${s.id}`);
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'vs-learn-c-slash' }),
    ).rejects.toMatchObject({ status: 422, message: '『引換』のカードが必要' });
    expect(await api.get<Session>(`/sessions/${s.id}`)).toEqual(before);
    expect((await characterOf(s)).deck).toEqual([]);
  });

  it('引換カード1枚で斬撃を習うと、斬撃のカードだけが消えてお店に留まる。行動値は変わらない', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /柵で畑を囲む/);
    await play(user, /お店へ行く/);

    await playWhenEnabled(user, /斬撃を習う/);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /斬撃を習う/ })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/店主の手ほどきで「斬撃」を身につけた/)).toBeInTheDocument();
    expect(screen.queryByText(OLD_GROWTH_LINE)).not.toBeInTheDocument();
    // 引換カードを使い切ったので、ほかの3枚は選べない
    for (const name of [/渾身の一撃を習う/, /素早い突きを習う/, /応急手当を習う/])
      await waitFor(async () => expect(await card(name)).toBeDisabled());

    const pc = await characterOf(s);
    expect(pc.deck.map((c) => c.name)).toEqual(['斬撃']);
    expect(pc.baseActionValue).toBe(INITIAL.baseActionValue);
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
      api.post(`/sessions/${s.id}/play`, { cardId: 'vs-learn-c-slash' }),
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
      api.post(`/sessions/${s.id}/play`, { cardId: 'vs-to-guild' }),
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
    // 街道を経て、門をくぐると試験の戦い方の設定になる
    await play(user, /街の門をくぐる/);
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
      cardId: 'vs-quest-0-body',
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
      cardId: 'vs-learn-c-slash',
    });
    expect(after.flavor).toMatch(/GMの描写を待っている/);
    expect(await api.get<Character>('/characters/pc-mio')).toEqual(before);
  });

  it('説明文を持つ遷移カードを選んでも、描写は説明文にならずシーン名だけ', async () => {
    const after = await api.post<Session>('/sessions/ss-village-human-gm/play', {
      cardId: 'vs-to-shop',
    });
    expect(after.flavor).toBe('村のお店へ進んだ。');
  });

  it('プレイ画面では、使える条件で選べなくしたり、仮ルールの表示を出したりしない', async () => {
    renderAt('/pl/sessions/ss-village-human-gm/play');
    const learn = await card(/斬撃を習う/);
    expect(learn).toBeEnabled();
    expect(within(learn).queryByText(/カードが必要/)).not.toBeInTheDocument();
    expect(screen.queryByText(/仮ルール/)).not.toBeInTheDocument();
  });
});

describe('シーンに入ったときの描写（GM不在のソロ。solo-village.md「描写」、仮ルール）', () => {
  it('依頼へ行くと、依頼へ行くカードの説明文が描写になる', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await card(/柵で畑を囲む/);
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.flavor).toBe(descriptionOf('sc-village-always-win', 'vs-to-quest-0'));
  });

  it('説明文の無い遷移カード（依頼の中の「広場へ戻る」）では、従来どおりシーン名だけの描写', async () => {
    const { user, s } = await atSquare();
    await play(user, /依頼「畑を荒らす猪」/);
    await play(user, /広場へ戻る/);
    await card(/お店へ行く/);
    expect((await api.get<Session>(`/sessions/${s.id}`)).flavor).toBe('村の広場へ進んだ。');
  });

  it('自動戦闘のシーンへ説明文のあるカードで進むと、説明文のあとに相手の登場の文が続く', async () => {
    const s = await start('sc-village-always-win');
    for (const id of ['vs-to-square', 'vs-to-quest-0', 'vs-quest-0-body', 'vs-to-shop'])
      await api.post(`/sessions/${s.id}/play`, { cardId: id });
    for (const id of ['vs-learn-c-slash', 'vs-shop-leave', 'vs-to-guild'])
      await api.post(`/sessions/${s.id}/play`, { cardId: id });
    const exam = await api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'vs-to-exam' });
    expect(exam.flavor).toBe(
      `${descriptionOf('sc-village-always-win', 'vs-to-exam')} 試験官が待ち構えている。戦い方（カードの優先順位）を決めよう。`,
    );
  });

  it('自動戦闘のシーンへ説明文の無いカードで進むと、相手の登場の文だけ', async () => {
    const s = await start('sc-exam-always-win');
    const exam = await api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'aw-to-guild' });
    expect(exam.flavor).toBe('試験官が待ち構えている。戦い方（カードの優先順位）を決めよう。');
  });
});

describe('街道', () => {
  it('手札は「辺りを眺める」と「街の門をくぐる」だけで、眺めるとその場に留まる', async () => {
    const s = await start('sc-village-always-win');
    for (const id of ['vs-to-square', 'vs-to-quest-0', 'vs-quest-0-body', 'vs-to-shop'])
      await api.post(`/sessions/${s.id}/play`, { cardId: id });
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-learn-c-slash' });
    await api.post(`/sessions/${s.id}/play`, { cardId: 'vs-shop-leave' });
    const road = await api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'vs-to-guild' });
    expect(road.flavor).toBe(descriptionOf('sc-village-always-win', 'vs-to-guild'));
    expect(road.hand.map((c) => c.name)).toEqual(['辺りを眺める', '街の門をくぐる']);

    const looked = await api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'vs-road-look' });
    expect(looked.currentScene.name).toBe('街道');
    expect(looked.flavor).toBe(descriptionOf('sc-village-always-win', 'vs-road-look'));
    expect(looked.hand.map((c) => c.name)).toEqual(['街の門をくぐる']);
  });
});

describe('結末の「仮ルール」表示', () => {
  it('結末タグを持たないシナリオで GM不在のソロが終わっても、結末タグの仮ルールの表示は出ない', async () => {
    const user = userEvent.setup();
    const s = await start('sc-exam-always-win');
    await api.post(`/sessions/${s.id}/play`, { cardId: 'aw-to-guild' });
    await api.post(`/sessions/${s.id}/auto-combat`, {
      priority: [{ cardId: 'c-slash', when: 'always' }],
    });
    renderAt(`/pl/sessions/${s.id}/play`);
    await user.click(await card(/合格の証を受け取る/));
    expect(
      await screen.findByRole('heading', { name: '結末「冒険者として旅立つ」' }),
    ).toBeInTheDocument();
    // 終了後に読むシナリオ（結末の定義）とキャラクターの応答を待ってから確かめる
    expect((await characterOf(s)).endingTags).toEqual([]);
    await api.get(`/scenarios/sc-exam-always-win`);
    expect(screen.queryByText(/結末タグの即時反映は仮ルール/)).not.toBeInTheDocument();
    expect((await characterOf(s)).endingTags).toEqual([]);
  });
});
