// 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）の型。
// 敵と優先順位はシナリオ（scenarios/*.json）に書くので zod スキーマが正（方針は card/model.ts の冒頭）。

import { z } from 'zod';
import { type CombatEffect, cardDefSchema, commentSchema } from '../card/model';

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
