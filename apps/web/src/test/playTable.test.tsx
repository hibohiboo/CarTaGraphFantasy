// プレイ画面（卓）のテスト。docs/plans/2026-10-27-P7-プレイ画面の卓.md「5. 新規テストケース」の T1〜T7・T10 に対応する。
// 栞の外の操作（手札のプレイなど）は pages.test.tsx・gmlessScreens.test.tsx・VillagePart.test.tsx が通しで確かめる。

import type { Character } from '@cartagraph/domain/character/model';
import type { Session } from '@cartagraph/domain/session/model';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { server } from '../mocks/node';
import { runAutoCombat, startAtExam } from './autoCombatHelpers';
import { bookmarkLink, openBookmark } from './playHelpers';
import { renderAt } from './renderAt';

/** 灰色館の一夜（rc-mine）を、自分（GM）の PC をドライバーにして API で始める */
const startMansion = () =>
  api.post<Session>('/recruitments/rc-mine/start', {
    characterIds: ['pc-jin'],
    driverCharacterId: 'pc-jin',
    partyName: '',
  });

const BOOKMARK = { name: '栞を開く' };
const DOOR_FLAVOR = '古びた扉の向こうから、かすかな音が聞こえる。';
/** 卓の「場を見る」を押して、場のゾーンのダイアログを開く */
const openField = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: '場を見る' }));
  return screen.findByRole('dialog', { name: '場のゾーン' });
};
const partyCards = () =>
  within(screen.getByRole('list', { name: 'パーティ' })).getAllByRole('listitem');
const awaiting = () => document.querySelector('[data-awaiting="true"]');

describe('プレイ画面の卓：ナビゲーション（T1）', () => {
  it('プレイ画面には主要ナビゲーションとフッタが出ない。セッション一覧には出る', async () => {
    renderAt('/pl/sessions/ss-mansion/play');
    await screen.findByRole('button', BOOKMARK);
    expect(
      screen.queryByRole('navigation', { name: '主要ナビゲーション' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('セッション一覧（プレイ画面の外）には主要ナビゲーションとフッタが出る', async () => {
    renderAt('/pl/sessions');
    expect(
      await screen.findByRole('navigation', { name: '主要ナビゲーション' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

describe('プレイ画面の卓：栞（T2）', () => {
  it('卓にはキャラクターシート・セッション一覧・GMの画面へのリンクが無く、栞を閉じているときは中身が DOM に無い', async () => {
    renderAt('/pl/sessions/ss-mansion/play');
    await screen.findByRole('button', BOOKMARK);
    for (const name of ['キャラクターシート', 'セッション一覧', 'GMの画面へ']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('dialog', { name: '栞' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ホームへ戻る' })).not.toBeInTheDocument();
  });

  it('開くと、シート（ドライバーの PC）とホームへのリンクがあり、セッション一覧は無い。GM でない PL に「GMの画面へ」は無い', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    const dialog = await openBookmark(user);
    expect(within(dialog).getByRole('link', { name: 'キャラクターシートを見る' })).toHaveAttribute(
      'href',
      '/pl/characters/pc-jin',
    );
    expect(within(dialog).getByRole('link', { name: 'ホームへ戻る' })).toHaveAttribute(
      'href',
      '/home',
    );
    expect(within(dialog).queryByRole('link', { name: 'セッション一覧' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'GMの画面へ' })).not.toBeInTheDocument();
  });

  it('GM 本人（自分の PC で遊ぶ）には「GMの画面へ」がある', async () => {
    const user = userEvent.setup();
    const s = await startMansion();
    renderAt(`/pl/sessions/${s.id}/play`);
    expect(await bookmarkLink(user, 'GMの画面へ')).toHaveAttribute('href', `/gm/sessions/${s.id}`);
  });

  it('Escape・「卓に戻る」・外側のクリックのそれぞれで閉じ、栞のボタンにフォーカスが戻る。セッションの状態は変わらない', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    const before = await api.get<Session>('/sessions/ss-mansion');

    await openBookmark(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '栞' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', BOOKMARK)).toHaveFocus();

    await openBookmark(user);
    await user.click(screen.getByRole('button', { name: '卓に戻る' }));
    expect(screen.queryByRole('dialog', { name: '栞' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', BOOKMARK)).toHaveFocus();

    await openBookmark(user);
    await user.click(screen.getByTestId('modal-overlay'));
    expect(screen.queryByRole('dialog', { name: '栞' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', BOOKMARK)).toHaveFocus();

    const after = await api.get<Session>('/sessions/ss-mansion');
    expect(after.status).toBe(before.status);
  });

  it('ダイアログの中の札を押しても閉じず、開いたときは最初の札にフォーカスが移り、Tab は中で巡る', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    const dialog = await openBookmark(user);
    const items = [
      ...within(dialog).getAllByRole('link'),
      within(dialog).getByRole('button', { name: '卓に戻る' }),
    ];
    expect(items[0]).toHaveFocus();
    await user.tab({ shift: true });
    expect(items[items.length - 1]).toHaveFocus();
    await user.tab();
    expect(items[0]).toHaveFocus();
  });

  it('ドライバーに PC が無いセッションでは、「キャラクターシートを見る」が出ない', async () => {
    const user = userEvent.setup();
    const original = await api.get<Session>('/sessions/ss-mansion');
    server.use(
      http.get('/api/sessions/ss-mansion', () =>
        HttpResponse.json({
          ...original,
          participants: original.participants.map((p) =>
            p.role === 'driver' ? { ...p, characterId: undefined, characterName: undefined } : p,
          ),
        }),
      ),
    );
    renderAt('/pl/sessions/ss-mansion/play');
    const dialog = await openBookmark(user);
    expect(within(dialog).getByRole('link', { name: 'ホームへ戻る' })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('link', { name: 'キャラクターシートを見る' }),
    ).not.toBeInTheDocument();
  });

  it('セッションを読めないときは、ホームへ戻るリンクが出る', async () => {
    renderAt('/pl/sessions/zzz/play');
    expect(await screen.findByRole('link', { name: 'ホームへ戻る' })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('ダイアログの余白をクリックしてフォーカスが札から外れても、Escape で閉じる', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    const dialog = await openBookmark(user);
    await user.click(dialog);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '栞' })).not.toBeInTheDocument();
  });
});

describe('プレイ画面の卓：パーティの札（T3）', () => {
  it('GM が自分の PC で遊ぶとき、GM の行の札は出ず、ドライバーの PC の札が1枚。値がキャラクターと合う', async () => {
    const s = await startMansion();
    const jin = await api.get<Character>('/characters/pc-jin');
    renderAt(`/pl/sessions/${s.id}/play`);
    await waitFor(() => expect(partyCards()).toHaveLength(1));
    const [card] = partyCards();
    expect(card).toHaveTextContent(jin.name);
    expect(card).toHaveTextContent('ドライバー');
    const { body, skill, mind } = jin.abilities;
    await waitFor(() =>
      expect(card).toHaveTextContent(
        `体${body}技${skill}心${mind}HP${jin.hp.current}/${jin.hp.max}`,
      ),
    );
  });

  it('GM の行が PC を持っていても（GM が自分の PC で遊ぶ2行目）、GM の行の札は出ない', async () => {
    const original = await api.get<Session>('/sessions/ss-mansion');
    server.use(
      http.get('/api/sessions/ss-mansion', () =>
        HttpResponse.json({
          ...original,
          participants: original.participants.map((p) =>
            p.role === 'gm' ? { ...p, characterId: 'pc-jin', characterName: 'ジン' } : p,
          ),
        }),
      ),
    );
    renderAt('/pl/sessions/ss-mansion/play');
    await waitFor(() => expect(partyCards()).toHaveLength(2));
    expect(partyCards().map((c) => c.textContent)).toEqual([
      expect.stringContaining('ドライバー'),
      expect.stringContaining('ナビゲーター'),
    ]);
  });

  it('人間の GM のセッションで、ドライバーとミオの2枚。PC の無いルウの札は出ず、誤りも出ない', async () => {
    renderAt('/pl/sessions/ss-mansion/play');
    await waitFor(() => expect(partyCards()).toHaveLength(2));
    const [driver, mio] = partyCards();
    expect(driver).toHaveTextContent('ジン');
    expect(mio).toHaveTextContent('ミオ');
    expect(mio).toHaveTextContent('ナビゲーター');
    expect(within(screen.getByRole('list', { name: 'パーティ' })).queryByText(/ルウ/)).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('キャラクターを読めないとき、その札は名前とロールだけになり、画面は落ちず誤りも出ない', async () => {
    server.use(
      http.get('/api/characters/pc-mio', () =>
        HttpResponse.json({ message: 'キャラクター が見つかりません' }, { status: 404 }),
      ),
    );
    renderAt('/pl/sessions/ss-mansion/play');
    await waitFor(() => expect(partyCards()).toHaveLength(2));
    const jinCard = partyCards()[0];
    await waitFor(() => expect(jinCard).toHaveTextContent('HP'));
    const mio = partyCards()[1];
    expect(mio).toHaveTextContent('ミオ');
    expect(mio).toHaveTextContent('ナビゲーター');
    expect(mio).not.toHaveTextContent('HP');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('プレイ画面の卓：場のゾーン（T4）', () => {
  it('PL可視ゾーンの札の名前が出る。裏の札の名前と GM専用ゾーンの札は、属性も含めて DOM のどこにも出ない', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    await screen.findByText(DOOR_FLAVOR);
    // 閉じているときは、場の札を DOM に出さない
    expect(screen.queryByRole('dialog', { name: '場のゾーン' })).not.toBeInTheDocument();
    expect(screen.queryByText('奥の扉', { selector: 'li *' })).not.toBeInTheDocument();
    const zone = await openField(user);
    expect(within(zone).getByText('奥の扉')).toBeInTheDocument();
    expect(within(zone).getByText('地下回廊')).toBeInTheDocument();
    expect(within(zone).getAllByRole('listitem')).toHaveLength(3);
    const html = document.body.innerHTML;
    for (const hidden of ['何かが書かれた紙', '館の真相', '館の老従者', '3-3 隠し書庫']) {
      expect(html).not.toContain(hidden);
    }
    expect(screen.queryByRole('img', { name: /何かが書かれた紙/ })).not.toBeInTheDocument();
  });

  it('場のゾーンは Escape・「卓に戻る」で閉じ、「場を見る」のボタンにフォーカスが戻る', async () => {
    const user = userEvent.setup();
    renderAt('/pl/sessions/ss-mansion/play');
    await openField(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '場のゾーン' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '場を見る' })).toHaveFocus();
    await openField(user);
    await user.click(screen.getByRole('button', { name: '卓に戻る' }));
    expect(screen.queryByRole('dialog', { name: '場のゾーン' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '場を見る' })).toHaveFocus();
  });

  it('GM不在の村：札が0枚のとき、ゾーンは空で落ちない。成長の効果の札が GM専用ゾーンに入った後も出ない', async () => {
    const user = userEvent.setup();
    const s = await api.post<Session>('/scenarios/sc-village-start/start-solo', { name: '新人' });
    expect(s.field.plVisible).toHaveLength(0);
    renderAt(`/pl/sessions/${s.id}/play`);
    await screen.findByRole('button', BOOKMARK);
    const empty = await openField(user);
    expect(within(empty).queryAllByRole('listitem')).toHaveLength(0);
    await user.click(within(empty).getByRole('button', { name: '卓に戻る' }));

    for (const name of [/村の広場へ向かう/, /依頼「畑を荒らす猪」/, /柵で畑を囲む/]) {
      await user.click(await screen.findByRole('button', { name }));
      await waitFor(() => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
    }
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.field.gmOnly.length).toBeGreaterThan(0);
    const html = document.body.innerHTML;
    for (const card of after.field.gmOnly) expect(html).not.toContain(card.name);
  });
});

describe('プレイ画面の卓：案内文と手札の合図（T5）', () => {
  it('案内文と「…」は出ず、選べる手札があるとき手札の領域に data-awaiting が付く', async () => {
    renderAt('/pl/sessions/ss-mansion/play');
    await screen.findByText(DOOR_FLAVOR);
    expect(screen.queryByText('手札から1枚選んでプレイしよう。')).not.toBeInTheDocument();
    expect(
      screen.queryByText('戦い方（カードの優先順位）を決めて、戦闘を始めよう。'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();
    await waitFor(() => expect(awaiting()).not.toBeNull());
  });

  it('プレイの送信中は data-awaiting が外れ、送信が済むと「…」も出ないまま元に戻る', async () => {
    const user = userEvent.setup();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // 待たせた後は何も返さず、元のハンドラへ流す
    server.use(
      http.post('/api/sessions/:id/play', async () => {
        await gate;
      }),
    );
    renderAt('/pl/sessions/ss-mansion/play');
    await screen.findByText(DOOR_FLAVOR);
    await waitFor(() => expect(awaiting()).not.toBeNull());
    await user.click(screen.getByRole('button', { name: /戻る/ }));
    await waitFor(() => expect(awaiting()).toBeNull());
    expect(screen.queryByText('…')).not.toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.queryByText(DOOR_FLAVOR)).not.toBeInTheDocument());
  });

  it('終了したセッションでは data-awaiting が付かず、案内は語りの札の下に出る', async () => {
    await api.post('/sessions/ss-galleon/end');
    renderAt('/pl/sessions/ss-galleon/play');
    const notice = await screen.findByText('このセッションは終了しています。');
    expect(notice.closest('section')).toHaveAccessibleName(/GM|結末/);
    expect(awaiting()).toBeNull();
  });

  it('GM不在のソロ村で依頼を体で解決すると、パーティの札の体が1上がる', async () => {
    const user = userEvent.setup();
    const s = await api.post<Session>('/scenarios/sc-village-start/start-solo', { name: '新人' });
    const before = await api.get<Character>(`/characters/${s.participants[0].characterId}`);
    renderAt(`/pl/sessions/${s.id}/play`);
    await waitFor(() => expect(partyCards()[0]).toHaveTextContent(`体${before.abilities.body}`));
    for (const name of [/村の広場へ向かう/, /依頼「畑を荒らす猪」/, /柵で畑を囲む/]) {
      await user.click(await screen.findByRole('button', { name }));
      await waitFor(() => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
    }
    await waitFor(() =>
      expect(partyCards()[0]).toHaveTextContent(`体${before.abilities.body + 1}技`),
    );
  });

  it('GM不在のソロ村では、仮ルールの注記がステータスの行に出続ける', async () => {
    const s = await api.post<Session>('/scenarios/sc-village-start/start-solo', { name: '新人' });
    renderAt(`/pl/sessions/${s.id}/play`);
    expect(await screen.findByText(/仮ルール（GM不在）/)).toBeInTheDocument();
  });
});

describe('プレイ画面の卓：自動戦闘（T6）', () => {
  it('初めて試験に入るとすぐ「戦い方を決める」が出て、「戦闘の記録」は出ない。手札の合図も付かない', async () => {
    const s = await startAtExam('sc-exam-always-lose');
    renderAt(`/pl/sessions/${s.id}/play`);
    await screen.findByRole('region', { name: '戦い方を決める' });
    expect(screen.queryByRole('region', { name: '戦闘の記録' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /もう一度挑む/ })).not.toBeInTheDocument();
    expect(awaiting()).toBeNull();
  });

  it('負けると戦闘の記録（仮の注記つき）と「もう一度挑む」が出て、手札と戦い方は出ない。選ぶとパネルが開き、前回のリストが残る', async () => {
    const user = userEvent.setup();
    const s = await startAtExam('sc-exam-always-lose');
    renderAt(`/pl/sessions/${s.id}/play`);
    let panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    await screen.findByText(/^1回目：\d+ラウンドで試験官に敗れた$/);

    const log = screen.getByRole('region', { name: '戦闘の記録' });
    expect(within(log).getByText(/^仮ルール：/)).toBeInTheDocument();
    expect(within(log).getByRole('list', { name: '戦闘の経過' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '戦い方を決める' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
    expect(awaiting()).toBeNull();

    await user.click(screen.getByRole('button', { name: /もう一度挑む/ }));
    panel = await screen.findByRole('region', { name: '戦い方を決める' });
    // 戦闘の記録の札に注記が出ているので、パネルには出さない（注記が2つ並ばない）
    expect(within(panel).queryByText(/^仮ルール：/)).not.toBeInTheDocument();
    expect(within(panel).getByRole('list', { name: '優先順位' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    await screen.findByText(/^2回目：\d+ラウンドで試験官に敗れた$/);
    expect(screen.queryByRole('region', { name: '戦い方を決める' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /もう一度挑む/ })).toBeInTheDocument();
  });

  it('時間切れでも「もう一度挑む」が出る。API で負けてから新しく描画すると、パネルは出ず記録と「もう一度挑む」が出る', async () => {
    const s = await startAtExam('sc-exam-always-timeout');
    await runAutoCombat(s, ['c-slash']);
    renderAt(`/pl/sessions/${s.id}/play`);
    expect(await screen.findByRole('button', { name: /もう一度挑む/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '戦闘の記録' })).toBeInTheDocument();
    expect(
      screen.getByText(/^1回目：\d+ラウンドで決着がつかず、試験官に敗れた$/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '戦い方を決める' })).not.toBeInTheDocument();
  });

  it('負けた後に終了したセッションでは、「もう一度挑む」もパネルも出ない', async () => {
    const s = await startAtExam('sc-exam-always-lose');
    await runAutoCombat(s, ['c-slash']);
    await api.post(`/sessions/${s.id}/end`);
    renderAt(`/pl/sessions/${s.id}/play`);
    await screen.findByText('このセッションは終了しています。');
    expect(screen.queryByRole('button', { name: /もう一度挑む/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '戦い方を決める' })).not.toBeInTheDocument();
  });

  it('勝った後は、パネルも「もう一度挑む」も出ず、戦闘の記録（仮の注記つき）が出て、場の試験官に「戦闘不能」が出る', async () => {
    const user = userEvent.setup();
    const s = await startAtExam('sc-exam-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    await screen.findByText(/^1回目：\d+ラウンドで試験官に勝利した$/);
    const log = screen.getByRole('region', { name: '戦闘の記録' });
    expect(within(log).getByText(/^仮ルール：/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '戦い方を決める' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /もう一度挑む/ })).not.toBeInTheDocument();
    expect(within(await openField(user)).getByText('戦闘不能')).toBeInTheDocument();
  });
});

describe('プレイ画面の卓：結末（T7）', () => {
  it('結末以外のシーンで終わったセッションでは、見出しが出ず、語りの札のラベルは「GM」のまま', async () => {
    const s = await startMansion();
    await api.post(`/sessions/${s.id}/end`);
    renderAt(`/pl/sessions/${s.id}/play`);
    await screen.findByText('このセッションは終了しています。');
    expect(screen.getByRole('region', { name: 'GM' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '結末' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^結末「/ })).not.toBeInTheDocument();
  });
});

describe('プレイ画面の卓：場面の札（T10）', () => {
  it('シナリオ名の h1・いまの場所・進行が出て、ロールの表示は無い', async () => {
    renderAt('/pl/sessions/ss-mansion/play');
    expect(
      await screen.findByRole('heading', { level: 1, name: '灰色館の一夜' }),
    ).toBeInTheDocument();
    expect(screen.getByText('地下回廊 › 奥の扉')).toBeInTheDocument();
    expect(screen.getByText('通常進行')).toBeInTheDocument();
    expect(screen.queryByText(/（ドライバー）/)).not.toBeInTheDocument();
  });

  it('じっくり進行のセッションでは「じっくり進行」と出る', async () => {
    renderAt('/pl/sessions/ss-galleon/play');
    expect(
      await screen.findByRole('heading', { level: 1, name: '鉄鎖のガレオン船' }),
    ).toBeInTheDocument();
    expect(screen.getByText('じっくり進行')).toBeInTheDocument();
  });
});
