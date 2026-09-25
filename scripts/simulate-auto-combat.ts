// 自動戦闘（docs/cartagraph/auto-combat.md、仮ルール）の数値バランスを確かめるシミュレーション。
// 検証用シナリオ sc-village-start（apps/web/src/mocks/fixtures.ts）の初期装備と試験官を使い、
// 代表的な戦い方ごとに何千回も戦わせて、勝率と決着ラウンドを docs/cartagraph/auto-combat-simulation.md に書き出す。
//
// 実行は任意のタイミングで `pnpm sim:auto-combat`（CI・git フックでは回さない）。
//   pnpm sim:auto-combat -- --runs=10000 --seed=42   回数・乱数の種を変える
// 乱数は種つきなので、fixture の数値が同じなら何度回しても同じ表になる（差分が出たら数値が変わったということ）。

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarios } from '../apps/web/src/mocks/fixtures';
import { resolveAutoCombat } from '../packages/domain/src/autoCombat';
import {
  type CardDef,
  HP_CONDITION_LABEL,
  type HpCondition,
  type PriorityEntry,
} from '../packages/domain/src/index';
import { findDeckNode } from '../packages/domain/src/sceneTransition';

const SCENARIO_ID = 'sc-village-start';
const EXAM_NODE_ID = 'vs-exam';
const OUTPUT = resolve('docs/cartagraph/auto-combat-simulation.md');

/** 比べる戦い方。カードIDは初期装備（soloStarter）のカード */
const STRATEGIES: { rows: [cardId: string, when: HpCondition][] }[] = [
  { rows: [['c-slash', 'always']] },
  {
    rows: [
      ['c-heavy-blow', 'always'],
      ['c-slash', 'always'],
    ],
  },
  {
    rows: [
      ['c-first-aid', 'always'],
      ['c-slash', 'always'],
    ],
  },
  {
    rows: [
      ['c-first-aid', 'half'],
      ['c-slash', 'always'],
    ],
  },
  {
    rows: [
      ['c-first-aid', 'half'],
      ['c-heavy-blow', 'always'],
      ['c-slash', 'always'],
    ],
  },
  {
    rows: [
      ['c-first-aid', 'quarter'],
      ['c-heavy-blow', 'always'],
      ['c-slash', 'always'],
    ],
  },
];

function parseArgs() {
  const get = (name: string, fallback: number) => {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    const n = arg ? Number(arg.split('=')[1]) : fallback;
    if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} は1以上の整数で指定してください`);
    return n;
  };
  return { runs: get('runs', 5000), seed: get('seed', 20260926) };
}

/** 種つきの乱数（mulberry32）。[0, 1) を返す */
function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const percent = (n: number, total: number) => `${Math.round((n / total) * 100)}%`;
const at = (sorted: number[], ratio: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
const dice = (c: CardDef) => {
  const e = c.combatEffect;
  if (!e) return '-';
  const { count, sides, bonus } = e.dice;
  return `${count}d${sides}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ''}`;
};
const cardLine = (c: CardDef) =>
  `${c.name}（コスト${c.actionCost}・${c.combatEffect?.type === 'heal' ? '回復' : '攻撃'} ${dice(c)}）`;
const strategyLabel = (rows: PriorityEntry[]) =>
  rows
    .map((r) =>
      r.when === 'always' ? r.card.name : `${r.card.name}（${HP_CONDITION_LABEL[r.when]}）`,
    )
    .join(' → ');

function main() {
  const { runs, seed } = parseArgs();
  const scenario = scenarios.find((s) => s.id === SCENARIO_ID);
  const starter = scenario?.soloStarter;
  const combat = scenario && findDeckNode(scenario.deck, EXAM_NODE_ID)?.node.autoCombat;
  if (!starter || !combat)
    throw new Error(`${SCENARIO_ID} に初期装備か試験（${EXAM_NODE_ID}）がありません`);
  const { enemy, maxRounds } = combat;
  const cardById = (id: string) => {
    const card = starter.cards.find((c) => c.id === id);
    if (!card) throw new Error(`初期装備にカード ${id} がありません`);
    return card;
  };

  const rows = STRATEGIES.map((st) => {
    const priority: PriorityEntry[] = st.rows.map(([id, when]) => ({ card: cardById(id), when }));
    const rng = seededRng(seed);
    const count = { win: 0, lose: 0, timeout: 0 };
    const rounds: number[] = [];
    for (let i = 0; i < runs; i++) {
      const r = resolveAutoCombat({
        pl: { name: 'PL', maxHp: starter.hp, baseActionValue: starter.baseActionValue, priority },
        enemy: {
          name: enemy.card.name,
          maxHp: enemy.hp,
          baseActionValue: enemy.baseActionValue,
          priority: enemy.priority,
        },
        maxRounds,
        rng,
      });
      count[r.outcome]++;
      rounds.push(r.rounds);
    }
    rounds.sort((a, b) => a - b);
    return `| ${strategyLabel(priority)} | ${percent(count.win, runs)} | ${percent(count.lose, runs)} | ${percent(count.timeout, runs)} | ${at(rounds, 0.5)} | ${at(rounds, 0.1)}〜${at(rounds, 0.9)} |`;
  });

  const md = `# 自動戦闘のシミュレーション結果

<!-- このページは scripts/simulate-auto-combat.ts が生成する。手で編集しない（pnpm sim:auto-combat で作り直す） -->

[自動戦闘（仮ルール）](auto-combat.md)の数値バランスを確かめるため、検証用シナリオ「${scenario.title}」の初期装備と試験官で、代表的な戦い方ごとに${runs.toLocaleString('ja-JP')}回ずつ戦わせた結果。**仕様ではなく、数値を調整するときの参考資料**である。数値の相場観は[数値バランスの相場観](balance.md)を参照。

- 生成日：${new Date().toISOString().slice(0, 10)}
- 回数：戦い方ごとに${runs.toLocaleString('ja-JP')}回（乱数の種：${seed}。数値が同じなら何度回しても同じ結果になる）
- 作り直し方：\`pnpm sim:auto-combat\`（回数・種は \`pnpm sim:auto-combat -- --runs=10000 --seed=42\` のように変えられる）

## 条件

| | HP | 基本行動値 | 優先順位（カード） |
|---|---|---|---|
| PL（初期装備） | ${starter.hp} | ${starter.baseActionValue} | ${starter.cards.map(cardLine).join('、')} |
| ${enemy.card.name} | ${enemy.hp} | ${enemy.baseActionValue} | ${enemy.priority.map((r) => cardLine(r.card)).join(' → ')} |

ラウンド上限は${maxRounds}ラウンド（超えたら時間切れ＝PLの敗北扱い）。

## 結果

| PLの戦い方（優先順位） | 勝率 | 敗北 | 時間切れ | 決着ラウンド（中央値） | 決着ラウンド（10〜90%） |
|---|---|---|---|---|---|
${rows.join('\n')}

- 条件の書かれていないカードは「いつでも」。
- 決着ラウンドは、勝ち・負け・時間切れのすべてを含めた、戦闘が終わったラウンド。
`;
  writeFileSync(OUTPUT, md);
  console.log(`wrote ${OUTPUT}`);
  console.log(rows.join('\n'));
}

main();
