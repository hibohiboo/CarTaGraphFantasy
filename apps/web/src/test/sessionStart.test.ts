// docs/plans/2026-10-03-募集からのセッション開始.md の「5. 新規テストケース（API）」に対応する。
// 募集からセッションを始める API（POST /api/recruitments/:id/start）を、MSW を直接呼んで確かめる。

import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { describe, expect, it } from 'vitest';
import * as fx from '@/mocks/fixtures';
import { api } from '@/shared/api/api';

const grayMansion = fx.scenarios.find((s) => s.id === 'sc-gray-mansion');
const village = fx.scenarios.find((s) => s.id === 'sc-village-start');

const start = (recruitmentId: string, body: object) =>
  api.post<Session>(`/recruitments/${recruitmentId}/start`, body);

/** 村はずれの一歩（導入から別のシーンへ進む選択肢カードがある）で、シーンを外した募集を出し、自分の PC で応募して始める */
async function startVillage(excludedNodeIds: string[]) {
  const rc = await api.post<Recruitment>('/scenarios/sc-village-start/recruitments', {
    capacity: 1,
    excludedNodeIds,
  });
  await api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' });
  return start(rc.id, { characterIds: ['pc-jin'], driverCharacterId: 'pc-jin', partyName: '' });
}

const handIds = (s: Session) => s.hand.map((c) => c.id);

describe('募集からセッションを始める', () => {
  it('自分の募集を始めると、GM が自分の人間 GM のセッションができ、募集は一覧から消える', async () => {
    const s = await start('rc-mine', {
      characterIds: ['pc-jin', 'pc-mio'],
      driverCharacterId: 'pc-jin',
      partyName: '夜更かし組',
    });
    expect(s).toMatchObject({
      gmId: 'u-me',
      status: 'playing',
      recruitmentId: 'rc-mine',
      partyName: '夜更かし組',
      flavor: grayMansion?.summary,
      currentScene: { nodeId: 'd-intro', total: grayMansion?.deck.length },
    });
    expect(s.participants.map((p) => [p.role, p.userId, p.characterId])).toEqual([
      ['gm', 'u-me', undefined],
      ['driver', 'u-me', 'pc-jin'],
      ['navigator', 'u-kaya', 'pc-mio'],
    ]);
    const recruitments = await api.get<Recruitment[]>('/recruitments');
    expect(recruitments.map((r) => r.id)).not.toContain('rc-mine');
    const sessions = await api.get<Session[]>('/sessions');
    expect(sessions.filter((x) => x.recruitmentId === 'rc-mine').map((x) => x.id)).toEqual([s.id]);
  });

  it('パーティー名が空欄なら「〈ドライバーのキャラクター名〉の一行」になる', async () => {
    const s = await start('rc-mine', {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
      partyName: '',
    });
    expect(s.partyName).toBe('ジンの一行');
  });
});

describe('外したシーン（docs/cartagraph/scenario-flow.md「GMのカスタマイズ」）', () => {
  it('外したシーンへ進む選択肢カードは、シーンを移ったあとも配られない', async () => {
    const s = await startVillage(['vs-shop']);
    expect(s.excludedNodeIds).toEqual(['vs-shop']);
    expect(s.currentScene.total).toBe((village?.deck.length ?? 0) - 1);
    const moved = await api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    expect(moved.currentScene.nodeId).toBe('vs-square');
    expect(handIds(moved)).toContain('vs-to-guild');
    expect(handIds(moved)).not.toContain('vs-to-shop');
    expect(moved.currentScene.total).toBe((village?.deck.length ?? 0) - 1);
  });

  it('導入シーンの手札にも、外したシーンへ進むカードは配られない', async () => {
    const s = await startVillage(['vs-square']);
    expect(handIds(s)).toContain('vs-look-around');
    expect(handIds(s)).not.toContain('vs-to-square');
  });

  it('募集人数は1以上の整数。0・空の本文では出せず、1なら出せる', async () => {
    const path = '/scenarios/sc-village-start/recruitments';
    for (const body of [{ capacity: 0 }, { capacity: 1.5 }, { capacity: '3' }, undefined]) {
      await expect(api.post(path, body)).rejects.toMatchObject({ status: 422 });
    }
    await expect(api.post<Recruitment>(path, { capacity: 1 })).resolves.toMatchObject({
      capacity: 1,
    });
  });

  it('シナリオに無いシーンや、形の崩れた指定では募集を出せない', async () => {
    for (const excludedNodeIds of [['nowhere'], 'vs-shop', [123]]) {
      await expect(
        api.post('/scenarios/sc-village-start/recruitments', { capacity: 1, excludedNodeIds }),
      ).rejects.toMatchObject({ status: 422 });
    }
  });

  it('導入・結末のシーンを外した募集は出せない', async () => {
    for (const id of ['vs-intro', 'vs-end']) {
      await expect(
        api.post('/scenarios/sc-village-start/recruitments', {
          capacity: 1,
          excludedNodeIds: [id],
        }),
      ).rejects.toMatchObject({ status: 422 });
    }
  });
});

describe('始められないとき', () => {
  it('PC を選ばずに始めると 422 で、募集もセッションも変わらない', async () => {
    const before = (await api.get<Session[]>('/sessions')).length;
    await expect(
      start('rc-mine', { characterIds: [], driverCharacterId: 'pc-jin', partyName: '' }),
    ).rejects.toMatchObject({ status: 422, message: '参加させるPCを選んでください' });
    expect((await api.get<Recruitment[]>('/recruitments')).map((r) => r.id)).toContain('rc-mine');
    expect((await api.get<Session[]>('/sessions')).length).toBe(before);
  });

  it('参加させるPCの指定の形が崩れていると 422 で、何も変わらない', async () => {
    for (const characterIds of ['pc-jin', ['pc-jin', 1]]) {
      await expect(
        start('rc-mine', { characterIds, driverCharacterId: 'pc-jin', partyName: '' }),
      ).rejects.toMatchObject({ status: 422, message: '参加させるPCの指定の形が正しくありません' });
    }
    expect((await api.get<Recruitment[]>('/recruitments')).map((r) => r.id)).toContain('rc-mine');
  });

  it('始めた募集には応募できず、もう一度は始められない', async () => {
    const body = { characterIds: ['pc-jin'], driverCharacterId: 'pc-jin', partyName: '' };
    await start('rc-mine', body);
    await expect(
      api.post('/recruitments/rc-mine/apply', { characterId: 'pc-akari' }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(start('rc-mine', body)).rejects.toMatchObject({
      status: 422,
      message: 'この募集はもう始まっています',
    });
  });

  it('他の GM の募集は始められず（403）、無い募集は 404', async () => {
    const body = { characterIds: ['pc-mio'], driverCharacterId: 'pc-mio', partyName: '' };
    await expect(start('rc-1', body)).rejects.toMatchObject({ status: 403 });
    await expect(start('rc-nowhere', body)).rejects.toMatchObject({ status: 404 });
  });
});
