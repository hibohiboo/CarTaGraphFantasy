// CarTaGraphFantasy のドメイン型。
// 仕様の正は docs/ 配下（SSOT）。ここは docs/cartagraph/ の用語をそのまま型に落としたもので、
// 用語の意味を変える場合は docs 側を先に更新する。
// シナリオとそれが含む型は scenarioSchema.ts の zod スキーマが正で、ここでは z.infer で導く
// （docs/plans/2026-10-03-シナリオのJSON管理.md D2）。各フィールドの説明もスキーマ側にある。

import type { z } from 'zod';
import type {
  autoCombatEnemySchema,
  cardConditionSchema,
  cardDefSchema,
  cardKindSchema,
  checkSpecSchema,
  combatEffectSchema,
  deckNodeKindSchema,
  deckNodeSchema,
  diceExprSchema,
  endingDefSchema,
  hpConditionSchema,
  priorityEntrySchema,
  proposalHandlingSchema,
  scenarioSchema,
  soloEffectSchema,
  spaceModelSchema,
} from './scenarioSchema';

/** 利用者ロール（docs/cartagraph/graph.md「グラフの利用者とロール別の見え方」） */
export type UserRole = 'pl' | 'gm' | 'creator' | 'admin';

/** カード種別（docs/cartagraph/card-and-deck.md, card-face-back.md の一覧に対応） */
export type CardKind = z.infer<typeof cardKindSchema>;

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  character: 'キャラクター',
  skill: 'スキル',
  trait: '特徴',
  item: 'アイテム',
  equipment: '装備',
  choice: '選択肢',
  npc: 'NPC',
  info: '情報',
  enemy: 'エネミー',
  scene: 'シーン',
  location: 'ロケーション',
  relation: '関係性',
};

/** 探索者の能力値（docs/cartagraph/exploration-check.md） */
export interface Abilities {
  body: number; // 体
  skill: number; // 技
  mind: number; // 心
}

/** 選択肢カードに紐づく判定（能力値＋2d6 vs 目標値） */
export type CheckSpec = z.infer<typeof checkSpecSchema>;

/** カード1枚。生成元（作者／GM／進化）に関わらず同じ構造を持つ */
export type CardDef = z.infer<typeof cardDefSchema>;

/**
 * 配る条件・使える条件（docs/cartagraph/solo-village.md、仮ルール）。
 * 判定の対象はキャラクターデッキと GM専用ゾーンの達成カード。すべての項目を満たせば真
 */
export type CardCondition = z.infer<typeof cardConditionSchema>;

/** GM不在のソロで、選択肢カードを選んだときの成長の効果（docs/cartagraph/solo-village.md、仮ルール） */
export type SoloEffect = z.infer<typeof soloEffectSchema>;

/** ダイス式（例：2d6+1 は { count: 2, sides: 6, bonus: 1 }） */
export type DiceExpr = z.infer<typeof diceExprSchema>;

/** 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）でカードが持つ効果。攻撃と回復のみ */
export type CombatEffect = z.infer<typeof combatEffectSchema>;

/**
 * 優先順位リストの1行に付ける「使う条件」（自分のHPの段階。docs/cartagraph/auto-combat.md、仮ルール）。
 * half＝HPが最大の半分以下、quarter＝1/4以下
 */
export type HpCondition = z.infer<typeof hpConditionSchema>;

export const HP_CONDITION_LABEL: Record<HpCondition, string> = {
  always: 'いつでも',
  half: 'HPが半分以下',
  quarter: 'HPが1/4以下',
};

/** 優先順位リストの1行 */
export type PriorityEntry = z.infer<typeof priorityEntrySchema>;

/** 自動戦闘の相手（1体・固定の優先順位リスト。仮ルール） */
export type AutoCombatEnemy = z.infer<typeof autoCombatEnemySchema>;

/** 自動戦闘の1手。使えるカードが無くラウンドの行動を終えた記録は effect: 'pass' */
export interface CombatLogEntry {
  round: number;
  count: number;
  actor: 'pl' | 'enemy';
  actorName: string;
  /** effect が 'pass' のときは空文字 */
  cardName: string;
  effect: CombatEffect['type'] | 'pass';
  /** ダイスの出目 */
  rolls: number[];
  /** 実際に与えたダメージ／回復した量（HPの下限・上限で切り詰めた後） */
  amount: number;
  /** 行動後の双方のHP */
  plHp: number;
  enemyHp: number;
}

export type AutoCombatOutcome = 'win' | 'lose' | 'timeout';

/** 自動戦闘1回分の記録。セッションの記録として消さずに残す（docs/concept「セッションログの方針」） */
export interface CombatRecord {
  nodeId: string;
  /** そのシーンで何回目の挑戦か */
  attempt: number;
  outcome: AutoCombatOutcome;
  rounds: number;
  log: CombatLogEntry[];
}

/** セッションが自動戦闘のシーンにいる間の状態（仮ルール） */
export interface AutoCombatState {
  nodeId: string;
  /** 場（field.plVisible）のエネミーカードのID。エネミーの実体は場の1か所だけに置く */
  enemyCardId: string;
  status: 'awaiting-priority' | 'won';
  attempts: number;
  lastResult?: { outcome: AutoCombatOutcome; rounds: number; log: CombatLogEntry[] };
}

/** 典型ロールの通称（PCが持つデータから導出する。固定属性ではない） */
export type CharacterArchetype = 'traveler' | 'explorer' | 'adventurer';

export const ARCHETYPE_LABEL: Record<CharacterArchetype, string> = {
  traveler: '旅人',
  explorer: '探索者',
  adventurer: '冒険者',
};

export interface Character {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  /** 能力値を持たなければ旅人 */
  abilities?: Abilities;
  hp?: { current: number; max: number };
  /** 戦闘用の基本行動値（冒険者のみ） */
  baseActionValue?: number;
  /** キャラクターデッキ（所有・構成デッキ） */
  deck: CardDef[];
  /** 称号タグ（特徴カードの一種。所有者が反映を選んだもの） */
  titles: string[];
  /** 結末タグ（後続シナリオの前提タグと突き合わせる） */
  endingTags: string[];
  cp: { total: number; spent: number };
  createdAt: string;
}

/** 戦闘スキルカードを持つか（冒険者の条件） */
export function hasCombatSkill(c: Pick<Character, 'deck'>): boolean {
  return c.deck.some((card) => card.tags.includes('戦闘スキル'));
}

/** PCが現在持つデータから典型ロールを導く */
export function deriveArchetype(c: Pick<Character, 'abilities' | 'deck'>): CharacterArchetype {
  if (hasCombatSkill(c)) return 'adventurer';
  if (c.abilities) return 'explorer';
  return 'traveler';
}

/** シナリオデッキの入れ子構造（導入→シーン→結末） */
export type DeckNodeKind = z.infer<typeof deckNodeKindSchema>;

export const DECK_NODE_LABEL: Record<DeckNodeKind, string> = {
  intro: '導入',
  scene: 'シーン',
  ending: '結末',
  npc: 'NPC',
  info: '情報',
  enemy: 'エネミー',
  location: 'ロケーション',
};

export type DeckNode = z.infer<typeof deckNodeSchema>;

/** 結末タグの定義（成功／失敗に限らず任意の数） */
export type EndingDef = z.infer<typeof endingDefSchema>;

export type SpaceModel = z.infer<typeof spaceModelSchema>;

/**
 * 「新たな選択肢を提案」カードの提案を誰がどう裁定するか（docs/cartagraph/play-and-field.md
 * 「GMレスセッションでの提案の扱い（決着）」）。'auto-resolve' は人間GM不在のセッションでのみ使う、
 * 「機械的な自動判定より人間の裁量を優先する」という一貫方針からの意図的な逸脱。
 */
export type ProposalHandling = z.infer<typeof proposalHandlingSchema>;

export const PROPOSAL_HANDLING_LABEL: Record<ProposalHandling, string> = {
  'gm-required': 'GM必須',
  disabled: '提案不可',
  'auto-resolve': '自動解決',
};

export type Scenario = z.infer<typeof scenarioSchema>;

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

/** 共有ライブラリ（正史グラフから格上げされた設定・カード） */
export interface LibraryEntry {
  id: string;
  kind: CardKind;
  name: string;
  description: string;
  tags: string[];
  originScenarioTitle: string;
  promotedBy: string;
  promotedAt: string;
}

/** ログインユーザー（バックエンド未実装のためモックで固定） */
export interface CurrentUser {
  id: string;
  name: string;
  roles: UserRole[];
  /** 制作側の学習的アンロック：既読にしたルール */
  readRules: string[];
  /** 解放済みカードプール（プレイヤー単位） */
  unlockedCardIds: string[];
}
