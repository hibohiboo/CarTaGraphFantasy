// 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）のエンジン。
// 戦闘ルール（docs/cartagraph/combat.md）のカウント制を、事前の優先順位リストで自動実行する。
// 乱数は引数で受け取り、副作用を持たない（docs/process/rules/architecture.md の Functional Core）。

import type { AutoCombatOutcome, CardDef, Character, CombatLogEntry, DiceExpr } from './index';

/** [0, 1) の乱数を返す関数 */
export type Rng = () => number;

/** ダイス1個ごとに rng を1回呼んで振る */
export function rollDice(d: DiceExpr, rng: Rng): { rolls: number[]; total: number } {
  const rolls = Array.from({ length: d.count }, () => Math.floor(rng() * d.sides) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + d.bonus };
}

/**
 * 優先順位リストの先頭から、いま使えるカードのうち最初の1枚を選ぶ。使えるものが無ければ null。
 * 使える＝残り行動値がコスト以上、かつ回復なら自分のHPが最大未満（auto-combat.md「解決の手順」4）
 */
export function pickCard(
  self: { hp: number; maxHp: number; actionValue: number },
  priority: CardDef[],
): CardDef | null {
  return (
    priority.find((c) => {
      if (c.combatEffect === undefined || c.actionCost === undefined) return false;
      if (c.actionCost > self.actionValue) return false;
      return c.combatEffect.type !== 'heal' || self.hp < self.maxHp;
    }) ?? null
  );
}

/** 優先順位リストとして使えるかを検査する。問題があればエラーメッセージ、無ければ null */
export function validatePriority(cards: CardDef[]): string | null {
  if (cards.length === 0) return '優先順位リストには1枚以上のカードが必要です';
  for (const c of cards) {
    if (!c.combatEffect) return `「${c.name}」は自動戦闘の効果を持たないため使えません`;
    // コスト0だと同じカウントで行動し続け、ラウンドが終わらない
    if (!isPositiveInt(c.actionCost))
      return `「${c.name}」のコストは1以上の整数である必要があります`;
    const { count, sides } = c.combatEffect.dice;
    if (!isPositiveInt(count) || !isPositiveInt(sides))
      return `「${c.name}」のダイスは個数・面数とも1以上の整数である必要があります`;
  }
  if (new Set(cards.map((c) => c.id)).size !== cards.length) return '同じカードが重複しています';
  return null;
}

/** 自動戦闘の参加者。HPは戦闘開始時に最大値から始める */
export interface Combatant {
  name: string;
  maxHp: number;
  baseActionValue: number;
  priority: CardDef[];
}

export interface AutoCombatResult {
  outcome: AutoCombatOutcome;
  /** 決着した（または上限に達した）ラウンド */
  rounds: number;
  log: CombatLogEntry[];
}

/**
 * PL と敵の1対1の戦闘を、カウント制で最後まで自動解決する（auto-combat.md「解決の手順」）。
 * 入力が不正（優先順位リストが validatePriority を通らない、行動値・HP・ラウンド上限が1未満）なら例外を投げる。
 */
export function resolveAutoCombat(input: {
  pl: Combatant;
  enemy: Combatant;
  maxRounds: number;
  rng: Rng;
}): AutoCombatResult {
  const { maxRounds, rng } = input;
  if (maxRounds < 1) throw new Error('ラウンド上限は1以上である必要があります');
  for (const c of [input.pl, input.enemy]) {
    const error = validatePriority(c.priority);
    if (error) throw new Error(`${c.name}：${error}`);
    if (!isPositiveInt(c.baseActionValue))
      throw new Error(`${c.name}：基本行動値は1以上の整数である必要があります`);
    if (!isPositiveInt(c.maxHp))
      throw new Error(`${c.name}：最大HPは1以上の整数である必要があります`);
  }

  type Side = 'pl' | 'enemy';
  type State = { def: Combatant; hp: number; actionValue: number; reachedAt: number };
  const s: Record<Side, State> = {
    pl: { def: input.pl, hp: input.pl.maxHp, actionValue: 0, reachedAt: 0 },
    enemy: { def: input.enemy, hp: input.enemy.maxHp, actionValue: 0, reachedAt: 0 },
  };
  const other = (side: Side): Side => (side === 'pl' ? 'enemy' : 'pl');
  const log: CombatLogEntry[] = [];
  // 「最後にその行動値になった者から」を判定するための通し番号
  let tick = 0;

  for (let round = 1; round <= maxRounds; round++) {
    // ラウンド開始時の同値はPLが先（auto-combat.md 差分5）：PLを後から値を得た扱いにする
    for (const side of ['enemy', 'pl'] as const) {
      s[side].actionValue = s[side].def.baseActionValue;
      s[side].reachedAt = ++tick;
    }
    let count = Math.max(s.pl.actionValue, s.enemy.actionValue);
    while (count >= 1) {
      const actors = (['pl', 'enemy'] as const)
        .filter((side) => s[side].actionValue === count)
        .sort((a, b) => s[b].reachedAt - s[a].reachedAt);
      const side = actors[0];
      if (!side) {
        count--;
        continue;
      }
      const self = s[side];
      const target = s[other(side)];
      const entry = { round, count, actor: side, actorName: self.def.name };
      const card = pickCard(
        { hp: self.hp, maxHp: self.def.maxHp, actionValue: self.actionValue },
        self.def.priority,
      );
      if (!card?.combatEffect || card.actionCost === undefined) {
        // 使えるカードが無ければ、そのラウンドの行動を終える（差分4）
        self.actionValue = 0;
        log.push({ ...entry, cardName: '', effect: 'pass', rolls: [], amount: 0, ...hps(s) });
        continue;
      }
      self.actionValue -= card.actionCost;
      self.reachedAt = ++tick;
      const { rolls, total } = rollDice(card.combatEffect.dice, rng);
      let amount: number;
      if (card.combatEffect.type === 'damage') {
        amount = Math.min(Math.max(total, 0), target.hp);
        target.hp -= amount;
      } else {
        amount = Math.min(Math.max(total, 0), self.def.maxHp - self.hp);
        self.hp += amount;
      }
      log.push({
        ...entry,
        cardName: card.name,
        effect: card.combatEffect.type,
        rolls,
        amount,
        ...hps(s),
      });
      if (target.hp === 0) return { outcome: side === 'pl' ? 'win' : 'lose', rounds: round, log };
    }
  }
  return { outcome: 'timeout', rounds: maxRounds, log };
}

function hps(s: Record<'pl' | 'enemy', { hp: number }>) {
  return { plHp: s.pl.hp, enemyHp: s.enemy.hp };
}

/** キャラクターが自動戦闘に臨めるか。臨めなければ理由を返す（戦闘のシーンへ入る前に確かめ、進めなくなる状態を防ぐ） */
export function canFight(c: Pick<Character, 'hp' | 'baseActionValue' | 'deck'>): string | null {
  if (!c.hp || !isPositiveInt(c.hp.max)) return 'HPを持たないため戦えません';
  if (!isPositiveInt(c.baseActionValue)) return '行動値を持たないため戦えません';
  if (!c.deck.some((card) => validatePriority([card]) === null))
    return '自動戦闘に使えるカードを1枚も持っていないため戦えません';
  return null;
}

/** カウント制は整数のカウントと行動値の一致で進むため、行動値・コスト・HPは1以上の整数に限る */
function isPositiveInt(n: number | undefined): n is number {
  return n !== undefined && Number.isInteger(n) && n >= 1;
}
