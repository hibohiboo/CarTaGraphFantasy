// 自動戦闘のテストで共有する手順（AutoCombat.test.tsx・playTable.test.tsx）。
// 勝敗は乱数によらず決まるテスト用シナリオ（mocks/fixtures.ts の sc-exam-always-*）を使う。

import type { Session } from '@cartagraph/domain/session/model';
import { api } from '@/shared/api/api';

export const PREFIX: Record<string, string> = {
  'sc-exam-always-win': 'aw',
  'sc-exam-always-lose': 'al',
  'sc-exam-always-timeout': 'at',
  'sc-exam-no-starter': 'ns',
};

/** ソロで開始し、試験シーン（自動戦闘）まで API で進める */
export async function startAtExam(scenarioId: string) {
  const s = await api.post<Session>(`/scenarios/${scenarioId}/start-solo`, { name: '新人' });
  return api.post<Session>(`/sessions/${s.id}/play`, { cardId: `${PREFIX[scenarioId]}-to-guild` });
}

/** 優先順位（カードID）を、すべて条件「いつでも」で送る */
export const runAutoCombat = (s: Session, cardIds: string[]) =>
  api.post<Session>(`/sessions/${s.id}/auto-combat`, {
    priority: cardIds.map((cardId) => ({ cardId, when: 'always' })),
  });
