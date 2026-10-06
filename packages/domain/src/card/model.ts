// カード（docs/cartagraph/card-and-deck.md, card-face-back.md）。
// カードが持つ属性の型（自動戦闘の効果・配る条件・成長の効果）も、出典のページに関わらずここに置く
// （cardDefSchema と soloEffectSchema が互いを参照するため。docs/process/rules/architecture.md「packages/domain の中の置き場所」）。
//
// シナリオとそれが含む型（scenarios/*.json に書くもの）は zod スキーマが正で、型は z.infer で導く
// （docs/plans/2026-10-03-シナリオのJSON管理.md D2）。check/・autoCombat/・scenario/ の model.ts も同じ方針。
// 知らないキー（書き間違い）を黙って捨てないよう、オブジェクトはすべて strictObject にする。
// 省略可能な項目に null は書けない（キーごと省く）。

import { z } from 'zod';
import { abilityKeySchema, checkSpecSchema } from '../check/model';

/** id とその参照。空文字は書けない（参照の整合の検査をすり抜けるため） */
export const idSchema = z.string().min(1);

/** scenarios/*.json に書く注記（なぜこのデータか）。画面には出さない（シナリオのJSON管理 D8） */
export const commentSchema = z.string().optional();

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

/** ダイス式（例：2d6+1 は { count: 2, sides: 6, bonus: 1 }） */
export const diceExprSchema = z.strictObject({
  count: z.number(),
  sides: z.number(),
  bonus: z.number(),
});

/** ダイス式（例：2d6+1 は { count: 2, sides: 6, bonus: 1 }） */
export type DiceExpr = z.infer<typeof diceExprSchema>;

/** 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）でカードが持つ効果。攻撃と回復のみ */
export const combatEffectSchema = z.strictObject({
  type: z.enum(['damage', 'heal']),
  dice: diceExprSchema,
});

/** 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）でカードが持つ効果。攻撃と回復のみ */
export type CombatEffect = z.infer<typeof combatEffectSchema>;

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

/**
 * 配る条件・使える条件（docs/cartagraph/solo-village.md、仮ルール）。
 * 判定の対象はキャラクターデッキと GM専用ゾーンの達成カード。すべての項目を満たせば真
 */
export type CardCondition = z.infer<typeof cardConditionSchema>;

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

/** GM不在のソロで、選択肢カードを選んだときの成長の効果（docs/cartagraph/solo-village.md、仮ルール） */
export type SoloEffect = z.infer<typeof soloEffectSchema>;

/** カード1枚。生成元（シナリオ製作者／GM／進化）に関わらず同じ構造を持つ */
export const cardDefSchema = z.strictObject({
  $comment: commentSchema,
  id: idSchema,
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
  nextNodeId: idSchema.optional(),
  /** 配る条件。満たさなければ手札に配らない（docs/cartagraph/solo-village.md、GM不在のソロの仮ルール） */
  dealWhen: cardConditionSchema.optional(),
  /** 使える条件。満たさなければ手札に出すが選べない（同上、仮ルール） */
  playWhen: cardConditionSchema.optional(),
  /** 選んだときの成長の効果（同上、仮ルール） */
  get soloEffect(): z.ZodOptional<typeof soloEffectSchema> {
    return soloEffectSchema.optional();
  },
});

/** カード1枚。生成元（シナリオ製作者／GM／進化）に関わらず同じ構造を持つ */
export type CardDef = z.infer<typeof cardDefSchema>;
