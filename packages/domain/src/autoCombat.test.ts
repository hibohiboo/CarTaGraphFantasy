import { describe, expect, it } from 'vitest';
import {
  type Combatant,
  canFight,
  pickCard,
  type Rng,
  resolveAutoCombat,
  rollDice,
  validatePriority,
} from './autoCombat';
import type { CardDef, CombatEffect, HpCondition, PriorityEntry } from './index';

/** 与えた列を順に返し、尽きたら最後の値を返し続ける乱数 */
const seq =
  (...values: number[]): Rng =>
  () =>
    values.length > 1 ? (values.shift() as number) : values[0];

describe('rollDice', () => {
  it('乱数が常に0なら全ダイスが1になり、合計は count + bonus', () => {
    expect(rollDice({ count: 2, sides: 6, bonus: 3 }, seq(0))).toEqual({ rolls: [1, 1], total: 5 });
  });

  it('乱数が常に0.999なら全ダイスが最大目になり、合計は count × sides + bonus', () => {
    expect(rollDice({ count: 2, sides: 6, bonus: 3 }, seq(0.999))).toEqual({
      rolls: [6, 6],
      total: 15,
    });
  });

  it('ダイス1個ごとに乱数を1回使う', () => {
    expect(rollDice({ count: 2, sides: 6, bonus: 0 }, seq(0, 0.999))).toEqual({
      rolls: [1, 6],
      total: 7,
    });
  });

  it('中間の乱数は対応する目になる（0.5 → 1d6 の 4）', () => {
    expect(rollDice({ count: 1, sides: 6, bonus: 1 }, seq(0.5))).toEqual({ rolls: [4], total: 5 });
  });
});

/** テスト用の戦闘スキルカード。ダイスは固定値にしたいときは sides: 1 を使う */
const card = (id: string, actionCost: number | undefined, effect?: CombatEffect): CardDef => ({
  id,
  kind: 'skill',
  name: id,
  tags: ['戦闘スキル'],
  actionCost,
  combatEffect: effect,
});
/** カードを条件「いつでも」の優先順位の行にする */
const list = (...cards: CardDef[]): PriorityEntry[] =>
  cards.map((card) => ({ card, when: 'always' }));
const when = (card: CardDef, cond: HpCondition): PriorityEntry => ({ card, when: cond });
const hit = (n: number): CombatEffect => ({
  type: 'damage',
  dice: { count: 1, sides: 1, bonus: n - 1 },
});
const heal = (n: number): CombatEffect => ({
  type: 'heal',
  dice: { count: 1, sides: 1, bonus: n - 1 },
});

describe('pickCard', () => {
  const light = card('軽', 2, hit(2));
  const heavy = card('重', 5, hit(6));
  const aid = card('手当', 3, heal(4));

  it('先頭が使えれば先頭を選ぶ', () => {
    expect(pickCard({ hp: 10, maxHp: 10, actionValue: 10 }, list(heavy, light))).toBe(heavy);
  });

  it('残り行動値がコストちょうどなら使える', () => {
    expect(pickCard({ hp: 10, maxHp: 10, actionValue: 5 }, list(heavy, light))).toBe(heavy);
  });

  it('残り行動値がコストより1少なければ使えず、次の候補を選ぶ', () => {
    expect(pickCard({ hp: 10, maxHp: 10, actionValue: 4 }, list(heavy, light))).toBe(light);
  });

  it('HPが最大なら回復を飛ばして次の候補を選ぶ', () => {
    expect(pickCard({ hp: 10, maxHp: 10, actionValue: 10 }, list(aid, light))).toBe(light);
  });

  it('HPが最大より1少なければ回復を選ぶ', () => {
    expect(pickCard({ hp: 9, maxHp: 10, actionValue: 10 }, list(aid, light))).toBe(aid);
  });

  it('使えるカードが無ければ null', () => {
    expect(pickCard({ hp: 10, maxHp: 10, actionValue: 1 }, list(heavy, light, aid))).toBeNull();
  });

  describe('使う条件（HPの段階）', () => {
    const at = (hp: number, maxHp: number) => ({ hp, maxHp, actionValue: 10 });

    it('「半分以下」は、最大HP20ならHP10で使え、11では使えず次の候補へ', () => {
      expect(pickCard(at(10, 20), [when(aid, 'half'), ...list(light)])).toBe(aid);
      expect(pickCard(at(11, 20), [when(aid, 'half'), ...list(light)])).toBe(light);
    });

    it('「半分以下」は、最大HP21（奇数）ならHP10で使え、11では使えない', () => {
      expect(pickCard(at(10, 21), [when(aid, 'half'), ...list(light)])).toBe(aid);
      expect(pickCard(at(11, 21), [when(aid, 'half'), ...list(light)])).toBe(light);
    });

    it('「1/4以下」は、最大HP20ならHP5で使え、6では使えない', () => {
      expect(pickCard(at(5, 20), [when(aid, 'quarter'), ...list(light)])).toBe(aid);
      expect(pickCard(at(6, 20), [when(aid, 'quarter'), ...list(light)])).toBe(light);
    });

    it('攻撃カードにも条件を付けられる', () => {
      expect(pickCard(at(15, 20), [when(heavy, 'half'), ...list(light)])).toBe(light);
      expect(pickCard(at(10, 20), [when(heavy, 'half'), ...list(light)])).toBe(heavy);
    });
  });

  it('空のリストなら null', () => {
    expect(pickCard({ hp: 10, maxHp: 10, actionValue: 10 }, list())).toBeNull();
  });
});

describe('validatePriority', () => {
  it('1枚ちょうどの正しいリストなら null', () => {
    expect(validatePriority(list(card('a', 1, hit(1))))).toBeNull();
  });

  it('0件はエラー', () => {
    expect(validatePriority(list())).toMatch(/1枚以上/);
  });

  it('自動戦闘の効果を持たないカードを含むとエラー', () => {
    expect(validatePriority(list(card('a', 3, hit(1)), card('b', 3)))).toMatch(/効果/);
  });

  it('コストが未設定のカードを含むとエラー', () => {
    expect(validatePriority(list(card('a', undefined, hit(1))))).toMatch(/コスト/);
  });

  it('コストが0のカードを含むとエラー（同じカウントで行動し続けてしまうため）', () => {
    expect(validatePriority(list(card('a', 0, hit(1))))).toMatch(/コスト/);
  });

  it('使う条件が3種のどれでもなければエラー', () => {
    const bad = { card: card('a', 2, hit(1)), when: 'sometimes' } as unknown as PriorityEntry;
    expect(validatePriority([bad])).toMatch(/条件/);
  });

  it('同じカードが重複しているとエラー', () => {
    const a = card('a', 2, hit(1));
    expect(validatePriority(list(a, a))).toMatch(/重複/);
  });
});

describe('resolveAutoCombat', () => {
  const fighter = (
    name: string,
    maxHp: number,
    baseActionValue: number,
    priority: CardDef[],
  ): Combatant => ({ name, maxHp, baseActionValue, priority: list(...priority) });
  const run = (pl: Combatant, enemy: Combatant, maxRounds = 20, rng: Rng = seq(0)) =>
    resolveAutoCombat({ pl, enemy, maxRounds, rng });
  /** ログを「行動者@カウント:カード名」の列にする */
  const trace = (log: { actor: string; count: number; cardName: string; effect: string }[]) =>
    log.map((e) => `${e.actor}@${e.count}:${e.effect === 'pass' ? 'pass' : e.cardName}`);

  describe('入力の検査（ループしないこと）', () => {
    const ok = fighter('PL', 10, 10, [card('打', 3, hit(1))]);

    it('敵の優先順位にコスト0のカードがあると例外', () => {
      expect(() => run(ok, fighter('敵', 10, 10, [card('零', 0, hit(1))]))).toThrow(/コスト/);
    });

    it('PLの優先順位が空なら例外', () => {
      expect(() => run(fighter('PL', 10, 10, []), ok)).toThrow(/1枚以上/);
    });

    it('基本行動値が0なら例外', () => {
      expect(() => run(ok, fighter('敵', 10, 0, [card('打', 3, hit(1))]))).toThrow(/行動値/);
    });

    it('最大HPが0なら例外', () => {
      expect(() => run(fighter('PL', 0, 10, [card('打', 3, hit(1))]), ok)).toThrow(/HP/);
    });

    it('ラウンド上限が0なら例外', () => {
      expect(() => run(ok, ok, 0)).toThrow(/ラウンド/);
    });

    it('基本行動値が整数でなければ例外（カウントと一致せず行動できなくなるため）', () => {
      expect(() => run(ok, fighter('敵', 10, 2.5, [card('打', 1, hit(1))]))).toThrow(/行動値/);
    });

    it('ラウンド上限が整数でなければ例外', () => {
      expect(() => run(ok, ok, 2.5)).toThrow(/ラウンド/);
    });

    it('ダイスの修正値が NaN なら例外（HPが NaN になり決着しなくなるため）', () => {
      const bad: CombatEffect = { type: 'damage', dice: { count: 1, sides: 6, bonus: Number.NaN } };
      expect(() => run(fighter('PL', 10, 10, [card('打', 3, bad)]), ok)).toThrow(/修正値/);
    });

    it('最大HPが NaN なら例外', () => {
      expect(() => run(fighter('PL', Number.NaN, 10, [card('打', 3, hit(1))]), ok)).toThrow(/HP/);
    });
  });

  describe('validatePriority の数値検査', () => {
    it('コストが整数でなければエラー', () => {
      expect(validatePriority(list(card('a', 1.5, hit(1))))).toMatch(/コスト/);
    });

    it('ダイスの面数が0ならエラー', () => {
      const bad: CombatEffect = { type: 'damage', dice: { count: 1, sides: 0, bonus: 0 } };
      expect(validatePriority(list(card('a', 2, bad)))).toMatch(/ダイス/);
    });

    it('ダイスの個数が0ならエラー', () => {
      const bad: CombatEffect = { type: 'damage', dice: { count: 0, sides: 6, bonus: 0 } };
      expect(validatePriority(list(card('a', 2, bad)))).toMatch(/ダイス/);
    });
  });

  describe('canFight（自動戦闘のシーンへ進めるか）', () => {
    const fightable = card('打', 3, hit(1));

    it('HP・行動値・自動戦闘の効果を持つカードがそろっていれば null', () => {
      expect(
        canFight({ hp: { current: 5, max: 5 }, baseActionValue: 5, deck: [fightable] }),
      ).toBeNull();
    });

    it('HPが無ければ理由を返す', () => {
      expect(canFight({ baseActionValue: 5, deck: [fightable] })).toMatch(/HP/);
    });

    it('行動値が無ければ理由を返す', () => {
      expect(canFight({ hp: { current: 5, max: 5 }, deck: [fightable] })).toMatch(/行動値/);
    });

    it('自動戦闘の効果を持つカードが1枚も無ければ理由を返す', () => {
      expect(
        canFight({ hp: { current: 5, max: 5 }, baseActionValue: 5, deck: [card('剣', undefined)] }),
      ).toMatch(/カード/);
    });
  });

  it('カウント制どおりの行動順になる（同じラウンドの再行動・途中の同値はスタック・払えなければパス）', () => {
    // PL 行動値12・コスト3、敵 行動値10・コスト4。
    // 12:PL→9 / 10:敵→6 / 9:PL→6 / 6:両者6だが後から6になったPLが先→3、続いて敵→2 / 3:PL→0 / 2:敵は払えずパス
    const pl = fighter('PL', 100, 12, [card('突', 3, hit(1))]);
    const enemy = fighter('敵', 100, 10, [card('打', 4, hit(1))]);
    expect(trace(run(pl, enemy, 1).log)).toEqual([
      'pl@12:突',
      'enemy@10:打',
      'pl@9:突',
      'pl@6:突',
      'enemy@6:打',
      'pl@3:突',
      'enemy@2:pass',
    ]);
  });

  it('行動値13・コスト5なら、同じラウンドの8と3で再行動する', () => {
    const pl = fighter('PL', 100, 13, [card('斬', 5, hit(1))]);
    const enemy = fighter('敵', 100, 1, [card('打', 1, hit(1))]);
    const counts = run(pl, enemy, 1)
      .log.filter((e) => e.actor === 'pl')
      .map((e) => e.count);
    expect(counts).toEqual([13, 8, 3]);
  });

  it('パスしたラウンドの次のラウンドは、基本行動値から始まる（持ち越しはない）', () => {
    // PL 行動値5・コスト3：5で行動→2でパス。次のラウンドも5から行動する
    const pl = fighter('PL', 100, 5, [card('突', 3, hit(1))]);
    const enemy = fighter('敵', 100, 1, [card('打', 1, hit(1))]);
    const plLog = run(pl, enemy, 2).log.filter((e) => e.actor === 'pl');
    expect(plLog.map((e) => `${e.round}@${e.count}:${e.effect}`)).toEqual([
      '1@5:damage',
      '1@2:pass',
      '2@5:damage',
      '2@2:pass',
    ]);
  });

  it('ラウンド開始時に行動値が同じならPLが先。互いに一撃で倒せるなら、PLが勝ち敵は行動しない（同時HP0は起きない）', () => {
    const pl = fighter('PL', 5, 10, [card('突', 3, hit(5))]);
    const enemy = fighter('敵', 5, 10, [card('打', 3, hit(5))]);
    const r = run(pl, enemy);
    expect(r.outcome).toBe('win');
    expect(trace(r.log)).toEqual(['pl@10:突']);
    expect(r.log[0]).toMatchObject({ plHp: 5, enemyHp: 0, amount: 5 });
  });

  it('敵のHPがちょうど0になったら勝利し、そこでログが終わる', () => {
    const pl = fighter('PL', 10, 10, [card('突', 5, hit(3))]);
    const enemy = fighter('敵', 6, 1, [card('打', 1, hit(1))]);
    const r = run(pl, enemy);
    expect(r).toMatchObject({ outcome: 'win', rounds: 1 });
    expect(trace(r.log)).toEqual(['pl@10:突', 'pl@5:突']);
  });

  it('敵のHPが1残れば戦闘は続く', () => {
    const pl = fighter('PL', 10, 10, [card('突', 5, hit(3))]);
    const enemy = fighter('敵', 7, 1, [card('打', 1, hit(1))]);
    const r = run(pl, enemy);
    expect(r.log[1].enemyHp).toBe(1);
    expect(r.log[2]).toMatchObject({ actor: 'enemy', count: 1 });
    expect(r).toMatchObject({ outcome: 'win', rounds: 2 });
  });

  it('PLのHPが0になったら敗北する（途中の同値は後からその値になった敵が先）', () => {
    const pl = fighter('PL', 4, 5, [card('突', 5, hit(1))]);
    const enemy = fighter('敵', 100, 10, [card('打', 5, hit(2))]);
    const r = run(pl, enemy);
    expect(r).toMatchObject({ outcome: 'lose', rounds: 1 });
    expect(trace(r.log)).toEqual(['enemy@10:打', 'enemy@5:打']);
    expect(r.log.at(-1)).toMatchObject({ plHp: 0 });
  });

  it('ラウンド上限ちょうどのラウンドで決着すれば勝利', () => {
    // 1ラウンドに1ダメージ×1回。敵HP3なら3ラウンド目に決着
    const pl = fighter('PL', 10, 3, [card('突', 3, hit(1))]);
    const enemy = fighter('敵', 3, 1, [card('打', 1, hit(0))]);
    expect(run(pl, enemy, 3)).toMatchObject({ outcome: 'win', rounds: 3 });
  });

  it('ラウンド上限までに決着しなければ時間切れ', () => {
    const pl = fighter('PL', 10, 3, [card('突', 3, hit(1))]);
    const enemy = fighter('敵', 3, 1, [card('打', 1, hit(0))]);
    expect(run(pl, enemy, 2)).toMatchObject({ outcome: 'timeout', rounds: 2 });
  });

  it('回復は最大HPで頭打ちになり、最大に戻った後は攻撃を選ぶ', () => {
    // 敵の2ダメージを受けた後、PLは回復(5)で最大10まで戻り（実際の回復量2）、次は攻撃する
    const pl = fighter('PL', 10, 6, [card('手当', 3, heal(5)), card('突', 3, hit(1))]);
    const enemy = fighter('敵', 100, 7, [card('打', 7, hit(2))]);
    const r = run(pl, enemy, 1);
    expect(trace(r.log)).toEqual(['enemy@7:打', 'pl@6:手当', 'pl@3:突']);
    expect(r.log[1]).toMatchObject({ effect: 'heal', amount: 2, plHp: 10 });
  });

  it('ダメージはHP0で止まり、実際に減った量が記録される', () => {
    const pl = fighter('PL', 10, 10, [card('突', 3, hit(9))]);
    const enemy = fighter('敵', 4, 1, [card('打', 1, hit(1))]);
    expect(run(pl, enemy).log[0]).toMatchObject({ amount: 4, enemyHp: 0 });
  });

  it('ダイスの出目がログに残る', () => {
    const twoDice: CombatEffect = { type: 'damage', dice: { count: 2, sides: 6, bonus: 1 } };
    const pl = fighter('PL', 10, 10, [card('突', 3, twoDice)]);
    const enemy = fighter('敵', 100, 1, [card('打', 1, hit(1))]);
    const r = run(pl, enemy, 1, seq(0, 0.999));
    expect(r.log[0]).toMatchObject({ rolls: [1, 6], amount: 8, enemyHp: 92 });
  });

  it('「応急手当（HPが半分以下）→突き」なら、HPが半分を切るまでは攻撃し、切ったら回復する', () => {
    // 敵は毎ラウンド4ダメージ。PL（最大20）は 16→12 の間は攻撃し、8 になったラウンドで回復する
    const pl: Combatant = {
      name: 'PL',
      maxHp: 20,
      baseActionValue: 6,
      priority: [when(card('手当', 3, heal(5)), 'half'), ...list(card('突', 3, hit(1)))],
    };
    const enemy = fighter('敵', 100, 7, [card('打', 7, hit(4))]);
    expect(trace(run(pl, enemy, 3).log)).toEqual([
      'enemy@7:打',
      'pl@6:突',
      'pl@3:突',
      'enemy@7:打',
      'pl@6:突',
      'pl@3:突',
      'enemy@7:打',
      'pl@6:手当',
      'pl@3:突',
    ]);
  });

  it('回復カードだけの優先順位でも、ループせず時間切れで終わる', () => {
    const pl = fighter('PL', 10, 6, [card('手当', 3, heal(5))]);
    const enemy = fighter('敵', 100, 7, [card('打', 7, hit(1))]);
    expect(run(pl, enemy, 3)).toMatchObject({ outcome: 'timeout', rounds: 3 });
  });

  it('同じ乱数列なら同じ結果になる', () => {
    const dice: CombatEffect = { type: 'damage', dice: { count: 2, sides: 6, bonus: 0 } };
    const pl = fighter('PL', 20, 10, [card('突', 4, dice)]);
    const enemy = fighter('敵', 20, 9, [card('打', 4, dice)]);
    const values = [0.1, 0.9, 0.4, 0.7, 0.2, 0.5, 0.8, 0.3];
    expect(run(pl, enemy, 20, seq(...values))).toEqual(run(pl, enemy, 20, seq(...values)));
  });
});
