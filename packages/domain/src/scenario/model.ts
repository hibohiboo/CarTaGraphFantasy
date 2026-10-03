// シナリオ（docs/cartagraph/scenario-flow.md）。シナリオの型の正は、ここと card/・autoCombat/・check/ の
// zod スキーマで、型は z.infer で導く（方針は card/model.ts の冒頭）。scenarios/*.json はこのスキーマで
// 検査してから使う（scenario/file.ts）。

import { z } from 'zod';
import { autoCombatEnemySchema } from '../autoCombat/model';
import { cardDefSchema, commentSchema, idSchema } from '../card/model';

/** シナリオデッキの入れ子構造（導入→シーン→結末） */
export const deckNodeKindSchema = z.enum([
  'intro',
  'scene',
  'ending',
  'npc',
  'info',
  'enemy',
  'location',
]);

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

export const deckNodeSchema = z.strictObject({
  $comment: commentSchema,
  id: idSchema,
  kind: deckNodeKindSchema,
  name: z.string(),
  /** 濃密モードを要求するシーンか */
  dense: z.boolean().optional(),
  cards: z.array(cardDefSchema),
  get children(): z.ZodOptional<z.ZodArray<typeof deckNodeSchema>> {
    return z.array(deckNodeSchema).optional();
  },
  /**
   * シーンの目的（仮ルール）。docs/open-questions.md「シーンカードの『目的』『終了条件』
   * という属性」が未決のため、正式仕様ではない。意味を持つのは kind === 'scene' のときだけ
   * （型では強制しない）。
   */
  objective: z.string().optional(),
  /** シーンの終了条件（同上、仮ルール） */
  endCondition: z.string().optional(),
  /**
   * このシーンで自動戦闘を行う（docs/cartagraph/auto-combat.md、仮ルール）。dense とは独立で、
   * 自動戦闘中もセッションは軽量モードのまま
   */
  autoCombat: z.strictObject({ enemy: autoCombatEnemySchema, maxRounds: z.number() }).optional(),
  /** 結末のノードが指す結末（Scenario.endings の id）。意味を持つのは kind === 'ending' のときだけ */
  endingId: idSchema.optional(),
});

export type DeckNode = z.infer<typeof deckNodeSchema>;

/** 結末タグの定義（成功／失敗に限らず任意の数） */
export const endingDefSchema = z.strictObject({
  id: idSchema,
  name: z.string(),
  /** 後続シナリオの前提タグとして配るタグ。無ければ単発扱い */
  grantsTag: z.string().optional(),
});

/** 結末タグの定義（成功／失敗に限らず任意の数） */
export type EndingDef = z.infer<typeof endingDefSchema>;

export const spaceModelSchema = z.enum(['1d', '2d']);

export type SpaceModel = z.infer<typeof spaceModelSchema>;

/** 「新たな選択肢を提案」カードの提案を誰がどう裁定するか（説明は下の ProposalHandling） */
export const proposalHandlingSchema = z.enum(['gm-required', 'disabled', 'auto-resolve']);

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

export const scenarioSchema = z.strictObject({
  $comment: commentSchema,
  id: idSchema,
  title: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  summary: z.string(),
  /** 参照するデータ種別のタグ（体・技・心／HP／戦闘スキル） */
  referenceTags: z.array(z.string()),
  /** 前提スキル・前作の結末タグなど（ソフトガイド） */
  prerequisiteTags: z.array(z.string()),
  partySize: z.strictObject({ min: z.number(), max: z.number() }),
  /** 戦闘がなければ null */
  spaceModel: spaceModelSchema.nullable(),
  recommendedCp: z.number(),
  baseCp: z.number(),
  proposalHandling: proposalHandlingSchema,
  /**
   * ソロ開始時にキャラクターへ無償で配る初期装備（docs/cartagraph/auto-combat.md「初期装備」、
   * 仮ルール）。村パートを持たないシナリオ用（いまはテスト専用のシナリオだけが使う）
   */
  soloStarter: z
    .strictObject({ hp: z.number(), baseActionValue: z.number(), cards: z.array(cardDefSchema) })
    .optional(),
  /**
   * GM不在のソロの成長で与える HP（探索者になったとき）と基本行動値（冒険者になったとき）
   * （docs/cartagraph/solo-village.md「HP・＜行動値＞」、仮ルール）
   */
  soloGrowth: z.strictObject({ hp: z.number(), baseActionValue: z.number() }).optional(),
  deck: z.array(deckNodeSchema),
  endings: z.array(endingDefSchema),
  /** 共有ライブラリへの公開状態 */
  libraryStatus: z.enum(['draft', 'published']),
  /** ISO 8601 の日時。時差付き（+09:00 など）も書ける */
  updatedAt: z.iso.datetime({ offset: true }),
});

export type Scenario = z.infer<typeof scenarioSchema>;
