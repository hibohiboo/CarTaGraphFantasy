// セッション（docs/cartagraph/party-and-session.md, play-and-field.md）と、その前段の募集
// （docs/cartagraph/scenario-flow.md の募集→応募→確定。GM がシナリオからセッションを立てる手続きなのでここに置く。
// docs/process/rules/architecture.md「packages/domain の中の置き場所」）。

import type { AutoCombatState, CombatRecord } from '../autoCombat/model';
import type { CardDef } from '../card/model';
import type { ProposalHandling, ScenarioType, SpaceModel } from '../scenario/model';

/**
 * GMが出した募集。セッションとは別のもの（docs/cartagraph/scenario-flow.md「募集とセッション」）。
 * 通常の募集は、セッションを始めると開始済み（started）になる。どのセッションが始まったかは
 * Session.recruitmentId だけが持つ（同じつながりを両側に持たない）
 */
export interface Recruitment {
  id: string;
  /**
   * 通常の募集（応募を受けて GM が始める。募集1つからセッション1つ）か、GM 不在の募集（応募は無く、PL が自分の
   * PC ですぐ始める。受付中のまま残り続け、募集1つからセッションが複数）か（docs/cartagraph/scenario-flow.md
   * 「募集とセッション」）。GM 不在の募集は applicants が空で、capacity は 0
   */
  kind: 'normal' | 'gmless';
  /**
   * GM 不在の募集だけが持つ、提案の扱い（GM が後から裁定＝gm-required／提案不可＝disabled）。
   * 始めたセッションへコピーする（docs/cartagraph/play-and-field.md「GMレスセッションでの提案の扱い」）
   */
  proposalHandling?: 'gm-required' | 'disabled';
  scenarioId: string;
  scenarioTitle: string;
  gmId: string;
  gmName: string;
  partySize: { min: number; max: number };
  spaceModel: SpaceModel | null;
  recommendedCp: number;
  /** シナリオタイプ。募集を出すときにシナリオからコピーする（docs/cartagraph/scenario-type.md） */
  scenarioType: ScenarioType;
  prerequisiteTags: string[];
  /** 応募（ドライバー候補とPC）。userId は応募した人（借りたPCなら、PCの所有者とは別の人） */
  applicants: { characterId: string; characterName: string; userId: string; playerName: string }[];
  capacity: number;
  status: 'open' | 'started';
  /** GMが外したシーン（シナリオデッキのノードの id）。開始したセッションへ引き継ぐ */
  excludedNodeIds: string[];
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
  status: 'playing' | 'suspended' | 'ended';
}

/**
 * ソロ開始のセッションの GM 欄に入れるダミー（裁定する GM がいない印。docs/cartagraph/party-and-session.md
 * 「GM不在のセッションのGM」）。振る舞い（GM 不在の仮ルール・結末での終了など）は gmId ではなく
 * Session.gmless で判定する
 */
export const SYSTEM_GM_ID = 'system-gm';
export const SYSTEM_GM_NAME = '（自動進行）';

export interface Session {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  /** 始めた募集（ソロ開始のセッションには無い） */
  recruitmentId?: string;
  /** 募集でGMが外したシーン。シナリオを引くたびに sessionDeck で除く（ソロ開始のセッションには無い） */
  excludedNodeIds?: string[];
  gmId: string;
  gmName: string;
  /**
   * システムが進行するセッション（GM不在のセッション。ソロ開始と GM 不在の募集から始めたもの）か。
   * GM 不在の仮ルール・配る条件・自動戦闘・結末での自動終了・結末タグの即時反映はこれで判定する
   * （docs/cartagraph/solo-village.md「適用範囲」）
   */
  gmless: boolean;
  partyName: string;
  status: SessionStatus['status'];
  /**
   * 中断の理由（status が suspended のときだけ。docs/cartagraph/party-and-session.md「中断」）。
   * いま書き込むのは proposal（GM 不在の募集のセッションで提案の裁定を待つ）だけ
   */
  suspendedFor?: 'inactivity' | 'proposal';
  mode: SessionMode;
  /**
   * セッション開始時にコピーする（セッションスナップショットの一部）。ソロ開始はシナリオの値、GM 不在の募集は募集の値、
   * 通常の募集はシナリオの値（自動解決は GM必須に読み替える。docs/cartagraph/play-and-field.md「GMレスセッションでの提案の扱い」）
   */
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
