// セッション（docs/cartagraph/party-and-session.md, play-and-field.md）と、その前段の募集
// （docs/cartagraph/scenario-flow.md の募集→応募→確定。GM がシナリオからセッションを立てる手続きなのでここに置く。
// docs/process/rules/architecture.md「packages/domain の中の置き場所」）。

import type { AutoCombatState, CombatRecord } from '../autoCombat/model';
import type { CardDef } from '../card/model';
import type { ProposalHandling, SpaceModel } from '../scenario/model';

/** GMが出した募集 */
export interface Recruitment {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  gmId: string;
  gmName: string;
  partySize: { min: number; max: number };
  spaceModel: SpaceModel | null;
  recommendedCp: number;
  referenceTags: string[];
  prerequisiteTags: string[];
  /** 応募（ドライバー候補とPC） */
  applicants: { characterId: string; characterName: string; playerName: string }[];
  capacity: number;
  status: 'open' | 'closed';
  note?: string;
}

export type ParticipantRole = 'driver' | 'navigator' | 'gm';

export const PARTICIPANT_ROLE_LABEL: Record<ParticipantRole, string> = {
  driver: 'ドライバー',
  navigator: 'ナビゲーター',
  gm: 'GM',
};

export interface Participant {
  userId: string;
  name: string;
  role: ParticipantRole;
  characterId?: string;
  characterName?: string;
  lastSeenAt: string;
}

export type ProposalStatus = 'pending' | 'approved' | 'approved-unused' | 'rejected';

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: '承認待ち',
  approved: '採用済み',
  'approved-unused': '採用済み・今回は未使用',
  rejected: '却下',
};

/** 「新たな選択肢を提案」カードのプレイで生まれる提案 */
export interface Proposal {
  id: string;
  sessionId: string;
  byName: string;
  sceneName: string;
  text: string;
  presentedChoices: string[];
  status: ProposalStatus;
  /** 採用時に生成したカード名／却下理由 */
  resolution?: string;
  createdAt: string;
}

export type SessionMode = 'light' | 'dense';

export interface FeedItem {
  id: string;
  at: string;
  text: string;
  cardName?: string;
}

export interface SessionStatus {
  status: 'recruiting' | 'playing' | 'suspended' | 'ended';
}

/**
 * 人間GMのいないソロセッションに割り当てるダミーGM（docs/plans/2026-09-23-村スタート冒険者キャンペーン.md
 * 決定事項5）。提案の自動解決の可否は gmId ではなく Session.proposalHandling で判定する。
 * gmId がこれなら「人間GMのいないセッション」として、結末ノードへの遷移で終了する
 * （docs/cartagraph/play-and-field.md「次のシーンへ進む」）
 */
export const SYSTEM_GM_ID = 'system-gm';
export const SYSTEM_GM_NAME = '（自動進行）';

export interface Session {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  gmId: string;
  gmName: string;
  partyName: string;
  status: SessionStatus['status'];
  mode: SessionMode;
  /** セッション開始時にScenarioからコピーする（セッションスナップショットの一部） */
  proposalHandling: ProposalHandling;
  /** 進行中のシーン（例: "3-2 奥の扉"） */
  /** nodeId は「次のシーンへ進む」で移ったノード（それ以前から続くセッションでは無い） */
  currentScene: { index: number; total: number; name: string; path: string; nodeId?: string };
  /** 自動戦闘のシーンにいる間だけ存在する（仮ルール） */
  autoCombat?: AutoCombatState;
  /** これまでの自動戦闘のすべての挑戦（シーンを移っても残る） */
  combatHistory?: CombatRecord[];
  participants: Participant[];
  /** 場のゾーン別枚数 */
  field: { gmOnly: CardDef[]; plVisible: CardDef[] };
  /** ドライバーの手札 */
  hand: CardDef[];
  /** 卓上の描写（GMが用意した流れ） */
  flavor: string;
  proposals: Proposal[];
  feed: FeedItem[];
  lastActivityAt: string;
  /** 無反応で「中断」になる期限 */
  suspendAt: string;
}
