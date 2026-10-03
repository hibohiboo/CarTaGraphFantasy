import { describe, expect, it } from 'vitest';
import { type AutoCombatEnemy, type CardDef, type DeckNode, SYSTEM_GM_ID } from './index';
import { dealChoices, findDeckNode, planTransition } from './sceneTransition';

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
    expect(planTransition({ deck, endings: [] }, humanGm, 'town', [])).toEqual({
      ok: true,
      currentScene: { index: 1, total: 3, name: '街', path: '街', nodeId: 'town' },
      choices: [choice('ギルドへ', 'exam')],
      ended: false,
    });
  });

  it('入れ子のノードでは index が祖先の添字、path が「親 › 子」になる', () => {
    const plan = planTransition({ deck, endings: [] }, soloGm, 'exam', []);
    expect(plan.ok && plan.currentScene).toEqual({
      index: 1,
      total: 3,
      name: '試験',
      path: '街 › 試験',
      nodeId: 'exam',
    });
  });

  it('自動戦闘のノードでは選択肢カードを配らず、戦闘の相手を返す', () => {
    const plan = planTransition({ deck, endings: [] }, soloGm, 'exam', []);
    expect(plan.ok && plan.choices).toEqual([]);
    expect(plan.ok && plan.autoCombat).toEqual({ enemy, maxRounds: 20 });
  });

  it('人間GMのいないセッションで結末ノードへ移ると終了する', () => {
    const plan = planTransition({ deck, endings: [] }, soloGm, 'end', []);
    expect(plan.ok && plan.ended).toBe(true);
  });

  it('人間GMのセッションでは自動戦闘のノードへ進めない（自動戦闘はGM不在のソロ限定）', () => {
    expect(planTransition({ deck, endings: [] }, humanGm, 'exam', [])).toEqual({
      ok: false,
      error: expect.stringMatching(/自動戦闘/),
    });
  });

  it('人間GMのセッションでは結末ノードへ移っても終了しない（GMが宣言する）', () => {
    const plan = planTransition({ deck, endings: [] }, humanGm, 'end', []);
    expect(plan.ok && plan.ended).toBe(false);
  });

  it('人間GMのいないセッションでも、結末以外のノードでは終了しない', () => {
    const plan = planTransition({ deck, endings: [] }, soloGm, 'town', []);
    expect(plan.ok && plan.ended).toBe(false);
  });

  it('存在しないノードを指すと失敗する', () => {
    expect(planTransition({ deck, endings: [] }, soloGm, 'nowhere', [])).toEqual({
      ok: false,
      error: expect.stringMatching(/nowhere/),
    });
  });
});

describe('dealChoices（配る条件。docs/cartagraph/solo-village.md、仮ルール）', () => {
  const voucher: CardDef = { id: 'v', kind: 'item', name: '報酬', tags: ['引換'] };
  const done: CardDef = { id: 'a', kind: 'info', name: '達成', tags: ['達成', '達成:猪'] };
  const square: DeckNode = {
    id: 'square',
    kind: 'scene',
    name: '広場',
    cards: [
      { ...choice('猪へ', 'boar'), dealWhen: { lacksTags: ['達成:猪'] } },
      { ...choice('斬撃を習う'), dealWhen: { lacksCards: ['c-slash'] } },
      choice('お店へ', 'shop'),
      { id: 'npc', kind: 'npc', name: '村長', tags: [] },
    ],
  };
  const slash: CardDef = { id: 'c-slash', kind: 'skill', name: '斬撃', tags: ['戦闘スキル'] };
  const names = (cards: CardDef[]) => cards.map((c) => c.name);

  it('人間GMのいないセッションでは、配る条件を満たすカードだけを配る', () => {
    expect(names(dealChoices(square, [voucher], soloGm))).toEqual(['猪へ', '斬撃を習う', 'お店へ']);
    expect(names(dealChoices(square, [done], soloGm))).toEqual(['斬撃を習う', 'お店へ']);
    expect(names(dealChoices(square, [slash], soloGm))).toEqual(['猪へ', 'お店へ']);
  });

  it('人間GMのセッションでは、配る条件を満たさないカードも配る', () => {
    expect(names(dealChoices(square, [done, slash], humanGm))).toEqual([
      '猪へ',
      '斬撃を習う',
      'お店へ',
    ]);
  });

  it('planTransition も移り先の選択肢カードを配る条件で絞る', () => {
    const plan = planTransition({ deck: [...deck, square], endings: [] }, soloGm, 'square', [done]);
    expect(plan.ok && names(plan.choices)).toEqual(['斬撃を習う', 'お店へ']);
  });
});

describe('planTransition の結末タグ（docs/cartagraph/solo-village.md「結末タグ」、仮ルール）', () => {
  const endings = [
    { id: 'e-ok', name: '旅立ち', grantsTag: '冒険者になった' },
    { id: 'e-plain', name: '静かな結末' },
  ];
  const withEnding = (endingId: string | undefined, kind: DeckNode['kind'] = 'ending') => ({
    deck: [
      ...deck.filter((n) => n.id !== 'end'),
      { id: 'end', kind, name: '旅立ち', cards: [], endingId },
    ],
    endings,
  });

  it('GM不在で、結末のノードが結末タグを持つ結末を指せば、endingTag が返る', () => {
    const plan = planTransition(withEnding('e-ok'), soloGm, 'end', []);
    expect(plan.ok && plan.endingTag).toBe('冒険者になった');
  });

  it.each([
    ['endingId が無い', undefined],
    ['指す結末がシナリオに無い', 'e-missing'],
    ['結末に結末タグが無い', 'e-plain'],
  ])('%s なら endingTag は返らない', (_, endingId) => {
    const plan = planTransition(withEnding(endingId), soloGm, 'end', []);
    expect(plan.ok && plan.endingTag).toBeUndefined();
  });

  it('結末でないノードが endingId を持っていても、endingTag は返らない', () => {
    const plan = planTransition(withEnding('e-ok', 'scene'), soloGm, 'end', []);
    expect(plan.ok && plan.ended).toBe(false);
    expect(plan.ok && plan.endingTag).toBeUndefined();
  });

  it('人間GMのセッションでは、同じ結末のノードでも endingTag は返らない', () => {
    const plan = planTransition(withEnding('e-ok'), humanGm, 'end', []);
    expect(plan.ok && plan.ended).toBe(false);
    expect(plan.ok && plan.endingTag).toBeUndefined();
  });
});
