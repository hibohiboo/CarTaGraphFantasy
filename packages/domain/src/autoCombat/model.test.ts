// 自動戦闘の状態と記録の zod スキーマ（docs/plans/2026-10-11-APIドキュメント.md T1）。API の応答に入るので、
// 列挙の外・null・省略を通さないことを確かめる。

import { describe, expect, it } from 'vitest';
import { autoCombatStateSchema, combatLogEntrySchema, combatRecordSchema } from './model';

const entry = () => ({
  round: 1,
  count: 1,
  actor: 'pl',
  actorName: 'PC',
  cardName: '斬る',
  effect: 'damage',
  rolls: [3, 4],
  amount: 7,
  plHp: 10,
  enemyHp: 3,
});

const state = (): Record<string, unknown> => ({
  nodeId: 'n-1',
  enemyCardId: 'en-1',
  status: 'awaiting-priority',
  attempts: 0,
});

describe('combatLogEntrySchema', () => {
  it('攻撃・回復・パスの手が通り、それ以外の効果と行動者は落ちる', () => {
    expect(combatLogEntrySchema.safeParse(entry()).success).toBe(true);
    expect(combatLogEntrySchema.safeParse({ ...entry(), effect: 'heal' }).success).toBe(true);
    expect(
      combatLogEntrySchema.safeParse({ ...entry(), effect: 'pass', cardName: '' }).success,
    ).toBe(true);
    expect(combatLogEntrySchema.safeParse({ ...entry(), effect: 'poison' }).success).toBe(false);
    expect(combatLogEntrySchema.safeParse({ ...entry(), actor: 'gm' }).success).toBe(false);
  });
});

describe('autoCombatStateSchema', () => {
  it('戦闘中・勝利の状態が通り、列挙の外の状態は落ちる', () => {
    expect(autoCombatStateSchema.safeParse(state()).success).toBe(true);
    expect(autoCombatStateSchema.safeParse({ ...state(), status: 'won' }).success).toBe(true);
    expect(autoCombatStateSchema.safeParse({ ...state(), status: 'lost' }).success).toBe(false);
  });

  it('エネミーカードの id は省けず、null も書けない', () => {
    const { enemyCardId: _, ...without } = state();
    expect(autoCombatStateSchema.safeParse(without).success).toBe(false);
    expect(autoCombatStateSchema.safeParse({ ...state(), enemyCardId: null }).success).toBe(false);
  });

  it('前回の結果は省けて、null は書けない', () => {
    const lastResult = { outcome: 'timeout', rounds: 10, log: [entry()] };
    expect(autoCombatStateSchema.safeParse({ ...state(), lastResult }).success).toBe(true);
    expect(autoCombatStateSchema.safeParse({ ...state(), lastResult: null }).success).toBe(false);
  });
});

describe('combatRecordSchema', () => {
  it('記録が通り、列挙の外の結果・知らないキーは落ちる', () => {
    const record = { nodeId: 'n-1', attempt: 1, outcome: 'win', rounds: 2, log: [entry()] };
    expect(combatRecordSchema.safeParse(record).success).toBe(true);
    expect(combatRecordSchema.safeParse({ ...record, outcome: 'draw' }).success).toBe(false);
    expect(combatRecordSchema.safeParse({ ...record, extra: 1 }).success).toBe(false);
  });
});
