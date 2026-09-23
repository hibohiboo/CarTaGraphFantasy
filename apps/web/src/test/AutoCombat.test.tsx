// docs/plans/2026-09-23-自動戦闘エンジン.md の「5. 新規テストケース（ページ描画・API）」に対応する。
// 勝敗を固定したい検証は、乱数の出目によらず結果が決まるテスト用シナリオ（mocks/fixtures.ts の
// sc-exam-always-win / always-lose / always-timeout）で行う。

import { type Character, deriveArchetype, type Session } from '@cartagraph/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routeObjects } from '../app/router';
import { api } from '../lib/api';

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

const PREFIX: Record<string, string> = {
  'sc-village-start': 'vs',
  'sc-exam-always-win': 'aw',
  'sc-exam-always-lose': 'al',
  'sc-exam-always-timeout': 'at',
  'sc-exam-no-starter': 'ns',
};

/** ソロで開始し、試験シーン（自動戦闘）まで API で進める */
async function startAtExam(scenarioId: string) {
  const s = await api.post<Session>(`/scenarios/${scenarioId}/start-solo`, { name: '新人' });
  return api.post<Session>(`/sessions/${s.id}/play`, { cardId: `${PREFIX[scenarioId]}-to-guild` });
}

const characterOf = (s: Session) =>
  api.get<Character>(`/characters/${s.participants.find((p) => p.role === 'driver')?.characterId}`);

const runAutoCombat = (s: Session, priority: string[]) =>
  api.post<Session>(`/sessions/${s.id}/auto-combat`, { priority });

describe('試験シーンへの遷移（次のシーンへ進む）', () => {
  it('村はずれから「街の冒険者ギルドへ向かう」と、試験官が場に出て戦い方の設定画面になる', async () => {
    const user = userEvent.setup();
    const router = renderAt('/pl/village-start');
    await user.type(await screen.findByLabelText('名前'), '新人');
    await user.click(screen.getByRole('button', { name: '始める' }));
    await user.click(await screen.findByRole('button', { name: /街の冒険者ギルドへ向かう/ }));

    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    expect(within(panel).getByText(/仮ルール/)).toBeInTheDocument();
    // 手札の選択肢カードと「新たな選択肢を提案」は出ない
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /辺りを見回す/ })).not.toBeInTheDocument();

    const sessionId = router.state.location.pathname.split('/')[3];
    const s = await api.get<Session>(`/sessions/${sessionId}`);
    expect(s.currentScene).toMatchObject({ name: '冒険者試験', nodeId: 'vs-exam' });
    expect(s.autoCombat).toMatchObject({ status: 'awaiting-priority', attempts: 0 });
    expect(s.field.plVisible.map((c) => c.name)).toContain('試験官');
    expect(s.hand.filter((c) => c.kind === 'choice')).toEqual([]);
    // 自動戦闘は濃密モードにしない（docs/cartagraph/auto-combat.md 差分2）
    expect(s.mode).toBe('light');
  });

  it('候補には自動戦闘の効果を持つカードだけが並ぶ（短剣は並ばない）', async () => {
    const s = await startAtExam('sc-exam-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    expect(
      within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: '「応急手当」をリストに入れる' }),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/短剣/)).not.toBeInTheDocument();
  });

  it('異常系：シナリオに無いノードを指すカードをプレイすると422で、セッションは変わらない', async () => {
    const s = await api.post<Session>('/scenarios/sc-exam-no-starter/start-solo', { name: '新人' });
    await expect(api.post(`/sessions/${s.id}/play`, { cardId: 'ns-lost' })).rejects.toMatchObject({
      status: 422,
    });
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.currentScene).toEqual(s.currentScene);
    expect(after.hand).toEqual(s.hand);
    expect(after.feed).toHaveLength(s.feed.length);
  });
});

describe('自動戦闘（勝利）', () => {
  it('優先順位を決めて試験を始めると、追加の操作なしに決着し、合格の証を受け取ると結末で終了する', async () => {
    const user = userEvent.setup();
    const s = await startAtExam('sc-exam-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));

    expect(await screen.findByText(/^1回目：\d+ラウンドで試験官に勝利した$/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '戦闘の経過' })).toBeInTheDocument();

    const won = await api.get<Session>(`/sessions/${s.id}`);
    // 敵は「戦闘不能」状態タグが付き、場に残る（docs/cartagraph/combat.md）
    const examiner = won.field.plVisible.find((c) => c.id === won.autoCombat?.enemyCardId);
    expect(examiner?.tags).toContain('戦闘不能');
    expect(won.feed.some((f) => f.text.includes('勝利'))).toBe(true);
    expect(won.autoCombat).toMatchObject({ status: 'won', attempts: 1 });

    await user.click(await screen.findByRole('button', { name: /合格の証を受け取る/ }));
    expect(
      await screen.findByRole('heading', { name: '結末「冒険者として旅立つ」' }),
    ).toBeInTheDocument();
    const ended = await api.get<Session>(`/sessions/${s.id}`);
    expect(ended.status).toBe('ended');
    expect(ended.autoCombat).toBeUndefined();
    // 結末へ進んで自動戦闘の状態が消えても、戦闘の経過はセッションの記録として残る
    expect(ended.combatHistory).toHaveLength(1);
    expect(ended.combatHistory?.[0]).toMatchObject({ attempt: 1, outcome: 'win' });
    expect(ended.combatHistory?.[0].log.length).toBeGreaterThan(0);
    // 終了後は、提案も戦い方の設定もできない
    expect(screen.queryByRole('button', { name: /新たな選択肢を提案/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '戦い方を決める' })).not.toBeInTheDocument();
  });

  it('並べ替えた優先順位がそのまま使われる（渾身の一撃を上へ）', async () => {
    const user = userEvent.setup();
    const s = await startAtExam('sc-exam-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '「渾身の一撃」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '「渾身の一撃」を上へ' }));
    const order = within(within(panel).getByRole('list', { name: '優先順位' })).getAllByRole(
      'listitem',
    );
    expect(order.map((li) => li.textContent)).toEqual([
      expect.stringContaining('渾身の一撃'),
      expect.stringContaining('斬撃'),
    ]);
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    await screen.findByText(/^1回目：\d+ラウンドで試験官に勝利した$/);
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.autoCombat?.lastResult?.log[0]).toMatchObject({
      actor: 'pl',
      cardName: '渾身の一撃',
    });
  });

  it('勝利後に同じシナリオで新しく始めても、場の試験官は戦闘不能になっていない', async () => {
    const first = await startAtExam('sc-exam-always-win');
    await runAutoCombat(first, ['c-slash']);
    const second = await startAtExam('sc-exam-always-win');
    const examiner = second.field.plVisible.find((c) => c.id === second.autoCombat?.enemyCardId);
    expect(examiner?.tags).not.toContain('戦闘不能');
  });
});

describe('自動戦闘（敗北・時間切れ）', () => {
  it('敗れるとナレーションを挟んで設定に戻り、「再挑戦の記憶」は何度負けても1枚だけ', async () => {
    const user = userEvent.setup();
    const s = await startAtExam('sc-exam-always-lose');
    renderAt(`/pl/sessions/${s.id}/play`);
    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    await user.click(within(panel).getByRole('button', { name: '「斬撃」をリストに入れる' }));
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    expect(await screen.findByText(/試験官に敗れた/)).toBeInTheDocument();

    const after1 = await api.get<Session>(`/sessions/${s.id}`);
    expect(after1.feed.some((f) => f.text.includes('傷を癒し、再び武具を取った'))).toBe(true);
    expect(after1.autoCombat).toMatchObject({ status: 'awaiting-priority', attempts: 1 });
    const pc1 = await characterOf(s);
    expect(pc1.deck.filter((c) => c.name === '再挑戦の記憶')).toHaveLength(1);
    // 戦闘後もキャラクターのHPは変わらない
    expect(pc1.hp).toEqual({ current: 20, max: 20 });

    // 設定画面に戻っていて、もう一度挑戦できる
    await user.click(within(panel).getByRole('button', { name: '戦闘を始める' }));
    await screen.findByText(/2回目/);
    const pc2 = await characterOf(s);
    expect(pc2.deck.filter((c) => c.name === '再挑戦の記憶')).toHaveLength(1);
    // 前回の挑戦の経過も消えずに残る
    const after2 = await api.get<Session>(`/sessions/${s.id}`);
    expect(after2.combatHistory?.map((r) => [r.attempt, r.outcome])).toEqual([
      [1, 'lose'],
      [2, 'lose'],
    ]);
  });

  it('ラウンド上限までに決着しなければ、敗北と同じ扱いになる', async () => {
    const s = await startAtExam('sc-exam-always-timeout');
    const after = await runAutoCombat(s, ['c-slash']);
    expect(after.autoCombat).toMatchObject({ status: 'awaiting-priority', attempts: 1 });
    expect(after.autoCombat?.lastResult?.outcome).toBe('timeout');
    expect(after.feed.some((f) => f.text.includes('傷を癒し、再び武具を取った'))).toBe(true);
    const pc = await characterOf(s);
    expect(pc.deck.filter((c) => c.name === '再挑戦の記憶')).toHaveLength(1);
  });
});

describe('自動戦闘の異常系', () => {
  it('優先順位が0件なら「戦闘を始める」を押せない', async () => {
    const s = await startAtExam('sc-exam-always-win');
    renderAt(`/pl/sessions/${s.id}/play`);
    const panel = await screen.findByRole('region', { name: '戦い方を決める' });
    expect(within(panel).getByRole('button', { name: '戦闘を始める' })).toBeDisabled();
  });

  it.each([
    ['0件', []],
    ['デッキに無いカード', ['c-lantern']],
    ['自動戦闘の効果を持たないカード', ['c-short-sword']],
    ['同じカードの重複', ['c-slash', 'c-slash']],
  ])('%sは422で、試行回数・feed・デッキは変わらない', async (_, priority) => {
    const s = await startAtExam('sc-exam-always-win');
    const pcBefore = await characterOf(s);
    await expect(runAutoCombat(s, priority)).rejects.toMatchObject({ status: 422 });
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.autoCombat?.attempts).toBe(0);
    expect(after.feed).toHaveLength(s.feed.length);
    expect((await characterOf(s)).deck).toEqual(pcBefore.deck);
  });

  it('自動戦闘のシーンにいないセッションでは422', async () => {
    const s = await api.post<Session>('/scenarios/sc-exam-always-win/start-solo', { name: '新人' });
    await expect(runAutoCombat(s, ['c-slash'])).rejects.toMatchObject({ status: 422 });
  });

  it('勝利済みのセッションでは422', async () => {
    const s = await startAtExam('sc-exam-always-win');
    await runAutoCombat(s, ['c-slash']);
    await expect(runAutoCombat(s, ['c-slash'])).rejects.toMatchObject({ status: 422 });
  });

  it('存在しないセッションでは404', async () => {
    await expect(
      api.post('/sessions/ss-nowhere/auto-combat', { priority: ['c-slash'] }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('戦えないキャラクター（HP・行動値・戦闘カードなし）は自動戦闘のシーンへ進めず、セッションは変わらない', async () => {
    // 進めてしまうと、候補が0件で戦闘を始められず、手札も提案も無い行き止まりになる
    const s = await api.post<Session>('/scenarios/sc-exam-no-starter/start-solo', { name: '新人' });
    await expect(
      api.post(`/sessions/${s.id}/play`, { cardId: 'ns-to-guild' }),
    ).rejects.toMatchObject({ status: 422 });
    const after = await api.get<Session>(`/sessions/${s.id}`);
    expect(after.currentScene).toEqual(s.currentScene);
    expect(after.autoCombat).toBeUndefined();
    expect(after.feed).toHaveLength(s.feed.length);
  });

  it('終了済みのセッションでは、カードのプレイも自動戦闘も受け付けない', async () => {
    await expect(api.post('/sessions/ss-ended/play', { cardId: 'x' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      api.post('/sessions/ss-ended/auto-combat', { priority: ['c-slash'] }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('試験の戦闘中は、カードのプレイも提案もできない', async () => {
    const s = await startAtExam('sc-exam-always-win');
    await expect(api.post(`/sessions/${s.id}/play`, { cardId: 'aw-accept' })).rejects.toMatchObject(
      { status: 422 },
    );
    await expect(
      api.post(`/sessions/${s.id}/proposals`, { text: '逃げ出したい' }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('ソロ開始時の初期装備（仮ルール）', () => {
  it('初期装備を持つシナリオで始めると、HP・行動値・戦闘スキルを持つ冒険者になる', async () => {
    const s = await api.post<Session>('/scenarios/sc-village-start/start-solo', { name: '新人' });
    const pc = await characterOf(s);
    expect(pc.hp).toEqual({ current: 20, max: 20 });
    expect(pc.baseActionValue).toBe(10);
    expect(pc.deck.map((c) => c.name)).toEqual(['斬撃', '渾身の一撃', '応急手当']);
    expect(deriveArchetype(pc)).toBe('adventurer');
  });

  it('初期装備を持たないシナリオでは、従来どおり何も持たずに始まる', async () => {
    const s = await api.post<Session>('/scenarios/sc-village-no-propose/start-solo', {
      name: '新人',
    });
    const pc = await characterOf(s);
    expect(pc.deck).toEqual([]);
    expect(pc.hp).toBeUndefined();
  });
});
