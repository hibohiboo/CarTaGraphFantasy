// シナリオ集に載っているシナリオからだけ新しく始める・公開版を使う・シード
// （docs/plans/2026-10-11-シナリオの下書きのAPI.md T3・T4・T6・T10、docs/cartagraph/scenario-flow.md「シナリオの公開」）。

import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { describe, expect, it } from 'vitest';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { resetDb } from '../mocks/handlers';
import { createGmlessRecruitment, playFromRecruitment } from './gmlessHelpers';

const NOT_STARTABLE = 'シナリオ集に公開されていないシナリオからは始められません';

const getPublished = (id: string) => api.get<Scenario>(`/scenarios/${id}`);
const getDraft = (id: string) => api.get<ScenarioDraftView>(`/scenarios/${id}/draft`);
const listedIds = async () => (await api.get<Scenario[]>('/scenarios')).map((s) => s.id);
const counts = async () => ({
  sessions: (await api.get<Session[]>('/sessions')).length,
  recruitments: (await api.get<Recruitment[]>('/recruitments')).length,
});

/** 導入に選択肢カードを1枚置いたデッキ（ガレオンの導入にはカードが無い） */
const withIntroChoice = (deck: DeckNode[], name: string): DeckNode[] =>
  deck.map((n) =>
    n.kind === 'intro'
      ? { ...n, cards: [{ id: 'g-test-choice', kind: 'choice', name, tags: [] }] }
      : n,
  );

describe('新しく始められるのは、シナリオ集に載っているシナリオだけ（T3）', () => {
  it('公開版の無い下書き（涸れ井戸）からは、ソロ開始も募集の作成も 422 で、何も増えない', async () => {
    const before = await counts();
    await expect(
      api.post('/scenarios/sc-draft-well/start-solo', { name: '新人' }),
    ).rejects.toMatchObject({ status: 422, message: NOT_STARTABLE });
    await expect(
      api.post('/scenarios/sc-draft-well/recruitments', { capacity: 2 }),
    ).rejects.toMatchObject({ status: 422, message: NOT_STARTABLE });
    expect(await counts()).toEqual(before);
  });

  it('シナリオ集から外したシナリオからも 422。載っているうちは今どおり始められる', async () => {
    const rc = await api.post<Recruitment>('/scenarios/sc-galleon/recruitments', { capacity: 2 });
    expect(rc.scenarioId).toBe('sc-galleon');
    await api.post('/scenarios/sc-galleon/unpublish');
    const before = await counts();
    await expect(
      api.post('/scenarios/sc-galleon/recruitments', { capacity: 2 }),
    ).rejects.toMatchObject({ status: 422, message: NOT_STARTABLE });
    await expect(
      api.post('/scenarios/sc-galleon/start-solo', { name: '新人' }),
    ).rejects.toMatchObject({ status: 422, message: NOT_STARTABLE });
    expect(await counts()).toEqual(before);
  });

  it('外しても、既にある受付中の GM 不在の募集からは始められ、進行中のセッションは次のシーンへ進める（D3）', async () => {
    const published = await getPublished('sc-galleon');
    await api.patch(`/scenarios/sc-galleon/draft`, {
      deck: withIntroChoice(published.deck, '甲板へ'),
    });
    await api.post('/scenarios/sc-galleon/publish');
    const rc = await createGmlessRecruitment('sc-galleon');
    const first = await playFromRecruitment(rc.id, 'pc-jin');
    await api.post('/scenarios/sc-galleon/unpublish');
    const second = await playFromRecruitment(rc.id, 'pc-akari');
    expect(second.scenarioId).toBe('sc-galleon');
    const moved = await api.post<Session>(`/sessions/${first.id}/play`, {
      cardId: first.hand.find((c) => c.name === '甲板へ')?.id,
    });
    expect(moved.status).not.toBe('ended');
  });

  it('本文が崩れていて、かつ始められないシナリオのときは、本文の 422 が先', async () => {
    await expect(
      api.post('/scenarios/sc-draft-well/start-solo', { name: 5 }),
    ).rejects.toMatchObject({ status: 422, message: '本文の形が正しくありません（name）' });
  });

  it('どこにも無い id は 404', async () => {
    await expect(
      api.post('/scenarios/sc-nowhere/start-solo', { name: '新人' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      api.post('/scenarios/sc-nowhere/recruitments', { capacity: 2 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('公開版の取得とシナリオ集の一覧（T4）', () => {
  it('公開版の無い下書きは 404、外したシナリオは 200（既にある募集・セッションのため）', async () => {
    await expect(getPublished('sc-draft-well')).rejects.toMatchObject({ status: 404 });
    await api.post('/scenarios/sc-galleon/unpublish');
    expect((await getPublished('sc-galleon')).libraryStatus).toBe('draft');
  });

  it('一覧に、外したもの・公開版の無いもの・テスト専用のものは出ない。テスト専用のものは公開版として読める', async () => {
    await api.post('/scenarios/sc-galleon/unpublish');
    const ids = await listedIds();
    expect(ids).toEqual(expect.arrayContaining(['sc-gray-mansion', 'sc-village-start']));
    for (const id of ['sc-galleon', 'sc-draft-well', 'sc-mansion-mine', 'sc-village-always-win']) {
      expect(ids).not.toContain(id);
    }
    expect((await getPublished('sc-village-always-win')).libraryStatus).toBe('published');
  });
});

describe('シード（T6）', () => {
  it('自分の下書きの一覧と、それぞれの公開の状態', async () => {
    const views = await api.get<ScenarioDraftView[]>('/scenario-drafts');
    expect(views.map((v) => [v.draft.id, v.publication, v.changed])).toEqual([
      ['sc-galleon', 'listed', false],
      ['sc-draft-well', 'none', false],
      ['sc-mansion-mine', 'none', false],
    ]);
    expect(
      views.every((v) => v.draft.authorId === 'u-me' && v.draft.libraryStatus === 'draft'),
    ).toBe(true);
  });

  it('resetDb() で下書きもシードに戻る', async () => {
    await api.patch('/scenarios/sc-galleon/draft', { title: '直した' });
    await api.post('/scenarios', { title: '足した' });
    resetDb();
    expect((await getDraft('sc-galleon')).draft.title).not.toBe('直した');
    expect((await api.get<ScenarioDraftView[]>('/scenario-drafts')).map((v) => v.draft.id)).toEqual(
      ['sc-galleon', 'sc-draft-well', 'sc-mansion-mine'],
    );
  });
});

describe('始めたセッションは、募集を出したときの公開版を使う（T10）', () => {
  it('下書きで選択肢の名前を変えても、新しく始めたセッションの手札は公開版の名前。公開し直しても既にある募集は変わらず、後から出した募集は新しい名前', async () => {
    const published = await getPublished('sc-galleon');
    await api.patch('/scenarios/sc-galleon/draft', {
      deck: withIntroChoice(published.deck, '甲板へ'),
    });
    await api.post('/scenarios/sc-galleon/publish');
    await api.patch('/scenarios/sc-galleon/draft', {
      deck: withIntroChoice(published.deck, '船倉へ'),
    });
    const rc = await createGmlessRecruitment('sc-galleon');
    const before = await playFromRecruitment(rc.id, 'pc-jin');
    expect(before.hand.map((c) => c.name)).toContain('甲板へ');
    expect(before.hand.map((c) => c.name)).not.toContain('船倉へ');

    await api.post('/scenarios/sc-galleon/publish');
    // 既にある募集は、出したときの版のまま（公開し直しても変わらない。D6）
    const after = await playFromRecruitment(rc.id, 'pc-akari');
    expect(after.scenarioVersion).toBe(before.scenarioVersion);
    expect(after.hand.map((c) => c.name)).toContain('甲板へ');
    expect(after.hand.map((c) => c.name)).not.toContain('船倉へ');
    // 公開し直した後に出した募集から始めると、新しい名前
    const rc2 = await createGmlessRecruitment('sc-galleon');
    expect(rc2.scenarioVersion).toBe(before.scenarioVersion + 1);
    const fresh = await playFromRecruitment(rc2.id, 'pc-akari');
    expect(fresh.hand.map((c) => c.name)).toContain('船倉へ');
  });
});
