// docs/plans/2026-10-03-GMがPLを兼ねて遊ぶ.md の「5. 新規テストケース（API）」に対応する。
// 人間GMの描写・選択肢を配る・取り下げる API（POST /api/sessions/:id/narrate）を、MSW を直接呼んで確かめる。

import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';

const narrate = (sessionId: string, body: unknown) =>
  api.post<Session>(`/sessions/${sessionId}/narrate`, body);
const play = (sessionId: string, cardId: string) =>
  api.post<Session>(`/sessions/${sessionId}/play`, { cardId });
const getSession = (sessionId: string) => api.get<Session>(`/sessions/${sessionId}`);

/** 灰色館の一夜（rc-mine）を、自分の PC（pc-jin）をドライバーにして始める。導入に選択肢は無く、手札は空 */
const startMansion = () =>
  api.post<Session>('/recruitments/rc-mine/start', {
    characterIds: ['pc-jin'],
    driverCharacterId: 'pc-jin',
    partyName: '',
  });

/** 村はずれの一歩で、シーンを外した募集を出し、自分の PC で応募して始める（sessionStart.test.ts と同じ手順） */
async function startVillage(excludedNodeIds: string[]) {
  const rc = await api.post<Recruitment>('/scenarios/sc-village-start/recruitments', {
    capacity: 1,
    excludedNodeIds,
  });
  await api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' });
  return api.post<Session>(`/recruitments/${rc.id}/start`, {
    characterIds: ['pc-jin'],
    driverCharacterId: 'pc-jin',
    partyName: '',
  });
}

const dealtCard = (s: Session, name: string) => s.hand.find((c) => c.name === name);
const choiceNames = (s: Session) => s.hand.filter((c) => c.kind === 'choice').map((c) => c.name);

describe('GM が描写し、選択肢を配る', () => {
  it('描写が置き換わり、移り先付きのカードが手札に入り、プレイするとそのシーンへ進む', async () => {
    const s0 = await startMansion();
    expect(s0.hand).toEqual([]);
    const s1 = await narrate(s0.id, {
      flavor: '湿った石段が、地下へ続いている。',
      choices: [{ name: '地下へ降りる', description: '石段を降りる', nextNodeId: 'd-s1' }],
    });
    expect(s1.flavor).toBe('湿った石段が、地下へ続いている。');
    expect(dealtCard(s1, '地下へ降りる')).toMatchObject({
      kind: 'choice',
      description: '石段を降りる',
      nextNodeId: 'd-s1',
      tags: ['GM生成'],
    });
    expect(s1.feed.slice(0, 2).map((f) => f.text)).toEqual([
      'ユウが描写した',
      'ユウが選択肢「地下へ降りる」を配った（→3-1 地下回廊）',
    ]);
    expect(s1.feed[1].cardName).toBe('地下へ降りる');

    const card = dealtCard(s1, '地下へ降りる');
    const s2 = await play(s0.id, card?.id ?? '');
    expect(s2.currentScene.nodeId).toBe('d-s1');
    expect(dealtCard(s2, '地下へ降りる')).toBeUndefined();
  });

  it('描写・取り下げ・配るを1回で送ると、ログは上から描写→取り下げ→配るの順', async () => {
    const s0 = await startMansion();
    const s1 = await narrate(s0.id, { choices: [{ name: '待つ' }, { name: '戻る' }] });
    expect(choiceNames(s1)).toEqual(['待つ', '戻る']);
    const wait = dealtCard(s1, '待つ');
    const s2 = await narrate(s0.id, {
      flavor: '足音が近づく。',
      withdrawCardIds: [wait?.id],
      choices: [{ name: '隠れる' }],
    });
    expect(choiceNames(s2)).toEqual(['戻る', '隠れる']);
    expect(s2.feed.slice(0, 3).map((f) => f.text)).toEqual([
      'ユウが描写した',
      'ユウが選択肢「待つ」を取り下げた',
      'ユウが選択肢「隠れる」を配った',
    ]);
  });

  it('「GMの描写を待っている」から、描写と移り先付きのカードで立ち直れる', async () => {
    const s0 = await startMansion();
    const s1 = await narrate(s0.id, {
      choices: [{ name: '耳を澄ます' }, { name: '扉を叩く', nextNodeId: '' }],
    });
    expect(dealtCard(s1, '耳を澄ます')?.nextNodeId).toBeUndefined();
    expect(dealtCard(s1, '扉を叩く')?.nextNodeId).toBeUndefined();
    const s2 = await play(s0.id, dealtCard(s1, '耳を澄ます')?.id ?? '');
    expect(s2.flavor).toContain('GMの描写を待っている');
    expect(choiceNames(s2)).toEqual([]);
    expect(s2.currentScene.nodeId).toBe('d-intro');

    const s3 = await narrate(s0.id, {
      flavor: '奥から物音がした。',
      choices: [{ name: '奥へ', nextNodeId: 'd-s2' }],
    });
    const s4 = await play(s0.id, dealtCard(s3, '奥へ')?.id ?? '');
    expect(s4.currentScene.nodeId).toBe('d-s2');
  });

  it('結末へ進んでも人間 GM のセッションは続き、GM が終了を宣言すると終わる。終わったあとは送れない', async () => {
    const s0 = await startMansion();
    const s1 = await narrate(s0.id, { choices: [{ name: '館を出る', nextNodeId: 'd-end' }] });
    const s2 = await play(s0.id, dealtCard(s1, '館を出る')?.id ?? '');
    expect(s2.currentScene.nodeId).toBe('d-end');
    expect(s2.status).toBe('playing');
    const s3 = await narrate(s0.id, { flavor: '夜が明けた。' });
    expect(s3.flavor).toBe('夜が明けた。');
    const s4 = await api.post<Session>(`/sessions/${s0.id}/end`);
    expect(s4.status).toBe('ended');
    await expect(narrate(s0.id, { flavor: 'まだ続く' })).rejects.toMatchObject({
      status: 422,
      message: '進行中のセッションでだけ、描写・選択肢を配れます',
    });
  });

  it('描写の前後の空白は除き、空白だけの描写なら前の描写のまま', async () => {
    const s0 = await startMansion();
    const s1 = await narrate(s0.id, { flavor: '  霧が出てきた。 \n' });
    expect(s1.flavor).toBe('霧が出てきた。');
    const s2 = await narrate(s0.id, { flavor: '   ', choices: [{ name: '待つ' }] });
    expect(s2.flavor).toBe('霧が出てきた。');
    expect(s2.feed[0].text).toBe('ユウが選択肢「待つ」を配った');
  });

  it('最後の反応の時刻が新しくなる', async () => {
    const before = await getSession('ss-galleon');
    const s1 = await narrate('ss-galleon', { flavor: '甲板が揺れる。' });
    expect(Date.parse(s1.lastActivityAt)).toBeGreaterThan(Date.parse(before.lastActivityAt));
  });

  it('裁定待ちの提案は、描写・配る操作のあとも承認待ちのまま', async () => {
    const s0 = await startMansion();
    await api.post(`/sessions/${s0.id}/proposals`, { text: '扉を壊してみたい' });
    const s1 = await narrate(s0.id, { flavor: '扉は固い。', choices: [{ name: '待つ' }] });
    expect(s1.proposals.map((p) => p.status)).toEqual(['pending']);
  });
});

describe('取り下げ', () => {
  it('PC のカードは取り下げられず、同じ ID を2回送っても 422 で、手札は変わらない', async () => {
    const before = await getSession('ss-galleon');
    await expect(narrate('ss-galleon', { withdrawCardIds: ['c-slash'] })).rejects.toMatchObject({
      status: 422,
      message: '取り下げる選択肢が手札にありません',
    });
    const s0 = await startMansion();
    const s1 = await narrate(s0.id, { choices: [{ name: '待つ' }] });
    const id = dealtCard(s1, '待つ')?.id;
    await expect(narrate(s0.id, { withdrawCardIds: [id, id] })).rejects.toMatchObject({
      status: 422,
    });
    expect((await getSession('ss-galleon')).hand).toEqual(before.hand);
    expect(choiceNames(await getSession(s0.id))).toEqual(['待つ']);
  });
});

describe('移り先の制限（422 で、セッションは何も変わらない）', () => {
  const expectUnchanged = async (sessionId: string, body: unknown) => {
    const before = await getSession(sessionId);
    await expect(narrate(sessionId, body)).rejects.toMatchObject({ status: 422 });
    expect(await getSession(sessionId)).toEqual(before);
  };

  it('NPC のノード・いま居るノードへは配れない', async () => {
    const s0 = await startMansion();
    for (const nextNodeId of ['d-npc', 'd-intro'])
      await expectUnchanged(s0.id, {
        flavor: '正しい描写',
        choices: [{ name: '進む', nextNodeId }],
      });
  });

  it('外したシーン・自動戦闘のシーンへは配れない（村はずれの一歩。提案は使わないので自動解決は影響しない）', async () => {
    const s0 = await startVillage(['vs-shop']);
    for (const nextNodeId of ['vs-shop', 'vs-exam'])
      await expectUnchanged(s0.id, {
        flavor: '正しい描写',
        choices: [{ name: '進む', nextNodeId }],
      });
  });

  it('形の崩れた本文・何も変えない本文は 422', async () => {
    const s0 = await startMansion();
    for (const body of [
      null,
      {},
      { flavor: 1 },
      { withdrawCardIds: 'x' },
      { choices: { name: 'x' } },
      { choices: [{ name: 1 }] },
      { choices: [{ name: 'x', description: 1 }] },
      { choices: [{ name: 'x', nextNodeId: 1 }] },
      { choices: [null] },
    ])
      await expectUnchanged(s0.id, body);
  });
});

describe('誰が送れるか', () => {
  it('他の GM のセッションは 403、GM 不在のソロも 403、無いセッションは 404', async () => {
    await expect(narrate('ss-mansion', { flavor: '風' })).rejects.toMatchObject({ status: 403 });
    const solo = await api.post<Session>('/scenarios/sc-village-start/start-solo', {
      name: '試し',
    });
    await expect(narrate(solo.id, { flavor: '風' })).rejects.toMatchObject({ status: 403 });
    await expect(narrate('ss-none', { flavor: '風' })).rejects.toMatchObject({ status: 404 });
  });
});
