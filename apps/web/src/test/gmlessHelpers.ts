// GM 不在の募集のテストで共有する手順（gmlessRecruitment.test.ts・pages.test.tsx）。
// docs/plans/2026-10-04-GM不在の募集.md「5. 新規テストケース」の「結末タグを得る手順」。

import type { Recruitment, Session } from '@cartagraph/domain/session/model';
import { api } from '@/shared/api/api';

/** 自分（u-me）が GM の GM 不在の募集を出す。提案の扱いの初期値は「GM が後から裁定」 */
export const createGmlessRecruitment = (scenarioId: string, over: object = {}) =>
  api.post<Recruitment>(`/scenarios/${scenarioId}/recruitments`, {
    kind: 'gmless',
    proposalHandling: 'gm-required',
    ...over,
  });

export const playFromRecruitment = (recruitmentId: string, characterId: string) =>
  api.post<Session>(`/recruitments/${recruitmentId}/play`, { characterId });

/**
 * 結末タグ「冒険者になった」を得させる。sc-village-always-win（村はずれの一歩の複製。試験官の HP が 1）の
 * GM 不在の募集をこの PC で遊び、結末まで進める。結末タグの文字列が同じなので、本物の村はずれの一歩でも
 * 再挑戦不可になる
 */
export async function clearVillageWith(characterId: string) {
  const rc = await createGmlessRecruitment('sc-village-always-win');
  const s = await playFromRecruitment(rc.id, characterId);
  for (const id of [
    'vs-to-square',
    'vs-to-quest-0',
    'vs-quest-0-body',
    'vs-to-shop',
    'vs-learn-c-slash',
    'vs-shop-leave',
    'vs-to-guild',
    'vs-to-exam',
  ])
    await api.post(`/sessions/${s.id}/play`, { cardId: id });
  await api.post(`/sessions/${s.id}/auto-combat`, {
    priority: [{ cardId: 'c-slash', when: 'always' }],
  });
  return api.post<Session>(`/sessions/${s.id}/play`, { cardId: 'vs-accept' });
}
