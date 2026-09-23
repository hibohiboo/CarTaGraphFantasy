import { describe, expect, it } from 'vitest';
import { type AutoCombatEnemy, type CardDef, type DeckNode, SYSTEM_GM_ID } from './index';
import { findDeckNode, planTransition } from './sceneTransition';

const choice = (id: string, nextNodeId?: string): CardDef => ({
  id,
  kind: 'choice',
  name: id,
  tags: [],
  nextNodeId,
});
const enemy: AutoCombatEnemy = {
  card: { id: 'en', kind: 'enemy', name: '試験官', tags: [] },
  hp: 10,
  baseActionValue: 10,
  priority: [],
};
const deck: DeckNode[] = [
  { id: 'intro', kind: 'intro', name: '導入', cards: [choice('行く', 'town')] },
  {
    id: 'town',
    kind: 'scene',
    name: '街',
    cards: [choice('ギルドへ', 'exam'), { id: 'npc', kind: 'npc', name: '門番', tags: [] }],
    children: [
      {
        id: 'exam',
        kind: 'scene',
        name: '試験',
        cards: [choice('合格の証', 'end')],
        autoCombat: { enemy, maxRounds: 20 },
      },
    ],
  },
  { id: 'end', kind: 'ending', name: '旅立ち', cards: [] },
];
const soloGm = { gmId: SYSTEM_GM_ID };
const humanGm = { gmId: 'u-gm' };

describe('findDeckNode', () => {
  it('入れ子の子ノードも見つけ、最上位の祖先の添字と経路を返す', () => {
    const found = findDeckNode(deck, 'exam');
    expect(found?.node.name).toBe('試験');
    expect(found?.topIndex).toBe(1);
    expect(found?.path.map((n) => n.id)).toEqual(['town', 'exam']);
  });

  it('無ければ null', () => {
    expect(findDeckNode(deck, 'nowhere')).toBeNull();
  });
});

describe('planTransition', () => {
  it('最上位のノードへ移ると、現在のシーンと手札の選択肢カードが移り先のものになる', () => {
    expect(planTransition({ deck }, humanGm, 'town')).toEqual({
      ok: true,
      currentScene: { index: 1, total: 3, name: '街', path: '街', nodeId: 'town' },
      choices: [choice('ギルドへ', 'exam')],
      ended: false,
    });
  });

  it('入れ子のノードでは index が祖先の添字、path が「親 › 子」になる', () => {
    const plan = planTransition({ deck }, humanGm, 'exam');
    expect(plan.ok && plan.currentScene).toEqual({
      index: 1,
      total: 3,
      name: '試験',
      path: '街 › 試験',
      nodeId: 'exam',
    });
  });

  it('自動戦闘のノードでは選択肢カードを配らず、戦闘の相手を返す', () => {
    const plan = planTransition({ deck }, soloGm, 'exam');
    expect(plan.ok && plan.choices).toEqual([]);
    expect(plan.ok && plan.autoCombat).toEqual({ enemy, maxRounds: 20 });
  });

  it('人間GMのいないセッションで結末ノードへ移ると終了する', () => {
    const plan = planTransition({ deck }, soloGm, 'end');
    expect(plan.ok && plan.ended).toBe(true);
  });

  it('人間GMのセッションでは結末ノードへ移っても終了しない（GMが宣言する）', () => {
    const plan = planTransition({ deck }, humanGm, 'end');
    expect(plan.ok && plan.ended).toBe(false);
  });

  it('人間GMのいないセッションでも、結末以外のノードでは終了しない', () => {
    const plan = planTransition({ deck }, soloGm, 'town');
    expect(plan.ok && plan.ended).toBe(false);
  });

  it('存在しないノードを指すと失敗する', () => {
    expect(planTransition({ deck }, soloGm, 'nowhere')).toEqual({
      ok: false,
      error: expect.stringMatching(/nowhere/),
    });
  });
});
