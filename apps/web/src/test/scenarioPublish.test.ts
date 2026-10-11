// シナリオの下書きと公開版の API（docs/plans/2026-10-11-シナリオの下書きのAPI.md T1・T2・T7〜T9・T11〜T13、
// docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。保存は下書きだけを変え、公開・公開し直す・非公開で公開版と
// ファイルを変える。保存先は既定で null（デモ。setup.ts が毎回戻す）。書き込みを確かめるテストだけ、偽の保存先を差し込む。

import type { CardDef } from '@cartagraph/domain/card/model';
import { safeParseScenarioFile } from '@cartagraph/domain/scenario/file';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ScenarioDraftView, ScenarioSaveResult } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { nextFreeId, setScenarioFileStore } from '../mocks/handlers';

/** 偽の保存先。渡されたシナリオを記録する。fail を渡すと例外を投げる */
function fakeStore(fail?: string) {
  const written: Scenario[] = [];
  setScenarioFileStore({
    write: async (s) => {
      if (fail) throw new Error(fail);
      written.push(structuredClone(s));
    },
  });
  return written;
}

const create = async (title = '新しい公開テスト') =>
  (await api.post<ScenarioDraftView>('/scenarios', { title })).draft;
const publish = (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/publish`);
const unpublish = (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/unpublish`);
const saveDraft = (id: string, body: Partial<Scenario> | Record<string, unknown>) =>
  api.patch<ScenarioDraftView>(`/scenarios/${id}/draft`, body);
const getDraft = (id: string) => api.get<ScenarioDraftView>(`/scenarios/${id}/draft`);
const getPublished = (id: string) => api.get<Scenario>(`/scenarios/${id}`);
const listedIds = async () => (await api.get<Scenario[]>('/scenarios')).map((s) => s.id);
const draftIds = async () =>
  (await api.get<ScenarioDraftView[]>('/scenario-drafts')).map((v) => v.draft.id);

/** 存在しないノードを指す選択肢を持つデッキ（参照の検査に落ちる。下書きの形としては正しい） */
const brokenDeck = (s: Scenario): Scenario['deck'] =>
  s.deck.map((n, i) =>
    i === 0
      ? {
          ...n,
          cards: [
            ...n.cards,
            { id: 'c-broken', kind: 'choice', name: '迷う', tags: [], nextNodeId: 'nowhere' },
          ],
        }
      : n,
  );

/** updatedAt を除いた中身 */
const content = ({ updatedAt: _, ...rest }: Scenario) => rest;

describe('公開（POST /api/scenarios/:id/publish）', () => {
  it('下書きを公開すると公開版ができてシナリオ集に載り、保存先に1回渡る', async () => {
    const written = fakeStore();
    const sc = await create();
    await expect(getPublished(sc.id)).rejects.toMatchObject({ status: 404 });
    const res = await publish(sc.id);
    expect(res.scenario.libraryStatus).toBe('published');
    expect(res.file).toEqual({ saved: true, path: `scenarios/${sc.id}.json` });
    expect(written).toEqual([res.scenario]);
    expect(await listedIds()).toContain(sc.id);
    expect((await getPublished(sc.id)).libraryStatus).toBe('published');
    expect(await getDraft(sc.id)).toMatchObject({ publication: 'listed', changed: false });
  });

  it('保存先が無い（デモ）なら公開はでき、保存されなかったことを返す', async () => {
    const sc = await create();
    const res = await publish(sc.id);
    expect(res.file).toEqual({ saved: false });
    expect(await listedIds()).toContain(sc.id);
  });

  it('公開中で変更の無いものをもう一度公開しても誤りにならず、同じ中身で書き直す（updatedAt は下書きの値）', async () => {
    const written = fakeStore();
    const sc = await create();
    await publish(sc.id);
    await publish(sc.id);
    expect(written).toHaveLength(2);
    expect(written[1]).toEqual(written[0]);
    expect(written[0]?.updatedAt).toBe(sc.updatedAt);
  });

  it('カード画像の data URL はファイルに書かず、公開版と下書きには残り、変更なしのまま（T13）', async () => {
    const written = fakeStore();
    const sc = await create();
    const img = 'data:image/png;base64,AAAA';
    const card: CardDef = { id: 'c-pic', kind: 'npc', name: '絵', tags: [], portraitUrl: img };
    await saveDraft(sc.id, {
      deck: sc.deck.map((n, i) => (i === 0 ? { ...n, cards: [card] } : n)),
    });
    await publish(sc.id);
    expect(written[0]?.deck[0]?.cards[0]).not.toHaveProperty('portraitUrl');
    expect((await getPublished(sc.id)).deck[0]?.cards[0]?.portraitUrl).toBe(img);
    const view = await getDraft(sc.id);
    expect(view.draft.deck[0]?.cards[0]?.portraitUrl).toBe(img);
    expect(view.changed).toBe(false);
  });

  it('参照の切れた下書きは保存できるが、公開は 422 で、保存先に渡らず公開版もできない（デモでも同じ）', async () => {
    const sc = await create();
    await saveDraft(sc.id, { deck: brokenDeck(sc) });
    await expect(publish(sc.id)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('nowhere'),
    });
    const written = fakeStore();
    await expect(publish(sc.id)).rejects.toMatchObject({ status: 422 });
    expect(written).toEqual([]);
    await expect(getPublished(sc.id)).rejects.toMatchObject({ status: 404 });
    expect(await listedIds()).not.toContain(sc.id);
    expect(await getDraft(sc.id)).toMatchObject({ publication: 'none', changed: false });
  });

  it('公開中のシナリオを公開し直して検査に落ちると 422 で、公開版・一覧・下書き・変更ありは変わらない（T9）', async () => {
    const written = fakeStore();
    const before = await getPublished('sc-galleon');
    const saved = await saveDraft('sc-galleon', { deck: brokenDeck(before) });
    expect(saved.changed).toBe(true);
    await expect(publish('sc-galleon')).rejects.toMatchObject({ status: 422 });
    expect(written).toEqual([]);
    expect(await getPublished('sc-galleon')).toEqual(before);
    expect(await listedIds()).toContain('sc-galleon');
    const after = await getDraft('sc-galleon');
    expect(after.draft.deck).toEqual(saved.draft.deck);
    expect(after.changed).toBe(true);
  });

  it('公開し直しで保存先が失敗したら 500 で、公開版と一覧は変わらない（T9）', async () => {
    const before = await getPublished('sc-galleon');
    await saveDraft('sc-galleon', { title: '直した題名' });
    fakeStore('ディスクがいっぱい');
    await expect(publish('sc-galleon')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('ディスクがいっぱい'),
    });
    expect(await getPublished('sc-galleon')).toEqual(before);
    expect(await listedIds()).toContain('sc-galleon');
    expect((await getDraft('sc-galleon')).changed).toBe(true);
  });

  it('fixtures にしか無いデモの下書き（涸れ井戸）は 422 で公開できない（シナリオ公開の D7）', async () => {
    const written = fakeStore();
    await expect(publish('sc-draft-well')).rejects.toMatchObject({
      status: 422,
      message: 'デモ用のシナリオは公開・非公開を変えられません',
    });
    expect(written).toEqual([]);
    await expect(getPublished('sc-draft-well')).rejects.toMatchObject({ status: 404 });
  });

  it('製作者でないシナリオ（他人の灰色館・system の村はずれ）は 403 で、公開版は変わらない（T5）', async () => {
    const written = fakeStore();
    for (const id of ['sc-gray-mansion', 'sc-village-start']) {
      const before = await getPublished(id);
      const denied = { status: 403, message: '製作者でないため変更できません' };
      await expect(publish(id)).rejects.toMatchObject(denied);
      await expect(unpublish(id)).rejects.toMatchObject(denied);
      await expect(saveDraft(id, { title: '乗っ取り' })).rejects.toMatchObject(denied);
      // 読むだけの 403 は「読めません」（変更の 403 と文を分ける）
      await expect(getDraft(id)).rejects.toMatchObject({
        status: 403,
        message: '製作者でないため下書きを読めません',
      });
      expect(await getPublished(id)).toEqual(before);
    }
    expect(written).toEqual([]);
  });

  it('下書きにも公開版にも無い id は 404（T5）', async () => {
    for (const call of [publish, unpublish, getDraft, (id: string) => saveDraft(id, {})]) {
      await expect(call('sc-nowhere')).rejects.toMatchObject({ status: 404 });
    }
  });
});

describe('非公開（POST /api/scenarios/:id/unpublish）', () => {
  it('公開中を外すと、公開版の中身のまま外した状態で書き直し、一覧から消え、公開版と下書きは残る', async () => {
    const written = fakeStore();
    const res = await unpublish('sc-galleon');
    expect(res.scenario.libraryStatus).toBe('draft');
    expect(res.file).toEqual({ saved: true, path: 'scenarios/sc-galleon.json' });
    expect(written.map((s) => [s.id, s.libraryStatus])).toEqual([['sc-galleon', 'draft']]);
    expect(await listedIds()).not.toContain('sc-galleon');
    expect((await getPublished('sc-galleon')).libraryStatus).toBe('draft');
    expect(await getDraft('sc-galleon')).toMatchObject({ publication: 'unlisted' });
    expect(await draftIds()).toContain('sc-galleon');
  });

  it('デモでは保存されなかったことを返す', async () => {
    expect((await unpublish('sc-galleon')).file).toEqual({ saved: false });
  });

  it('外すと updatedAt が新しくなる（固定の日時のガレオンで確かめる）', async () => {
    const before = await getPublished('sc-galleon');
    expect((await unpublish('sc-galleon')).scenario.updatedAt).not.toBe(before.updatedAt);
  });

  it('デモ用の下書き（涸れ井戸）を外すのも 422 で、文は非公開の操作に合う', async () => {
    await expect(unpublish('sc-draft-well')).rejects.toMatchObject({
      status: 422,
      message: 'デモ用のシナリオは公開・非公開を変えられません',
    });
  });

  it('公開版の無い下書きは外せない（422）。外したものをもう一度外すのは 200（T8）', async () => {
    const sc = await create();
    await expect(unpublish(sc.id)).rejects.toMatchObject({
      status: 422,
      message: '公開していないシナリオは非公開にできません',
    });
    await unpublish('sc-galleon');
    expect((await unpublish('sc-galleon')).scenario.libraryStatus).toBe('draft');
  });

  it('変更のある下書きを持つシナリオを外すと、ファイルに書くのは公開版の中身で、下書きと変更ありは変わらない（T8）', async () => {
    const written = fakeStore();
    const before = await getPublished('sc-galleon');
    await saveDraft('sc-galleon', { title: '直しかけの題名' });
    await unpublish('sc-galleon');
    expect(written.map((s) => s.title)).toEqual([before.title]);
    expect(await getDraft('sc-galleon')).toMatchObject({
      draft: { title: '直しかけの題名' },
      publication: 'unlisted',
      changed: true,
    });
    // 外したシナリオを公開すると、一覧に戻り、公開版が下書きの中身になる
    await publish('sc-galleon');
    expect(await listedIds()).toContain('sc-galleon');
    expect((await getPublished('sc-galleon')).title).toBe('直しかけの題名');
    expect((await getDraft('sc-galleon')).changed).toBe(false);
  });

  it('保存先が失敗したら 500 で、一覧に載ったまま', async () => {
    fakeStore('書けない');
    await expect(unpublish('sc-galleon')).rejects.toMatchObject({ status: 500 });
    expect((await getPublished('sc-galleon')).libraryStatus).toBe('published');
    expect(await listedIds()).toContain('sc-galleon');
  });
});

describe('下書きの保存（PATCH /api/scenarios/:id/draft）', () => {
  it('公開中のシナリオの下書きを保存しても、公開版と保存先は変わらず、変更ありになる。公開し直すと届く（T1）', async () => {
    const written = fakeStore();
    const before = await getPublished('sc-galleon');
    const saved = await saveDraft('sc-galleon', { title: '鉄鎖のガレオン船（改）' });
    expect(saved).toMatchObject({
      draft: { title: '鉄鎖のガレオン船（改）' },
      publication: 'listed',
      changed: true,
    });
    expect(written).toEqual([]);
    expect(await getPublished('sc-galleon')).toEqual(before);

    await publish('sc-galleon');
    expect(written.map((s) => s.title)).toEqual(['鉄鎖のガレオン船（改）']);
    expect((await getPublished('sc-galleon')).title).toBe('鉄鎖のガレオン船（改）');
    expect((await getDraft('sc-galleon')).changed).toBe(false);

    // 公開した後に下書きを直しても、公開版は変わらない（同じオブジェクトを共有していない）
    await saveDraft('sc-galleon', { title: 'もう一度直した題名' });
    expect((await getPublished('sc-galleon')).title).toBe('鉄鎖のガレオン船（改）');
  });

  it('updatedAt はサーバーが付け、本文の値は使わない', async () => {
    const sc = await create();
    const saved = await saveDraft(sc.id, { summary: 'x', updatedAt: '2000-01-01T00:00:00Z' });
    expect(saved.draft.updatedAt).not.toBe('2000-01-01T00:00:00Z');
    expect(Date.parse(saved.draft.updatedAt)).toBeGreaterThanOrEqual(Date.parse(sc.updatedAt));
  });

  it('id・作者・libraryStatus を本文に書いても変わらない（T2）', async () => {
    const sc = await create();
    const saved = await saveDraft(sc.id, {
      id: 'sc-other',
      authorId: 'u-kotone',
      authorName: '乗っ取り',
      libraryStatus: 'published',
    });
    expect(saved.draft).toMatchObject({
      id: sc.id,
      authorId: sc.authorId,
      authorName: sc.authorName,
      libraryStatus: 'draft',
    });
    expect(await listedIds()).not.toContain(sc.id);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['知らないキー', { foo: 1 }, '下書きの形が正しくありません（本文：foo）'],
    ['題名の型違い', { title: 123 }, '下書きの形が正しくありません（title）'],
    ['人数の型違い', { partySize: 'x' }, '下書きの形が正しくありません（partySize）'],
    [
      'シナリオタイプが null',
      { scenarioType: null },
      '下書きの形が正しくありません（scenarioType）',
    ],
    [
      'カードの中の知らないキー',
      {
        deck: [
          {
            id: 'n',
            kind: 'intro',
            name: '導入',
            cards: [{ id: 'c', kind: 'npc', name: 'x', tags: [], foo: 1 }],
          },
        ],
      },
      '下書きの形が正しくありません（deck.0.cards.0：foo）',
    ],
  ])('形の崩れ（%s）は 422 で、下書きは変わらない（T2）', async (_, body, message) => {
    const sc = await create();
    const before = await getDraft(sc.id);
    await expect(saveDraft(sc.id, body)).rejects.toMatchObject({ status: 422, message });
    expect(await getDraft(sc.id)).toEqual(before);
  });

  it('{} は 200 で、中身は変わらない（updatedAt だけ新しくなる）', async () => {
    const sc = await create();
    const saved = await saveDraft(sc.id, {});
    expect(content(saved.draft)).toEqual(content(sc));
  });

  it('参照の切れた下書きも保存できる（参照は形ではないので、公開のときに見る）', async () => {
    const written = fakeStore();
    const sc = await create();
    const saved = await saveDraft(sc.id, { deck: brokenDeck(sc) });
    expect(saved.draft.deck[0]?.cards.map((c) => c.id)).toEqual(['c-broken']);
    expect(written).toEqual([]);
  });
});

describe('公開版と違う変更があるか（changed。T7）', () => {
  it('公開版が無ければ、保存しても false', async () => {
    const sc = await create();
    expect((await saveDraft(sc.id, { title: '直した' })).changed).toBe(false);
  });

  it('公開版と同じ中身で保存すると false（updatedAt だけ違う）', async () => {
    const published = await getPublished('sc-galleon');
    const { updatedAt: _, libraryStatus: __, ...same } = published;
    expect((await saveDraft('sc-galleon', same)).changed).toBe(false);
  });

  it('キーの順が違うだけなら false', async () => {
    const published = await getPublished('sc-galleon');
    const reversed = published.deck.map(
      (n) => Object.fromEntries(Object.entries(n).reverse()) as typeof n,
    );
    expect((await saveDraft('sc-galleon', { deck: reversed })).changed).toBe(false);
  });

  it('外しても変わらない（libraryStatus だけ違う）', async () => {
    await unpublish('sc-galleon');
    expect((await getDraft('sc-galleon')).changed).toBe(false);
  });
});

describe('同じシナリオへの操作が重なる（別のタブなど）', () => {
  it('公開の書き込みを待つ間に届いた保存は、下書きにだけ入る（T11）', async () => {
    let release: () => void = () => {};
    const written: Scenario[] = [];
    setScenarioFileStore({
      write: (s) =>
        new Promise<void>((r) => {
          written.push(structuredClone(s));
          release = r;
        }),
    });
    const sc = await create();
    const publishing = publish(sc.id);
    await waitFor(() => expect(written).toHaveLength(1));
    const saving = saveDraft(sc.id, { title: '公開中に直した題名' });
    await new Promise((r) => setTimeout(r, 20));
    release();
    await publishing;
    await saving;
    expect((await getPublished(sc.id)).title).toBe(sc.title);
    expect(await getDraft(sc.id)).toMatchObject({
      draft: { title: '公開中に直した題名' },
      changed: true,
    });
    expect(written.map((s) => s.title)).toEqual([sc.title]);
  });
});

describe('下書きの保存の本文', () => {
  it.each([['"ab"'], ['[1]'], ['null']])(
    '本文 %s はオブジェクトでないので 422 で、何も変わらない',
    async (body) => {
      const sc = await create();
      const before = await getDraft(sc.id);
      const res = await fetch(`/api/scenarios/${sc.id}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      // ほかの API の本文の誤りと同じく 422（docs/plans/2026-10-10-APIスキーマの共用.md D5）
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ message: '本文はオブジェクトにしてください' });
      expect(await getDraft(sc.id)).toEqual(before);
    },
  );
});

describe('新規作成のシナリオ', () => {
  it('下書きだけができ（公開版なし）、結末「結末」と、それを指す結末のノードを1つずつ持ち、公開できる形', async () => {
    const view = await api.post<ScenarioDraftView>('/scenarios', { title: '作りたて' });
    expect(view).toMatchObject({ publication: 'none', changed: false });
    const sc = view.draft;
    await expect(getPublished(sc.id)).rejects.toMatchObject({ status: 404 });
    expect(await draftIds()).toContain(sc.id);
    expect(sc.endings).toEqual([{ id: expect.any(String), name: '結末' }]);
    const endingNodes = sc.deck.filter((n) => n.kind === 'ending');
    expect(endingNodes).toEqual([
      {
        id: expect.any(String),
        kind: 'ending',
        name: '結末',
        cards: [],
        endingId: sc.endings[0]?.id,
      },
    ]);
    expect(safeParseScenarioFile(`scenarios/${sc.id}.json`, sc).ok).toBe(true);
  });

  it('作るたびに別の id になり、既にある下書き・公開版の id と重ならない（T12）', async () => {
    const existing = new Set([...(await draftIds()), ...(await listedIds())]);
    const a = await create('一つ目');
    const b = await create('二つ目');
    expect(a.id).not.toBe(b.id);
    expect(existing.has(a.id) || existing.has(b.id)).toBe(false);
  });
});

describe('新規作成の id（nextFreeId）', () => {
  it('空いている id ならそのまま返す', () => {
    expect(
      nextFreeId(
        () => 'sc-1001',
        () => false,
      ),
    ).toBe('sc-1001');
  });

  it('使われている id は飛ばす（書き込んだ sc-1001.json をリロード後に上書きしない）', () => {
    let n = 1000;
    const taken = new Set(['sc-1001']);
    expect(
      nextFreeId(
        () => `sc-${++n}`,
        (id) => taken.has(id),
      ),
    ).toBe('sc-1002');
  });
});
