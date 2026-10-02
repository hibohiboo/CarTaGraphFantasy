// シナリオとそれが含む型の zod スキーマ。シナリオの型の正はここで、index.ts の型は z.infer で導く
// （docs/plans/2026-10-03-シナリオのJSON管理.md D2）。scenarios/*.json はこのスキーマで検査してから使う。
// 用語の意味は docs/cartagraph/ が正（index.ts の冒頭と同じ）。index.ts を import しない（循環させない）。
//
// 知らないキー（書き間違い）を黙って捨てないよう、オブジェクトはすべて strictObject にする。
// 省略可能な項目に null は書けない（キーごと省く）。

import { z } from 'zod';

/** 探索者の能力値のキー（docs/cartagraph/exploration-check.md）。index.ts の Abilities と一致させる */
export const abilityKeySchema = z.enum(['body', 'skill', 'mind']);

/** カード種別（docs/cartagraph/card-and-deck.md, card-face-back.md の一覧に対応） */
export const cardKindSchema = z.enum([
  'character',
  'skill',
  'trait',
  'item',
  'equipment',
  'choice', // 選択肢カード＝イベントカード
  'npc',
  'info',
  'enemy',
  'scene',
  'location',
  'relation',
]);

/** 選択肢カードに紐づく判定（能力値＋2d6 vs 目標値） */
export const checkSpecSchema = z.strictObject({
  ability: abilityKeySchema,
  target: z.number(),
  onSuccess: z.string(),
  onFailure: z.string(),
});

/** ダイス式（例：2d6+1 は { count: 2, sides: 6, bonus: 1 }） */
export const diceExprSchema = z.strictObject({
  count: z.number(),
  sides: z.number(),
  bonus: z.number(),
});

/** 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）でカードが持つ効果。攻撃と回復のみ */
export const combatEffectSchema = z.strictObject({
  type: z.enum(['damage', 'heal']),
  dice: diceExprSchema,
});

/**
 * 配る条件・使える条件（docs/cartagraph/solo-village.md、仮ルール）。
 * 判定の対象はキャラクターデッキと GM専用ゾーンの達成カード。すべての項目を満たせば真
 */
export const cardConditionSchema = z.strictObject({
  /** これらのタグのカードをすべて持っている */
  hasTags: z.array(z.string()).optional(),
  /** これらのタグのカードを1枚も持っていない */
  lacksTags: z.array(z.string()).optional(),
  /** これらのIDのカードを持っていない（お店で習ったスキルを並べないため） */
  lacksCards: z.array(z.string()).optional(),
});

/** scenarios/*.json に書く注記（なぜこのデータか）。画面には出さない（D8） */
const comment = z.string().optional();

/** GM不在のソロで、選択肢カードを選んだときの成長の効果（docs/cartagraph/solo-village.md、仮ルール） */
export const soloEffectSchema = z.strictObject({
  raiseAbility: abilityKeySchema.optional(),
  /** キャラクターデッキへ加える（引換カード・習ったスキル）。ID はそのまま保ち、オブジェクトだけ複製する */
  get gainCards(): z.ZodOptional<z.ZodArray<typeof cardDefSchema>> {
    return z.array(cardDefSchema).optional();
  },
  /** このタグのカードをキャラクターデッキから1枚手放す（引換カード） */
  consumeTag: z.string().optional(),
  /** GM専用ゾーンに置く達成カード */
  get achievement(): z.ZodOptional<typeof cardDefSchema> {
    return cardDefSchema.optional();
  },
});

/** カード1枚。生成元（作者／GM／進化）に関わらず同じ構造を持つ */
export const cardDefSchema = z.strictObject({
  $comment: comment,
  id: z.string(),
  kind: cardKindSchema,
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()),
  /** キャラメイク時のCPコスト（キャラクター構成カードのみ） */
  cpCost: z.number().optional(),
  /** 戦闘カードのコスト（行動値を消費する量） */
  actionCost: z.number().optional(),
  /** 射程（グループ単位） */
  range: z.number().optional(),
  /** 判定を伴う選択肢カードのみ */
  check: checkSpecSchema.optional(),
  /** 裏向き（存在は見えるが内容が伏せられている） */
  faceDown: z.boolean().optional(),
  /** 場のゾーン。GM専用ゾーンのカードはPLには存在ごと見えない */
  zone: z.enum(['gm', 'pl']).optional(),
  /** 画像URL。無ければアイコンにフォールバック */
  portraitUrl: z.string().optional(),
  /** 自動戦闘での効果（docs/cartagraph/auto-combat.md、仮ルール）。無ければ優先順位リストに入れられない */
  combatEffect: combatEffectSchema.optional(),
  /** 効果「次のシーンへ進む」の遷移先 DeckNode.id（docs/cartagraph/play-and-field.md 基本操作8） */
  nextNodeId: z.string().optional(),
  /** 配る条件。満たさなければ手札に配らない（docs/cartagraph/solo-village.md、GM不在のソロの仮ルール） */
  dealWhen: cardConditionSchema.optional(),
  /** 使える条件。満たさなければ手札に出すが選べない（同上、仮ルール） */
  playWhen: cardConditionSchema.optional(),
  /** 選んだときの成長の効果（同上、仮ルール） */
  get soloEffect(): z.ZodOptional<typeof soloEffectSchema> {
    return soloEffectSchema.optional();
  },
});

/**
 * 優先順位リストの1行に付ける「使う条件」（自分のHPの段階。docs/cartagraph/auto-combat.md、仮ルール）。
 * half＝HPが最大の半分以下、quarter＝1/4以下
 */
export const hpConditionSchema = z.enum(['always', 'half', 'quarter']);

/** 優先順位リストの1行 */
export const priorityEntrySchema = z.strictObject({
  card: cardDefSchema,
  when: hpConditionSchema,
});

/** 自動戦闘の相手（1体・固定の優先順位リスト。仮ルール） */
export const autoCombatEnemySchema = z.strictObject({
  $comment: comment,
  /** kind: 'enemy'。シーンに入るときにコピーして場に出す */
  card: cardDefSchema,
  hp: z.number(),
  baseActionValue: z.number(),
  priority: z.array(priorityEntrySchema),
});

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

export const deckNodeSchema = z.strictObject({
  $comment: comment,
  id: z.string(),
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
  endingId: z.string().optional(),
});

/** 結末タグの定義（成功／失敗に限らず任意の数） */
export const endingDefSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  /** 後続シナリオの前提タグとして配るタグ。無ければ単発扱い */
  grantsTag: z.string().optional(),
});

export const spaceModelSchema = z.enum(['1d', '2d']);

/** 「新たな選択肢を提案」カードの提案を誰がどう裁定するか（説明は index.ts の ProposalHandling） */
export const proposalHandlingSchema = z.enum(['gm-required', 'disabled', 'auto-resolve']);

export const scenarioSchema = z.strictObject({
  $comment: comment,
  id: z.string(),
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
  updatedAt: z.iso.datetime(),
});
