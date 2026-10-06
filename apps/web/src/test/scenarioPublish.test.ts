// シナリオの公開で JSON に書き込む：API（docs/plans/2026-10-06-シナリオ公開のJSON書き込み.md）。
// 保存先は既定で null（デモ。setup.ts が毎回戻す）。書き込みを確かめるテストだけ、偽の保存先を差し込む。

import type { CardDef } from '@cartagraph/domain/card/model';
import type { Scenario } from '@cartagraph/domain/scenario/model';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ScenarioSaveResult } from '@/entities/scenario/api/types';
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

const create = (title = '新しい公開テスト') => api.post<Scenario>('/scenarios', { title });
const publish = (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/publish`);
const unpublish = (id: string) => api.post<ScenarioSaveResult>(`/scenarios/${id}/unpublish`);
const patch = (id: string, body: Partial<Scenario>) =>
  api.patch<ScenarioSaveResult>(`/scenarios/${id}`, body);
const get = (id: string) => api.get<Scenario>(`/scenarios/${id}`);
const publishedIds = async () => (await api.get<Scenario[]>('/scenarios')).map((s) => s.id);
const mineIds = async () => (await api.get<Scenario[]>('/scenarios?mine=1')).map((s) => s.id);

/** 存在しないノードを指す選択肢を持つデッキ（参照の検査に落ちる） */
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

describe('公開（POST /api/scenarios/:id/publish）', () => {
  it('下書きを公開すると published になり、保存先に1回渡り、シナリオ集の一覧に出る', async () => {
    const written = fakeStore();
    const sc = await create();
    const res = await publish(sc.id);
    expect(res.scenario.libraryStatus).toBe('published');
    expect(res.file).toEqual({ saved: true, path: `scenarios/${sc.id}.json` });
    expect(written).toEqual([res.scenario]);
    expect(await publishedIds()).toContain(sc.id);
    expect((await get(sc.id)).libraryStatus).toBe('published');
  });

  it('保存先が無い（デモ）なら公開はでき、保存されなかったことを返す', async () => {
    const sc = await create();
    const res = await publish(sc.id);
    expect(res.scenario.libraryStatus).toBe('published');
    expect(res.file).toEqual({ saved: false });
    expect(await publishedIds()).toContain(sc.id);
  });

  it('公開中をもう一度公開しても誤りにならず、書き直す', async () => {
    const written = fakeStore();
    const sc = await create();
    await publish(sc.id);
    const res = await publish(sc.id);
    expect(res.scenario.libraryStatus).toBe('published');
    expect(written).toHaveLength(2);
  });

  it('カード画像の data URL はファイルに書かず、メモリには残す（D4）', async () => {
    const written = fakeStore();
    const sc = await create();
    const img = 'data:image/png;base64,AAAA';
    const card: CardDef = { id: 'c-pic', kind: 'npc', name: '絵', tags: [], portraitUrl: img };
    await patch(sc.id, {
      deck: sc.deck.map((n, i) => (i === 0 ? { ...n, cards: [card] } : n)),
    });
    await publish(sc.id);
    expect(written[0]?.deck[0]?.cards[0]).not.toHaveProperty('portraitUrl');
    expect((await get(sc.id)).deck[0]?.cards[0]?.portraitUrl).toBe(img);
  });

  it('参照が切れたシナリオは 422 で、保存先に渡らず、下書きのまま（デモでも同じ）', async () => {
    const sc = await create();
    await patch(sc.id, { deck: brokenDeck(sc) });
    await expect(publish(sc.id)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('nowhere'),
    });
    const written = fakeStore();
    await expect(publish(sc.id)).rejects.toMatchObject({ status: 422 });
    expect(written).toEqual([]);
    expect((await get(sc.id)).libraryStatus).toBe('draft');
    expect(await publishedIds()).not.toContain(sc.id);
  });

  it('保存先が失敗したら 500 で、メモリは下書きのまま', async () => {
    fakeStore('ディスクがいっぱい');
    const sc = await create();
    await expect(publish(sc.id)).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('ディスクがいっぱい'),
    });
    expect((await get(sc.id)).libraryStatus).toBe('draft');
  });

  it('fixtures にしか無いデモの下書き（涸れ井戸）は 422 で公開できない（D7）', async () => {
    const written = fakeStore();
    await expect(publish('sc-draft-well')).rejects.toMatchObject({
      status: 422,
      message: 'デモ用のシナリオは公開・非公開を変えられません',
    });
    expect(written).toEqual([]);
    expect((await get('sc-draft-well')).libraryStatus).toBe('draft');
  });

  it('製作者でないシナリオ（他人の灰色館・system の村はずれ）は 403 で、何も変わらない（D8）', async () => {
    const written = fakeStore();
    for (const id of ['sc-gray-mansion', 'sc-village-start']) {
      const before = await get(id);
      await expect(publish(id)).rejects.toMatchObject({
        status: 403,
        message: '製作者でないため変更できません',
      });
      await expect(unpublish(id)).rejects.toMatchObject({ status: 403 });
      await expect(patch(id, { title: '乗っ取り' })).rejects.toMatchObject({ status: 403 });
      expect(await get(id)).toEqual(before);
    }
    expect(written).toEqual([]);
  });

  it('存在しない id は 404', async () => {
    await expect(publish('sc-nowhere')).rejects.toMatchObject({ status: 404 });
    await expect(unpublish('sc-nowhere')).rejects.toMatchObject({ status: 404 });
    await expect(patch('sc-nowhere', { title: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('非公開（POST /api/scenarios/:id/unpublish）', () => {
  it('公開中を非公開にすると draft で書き直し、シナリオ集の一覧から消え、自分の一覧には残る', async () => {
    const written = fakeStore();
    const res = await unpublish('sc-galleon');
    expect(res.scenario.libraryStatus).toBe('draft');
    expect(res.file).toEqual({ saved: true, path: 'scenarios/sc-galleon.json' });
    expect(written.map((s) => [s.id, s.libraryStatus])).toEqual([['sc-galleon', 'draft']]);
    expect(await publishedIds()).not.toContain('sc-galleon');
    expect(await mineIds()).toContain('sc-galleon');
  });

  it('デモでは保存されなかったことを返す', async () => {
    expect((await unpublish('sc-galleon')).file).toEqual({ saved: false });
  });

  it('非公開でも updatedAt が新しくなる（固定の日時のガレオンで確かめる）', async () => {
    const before = await get('sc-galleon');
    expect((await unpublish('sc-galleon')).scenario.updatedAt).not.toBe(before.updatedAt);
  });

  it('デモ用の下書き（涸れ井戸）の非公開も 422 で、文は非公開の操作に合う', async () => {
    await expect(unpublish('sc-draft-well')).rejects.toMatchObject({
      status: 422,
      message: 'デモ用のシナリオは公開・非公開を変えられません',
    });
  });

  it('下書きを非公開にしても誤りにならない', async () => {
    const sc = await create();
    expect((await unpublish(sc.id)).scenario.libraryStatus).toBe('draft');
  });

  it('保存先が失敗したら 500 で、公開中のまま', async () => {
    fakeStore('書けない');
    await expect(unpublish('sc-galleon')).rejects.toMatchObject({ status: 500 });
    expect((await get('sc-galleon')).libraryStatus).toBe('published');
  });
});

describe('保存（PATCH /api/scenarios/:id）', () => {
  it('公開中のシナリオを保存すると保存先に渡り、updatedAt が新しくなる', async () => {
    const written = fakeStore();
    const before = await get('sc-galleon');
    const res = await patch('sc-galleon', { title: '鉄鎖のガレオン船（改）' });
    expect(res.scenario.title).toBe('鉄鎖のガレオン船（改）');
    expect(res.scenario.updatedAt).not.toBe(before.updatedAt);
    expect(res.file).toEqual({ saved: true, path: 'scenarios/sc-galleon.json' });
    expect(written.map((s) => s.title)).toEqual(['鉄鎖のガレオン船（改）']);
  });

  it('下書きの保存は保存先に渡らず、file は null。参照が切れていても保存できる（下書きは検査しない）', async () => {
    const written = fakeStore();
    const sc = await create();
    const res = await patch(sc.id, { deck: brokenDeck(sc) });
    expect(res.file).toBeNull();
    expect(written).toEqual([]);
    expect((await get(sc.id)).deck[0]?.cards.map((c) => c.id)).toEqual(['c-broken']);
  });

  it('本文の libraryStatus は無視する（下書き側・公開中側の両方）', async () => {
    const sc = await create();
    await patch(sc.id, { libraryStatus: 'published' });
    expect((await get(sc.id)).libraryStatus).toBe('draft');
    await patch('sc-galleon', { libraryStatus: 'draft' });
    expect((await get('sc-galleon')).libraryStatus).toBe('published');
  });

  it('公開中のシナリオで参照が切れる保存は 422 で、保存先に渡らず、メモリの deck も変わらない', async () => {
    const written = fakeStore();
    const before = await get('sc-galleon');
    await expect(patch('sc-galleon', { deck: brokenDeck(before) })).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('nowhere'),
    });
    expect(written).toEqual([]);
    expect((await get('sc-galleon')).deck).toEqual(before.deck);
  });

  it('保存先が失敗したら 500 で、題名は変わらない', async () => {
    fakeStore('書けない');
    const before = await get('sc-galleon');
    await expect(patch('sc-galleon', { title: 'x' })).rejects.toMatchObject({ status: 500 });
    expect((await get('sc-galleon')).title).toBe(before.title);
  });
});

describe('同じシナリオへの操作が重なる（別のタブなど）', () => {
  it('公開の書き込みを待っている間に届いた保存は、公開の後に処理され、どちらも失われない', async () => {
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
    const saving = patch(sc.id, { title: '公開中に直した題名' });
    await new Promise((r) => setTimeout(r, 20));
    release();
    await publishing;
    await waitFor(() => expect(written).toHaveLength(2));
    release();
    await saving;
    const now = await get(sc.id);
    expect([now.libraryStatus, now.title]).toEqual(['published', '公開中に直した題名']);
    expect(written.map((s) => [s.libraryStatus, s.title])).toEqual([
      ['published', sc.title],
      ['published', '公開中に直した題名'],
    ]);
  });
});

describe('保存の本文', () => {
  it.each([['"ab"'], ['[1]'], ['null']])(
    '本文 %s はオブジェクトでないので 400 で、何も変わらない',
    async (body) => {
      const sc = await create();
      const res = await fetch(`/api/scenarios/${sc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(res.status).toBe(400);
      expect(await get(sc.id)).toEqual(sc);
    },
  );
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
