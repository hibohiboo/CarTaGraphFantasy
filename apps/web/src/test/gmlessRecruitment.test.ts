// docs/plans/2026-10-04-GM不在の募集.md の「5. 新規テストケース（API）」に対応する。
// GM 不在の募集（作成・始める・中断と再開・再挑戦不可）を、MSW を直接呼んで確かめる。

import type { Character } from '@cartagraph/domain/character/model';
import { deadEndNodes, hasAutoCombat } from '@cartagraph/domain/scenario/deadEnd';
import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { describe, expect, it } from 'vitest';
import * as fx from '@/mocks/fixtures';
import { api } from '@/shared/api/api';
import { clearVillageWith, createGmlessRecruitment, playFromRecruitment } from './gmlessHelpers';

const createRecruitment = (scenarioId: string, body: object) =>
  api.post<Recruitment>(`/scenarios/${scenarioId}/recruitments`, body);
const gmless = createGmlessRecruitment;
const playFrom = playFromRecruitment;
const play = (sessionId: string, cardId: string) =>
  api.post<Session>(`/sessions/${sessionId}/play`, { cardId });
const getSession = (id: string) => api.get<Session>(`/sessions/${id}`);
const resume = (id: string) => api.post<Session>(`/sessions/${id}/resume`);
const handIds = (s: Session) => s.hand.map((c) => c.id);

const characterOf = (id: string) => api.get<Character>(`/characters/${id}`);

describe('先へ進めないシーン・自動戦闘のシーンの判定（シードのシナリオで）', () => {
  const scenario = (id: string) => fx.scenarios.find((s) => s.id === id)?.deck ?? [];

  it('村はずれの一歩は先へ進めないシーンが無く、自動戦闘のシーンがある', () => {
    expect(deadEndNodes(scenario('sc-village-start'))).toEqual([]);
    expect(hasAutoCombat(scenario('sc-village-start'))).toBe(true);
  });

  it('灰色館の一夜は導入とシーンが先へ進めず（結末・NPC は含まない）、自動戦闘のシーンは無い', () => {
    const kinds = deadEndNodes(scenario('sc-gray-mansion')).map((n) => n.kind);
    expect(kinds).toContain('intro');
    expect(kinds).toContain('scene');
    expect(kinds).not.toContain('ending');
    expect(kinds).not.toContain('npc');
    expect(hasAutoCombat(scenario('sc-gray-mansion'))).toBe(false);
  });
});

describe('GM 不在の募集を出す', () => {
  it('種類・提案の扱いが入り、応募の枠は 0、受付中。capacity を送らなくても出せる', async () => {
    const rc = await gmless('sc-village-start');
    expect(rc).toMatchObject({
      kind: 'gmless',
      proposalHandling: 'gm-required',
      capacity: 0,
      status: 'open',
      applicants: [],
    });
  });

  it('通常の募集は従来どおり capacity が要る', async () => {
    await expect(createRecruitment('sc-village-start', { kind: 'normal' })).rejects.toMatchObject({
      status: 422,
    });
  });

  it('提案の扱いが自動解決・不正な値・無しなら 422', async () => {
    for (const proposalHandling of ['auto-resolve', 'whatever', undefined])
      await expect(gmless('sc-village-start', { proposalHandling })).rejects.toMatchObject({
        status: 422,
      });
  });

  it('提案不可のシナリオでは「GM が後から裁定」は 422、提案不可なら出せる', async () => {
    await expect(gmless('sc-village-no-propose')).rejects.toMatchObject({ status: 422 });
    const rc = await gmless('sc-village-no-propose', { proposalHandling: 'disabled' });
    expect(rc.proposalHandling).toBe('disabled');
  });

  it('導入・結末を外す GM 不在の募集は 422', async () => {
    await expect(gmless('sc-village-start', { excludedNodeIds: ['vs-end'] })).rejects.toMatchObject(
      { status: 422 },
    );
  });

  it('GM 不在の募集への応募と、GM による開始は 422 で、募集は変わらない', async () => {
    const rc = await gmless('sc-village-start');
    await expect(
      api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' }),
    ).rejects.toMatchObject({ status: 422 });
    const before = (await api.get<Session[]>('/sessions')).length;
    await expect(
      api.post(`/recruitments/${rc.id}/start`, {
        characterIds: ['pc-jin'],
        driverCharacterId: 'pc-jin',
      }),
    ).rejects.toMatchObject({
      status: 422,
      message: 'GM 不在の募集は、PL が自分の PC で始めます（GM は始められません）',
    });
    const listed = (await api.get<Recruitment[]>('/recruitments')).find((r) => r.id === rc.id);
    expect(listed).toMatchObject({ status: 'open', applicants: [] });
    expect((await api.get<Session[]>('/sessions')).length).toBe(before);
  });
});

describe('GM 不在の募集から始める', () => {
  it('自分の PC で始めると、GM 不在のセッションができ、募集は受付中のまま残る', async () => {
    const rc = await gmless('sc-village-start');
    const s = await playFrom(rc.id, 'pc-jin');
    expect(s).toMatchObject({
      gmless: true,
      gmId: 'u-me',
      recruitmentId: rc.id,
      proposalHandling: 'gm-required',
      status: 'playing',
      partyName: '迅',
    });
    expect(s.participants.map((p) => [p.role, p.userId, p.characterId])).toEqual([
      ['gm', 'u-me', undefined],
      ['driver', 'u-me', 'pc-jin'],
    ]);
    const listed = (await api.get<Recruitment[]>('/recruitments')).map((r) => r.id);
    expect(listed).toContain(rc.id);
  });

  it('別の PC で同じ募集から始めると、セッションが2つできる', async () => {
    const rc = await gmless('sc-village-start');
    const a = await playFrom(rc.id, 'pc-jin');
    const b = await playFrom(rc.id, 'pc-akari');
    expect(a.id).not.toBe(b.id);
    const fromRc = (await api.get<Session[]>('/sessions')).filter((x) => x.recruitmentId === rc.id);
    expect(fromRc).toHaveLength(2);
  });

  it('終わったあと、再挑戦不可の結末を持たないシナリオなら同じ PC でもう一度始められる', async () => {
    const rc = await gmless('sc-gray-mansion');
    const first = await playFrom(rc.id, 'pc-jin');
    await api.post(`/sessions/${first.id}/end`);
    const second = await playFrom(rc.id, 'pc-jin');
    expect(second.id).not.toBe(first.id);
  });

  it('借りた PC は 422、無い PC・無い募集は 404、通常の募集への /play は 422', async () => {
    const rc = await gmless('sc-village-start');
    await expect(playFrom(rc.id, 'pc-akira')).rejects.toMatchObject({
      status: 422,
      message: 'GM 不在の募集では、自分が所有者の PC だけで遊べます',
    });
    await expect(playFrom(rc.id, 'pc-none')).rejects.toMatchObject({ status: 404 });
    await expect(playFrom('rc-none', 'pc-jin')).rejects.toMatchObject({ status: 404 });
    await expect(playFrom('rc-mine', 'pc-jin')).rejects.toMatchObject({ status: 422 });
  });

  it('導入の無いシナリオの GM 不在の募集から始めると 422 で、セッションは増えない', async () => {
    const rc = await gmless('sc-no-intro');
    const before = (await api.get<Session[]>('/sessions')).length;
    await expect(playFrom(rc.id, 'pc-jin')).rejects.toMatchObject({ status: 422 });
    expect((await api.get<Session[]>('/sessions')).length).toBe(before);
  });

  it('シーンを外した GM 不在の募集では、導入にも移った先にも、外したシーンへ進むカードが無い', async () => {
    const intro = await playFrom(
      (await gmless('sc-village-start', { excludedNodeIds: ['vs-square'] })).id,
      'pc-jin',
    );
    expect(intro.excludedNodeIds).toEqual(['vs-square']);
    expect(handIds(intro)).not.toContain('vs-to-square');
    expect(handIds(intro)).toContain('vs-look-around');

    const rc = await gmless('sc-village-start', { excludedNodeIds: ['vs-shop'] });
    const s = await playFrom(rc.id, 'pc-jin');
    const square = await play(s.id, 'vs-to-square');
    expect(handIds(square)).toContain('vs-to-guild');
    expect(handIds(square)).not.toContain('vs-to-shop');
  });
});

describe('GM 不在のセッションの進行（gmless の判定。GM は自分なので gmId では区別できない）', () => {
  const startVillage = async () => playFrom((await gmless('sc-village-start')).id, 'pc-jin');

  it('使える条件：攻撃カードの無い迅は、ギルドへ向かえない（422）', async () => {
    const s = await startVillage();
    await play(s.id, 'vs-to-square');
    await expect(play(s.id, 'vs-to-guild')).rejects.toMatchObject({ status: 422 });
  });

  it('移り先の無い選択肢は、説明文の描写が返り、同じシーンに留まる（GM の描写を待たない）', async () => {
    const s = await startVillage();
    const looked = await play(s.id, 'vs-look-around');
    expect(looked.currentScene.nodeId).toBe('vs-intro');
    expect(looked.flavor).not.toContain('GMの描写を待っている');
    expect(handIds(looked)).not.toContain('vs-look-around');
    expect(handIds(looked)).toContain('vs-to-square');
  });

  it('配る条件と即時反映：依頼を解決して広場に戻ると、その依頼は配られず、成長が PC に反映される', async () => {
    const s = await startVillage();
    const before = await characterOf('pc-jin');
    await play(s.id, 'vs-to-square');
    await play(s.id, 'vs-to-quest-0');
    const back = await play(s.id, 'vs-quest-0-body');
    expect(back.currentScene.nodeId).toBe('vs-square');
    expect(handIds(back)).not.toContain('vs-to-quest-0');
    const after = await characterOf('pc-jin');
    expect(after).not.toEqual(before);
  });

  it('自動戦闘のシーンへ進め、結末に至ると自動で終わり、結末タグが即時に付く', async () => {
    const ended = await clearVillageWith('pc-jin');
    expect(ended.status).toBe('ended');
    expect((await characterOf('pc-jin')).endingTags).toContain('冒険者になった');
  });

  it('/narrate は 422 でセッションは変わらない。ソロ開始のセッションは従来どおり 403', async () => {
    const s = await startVillage();
    await expect(
      api.post(`/sessions/${s.id}/narrate`, { flavor: '風が吹く' }),
    ).rejects.toMatchObject({
      status: 422,
      message: 'GM 不在のセッションは、システムが進行します',
    });
    expect(await getSession(s.id)).toEqual(s);
    const solo = await api.post<Session>('/scenarios/sc-village-start/start-solo', {
      name: '試し',
    });
    await expect(api.post(`/sessions/${solo.id}/narrate`, { flavor: '風' })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('提案で中断し、GM の裁定のあとドライバーが再開する', () => {
  const startMansion = async (proposalHandling = 'gm-required') =>
    playFrom((await gmless('sc-gray-mansion', { proposalHandling })).id, 'pc-jin');
  const propose = (id: string, text = '扉を叩いてみたい') =>
    api.post<Session>(`/sessions/${id}/proposals`, { text });

  it('提案すると中断し、中断中はプレイも提案もできず、裁定前は再開できない。採用すると再開でき、カードが手札にある', async () => {
    const s = await startMansion();
    const suspended = await propose(s.id);
    expect(suspended).toMatchObject({ status: 'suspended', suspendedFor: 'proposal' });
    await expect(play(s.id, 'anything')).rejects.toMatchObject({
      status: 422,
      message: 'このセッションは中断しています',
    });
    await expect(propose(s.id, 'もう一つ')).rejects.toMatchObject({
      status: 422,
      message: 'このセッションは中断しています',
    });
    await expect(resume(s.id)).rejects.toMatchObject({
      status: 422,
      message: 'GM の裁定を待っています',
    });

    const p = suspended.proposals[0];
    await api.post(`/sessions/${s.id}/proposals/${p.id}/approve`, { cardName: '扉を叩く' });
    const resumed = await resume(s.id);
    expect(resumed.status).toBe('playing');
    expect(resumed.suspendedFor).toBeUndefined();
    const card = resumed.hand.find((c) => c.name === '扉を叩く');
    expect(card).toBeDefined();

    // 移り先の無い採用カードを選ぶと、決まった文の描写になり、同じシーンに留まる
    const after = await play(s.id, card?.id ?? '');
    expect(after.currentScene.nodeId).toBe(resumed.currentScene.nodeId);
    expect(after.flavor).toBe('迅は「扉を叩く」を試みた。');
  });

  it('却下でも再開できる', async () => {
    const s = await startMansion();
    const suspended = await propose(s.id);
    await api.post(`/sessions/${s.id}/proposals/${suspended.proposals[0].id}/reject`, {
      reason: '今は無理',
    });
    expect((await resume(s.id)).status).toBe('playing');
  });

  it('採用で移り先を付けると、作ったカードに移り先があり、プレイするとそこへ進む', async () => {
    const s = await startMansion();
    const suspended = await propose(s.id, '地下へ降りたい');
    await api.post(`/sessions/${s.id}/proposals/${suspended.proposals[0].id}/approve`, {
      cardName: '地下へ降りる',
      nextNodeId: 'd-s1',
    });
    const resumed = await resume(s.id);
    const card = resumed.hand.find((c) => c.name === '地下へ降りる');
    expect(card).toMatchObject({ nextNodeId: 'd-s1', tags: ['GM生成'] });
    expect((await play(s.id, card?.id ?? '')).currentScene.nodeId).toBe('d-s1');
  });

  it('採用の移り先が候補に無い（NPC・いま居るノード）と 422 で、提案は承認待ちのまま', async () => {
    const s = await startMansion();
    const suspended = await propose(s.id);
    const pid = suspended.proposals[0].id;
    for (const nextNodeId of ['d-npc', 'd-intro', 'nowhere'])
      await expect(
        api.post(`/sessions/${s.id}/proposals/${pid}/approve`, { cardName: 'x', nextNodeId }),
      ).rejects.toMatchObject({ status: 422 });
    expect((await getSession(s.id)).proposals[0].status).toBe('pending');
  });

  it('提案不可の GM 不在の募集から始めたセッションは、提案が 422', async () => {
    const s = await startMansion('disabled');
    await expect(propose(s.id)).rejects.toMatchObject({ status: 422 });
  });

  it('中断しない側：人間 GM のセッション・ソロ開始（自動解決）・ソロ開始（GM必須のシナリオ）', async () => {
    const human = await propose('ss-mansion', '床を調べたい');
    expect(human.status).toBe('playing');
    const solo = await api.post<Session>('/scenarios/sc-village-start/start-solo', {
      name: '試し',
    });
    expect((await propose(solo.id)).status).toBe('playing');
    const soloMansion = await api.post<Session>('/scenarios/sc-gray-mansion/start-solo', {
      name: '試し',
    });
    expect((await propose(soloMansion.id)).status).toBe('playing');
  });

  it('/resume：進行中・終了は 422、無いセッションは 404、ドライバーが自分でないなら 403（中断の判定より先）', async () => {
    const s = await startMansion();
    await expect(resume(s.id)).rejects.toMatchObject({ status: 422 });
    await api.post(`/sessions/${s.id}/end`);
    await expect(resume(s.id)).rejects.toMatchObject({ status: 422 });
    await expect(resume('ss-none')).rejects.toMatchObject({ status: 404 });
    await expect(resume('ss-galleon')).rejects.toMatchObject({ status: 403 });
  });
});

describe('再挑戦不可', () => {
  it('結末タグを得た迅は、村はずれの一歩の GM 不在の募集から始められない。灯は始められる', async () => {
    await clearVillageWith('pc-jin');
    const rc = await gmless('sc-village-start');
    await expect(playFrom(rc.id, 'pc-jin')).rejects.toMatchObject({
      status: 422,
      message: '迅はこのシナリオの結末「冒険者として旅立つ」に至っているため、もう一度は遊べません',
    });
    expect((await playFrom(rc.id, 'pc-akari')).status).toBe('playing');
  });

  it('通常の募集（村はずれの一歩）への迅の応募は 422。灰色館の一夜の募集には応募できる', async () => {
    await clearVillageWith('pc-jin');
    const village = await createRecruitment('sc-village-start', { capacity: 2 });
    await expect(
      api.post(`/recruitments/${village.id}/apply`, { characterId: 'pc-jin' }),
    ).rejects.toMatchObject({ status: 422 });
    const mansion = await createRecruitment('sc-gray-mansion', { capacity: 2 });
    await api.post(`/recruitments/${mansion.id}/apply`, { characterId: 'pc-jin' });
  });

  it('応募したあとで結末タグを得た迅を含めて GM が始めると 422 で、募集は受付中・セッションは増えない', async () => {
    const village = await createRecruitment('sc-village-start', { capacity: 2 });
    await api.post(`/recruitments/${village.id}/apply`, { characterId: 'pc-jin' });
    await clearVillageWith('pc-jin');
    const before = (await api.get<Session[]>('/sessions')).length;
    await expect(
      api.post(`/recruitments/${village.id}/start`, {
        characterIds: ['pc-jin'],
        driverCharacterId: 'pc-jin',
      }),
    ).rejects.toMatchObject({ status: 422 });
    const listed = (await api.get<Recruitment[]>('/recruitments')).find((r) => r.id === village.id);
    expect(listed?.status).toBe('open');
    expect((await api.get<Session[]>('/sessions')).length).toBe(before);
  });
});

// docs/plans/2026-10-04-GM不在の募集.md「実装後の AI レビューで足したもの」
describe('実装後の AI レビューで足した検査', () => {
  const propose = (id: string, text = '鍬を借りたい') =>
    api.post<Session>(`/sessions/${id}/proposals`, { text });

  it('通常の募集で自動解決のシナリオ（村はずれの一歩）を始めると、提案は GM の裁定を待つ（自動で採用しない）', async () => {
    const rc = await createRecruitment('sc-village-start', { capacity: 1 });
    await api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' });
    const s = await api.post<Session>(`/recruitments/${rc.id}/start`, {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
    });
    expect(s.proposalHandling).toBe('gm-required');
    const after = await propose(s.id);
    expect(after.proposals[0].status).toBe('pending');
    expect(after.status).toBe('playing');
  });

  it('GM 不在のセッションでは、GM がモードを切り替えられない（422）', async () => {
    const s = await playFrom('rc-gmless', 'pc-jin');
    await expect(api.post(`/sessions/${s.id}/mode`, { mode: 'dense' })).rejects.toMatchObject({
      status: 422,
      message: 'GM 不在のセッションは、システムが進行します',
    });
    expect((await getSession(s.id)).mode).toBe('light');
  });

  it('中断中に GM が終えると、中断の理由は残らない', async () => {
    const s = await playFrom('rc-gmless', 'pc-jin');
    await propose(s.id);
    const ended = await api.post<Session>(`/sessions/${s.id}/end`);
    expect(ended.status).toBe('ended');
    expect(ended.suspendedFor).toBeUndefined();
  });

  it('裁定済みの提案をもう一度採用・却下すると 422 で、手札は増えない。終わったセッションの提案は裁定できない', async () => {
    const s = await playFrom('rc-gmless', 'pc-jin');
    const pid = (await propose(s.id)).proposals[0].id;
    await api.post(`/sessions/${s.id}/proposals/${pid}/approve`, { cardName: '鍬を借りる' });
    const handSize = (await getSession(s.id)).hand.length;
    await expect(
      api.post(`/sessions/${s.id}/proposals/${pid}/approve`, { cardName: '鍬を借りる' }),
    ).rejects.toMatchObject({ status: 422, message: 'この提案はもう裁定しています' });
    await expect(
      api.post(`/sessions/${s.id}/proposals/${pid}/reject`, { reason: 'やっぱり無し' }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await getSession(s.id)).hand.length).toBe(handSize);

    await resume(s.id);
    const pid2 = (await propose(s.id, '水を汲みたい')).proposals[0].id;
    await api.post(`/sessions/${s.id}/end`);
    await expect(
      api.post(`/sessions/${s.id}/proposals/${pid2}/approve`, { cardName: '水を汲む' }),
    ).rejects.toMatchObject({ status: 422, message: 'このセッションは終了しています' });
  });

  it('採用の移り先：GM 不在のセッションでは自動戦闘のシーンも選べ、外したシーンは選べない', async () => {
    const rc = await gmless('sc-village-start', { excludedNodeIds: ['vs-shop'] });
    const s = await playFrom(rc.id, 'pc-jin');
    const pid = (await propose(s.id)).proposals[0].id;
    await expect(
      api.post(`/sessions/${s.id}/proposals/${pid}/approve`, {
        cardName: 'x',
        nextNodeId: 'vs-shop',
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await getSession(s.id)).proposals[0].status).toBe('pending');
    const approved = await api.post<Session>(`/sessions/${s.id}/proposals/${pid}/approve`, {
      cardName: '試験を受けに行く',
      nextNodeId: 'vs-exam',
    });
    expect(approved.hand.find((c) => c.name === '試験を受けに行く')?.nextNodeId).toBe('vs-exam');
  });

  it('採用の移り先：GM 不在でないセッションでは、自動戦闘のシーンは選べない', async () => {
    const rc = await createRecruitment('sc-village-start', { capacity: 1 });
    await api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' });
    const s = await api.post<Session>(`/recruitments/${rc.id}/start`, {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
    });
    const pid = (await propose(s.id)).proposals[0].id;
    await expect(
      api.post(`/sessions/${s.id}/proposals/${pid}/approve`, {
        cardName: 'x',
        nextNodeId: 'vs-exam',
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
