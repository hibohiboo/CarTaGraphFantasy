// 募集からセッションを始めるときの検査と組み立て（docs/cartagraph/scenario-flow.md「募集とセッション」
// 「セッション開始までの全体フロー」5、party-and-session.md「ドライバーとナビゲーター」）。
// 画面（開始のフォーム）とサーバー（MSW の開始 API）の両方がここを使う。

import type { Character } from '../character/model';
import type { EndingDef } from '../scenario/model';
import { replayBlockedMessage } from '../scenario/replay';
import type { Participant, Recruitment, Session } from './model';

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

/**
 * GM 不在の募集から、この PC で始められるか（docs/cartagraph/scenario-flow.md「募集とセッション」）。
 * エラーは上から順に最初の1つを返す。blockedBy は replayBlockedBy（scenario/replay.ts）の結果
 */
export function checkPlayFromRecruitment(
  recruitment: Pick<Recruitment, 'kind'>,
  character: Pick<Character, 'name' | 'ownerId'>,
  v: { meId: string; blockedBy: EndingDef | null },
): { ok: false; error: string } | { ok: true } {
  if (recruitment.kind !== 'gmless')
    return { ok: false, error: 'この募集は GM 不在の募集ではありません' };
  // 即時反映の前提「所有者＝ドライバー」を崩さないため、借りた PC は使えない（solo-village.md「適用範囲」）
  if (character.ownerId !== v.meId)
    return { ok: false, error: 'GM 不在の募集では、自分が所有者の PC だけで遊べます' };
  if (v.blockedBy) return { ok: false, error: replayBlockedMessage(character.name, v.blockedBy) };
  return { ok: true };
}

/**
 * 中断したセッションを再開できるか（docs/cartagraph/party-and-session.md「中断」）。再開するのはドライバー。
 * 提案の裁定待ちで中断したセッションは、GM が裁定してから再開する。エラーは上から順に最初の1つを返す
 */
export function checkResume(
  session: Pick<Session, 'status' | 'suspendedFor'> & {
    participants: Pick<Session['participants'][number], 'userId' | 'role'>[];
    proposals: Pick<Session['proposals'][number], 'status'>[];
  },
  meId: string,
): { ok: false; status: 403 | 422; error: string } | { ok: true } {
  if (!session.participants.some((p) => p.role === 'driver' && p.userId === meId))
    return { ok: false, status: 403, error: 'ドライバーだけが再開できます' };
  if (session.status !== 'suspended')
    return { ok: false, status: 422, error: '中断していないセッションは再開できません' };
  // 無反応による中断は、仕様では GM がいつでも再開する（party-and-session.md「中断」）。
  // 無反応の中断そのものが未実装なので、まだ再開させない
  if (session.suspendedFor !== 'proposal')
    return { ok: false, status: 422, error: 'この中断の再開のしかたは、まだ決まっていません' };
  if (session.proposals.some((p) => p.status === 'pending'))
    return { ok: false, status: 422, error: 'GM の裁定を待っています' };
  return { ok: true };
}
