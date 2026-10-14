// シナリオの版と、募集・セッションが進む版（docs/plans/2026-10-14-セッションの独立.md T1〜T11、
// docs/cartagraph/scenario-flow.md「シナリオの公開」「セッション開始までの全体フロー」）。
// 公開し直しは、自分が作者の新しいシナリオ（灰色館の一夜・村はずれの一歩の写し）を API で公開して行う
// （fixtures にしか無い sc-mansion-mine は公開できない）。

import type { Character } from '@cartagraph/domain/character/model';
import type { DeckNode } from '@cartagraph/domain/scenario/model';
import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api/api';
import { resetDb, setScenarioFileStore } from '../mocks/handlers';
import { createGmlessRecruitment, finishVillage, playFromRecruitment } from './gmlessHelpers';
import {
  createDraftCopy,
  draftOf,
  editNode,
  getVersion,
  patchDraft,
  publish,
  publishVillageCopy,
  republishWith,
} from './scenarioVersionHelpers';

const ABSENT = { status: 404 };
const character = async (id: string) =>
  (await api.get<Character[]>('/characters')).find((c) => c.id === id) as Character;
/** PC が持つ、そのシナリオの結末タグのカード */
const endingCardOf = async (pcId: string, scenarioId: string) =>
  (await character(pcId)).deck.find((c) => c.ending?.scenarioId === scenarioId);
const handNames = (s: Session) => s.hand.map((c) => c.name);

/** 導入に選択肢カードを1枚置く（灰色館の導入にはカードが無い） */
const introChoice = (name: string) => (d: { deck: DeckNode[] }) => ({
  deck: editNode(d.deck, 'd-intro', (n) => ({
    ...n,
    cards: [{ id: 'g-test-choice', kind: 'choice' as const, name, tags: [] }],
  })),
});

describe('版を作る（T1）', () => {
  it('初めて公開すると版1。中身を変えて公開し直すと版2ができ、版1は前の中身のまま', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await expect(getVersion(id, 1)).rejects.toMatchObject(ABSENT);
    await publish(id);
    const v1 = await getVersion(id, 1);
    await patchDraft(id, { summary: `${v1.summary}（直した）` });
    await publish(id);
    const v2 = await getVersion(id, 2);
    expect(v2.summary).toBe(`${v1.summary}（直した）`);
    expect((await getVersion(id, 1)).summary).toBe(v1.summary);
  });

  it('変更の無い公開し直し・非公開・外したものを変更なしで載せ直すでは、版は増えない', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    await publish(id);
    await api.post(`/scenarios/${id}/unpublish`);
    await publish(id);
    await expect(getVersion(id, 2)).rejects.toMatchObject(ABSENT);
  });

  it('下書きを同じ中身で保存し直して（updatedAt だけ違う）公開し直しても、版は増えない', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    const d = await draftOf(id);
    await patchDraft(id, { summary: d.summary });
    await publish(id);
    await expect(getVersion(id, 2)).rejects.toMatchObject(ABSENT);
  });

  it('外したものを変更ありで載せ直すと版が増える。外した後は版1も libraryStatus が draft', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    await api.post(`/scenarios/${id}/unpublish`);
    expect((await getVersion(id, 1)).libraryStatus).toBe('draft');
    await patchDraft(id, { summary: '外している間に直した' });
    await publish(id);
    expect((await getVersion(id, 2)).summary).toBe('外している間に直した');
    expect((await getVersion(id, 1)).libraryStatus).toBe('published');
  });
});

describe('版を作らない失敗（T2）', () => {
  it('検査に落ちる公開し直し（422）では版は増えない', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    await patchDraft(id, {
      deck: editNode((await draftOf(id)).deck, 'd-intro', (n) => ({
        ...n,
        cards: [{ id: 'c-broken', kind: 'choice', name: '迷う', tags: [], nextNodeId: 'nowhere' }],
      })),
    });
    await expect(publish(id)).rejects.toMatchObject({ status: 422 });
    await expect(getVersion(id, 2)).rejects.toMatchObject(ABSENT);
  });

  it('保存先の失敗（500）でも版は増えない', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    await patchDraft(id, { summary: '直した' });
    setScenarioFileStore({
      write: async () => {
        throw new Error('disk full');
      },
    });
    await expect(publish(id)).rejects.toMatchObject({ status: 500 });
    await expect(getVersion(id, 2)).rejects.toMatchObject(ABSENT);
  });

  it('公開の書き込みを待つ間に届いた保存は、版に入らない（版は押した時点の下書き）', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    const before = (await draftOf(id)).summary;
    await patchDraft(id, { summary: '押した時点' });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setScenarioFileStore({ write: () => gate });
    const publishing = publish(id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const saving = patchDraft(id, { summary: '待つ間に保存' });
    release();
    await publishing;
    await saving;
    expect((await getVersion(id, 2)).summary).toBe('押した時点');
    expect((await getVersion(id, 1)).summary).toBe(before);
    expect((await draftOf(id)).summary).toBe('待つ間に保存');
  });
});

describe('版の取得（T3・T4）', () => {
  it('公開版の無い下書き・どこにも無い id・版番号として読めない値・最新+1は 404', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    await expect(getVersion('sc-draft-well', 1)).rejects.toMatchObject(ABSENT);
    await expect(getVersion('sc-nowhere', 1)).rejects.toMatchObject(ABSENT);
    for (const v of ['0', '-1', '1.5', 'x', '01', '1e0', '+1', '2'])
      await expect(getVersion(id, v), v).rejects.toMatchObject(ABSENT);
    expect((await getVersion(id, 1)).id).toBe(id);
  });

  it('他人のシナリオ（灰色館）の版1もだれでも読め、公開版の取得と取り違えない', async () => {
    const v1 = await getVersion('sc-gray-mansion', 1);
    expect(v1).toEqual(await api.get('/scenarios/sc-gray-mansion'));
  });

  it('中身を変えて公開し直した直後、最新の版は公開版と updatedAt を含めて同じ。一覧は版を足しても1シナリオ1件', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    await patchDraft(id, { summary: '直した' });
    await publish(id);
    expect(await getVersion(id, 2)).toEqual(await api.get(`/scenarios/${id}`));
    const ids = (await api.get<{ id: string }[]>('/scenarios')).map((s) => s.id);
    expect(ids.filter((x) => x === id)).toHaveLength(1);
  });
});

describe('募集・セッションは出したとき（始めたとき）の版（T5・D6）', () => {
  const setup = async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await republishWith(id, introChoice('甲板へ'));
    return id;
  };
  const rename = (id: string, name: string) => republishWith(id, introChoice(name));

  it('通常の募集と GM 不在の募集は出したときの版で始まり、公開し直しても変わらない。後から出した募集は新しい版', async () => {
    const id = await setup();
    const normal = await api.post<Recruitment>(`/scenarios/${id}/recruitments`, { capacity: 1 });
    const gmless = await createGmlessRecruitment(id);
    expect([normal.scenarioVersion, gmless.scenarioVersion]).toEqual([1, 1]);
    await rename(id, '船倉へ');

    await api.post(`/recruitments/${normal.id}/apply`, { characterId: 'pc-jin' });
    const started = await api.post<Session>(`/recruitments/${normal.id}/start`, {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
    });
    expect(started.scenarioVersion).toBe(1);
    expect(handNames(started)).toEqual(['甲板へ']);
    const played = await playFromRecruitment(gmless.id, 'pc-jin');
    expect(played.scenarioVersion).toBe(1);
    expect(handNames(played)).toEqual(['甲板へ']);

    const later = await createGmlessRecruitment(id);
    expect(later.scenarioVersion).toBe(2);
    expect(handNames(await playFromRecruitment(later.id, 'pc-jin'))).toEqual(['船倉へ']);
  });

  it('ソロ開始は、始めたときの最新の版', async () => {
    const id = await setup();
    const first = await api.post<Session>(`/scenarios/${id}/start-solo`, { name: '一人目' });
    expect(first.scenarioVersion).toBe(1);
    await rename(id, '船倉へ');
    const second = await api.post<Session>(`/scenarios/${id}/start-solo`, { name: '二人目' });
    expect(second.scenarioVersion).toBe(2);
    expect(handNames(first)).toEqual(['甲板へ']);
    expect(handNames(second)).toEqual(['船倉へ']);
  });
});

describe('外したシーンは募集の版で当てる（T6）', () => {
  it('版1で外したシーンを、版2で消しても、募集から始めたセッションは版1のデッキから外す', async () => {
    const id = await publishVillageCopy();
    const v1 = await getVersion(id, 1);
    const rc = await api.post<Recruitment>(`/scenarios/${id}/recruitments`, {
      kind: 'gmless',
      proposalHandling: 'gm-required',
      excludedNodeIds: ['vs-quest-1'],
    });
    // 版2：外したシーンを、へ進むカードごと消す
    await republishWith(id, (d) => ({
      deck: d.deck
        .filter((n) => n.id !== 'vs-quest-1')
        .map((n) => ({ ...n, cards: n.cards.filter((c) => c.nextNodeId !== 'vs-quest-1') })),
    }));
    const s = await playFromRecruitment(rc.id, 'pc-jin');
    // 版1のデッキから、外したシーンの分だけ減る（版2のデッキの数とは違う）
    expect(s.currentScene.total).toBe(v1.deck.length - 1);
    const sq = await api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    expect(handNames(sq).some((n) => n.includes('壊れた水車'))).toBe(false);
    expect(handNames(sq).some((n) => n.includes('猪'))).toBe(true);
  });
});

describe('進行中のセッションは変わらない（T7・D1）', () => {
  it('次のシーンの選択肢・移り先・結末タグを変えて公開し直しても、古い版で結末まで進む', async () => {
    const id = await publishVillageCopy();
    const rc = await createGmlessRecruitment(id);
    const s = await playFromRecruitment(rc.id, 'pc-jin');
    await republishWith(id, (d) => ({
      deck: editNode(
        editNode(d.deck, 'vs-intro', (n) => ({
          ...n,
          cards: n.cards.map((c) =>
            c.id === 'vs-to-square' ? { ...c, nextNodeId: 'vs-shop' } : c,
          ),
        })),
        'vs-square',
        (n) => ({
          ...n,
          cards: n.cards.map((c) => (c.id === 'vs-to-quest-0' ? { ...c, name: '改名した' } : c)),
        }),
      ),
      endings: d.endings.map((e) => ({ ...e, grantsTag: '別の結末タグ' })),
    }));
    const atSquare = await api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'vs-to-square' });
    expect(atSquare.currentScene.nodeId).toBe('vs-square');
    expect(handNames(atSquare).includes('改名した')).toBe(false);
    const ended = await finishVillageFromSquare(s.id);
    expect(ended.status).toBe('ended');
    expect((await endingCardOf('pc-jin', id))?.name).toBe('冒険者になった');
  });
});

/** vs-square にいるところから結末まで（finishVillage は導入から） */
async function finishVillageFromSquare(sessionId: string) {
  for (const cardId of [
    'vs-to-quest-0',
    'vs-quest-0-body',
    'vs-to-shop',
    'vs-learn-c-slash',
    'vs-shop-leave',
    'vs-to-guild',
    'vs-to-exam',
  ])
    await api.post(`/sessions/${sessionId}/play`, { cardId });
  await api.post(`/sessions/${sessionId}/auto-combat`, {
    priority: [{ cardId: 'c-slash', when: 'always' }],
  });
  return api.post<Session>(`/sessions/${sessionId}/play`, { cardId: 'vs-accept' });
}

describe('GM のセッションの移り先は募集の版（T8）', () => {
  it('描写（/narrate）・提案の採用（/approve）は、版1にだけあるシーンへ移れ、版2にしか無いシーンは 422', async () => {
    const id = await publishVillageCopy();
    const rc = await api.post<Recruitment>(`/scenarios/${id}/recruitments`, { capacity: 1 });
    await api.post(`/recruitments/${rc.id}/apply`, { characterId: 'pc-jin' });
    const s = await api.post<Session>(`/recruitments/${rc.id}/start`, {
      characterIds: ['pc-jin'],
      driverCharacterId: 'pc-jin',
    });
    // 版2：シーンを1つ消し、別のシーンを足す
    await republishWith(id, (d) => ({
      deck: [
        ...d.deck
          .filter((n) => n.id !== 'vs-quest-2')
          .map((n) => ({ ...n, cards: n.cards.filter((c) => c.nextNodeId !== 'vs-quest-2') })),
        { id: 'vs-new', kind: 'scene' as const, name: '新しいシーン', cards: [] },
      ],
    }));
    await expect(
      api.post(`/sessions/${s.id}/narrate`, { choices: [{ name: '新へ', nextNodeId: 'vs-new' }] }),
    ).rejects.toMatchObject({ status: 422 });
    const narrated = await api.post<Session>(`/sessions/${s.id}/narrate`, {
      choices: [{ name: '迷子へ', nextNodeId: 'vs-quest-2' }],
    });
    expect(narrated.hand.some((c) => c.nextNodeId === 'vs-quest-2')).toBe(true);

    const proposed = await api.post<Session>(`/sessions/${s.id}/proposals`, { text: '探す' });
    const pid = proposed.proposals[0].id;
    await expect(
      api.post(`/sessions/${s.id}/proposals/${pid}/approve`, {
        cardName: '探す',
        nextNodeId: 'vs-new',
      }),
    ).rejects.toMatchObject({ status: 422, message: '「vs-new」へは、選択肢で進めません' });
    const approved = await api.post<Session>(`/sessions/${s.id}/proposals/${pid}/approve`, {
      cardName: '探す',
      nextNodeId: 'vs-quest-2',
    });
    expect(approved.hand.some((c) => c.nextNodeId === 'vs-quest-2' && c.name === '探す')).toBe(
      true,
    );
  });
});

describe('自動戦闘は募集の版の敵で解決する（T9）', () => {
  it('版2で敵を強くしても、版1の募集から始めたセッションは版1の敵で勝ち、結末のカードは版1のもの', async () => {
    const id = await publishVillageCopy();
    const rc = await createGmlessRecruitment(id);
    await republishWith(id, (d) => ({
      deck: editNode(d.deck, 'vs-exam', (n) => ({
        ...n,
        autoCombat: n.autoCombat && {
          ...n.autoCombat,
          enemy: { ...n.autoCombat.enemy, hp: 9999 },
        },
      })),
      endings: d.endings.map((e) => ({ ...e, grantsTag: '別の結末タグ' })),
    }));
    const s = await playFromRecruitment(rc.id, 'pc-jin');
    const ended = await finishVillage(s.id);
    expect(ended.status).toBe('ended');
    expect(ended.combatHistory?.[0]?.outcome).toBe('win');
    expect((await endingCardOf('pc-jin', id))?.name).toBe('冒険者になった');
  });
});

describe('再挑戦不可は結末タグのカードだけで決める（T10・D7・D8）', () => {
  const normalRecruitment = (id: string) =>
    api.post<Recruitment>(`/scenarios/${id}/recruitments`, { capacity: 2 });
  const sessionCount = async () => (await api.get<Session[]>('/sessions')).length;

  it('版1で結末に至った PC は、再挑戦不可を外した版2の募集でも始められず、カードを持たない PC は始められる', async () => {
    const id = await publishVillageCopy();
    const old = await normalRecruitment(id);
    await api.post(`/recruitments/${old.id}/apply`, { characterId: 'pc-jin' });
    await api.post(`/recruitments/${old.id}/apply`, { characterId: 'pc-akari' });

    const cleared = await playFromRecruitment((await createGmlessRecruitment(id)).id, 'pc-jin');
    await finishVillage(cleared.id);
    expect((await endingCardOf('pc-jin', id))?.ending?.noReplay).toBe(true);

    // 製作者が再挑戦不可を外し、結末の名前も変えて公開し直す（版2）
    await republishWith(id, (d) => ({
      endings: d.endings.map(({ noReplay: _, ...e }) => ({ ...e, name: '旅立ち（改）' })),
      deck: editNode(d.deck, 'vs-end', (n) => ({ ...n, name: '旅立ち（改）' })),
    }));
    const next = await normalRecruitment(id);
    expect(next.scenarioVersion).toBe(2);
    const message =
      'ジンはこのシナリオの結末「冒険者として旅立つ」に至っているため、もう一度は遊べません';
    await expect(
      api.post(`/recruitments/${next.id}/apply`, { characterId: 'pc-jin' }),
    ).rejects.toMatchObject({ status: 422, message });
    expect(
      (await api.get<Recruitment[]>('/recruitments')).find((r) => r.id === next.id)?.applicants,
    ).toEqual([]);

    // 選んだ PC の1人だけがカードを持つ場合も、全体を断る
    const before = await sessionCount();
    await expect(
      api.post(`/recruitments/${old.id}/start`, {
        characterIds: ['pc-jin', 'pc-akari'],
        driverCharacterId: 'pc-akari',
      }),
    ).rejects.toMatchObject({ status: 422, message });
    expect(
      (await api.get<Recruitment[]>('/recruitments')).find((r) => r.id === old.id)?.status,
    ).toBe('open');
    expect(await sessionCount()).toBe(before);

    // GM 不在の募集（版2）も同じ
    const gmless2 = await createGmlessRecruitment(id);
    await expect(playFromRecruitment(gmless2.id, 'pc-jin')).rejects.toMatchObject({
      status: 422,
      message,
    });
    expect(await sessionCount()).toBe(before);

    // 反対側：カードを持たない PC は版2から始められ、版2の結末に至ると再挑戦不可でないカードを得て、もう一度始められる
    const akari = await playFromRecruitment(gmless2.id, 'pc-akari');
    await finishVillage(akari.id);
    expect((await endingCardOf('pc-akari', id))?.ending).toMatchObject({
      noReplay: false,
      endingName: '旅立ち（改）',
    });
    expect((await playFromRecruitment(gmless2.id, 'pc-akari')).status).toBe('playing');
  });

  it('版2で新しく再挑戦不可を付けても、版1で（再挑戦不可でなく）得ていた PC は止まらない', async () => {
    const id = await publishVillageCopy();
    await republishWith(id, (d) => ({
      endings: d.endings.map(({ noReplay: _, ...e }) => e),
    }));
    const lenient = await createGmlessRecruitment(id);
    await finishVillage((await playFromRecruitment(lenient.id, 'pc-jin')).id);
    expect((await endingCardOf('pc-jin', id))?.ending?.noReplay).toBe(false);

    await republishWith(id, (d) => ({
      endings: d.endings.map((e) => ({ ...e, noReplay: true })),
    }));
    const strict = await createGmlessRecruitment(id);
    expect((await playFromRecruitment(strict.id, 'pc-jin')).status).toBe('playing');
  });
});

describe('シード（T11）', () => {
  it('fixtures の募集・セッションは版1で、その版を読める。アカリの前作の結末タグのカードは後編の前提を満たす', async () => {
    for (const x of [
      ...(await api.get<Recruitment[]>('/recruitments')),
      ...(await api.get<Session[]>('/sessions')),
    ]) {
      expect(x.scenarioVersion).toBe(1);
      expect((await getVersion(x.scenarioId, 1)).id).toBe(x.scenarioId);
    }
    const akari = await character('pc-akari');
    expect(akari.deck.some((c) => c.tags.includes('灯りの回廊を経験'))).toBe(true);
    expect((await getVersion('sc-corridor-after', 1)).prerequisiteTags).toContain(
      '灯りの回廊を経験',
    );
  });

  it('resetDb() で版の履歴もシードに戻る', async () => {
    const id = await createDraftCopy('sc-gray-mansion');
    await publish(id);
    await patchDraft(id, { summary: '直した' });
    await publish(id);
    await getVersion(id, 2);
    resetDb();
    await expect(getVersion(id, 1)).rejects.toMatchObject(ABSENT);
    await expect(getVersion('sc-galleon', 2)).rejects.toMatchObject(ABSENT);
    expect((await getVersion('sc-galleon', 1)).id).toBe('sc-galleon');
  });
});
