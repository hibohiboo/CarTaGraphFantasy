// シナリオのコピーの API（docs/plans/2026-10-14-シナリオのコピー.md T1〜T7、
// docs/cartagraph/scenario-flow.md「シナリオのコピー」）。コピー元は、他人の公開版（灰色館の一夜）と、
// 自分の公開版（鉄鎖のガレオン船。公開し直しを挟むテストはこちら）。

import type { Scenario } from '@cartagraph/domain/scenario/model';
import { describe, expect, it } from 'vitest';
import type { ScenarioDraftView, ScenarioSaveResult } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { setScenarioFileStore } from '../mocks/handlers';
import { draftOf, editNode, getVersion, patchDraft, publish } from './scenarioVersionHelpers';

const copy = (id: string) => api.post<ScenarioDraftView>(`/scenarios/${id}/copy`);
const getPublished = (id: string) => api.get<Scenario>(`/scenarios/${id}`);
const listedIds = async () => (await api.get<Scenario[]>('/scenarios')).map((s) => s.id);
const draftCount = async () => (await api.get<ScenarioDraftView[]>('/scenario-drafts')).length;
/** 公開のときの見分けに使わない項目を除いた中身 */
const content = ({
  id: _i,
  authorId: _a,
  authorName: _n,
  title: _t,
  copiedFrom: _c,
  ...rest
}: Scenario) => ({ ...rest, libraryStatus: undefined, updatedAt: undefined });

describe('他人のシナリオのコピー（T1）', () => {
  it('灰色館をコピーすると、自分の下書き（公開版なし）になり、親を覚える', async () => {
    const source = await getPublished('sc-gray-mansion');
    const before = await draftCount();
    const view = await copy('sc-gray-mansion');
    const d = view.draft;
    expect(view).toMatchObject({ publication: 'none', changed: false });
    expect(d.id).not.toBe('sc-gray-mansion');
    expect(d).toMatchObject({
      authorId: 'u-me',
      authorName: 'ユウ',
      title: '灰色館の一夜のコピー',
      libraryStatus: 'draft',
      copiedFrom: { scenarioId: 'sc-gray-mansion', version: 1 },
    });
    expect(content(d)).toEqual(content(source));
    expect(await draftCount()).toBe(before + 1);
    expect(await getPublished('sc-gray-mansion')).toEqual(source);
    expect((await draftOf(d.id)).copiedFrom).toEqual({ scenarioId: 'sc-gray-mansion', version: 1 });
  });

  it('題名以外の中身（結末タグ・前提タグ・再挑戦不可・初期装備）は元と同じ', async () => {
    const source = await getPublished('sc-village-start');
    const d = (await copy('sc-village-start')).draft;
    expect(d.endings).toEqual(source.endings);
    expect(d.prerequisiteTags).toEqual(source.prerequisiteTags);
    expect(d.deck).toEqual(source.deck);
  });
});

describe('コピーは独立している（T2）', () => {
  it('コピーの下書きを保存しても元は変わらず、公開するとシナリオ集に載り、公開版・版1・保存先に親が写る', async () => {
    const written: Scenario[] = [];
    setScenarioFileStore({ write: async (s) => void written.push(structuredClone(s)) });
    const source = await getPublished('sc-galleon');
    const id = (await copy('sc-galleon')).draft.id;
    expect(await listedIds()).not.toContain(id);
    await patchDraft(id, { summary: 'コピーだけの概要' });
    expect(await getPublished('sc-galleon')).toEqual(source);

    await publish(id);
    const parent = { scenarioId: 'sc-galleon', version: 1 };
    expect(await listedIds()).toContain(id);
    expect((await getPublished(id)).copiedFrom).toEqual(parent);
    expect((await getVersion(id, 1)).copiedFrom).toEqual(parent);
    expect(written.at(-1)?.copiedFrom).toEqual(parent);
    expect((await listedIds()).filter((x) => x === 'sc-galleon')).toHaveLength(1);
    expect((await getPublished('sc-galleon')).summary).toBe(source.summary);
  });
});

describe('コピーできる元（T3）', () => {
  it('シナリオ集から外した公開版もコピーできる（コピーは下書きのまま）', async () => {
    await api.post('/scenarios/sc-galleon/unpublish');
    const d = (await copy('sc-galleon')).draft;
    expect(d.libraryStatus).toBe('draft');
    expect(d.copiedFrom).toEqual({ scenarioId: 'sc-galleon', version: 1 });
  });

  it('いちばん新しい公開版をコピーする（公開し直して版2にした後は、版2の中身）', async () => {
    await patchDraft('sc-galleon', { summary: '版2の概要' });
    await publish('sc-galleon');
    const d = (await copy('sc-galleon')).draft;
    expect(d.copiedFrom).toEqual({ scenarioId: 'sc-galleon', version: 2 });
    expect(d.summary).toBe('版2の概要');
  });

  it('下書きに未公開の変更があっても、コピーに写るのは公開版', async () => {
    const published = await getPublished('sc-galleon');
    await patchDraft('sc-galleon', { summary: '公開していない変更' });
    const d = (await copy('sc-galleon')).draft;
    expect(d.summary).toBe(published.summary);
    expect(d.copiedFrom?.version).toBe(1);
  });

  it('画像を持つ公開版は、コピーにも画像が残る', async () => {
    const url = 'data:image/png;base64,AAAA';
    const draft = await draftOf('sc-galleon');
    await patchDraft('sc-galleon', {
      deck: editNode(draft.deck, draft.deck[0]?.id ?? '', (n) => ({
        ...n,
        cards: [{ id: 'g-img', kind: 'npc', name: '絵', tags: [], portraitUrl: url }],
      })),
    });
    await publish('sc-galleon');
    const d = (await copy('sc-galleon')).draft;
    expect(d.deck[0]?.cards[0]?.portraitUrl).toBe(url);
  });
});

describe('コピーできない元（T4）', () => {
  it('公開版の無い下書き・どこにも無い id は 404、デモ・テスト専用のシナリオは 422。何も増えない', async () => {
    const before = await draftCount();
    await expect(copy('sc-draft-well')).rejects.toMatchObject({ status: 404 });
    await expect(copy('sc-nothing')).rejects.toMatchObject({ status: 404 });
    await expect(copy('sc-village-always-win')).rejects.toMatchObject({
      status: 422,
      message: 'デモ用のシナリオはコピーできません',
    });
    expect(await draftCount()).toBe(before);
  });

  it('公開していないコピーのコピーは 404', async () => {
    const id = (await copy('sc-gray-mansion')).draft.id;
    await expect(copy(id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('親の記録は変わらない（T4b）', () => {
  it('親を公開し直しても、シナリオ集から外しても、コピーの親は版1のまま。親の版1は読める', async () => {
    const id = (await copy('sc-galleon')).draft.id;
    await patchDraft('sc-galleon', { summary: '版2の概要' });
    await publish('sc-galleon');
    await api.post('/scenarios/sc-galleon/unpublish');
    expect((await draftOf(id)).copiedFrom).toEqual({ scenarioId: 'sc-galleon', version: 1 });
    expect((await getVersion('sc-galleon', 1)).id).toBe('sc-galleon');
  });
});

describe('孫（T5）', () => {
  it('コピーを公開してコピーすると、親は直接の親（最初のコピー）だけで、祖先は持たない', async () => {
    const child = (await copy('sc-galleon')).draft.id;
    await publish(child);
    const grandchild = (await copy(child)).draft;
    expect(grandchild.copiedFrom).toEqual({ scenarioId: child, version: 1 });
  });
});

describe('親はサーバーが決める（T6）', () => {
  it.each([
    ['別の親', { scenarioId: 'sc-other', version: 5 }],
    ['null', null],
    ['不正な形', { version: 0 }],
  ])('PATCH に copiedFrom（%s）を書いても変わらず、422 にもならない', async (_, copiedFrom) => {
    const id = (await copy('sc-galleon')).draft.id;
    const saved = await patchDraft(id, { copiedFrom, summary: '直した' });
    expect(saved.draft.copiedFrom).toEqual({ scenarioId: 'sc-galleon', version: 1 });
    expect(saved.draft.summary).toBe('直した');
  });

  it('キーを送らなくても変わらない', async () => {
    const id = (await copy('sc-galleon')).draft.id;
    const saved = await patchDraft(id, { summary: '直した' });
    expect(saved.draft.copiedFrom).toEqual({ scenarioId: 'sc-galleon', version: 1 });
  });

  it('親のない下書きに copiedFrom を付けようとしても付かない', async () => {
    const created = await api.post<ScenarioDraftView>('/scenarios', { title: '自作' });
    const saved = await patchDraft(created.draft.id, {
      copiedFrom: { scenarioId: 'sc-galleon', version: 1 },
    });
    expect(saved.draft).not.toHaveProperty('copiedFrom');
  });

  it('公開すると、公開版・版・保存先に親が渡る', async () => {
    const written: Scenario[] = [];
    setScenarioFileStore({ write: async (s) => void written.push(structuredClone(s)) });
    const id = (await copy('sc-galleon')).draft.id;
    const result = await api.post<ScenarioSaveResult>(`/scenarios/${id}/publish`);
    const parent = { scenarioId: 'sc-galleon', version: 1 };
    expect(result.scenario.copiedFrom).toEqual(parent);
    expect(written).toHaveLength(1);
    expect(written[0]?.copiedFrom).toEqual(parent);
  });
});

describe('id（T7）', () => {
  it('続けて2回コピーしても、別の id になる', async () => {
    const a = (await copy('sc-gray-mansion')).draft.id;
    const b = (await copy('sc-gray-mansion')).draft.id;
    expect(a).not.toBe(b);
    const ids = (await api.get<ScenarioDraftView[]>('/scenario-drafts')).map((v) => v.draft.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
