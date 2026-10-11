// 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）の型。
// 敵と優先順位はシナリオ（scenarios/*.json）に書き、戦闘の記録と状態は API の応答に入るので、どれも zod スキーマが正
// （方針は card/model.ts の冒頭）。

import { z } from 'zod';
import { cardDefSchema, combatEffectSchema, commentSchema } from '../card/model';

/**
 * 優先順位リストの1行に付ける「使う条件」（自分のHPの段階。docs/cartagraph/auto-combat.md、仮ルール）。
 * half＝HPが最大の半分以下、quarter＝1/4以下
 */
export const hpConditionSchema = z.enum(['always', 'half', 'quarter']);

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
export const priorityEntrySchema = z.strictObject({
  card: cardDefSchema,
  when: hpConditionSchema,
});

/** 優先順位リストの1行 */
export type PriorityEntry = z.infer<typeof priorityEntrySchema>;

/** 自動戦闘の相手（1体・固定の優先順位リスト。仮ルール） */
export const autoCombatEnemySchema = z.strictObject({
  $comment: commentSchema,
  /** kind: 'enemy'。シーンに入るときにコピーして場に出す */
  card: cardDefSchema,
  hp: z.number(),
  baseActionValue: z.number(),
  priority: z.array(priorityEntrySchema),
});

/** 自動戦闘の相手（1体・固定の優先順位リスト。仮ルール） */
export type AutoCombatEnemy = z.infer<typeof autoCombatEnemySchema>;

/** 自動戦闘の1手。使えるカードが無くラウンドの行動を終えた記録は effect: 'pass' */
export const combatLogEntrySchema = z.strictObject({
  round: z.number(),
  count: z.number(),
  actor: z.enum(['pl', 'enemy']),
  actorName: z.string(),
  /** effect が 'pass' のときは空文字 */
  cardName: z.string(),
  effect: z.enum([...combatEffectSchema.shape.type.options, 'pass']),
  /** ダイスの出目 */
  rolls: z.array(z.number()),
  /** 実際に与えたダメージ／回復した量（HPの下限・上限で切り詰めた後） */
  amount: z.number(),
  /** 行動後の双方のHP */
  plHp: z.number(),
  enemyHp: z.number(),
});

/** 自動戦闘の1手。使えるカードが無くラウンドの行動を終えた記録は effect: 'pass' */
export type CombatLogEntry = z.infer<typeof combatLogEntrySchema>;

export const autoCombatOutcomeSchema = z.enum(['win', 'lose', 'timeout']);

export type AutoCombatOutcome = z.infer<typeof autoCombatOutcomeSchema>;

/** 自動戦闘1回分の記録。セッションの記録として消さずに残す（docs/concept「セッションログの方針」） */
export const combatRecordSchema = z.strictObject({
  nodeId: z.string(),
  /** そのシーンで何回目の挑戦か */
  attempt: z.number(),
  outcome: autoCombatOutcomeSchema,
  rounds: z.number(),
  log: z.array(combatLogEntrySchema),
});

/** 自動戦闘1回分の記録。セッションの記録として消さずに残す（docs/concept「セッションログの方針」） */
export type CombatRecord = z.infer<typeof combatRecordSchema>;

/** セッションが自動戦闘のシーンにいる間の状態（仮ルール） */
export const autoCombatStateSchema = z.strictObject({
  nodeId: z.string(),
  /** 場（field.plVisible）のエネミーカードのID。エネミーの実体は場の1か所だけに置く */
  enemyCardId: z.string(),
  status: z.enum(['awaiting-priority', 'won']),
  attempts: z.number(),
  lastResult: z
    .strictObject({
      outcome: autoCombatOutcomeSchema,
      rounds: z.number(),
      log: z.array(combatLogEntrySchema),
    })
    .optional(),
});

/** セッションが自動戦闘のシーンにいる間の状態（仮ルール） */
export type AutoCombatState = z.infer<typeof autoCombatStateSchema>;
