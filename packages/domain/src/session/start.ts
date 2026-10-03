// 募集からセッションを始めるときの検査と組み立て（docs/cartagraph/scenario-flow.md「募集とセッション」
// 「セッション開始までの全体フロー」5、party-and-session.md「ドライバーとナビゲーター」）。
// 画面（開始のフォーム）とサーバー（MSW の開始 API）の両方がここを使う。

import type { Participant, Recruitment } from './model';

export interface StartSelection {
  /** 参加させる PC（応募の characterId） */
  characterIds: string[];
  /** ドライバーの PC。characterIds の中から選ぶ */
  driverCharacterId?: string;
}

export type StartCheck = { ok: false; error: string } | { ok: true; warning?: string };

/**
 * 始められるかを判定する。エラーは上から順に最初の1つを返す。
 * 想定人数は目安なので、外れても注意を付けるだけで止めない（scenario-flow.md「シナリオのメタデータ」）
 */
export function checkStart(
  recruitment: Pick<Recruitment, 'status' | 'applicants' | 'partySize'>,
  selection: StartSelection,
): StartCheck {
  const { characterIds, driverCharacterId } = selection;
  if (recruitment.status !== 'open') return { ok: false, error: 'この募集はもう始まっています' };
  if (characterIds.length === 0) return { ok: false, error: '参加させるPCを選んでください' };
  if (!driverCharacterId) return { ok: false, error: 'ドライバーのPCを選んでください' };
  const applied = new Set(recruitment.applicants.map((a) => a.characterId));
  if (characterIds.some((id) => !applied.has(id)))
    return { ok: false, error: '応募に無いPCが含まれています' };
  if (!characterIds.includes(driverCharacterId))
    return { ok: false, error: 'ドライバーのPCは、参加させるPCの中から選んでください' };
  if (new Set(characterIds).size !== characterIds.length)
    return { ok: false, error: '同じPCが2回選ばれています' };

  const { min, max } = recruitment.partySize;
  const range = `想定人数（${min}〜${max}人）`;
  if (characterIds.length < min) return { ok: true, warning: `${range}に届いていません` };
  if (characterIds.length > max) return { ok: true, warning: `${range}を超えています` };
  return { ok: true };
}

/** パーティー名の初期値。GM が空欄のまま始めたときにも使う */
export const defaultPartyName = (driverCharacterName: string) => `${driverCharacterName}の一行`;

/**
 * 参加者の行。GM の行、ドライバーの行、ナビゲーターの行の順。
 * PC ごとに1行で、userId は PC の所有者ではなく応募した人（借りた PC で応募することもある）
 */
export function buildParticipants(v: {
  gm: { userId: string; name: string };
  selected: Recruitment['applicants'];
  driverCharacterId: string;
  at: string;
}): Participant[] {
  const row = (
    a: Recruitment['applicants'][number],
    role: 'driver' | 'navigator',
  ): Participant => ({
    userId: a.userId,
    name: a.playerName,
    role,
    characterId: a.characterId,
    characterName: a.characterName,
    lastSeenAt: v.at,
  });
  const driver = v.selected.filter((a) => a.characterId === v.driverCharacterId);
  const navigators = v.selected.filter((a) => a.characterId !== v.driverCharacterId);
  return [
    { userId: v.gm.userId, name: v.gm.name, role: 'gm', lastSeenAt: v.at },
    ...driver.map((a) => row(a, 'driver')),
    ...navigators.map((a) => row(a, 'navigator')),
  ];
}
