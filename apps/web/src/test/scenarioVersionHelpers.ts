// シナリオの版のテストで共有する手順（docs/plans/2026-10-14-セッションの独立.md G8）。
// 公開し直しを挟むテストは、自分が作者のシナリオを API で公開して行う（db を直接書き換えない）。

import type { DeckNode, Scenario } from '@cartagraph/domain/scenario/model';
import type { ScenarioDraftView } from '@/entities/scenario/api/types';
import { api } from '@/shared/api/api';
import { scenarios } from '../mocks/fixtures';

/** 入れ子のノードを id で探して書き換える */
export function editNode(deck: DeckNode[], id: string, f: (n: DeckNode) => DeckNode): DeckNode[] {
  return deck.map((n) =>
    n.id === id ? f(n) : { ...n, ...(n.children && { children: editNode(n.children, id, f) }) },
  );
}

/** 公開した版を読む（GET /scenarios/:id/versions/:version） */
export const getVersion = (id: string, version: number | string) =>
  api.get<Scenario>(`/scenarios/${id}/versions/${version}`);

export const publish = (id: string) => api.post(`/scenarios/${id}/publish`);

export const patchDraft = (id: string, body: Record<string, unknown>) =>
  api.patch<ScenarioDraftView>(`/scenarios/${id}/draft`, body);

export const draftOf = async (id: string) =>
  (await api.get<ScenarioDraftView>(`/scenarios/${id}/draft`)).draft;

/** 公開の検査に通らない「迷い道」のカード（sc-village-always-win が持つ）を、入れ子のノードも含めて外す */
const withoutLostCard = (deck: DeckNode[]): DeckNode[] =>
  deck.map((n) => ({
    ...n,
    cards: n.cards.filter((c) => c.id !== 'vw-lost'),
    ...(n.children && { children: withoutLostCard(n.children) }),
  }));

/**
 * fixtures のシナリオの写しを、自分が作者の新しいシナリオ（下書き）として作る。fixtures にしか無いシナリオ
 * （sc-mansion-mine など）は公開できないので、公開し直しを挟むテストはこの写しで行う。作ったシナリオの id を返す
 */
export async function createDraftCopy(sourceId: string): Promise<string> {
  const base = scenarios.find((s) => s.id === sourceId);
  if (!base) throw new Error(`${sourceId} がありません`);
  const {
    id: _id,
    authorId: _a,
    authorName: _n,
    libraryStatus: _l,
    updatedAt: _u,
    ...body
  } = structuredClone(base);
  const created = await api.post<ScenarioDraftView>('/scenarios', { title: body.title });
  const id = created.draft.id;
  await patchDraft(id, { ...body, deck: withoutLostCard(body.deck) });
  return id;
}

/**
 * 村はずれの一歩の写し（sc-village-always-win の deck・endings。試験官の HP が 1）を、自分が作者の新しい
 * シナリオとして公開し、版1にする。作ったシナリオの id を返す
 */
export async function publishVillageCopy(): Promise<string> {
  const id = await createDraftCopy('sc-village-always-win');
  await publish(id);
  return id;
}

/** 下書きのデッキ・結末を直して公開し直す（新しい版ができる） */
export async function republishWith(
  id: string,
  edit: (draft: Scenario) => Partial<Pick<Scenario, 'deck' | 'endings' | 'summary'>>,
): Promise<void> {
  await patchDraft(id, edit(await draftOf(id)));
  await publish(id);
}
