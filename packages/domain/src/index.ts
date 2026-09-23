// CarTaGraphFantasy のドメイン型。
// 仕様の正は docs/ 配下（SSOT）。ここは docs/cartagraph/ の用語をそのまま型に落としたもので、
// 用語の意味を変える場合は docs 側を先に更新する。

/** 利用者ロール（docs/cartagraph/graph.md「グラフの利用者とロール別の見え方」） */
export type UserRole = 'pl' | 'gm' | 'creator' | 'admin';

/** カード種別（docs/cartagraph/card-and-deck.md, card-face-back.md の一覧に対応） */
export type CardKind =
  | 'character'
  | 'skill'
  | 'trait'
  | 'item'
  | 'equipment'
  | 'choice' // 選択肢カード＝イベントカード
  | 'npc'
  | 'info'
  | 'enemy'
  | 'scene'
  | 'location'
  | 'relation';

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
export interface CheckSpec {
  ability: keyof Abilities;
  target: number;
  onSuccess: string;
  onFailure: string;
}

/** カード1枚。生成元（作者／GM／進化）に関わらず同じ構造を持つ */
export interface CardDef {
  id: string;
  kind: CardKind;
  name: string;
  description?: string;
  tags: string[];
  /** キャラメイク時のCPコスト（キャラクター構成カードのみ） */
  cpCost?: number;
  /** 戦闘カードのコスト（行動値を消費する量） */
  actionCost?: number;
  /** 射程（グループ単位） */
  range?: number;
  /** 判定を伴う選択肢カードのみ */
  check?: CheckSpec;
  /** 裏向き（存在は見えるが内容が伏せられている） */
  faceDown?: boolean;
  /** 場のゾーン。GM専用ゾーンのカードはPLには存在ごと見えない */
  zone?: 'gm' | 'pl';
  /** 画像URL。無ければアイコンにフォールバック */
  portraitUrl?: string;
  /** 自動戦闘での効果（docs/cartagraph/auto-combat.md、仮ルール）。無ければ優先順位リストに入れられない */
  combatEffect?: CombatEffect;
  /** 効果「次のシーンへ進む」の遷移先 DeckNode.id（docs/cartagraph/play-and-field.md 基本操作8） */
  nextNodeId?: string;
}

/** ダイス式（例：2d6+1 は { count: 2, sides: 6, bonus: 1 }） */
export interface DiceExpr {
  count: number;
  sides: number;
  bonus: number;
}

/** 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）でカードが持つ効果。攻撃と回復のみ */
export interface CombatEffect {
  type: 'damage' | 'heal';
  dice: DiceExpr;
}

/** 自動戦闘の相手（1体・固定の優先順位リスト。仮ルール） */
export interface AutoCombatEnemy {
  /** kind: 'enemy'。シーンに入るときにコピーして場に出す */
  card: CardDef;
  hp: number;
  baseActionValue: number;
  priority: CardDef[];
}

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

/** PCが現在持つデータから典型ロールを導く */
export function deriveArchetype(c: Pick<Character, 'abilities' | 'deck'>): CharacterArchetype {
  const hasCombat = c.deck.some((card) => card.tags.includes('戦闘スキル'));
  if (hasCombat) return 'adventurer';
  if (c.abilities) return 'explorer';
  return 'traveler';
}

/** シナリオデッキの入れ子構造（導入→シーン→エンディング） */
export type DeckNodeKind = 'intro' | 'scene' | 'ending' | 'npc' | 'info' | 'enemy' | 'location';

export const DECK_NODE_LABEL: Record<DeckNodeKind, string> = {
  intro: '導入',
  scene: 'シーン',
  ending: '結末',
  npc: 'NPC',
  info: '情報',
  enemy: 'エネミー',
  location: 'ロケーション',
};

export interface DeckNode {
  id: string;
  kind: DeckNodeKind;
  name: string;
  /** 濃密モードを要求するシーンか */
  dense?: boolean;
  cards: CardDef[];
  children?: DeckNode[];
  /**
   * シーンの目的（仮ルール）。docs/open-questions.md「シーンカードの『目的』『終了条件』
   * という属性」が未決のため、正式仕様ではない。意味を持つのは kind === 'scene' のときだけ
   * （型では強制しない）。
   */
  objective?: string;
  /** シーンの終了条件（同上、仮ルール） */
  endCondition?: string;
  /**
   * このシーンで自動戦闘を行う（docs/cartagraph/auto-combat.md、仮ルール）。dense とは独立で、
   * 自動戦闘中もセッションは軽量モードのまま
   */
  autoCombat?: { enemy: AutoCombatEnemy; maxRounds: number };
}

/** 結末タグの定義（成功／失敗に限らず任意の数） */
export interface EndingDef {
  id: string;
  name: string;
  /** 後続シナリオの前提タグとして配るタグ。無ければ単発扱い */
  grantsTag?: string;
}

export type SpaceModel = '1d' | '2d';

/**
 * 「新たな選択肢を提案」カードの提案を誰がどう裁定するか（docs/cartagraph/play-and-field.md
 * 「GMレスセッションでの提案の扱い（決着）」）。'auto-resolve' は人間GM不在のセッションでのみ使う、
 * 「機械的な自動判定より人間の裁量を優先する」という一貫方針からの意図的な逸脱。
 */
export type ProposalHandling = 'gm-required' | 'disabled' | 'auto-resolve';

export const PROPOSAL_HANDLING_LABEL: Record<ProposalHandling, string> = {
  'gm-required': 'GM必須',
  disabled: '提案不可',
  'auto-resolve': '自動解決',
};

export interface Scenario {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  summary: string;
  /** 参照するデータ種別のタグ（体・技・心／HP／戦闘スキル） */
  referenceTags: string[];
  /** 前提スキル・前作の結末タグなど（ソフトガイド） */
  prerequisiteTags: string[];
  partySize: { min: number; max: number };
  /** 戦闘がなければ null */
  spaceModel: SpaceModel | null;
  recommendedCp: number;
  baseCp: number;
  proposalHandling: ProposalHandling;
  /**
   * ソロ開始時にキャラクターへ無償で配る初期装備（docs/cartagraph/auto-combat.md「初期装備」、
   * 仮ルール）。村パートの報酬・お店が実装されたら置き換える
   */
  soloStarter?: { hp: number; baseActionValue: number; cards: CardDef[] };
  deck: DeckNode[];
  endings: EndingDef[];
  /** 共有ライブラリへの公開状態 */
  libraryStatus: 'draft' | 'published';
  updatedAt: string;
}

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
