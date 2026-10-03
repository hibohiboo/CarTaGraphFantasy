import { describe, expect, it } from 'vitest';
import type { AutoCombatEnemy } from '../autoCombat/model';
import type { CardDef } from '../card/model';
import type { DeckNode } from '../scenario/model';
import type { Session } from './model';
import {
  buildDealtCard,
  checkNarration,
  isAtEnding,
  type NarrationInput,
  narrateHand,
  narrationTargets,
} from './narrate';

const choice = (id: string, nextNodeId?: string): CardDef => ({
  id,
  kind: 'choice',
  name: id,
  tags: [],
  ...(nextNodeId && { nextNodeId }),
});
const skill = (id: string): CardDef => ({ id, kind: 'skill', name: id, tags: [] });
const enemy: AutoCombatEnemy = {
  card: { id: 'en', kind: 'enemy', name: '試験官', tags: [] },
  hp: 10,
  baseActionValue: 10,
  priority: [],
};
const deck: DeckNode[] = [
  { id: 'intro', kind: 'intro', name: '導入', cards: [] },
  {
    id: 'town',
    kind: 'scene',
    name: '街',
    cards: [],
    children: [{ id: 'gate', kind: 'scene', name: '門', cards: [] }],
  },
  { id: 'npc', kind: 'npc', name: '門番', cards: [] },
  { id: 'exam', kind: 'scene', name: '試験', cards: [], autoCombat: { enemy, maxRounds: 20 } },
  {
    id: 'road',
    kind: 'scene',
    name: '街道',
    cards: [],
    children: [{ id: 'end', kind: 'ending', name: '旅立ち', cards: [] }],
  },
];

const session = (
  over: Partial<Pick<Session, 'status' | 'hand'>> & { nodeId?: string } = {},
): Pick<Session, 'status' | 'hand' | 'currentScene'> => ({
  status: over.status ?? 'playing',
  hand: over.hand ?? [choice('look'), choice('go', 'town'), skill('slash')],
  currentScene: { index: 0, total: 5, name: '導入', path: '導入', nodeId: over.nodeId ?? 'intro' },
});
const input = (over: Partial<NarrationInput> = {}): NarrationInput => ({
  flavor: '',
  withdrawCardIds: [],
  choices: [],
  ...over,
});

describe('narrationTargets', () => {
  it('導入・シーン・入れ子のシーン・結末が、デッキの順で出る。入れ子は祖先の名前を添える', () => {
    expect(narrationTargets(deck, undefined)).toEqual([
      { id: 'intro', label: '導入' },
      { id: 'town', label: '街' },
      { id: 'gate', label: '街 › 門' },
      { id: 'road', label: '街道' },
      { id: 'end', label: '街道 › 旅立ち' },
    ]);
  });

  it('いま居るノードは出ない。いま居るノードを変えると、出なかったノードが出る', () => {
    const atTown = narrationTargets(deck, 'town').map((t) => t.id);
    expect(atTown).not.toContain('town');
    expect(atTown).toContain('intro');
    const atIntro = narrationTargets(deck, 'intro').map((t) => t.id);
    expect(atIntro).not.toContain('intro');
    expect(atIntro).toContain('town');
  });

  it('NPC のノードと自動戦闘のノードは出ない', () => {
    const ids = narrationTargets(deck, undefined).map((t) => t.id);
    expect(ids).not.toContain('npc');
    expect(ids).not.toContain('exam');
  });
});

describe('checkNarration', () => {
  it('描写だけ／取り下げだけ／配るだけ／3つ同時、のどれでも OK', () => {
    expect(checkNarration(session(), deck, input({ flavor: '風が吹く' }))).toEqual({ ok: true });
    expect(checkNarration(session(), deck, input({ withdrawCardIds: ['look'] }))).toEqual({
      ok: true,
    });
    expect(checkNarration(session(), deck, input({ choices: [{ name: '待つ' }] }))).toEqual({
      ok: true,
    });
    expect(
      checkNarration(
        session(),
        deck,
        input({
          flavor: '風が吹く',
          withdrawCardIds: ['look'],
          choices: [{ name: '門へ', description: '門を目指す', nextNodeId: 'gate' }],
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('移り先が空文字のカードは、移り先なしとして OK', () => {
    expect(
      checkNarration(session(), deck, input({ choices: [{ name: '待つ', nextNodeId: '' }] })),
    ).toEqual({ ok: true });
  });

  it('描写が空白だけで、取り下げも配るも無ければエラー', () => {
    const r = checkNarration(session(), deck, input({ flavor: '  \n ' }));
    expect(r).toEqual({ ok: false, error: '描写を書くか、選択肢を配るか取り下げてください' });
  });

  it('手札に無い ID・選択肢でないカードの ID・同じ ID を2回、を取り下げるとエラー', () => {
    expect(checkNarration(session(), deck, input({ withdrawCardIds: ['nope'] }))).toEqual({
      ok: false,
      error: '取り下げる選択肢が手札にありません',
    });
    expect(checkNarration(session(), deck, input({ withdrawCardIds: ['slash'] }))).toEqual({
      ok: false,
      error: '取り下げる選択肢が手札にありません',
    });
    expect(checkNarration(session(), deck, input({ withdrawCardIds: ['look', 'look'] }))).toEqual({
      ok: false,
      error: '同じ選択肢を2回取り下げようとしています',
    });
  });

  it('名前が空白だけのカードを配るとエラー', () => {
    expect(checkNarration(session(), deck, input({ choices: [{ name: ' ' }] }))).toEqual({
      ok: false,
      error: '配る選択肢の名前を入力してください',
    });
  });

  it('移り先：入れ子のシーン・結末は OK', () => {
    for (const nextNodeId of ['gate', 'end'])
      expect(
        checkNarration(session(), deck, input({ choices: [{ name: '進む', nextNodeId }] })),
      ).toEqual({ ok: true });
  });

  it('移り先：デッキに無い ID・NPC のノード・自動戦闘のノード・いま居るノードはエラー', () => {
    for (const nextNodeId of ['nowhere', 'npc', 'exam', 'intro'])
      expect(
        checkNarration(session(), deck, input({ choices: [{ name: '進む', nextNodeId }] })),
      ).toEqual({ ok: false, error: `「${nextNodeId}」へは、選択肢で進めません` });
  });

  it('中断・終了のセッションはエラー', () => {
    for (const status of ['suspended', 'ended'] as const)
      expect(checkNarration(session({ status }), deck, input({ flavor: '風' }))).toEqual({
        ok: false,
        error: '進行中のセッションでだけ、描写・選択肢を配れます',
      });
  });

  it('判定の順：終了していて何も変えないなら「進行中でない」、取り下げが不正で名前も空なら取り下げ', () => {
    expect(checkNarration(session({ status: 'ended' }), deck, input())).toEqual({
      ok: false,
      error: '進行中のセッションでだけ、描写・選択肢を配れます',
    });
    expect(
      checkNarration(
        session(),
        deck,
        input({ withdrawCardIds: ['nope'], choices: [{ name: '' }] }),
      ),
    ).toEqual({ ok: false, error: '取り下げる選択肢が手札にありません' });
  });
});

describe('buildDealtCard', () => {
  it('名前・説明文の前後の空白を除き、GM生成のタグを付ける', () => {
    expect(
      buildDealtCard({ name: ' 門へ ', description: ' 門を目指す ', nextNodeId: 'gate' }, 'ch-1'),
    ).toEqual({
      id: 'ch-1',
      kind: 'choice',
      name: '門へ',
      description: '門を目指す',
      nextNodeId: 'gate',
      tags: ['GM生成'],
    });
  });

  it('空の説明文・空の移り先は持たせない', () => {
    expect(buildDealtCard({ name: '待つ', description: '  ', nextNodeId: '' }, 'ch-2')).toEqual({
      id: 'ch-2',
      kind: 'choice',
      name: '待つ',
      tags: ['GM生成'],
    });
  });
});

describe('narrateHand', () => {
  it('取り下げたカードが無くなり、配ったカードが送った順で、残った選択肢の後ろ・PC のカードの前に入る', () => {
    const hand = [choice('look'), choice('go'), skill('slash')];
    const next = narrateHand(hand, ['look'], [choice('a'), choice('b')]);
    expect(next.map((c) => c.id)).toEqual(['go', 'a', 'b', 'slash']);
  });

  it('選択肢が1枚も残らないときは、配ったカードが先頭に入る', () => {
    const hand = [choice('look'), skill('slash')];
    expect(narrateHand(hand, ['look'], [choice('a')]).map((c) => c.id)).toEqual(['a', 'slash']);
  });

  it('元の手札を書き換えない', () => {
    const hand = [choice('look'), skill('slash')];
    narrateHand(hand, ['look'], [choice('a')]);
    expect(hand.map((c) => c.id)).toEqual(['look', 'slash']);
  });
});

describe('isAtEnding', () => {
  it('結末のノード（入れ子でも）なら true', () => {
    expect(isAtEnding(deck, 'end')).toBe(true);
  });

  it('シーンのノード・デッキに無い ID・undefined なら false', () => {
    expect(isAtEnding(deck, 'road')).toBe(false);
    expect(isAtEnding(deck, 'nowhere')).toBe(false);
    expect(isAtEnding(deck, undefined)).toBe(false);
  });
});
