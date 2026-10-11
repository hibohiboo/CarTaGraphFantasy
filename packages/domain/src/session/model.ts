// セッション（docs/cartagraph/party-and-session.md, play-and-field.md）と、その前段の募集
// （docs/cartagraph/scenario-flow.md の募集→応募→確定。GM がシナリオからセッションを立てる手続きなのでここに置く。
// docs/process/rules/architecture.md「packages/domain の中の置き場所」）。
// 募集とセッションは API の応答の型なので zod スキーマが正（方針は card/model.ts の冒頭）。

import { z } from 'zod';
import { autoCombatStateSchema, combatRecordSchema } from '../autoCombat/model';
import { cardDefSchema } from '../card/model';
import { proposalHandlingSchema, scenarioTypeSchema, spaceModelSchema } from '../scenario/model';

/** 募集の種類（Recruitment.kind）。API の本文の検査（packages/schemas）も使う */
export const recruitmentKindSchema = z.enum(['normal', 'gmless']);
/** GM 不在の募集の提案の扱い（Recruitment.proposalHandling） */
export const recruitmentProposalHandlingSchema = proposalHandlingSchema.exclude(['auto-resolve']);
/** 軽量モード・濃密モード（Session.mode。docs/cartagraph/party-and-session.md） */
export const sessionModeSchema = z.enum(['light', 'dense']);

/**
 * GMが出した募集。セッションとは別のもの（docs/cartagraph/scenario-flow.md「募集とセッション」）。
 * 通常の募集は、セッションを始めると開始済み（started）になる。どのセッションが始まったかは
 * Session.recruitmentId だけが持つ（同じつながりを両側に持たない）
 */
export const recruitmentSchema = z.strictObject({
  id: z.string(),
  /**
   * 通常の募集（応募を受けて GM が始める。募集1つからセッション1つ）か、GM 不在の募集（応募は無く、PL が自分の
   * PC ですぐ始める。受付中のまま残り続け、募集1つからセッションが複数）か（docs/cartagraph/scenario-flow.md
   * 「募集とセッション」）。GM 不在の募集は applicants が空で、capacity は 0
   */
  kind: recruitmentKindSchema,
  /**
   * GM 不在の募集だけが持つ、提案の扱い（GM が後から裁定＝gm-required／提案不可＝disabled）。
   * 始めたセッションへコピーする（docs/cartagraph/play-and-field.md「GMレスセッションでの提案の扱い」）
   */
  proposalHandling: recruitmentProposalHandlingSchema.optional(),
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  gmId: z.string(),
  gmName: z.string(),
  partySize: z.strictObject({ min: z.number(), max: z.number() }),
  spaceModel: spaceModelSchema.nullable(),
  recommendedCp: z.number(),
  /** シナリオタイプ。募集を出すときにシナリオからコピーする（docs/cartagraph/scenario-type.md） */
  scenarioType: scenarioTypeSchema,
  prerequisiteTags: z.array(z.string()),
  /** 応募（ドライバー候補とPC）。userId は応募した人（借りたPCなら、PCの所有者とは別の人） */
  applicants: z.array(
    z.strictObject({
      characterId: z.string(),
      characterName: z.string(),
      userId: z.string(),
      playerName: z.string(),
    }),
  ),
  capacity: z.number(),
  status: z.enum(['open', 'started']),
  /** GMが外したシーン（シナリオデッキのノードの id）。開始したセッションへ引き継ぐ */
  excludedNodeIds: z.array(z.string()),
  note: z.string().optional(),
});

/**
 * GMが出した募集。セッションとは別のもの（docs/cartagraph/scenario-flow.md「募集とセッション」）。
 * 通常の募集は、セッションを始めると開始済み（started）になる。どのセッションが始まったかは
 * Session.recruitmentId だけが持つ（同じつながりを両側に持たない）
 */
export type Recruitment = z.infer<typeof recruitmentSchema>;

export const participantRoleSchema = z.enum(['driver', 'navigator', 'gm']);

export type ParticipantRole = z.infer<typeof participantRoleSchema>;

export const PARTICIPANT_ROLE_LABEL: Record<ParticipantRole, string> = {
  driver: 'ドライバー',
  navigator: 'ナビゲーター',
  gm: 'GM',
};

export const participantSchema = z.strictObject({
  userId: z.string(),
  name: z.string(),
  role: participantRoleSchema,
  characterId: z.string().optional(),
  characterName: z.string().optional(),
  lastSeenAt: z.string(),
});

export type Participant = z.infer<typeof participantSchema>;

export const proposalStatusSchema = z.enum(['pending', 'approved', 'approved-unused', 'rejected']);

export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: '承認待ち',
  approved: '採用済み',
  'approved-unused': '採用済み・今回は未使用',
  rejected: '却下',
};

/** 「新たな選択肢を提案」カードのプレイで生まれる提案 */
export const proposalSchema = z.strictObject({
  id: z.string(),
  sessionId: z.string(),
  byName: z.string(),
  sceneName: z.string(),
  text: z.string(),
  presentedChoices: z.array(z.string()),
  status: proposalStatusSchema,
  /** 採用時に生成したカード名／却下理由 */
  resolution: z.string().optional(),
  createdAt: z.string(),
});

/** 「新たな選択肢を提案」カードのプレイで生まれる提案 */
export type Proposal = z.infer<typeof proposalSchema>;

export type SessionMode = z.infer<typeof sessionModeSchema>;

export const feedItemSchema = z.strictObject({
  id: z.string(),
  at: z.string(),
  text: z.string(),
  cardName: z.string().optional(),
});

export type FeedItem = z.infer<typeof feedItemSchema>;

/** セッションの状態（Session.status） */
export const sessionStatusSchema = z.enum(['playing', 'suspended', 'ended']);

/**
 * ソロ開始のセッションの GM 欄に入れるダミー（裁定する GM がいない印。docs/cartagraph/party-and-session.md
 * 「GM不在のセッションのGM」）。振る舞い（GM 不在の仮ルール・結末での終了など）は gmId ではなく
 * Session.gmless で判定する
 */
export const SYSTEM_GM_ID = 'system-gm';
export const SYSTEM_GM_NAME = '（自動進行）';

export const sessionSchema = z.strictObject({
  id: z.string(),
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  /** 始めた募集（ソロ開始のセッションには無い） */
  recruitmentId: z.string().optional(),
  /** 募集でGMが外したシーン。シナリオを引くたびに sessionDeck で除く（ソロ開始のセッションには無い） */
  excludedNodeIds: z.array(z.string()).optional(),
  gmId: z.string(),
  gmName: z.string(),
  /**
   * システムが進行するセッション（GM不在のセッション。ソロ開始と GM 不在の募集から始めたもの）か。
   * GM 不在の仮ルール・配る条件・自動戦闘・結末での自動終了・結末タグの即時反映はこれで判定する
   * （docs/cartagraph/solo-village.md「適用範囲」）
   */
  gmless: z.boolean(),
  partyName: z.string(),
  status: sessionStatusSchema,
  /**
   * 中断の理由（status が suspended のときだけ。docs/cartagraph/party-and-session.md「中断」）。
   * いま書き込むのは proposal（GM 不在の募集のセッションで提案の裁定を待つ）だけ
   */
  suspendedFor: z.enum(['inactivity', 'proposal']).optional(),
  mode: sessionModeSchema,
  /**
   * セッション開始時にコピーする（セッションスナップショットの一部）。ソロ開始はシナリオの値、GM 不在の募集は募集の値、
   * 通常の募集はシナリオの値（自動解決は GM必須に読み替える。docs/cartagraph/play-and-field.md「GMレスセッションでの提案の扱い」）
   */
  proposalHandling: proposalHandlingSchema,
  /** 進行中のシーン（例: "3-2 奥の扉"） */
  /** nodeId は「次のシーンへ進む」で移ったノード（それ以前から続くセッションでは無い） */
  currentScene: z.strictObject({
    index: z.number(),
    total: z.number(),
    name: z.string(),
    path: z.string(),
    nodeId: z.string().optional(),
  }),
  /** 自動戦闘のシーンにいる間だけ存在する（仮ルール） */
  autoCombat: autoCombatStateSchema.optional(),
  /** これまでの自動戦闘のすべての挑戦（シーンを移っても残る） */
  combatHistory: z.array(combatRecordSchema).optional(),
  participants: z.array(participantSchema),
  /** 場のゾーン別枚数 */
  field: z.strictObject({ gmOnly: z.array(cardDefSchema), plVisible: z.array(cardDefSchema) }),
  /** ドライバーの手札 */
  hand: z.array(cardDefSchema),
  /** 卓上の描写（GMが用意した流れ） */
  flavor: z.string(),
  proposals: z.array(proposalSchema),
  feed: z.array(feedItemSchema),
  lastActivityAt: z.string(),
  /** 無反応で「中断」になる期限 */
  suspendAt: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;
