// docs/plans/2026-09-27-村パート.md「5. 新規テストケース（ドメイン単体）」に対応する。
import { describe, expect, it } from 'vitest';
import type { CardDef } from '../card/model';
import type { Character } from '../character/model';
import type { Abilities } from '../check/model';
import type { Session } from '../session/model';
import {
  applySoloEffect,
  grantEndingTag,
  heldCards,
  isSoloRuleCard,
  resolveGainCards,
  unplayableReason,
} from './rules';

const card = (id: string, tags: string[], extra: Partial<CardDef> = {}): CardDef => ({
  id,
  kind: 'item',
  name: id,
  tags,
  ...extra,
});
const voucher = (id = 'v1') => card(id, ['引換'], { name: `${id}からの報酬` });
const slash = card('c-slash', ['戦闘スキル', '攻撃'], { kind: 'skill', name: '斬撃' });
const achievement = card('ach-boar', ['達成', '達成:猪'], {
  kind: 'info',
  name: '猪の件を片づけた',
});
const lantern = card('c-lantern', ['道具'], { name: '灯火のランタン', cpCost: 1 });
/** システムのカード一覧と能力値の上限（rules/。docs/plans/2026-10-10-ルールとカードプールのJSON管理.md） */
const system = { cards: [slash, lantern], abilityMax: 5 };

/** どの PC も作成したときから能力値・HP・行動値を持つ（docs/cartagraph/character-growth.md「PCが持つデータ」） */
const pc = (extra: Partial<Character> = {}): Character => ({
  id: 'pc',
  name: '新人',
  ownerId: 'u',
  ownerName: 'U',
  abilities: { body: 3, skill: 3, mind: 3 },
  hp: { current: 20, max: 20 },
  baseActionValue: 10,
  deck: [],
  titles: [],
  endingTags: [],
  cp: { total: 5, spent: 0 },
  createdAt: '2026-09-27T00:00:00Z',
  ...extra,
});
const field = (gmOnly: CardDef[] = [], plVisible: CardDef[] = []): Session['field'] => ({
  gmOnly,
  plVisible,
});

/** 効果を適用し、成功を前提にキャラクターと文を返す */
function apply(c: Character, effect: Parameters<typeof applySoloEffect>[1], s = system) {
  const r = applySoloEffect(c, effect, s);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('heldCards', () => {
  it('キャラクターデッキと、GM専用ゾーンの「達成」タグのカードだけを含む', () => {
    const gmSecret = card('npc-secret', ['正体は裏'], { kind: 'npc' });
    const onTable = card('en', ['戦闘不能'], { kind: 'enemy' });
    const held = heldCards({ deck: [voucher()] }, field([achievement, gmSecret], [onTable]));
    expect(held.map((c) => c.id)).toEqual(['v1', 'ach-boar']);
  });
});

describe('unplayableReason', () => {
  it('使える条件が無ければ null', () => {
    expect(unplayableReason(card('x', []), [])).toBeNull();
  });
  it('満たせば null、満たさなければ欠けているタグ名を含む文', () => {
    const learn = card('learn', [], { playWhen: { hasTags: ['引換'] } });
    expect(unplayableReason(learn, [voucher()])).toBeNull();
    expect(unplayableReason(learn, [])).toBe('『引換』のカードが必要');
  });
  it('手放すタグのカードを持っていなければ、使える条件が無くても選べない', () => {
    const learn = card('learn', [], { soloEffect: { consumeTag: '引換', gainCards: [slash] } });
    expect(unplayableReason(learn, [])).toBe('『引換』のカードが必要');
    expect(unplayableReason(learn, [voucher()])).toBeNull();
  });
  it('手放すタグは達成カードでは満たせない（手放すのはキャラクターデッキのカード）', () => {
    const c = card('x', [], { soloEffect: { consumeTag: '達成' } });
    expect(unplayableReason(c, [achievement])).toBe('『達成』のカードが必要');
  });
  it('持っていてはいけないタグ・カードを持っていれば、その旨の文', () => {
    const c = card('x', [], { playWhen: { lacksTags: ['回復'], lacksCards: ['c-slash'] } });
    expect(unplayableReason(c, [card('h', ['回復'])])).toBe(
      '『回復』のカードを持っていると選べない',
    );
    expect(unplayableReason(c, [slash])).toBe('『斬撃』をすでに持っている');
  });
});

describe('applySoloEffect：能力値', () => {
  it.each<[keyof Abilities, Abilities, string]>([
    ['body', { body: 4, skill: 3, mind: 3 }, '体が1上がった（体 4）'],
    ['skill', { body: 3, skill: 4, mind: 3 }, '技が1上がった（技 4）'],
    ['mind', { body: 3, skill: 3, mind: 4 }, '心が1上がった（心 4）'],
  ])('%s に＋1し、ほかの2つは変わらない', (ability, expected, line) => {
    const { character, lines } = apply(pc(), { raiseAbility: ability });
    expect(character.abilities).toEqual(expected);
    expect(lines).toEqual([line]);
  });

  it('上限（渡した abilityMax。ここでは5）：4なら5に上がり、5なら5のまま', () => {
    const at = (body: number) => pc({ abilities: { body, skill: 1, mind: 1 } });
    expect(apply(at(4), { raiseAbility: 'body' }).character.abilities?.body).toBe(5);
    const capped = apply(at(5), { raiseAbility: 'body' });
    expect(capped.character.abilities?.body).toBe(5);
    expect(capped.lines).toEqual(['体はこれ以上上がらない（体 5）']);
  });

  it('上限は渡した abilityMax：上限3なら 2→3 に上がり、3 で止まる。上限を超えた値（4）は下がらない', () => {
    const at = (body: number) => pc({ abilities: { body, skill: 1, mind: 1 } });
    const max3 = { ...system, abilityMax: 3 };
    expect(apply(at(2), { raiseAbility: 'body' }, max3).character.abilities?.body).toBe(3);
    expect(apply(at(3), { raiseAbility: 'body' }, max3).lines).toEqual([
      '体はこれ以上上がらない（体 3）',
    ]);
    const over = apply(at(4), { raiseAbility: 'body' }, max3);
    expect(over.character.abilities?.body).toBe(4);
    expect(over.lines).toEqual(['体はこれ以上上がらない（体 4）']);
  });

  it('上げる順番によらず同じ結果になる', () => {
    const raise = (order: (keyof Abilities)[]) =>
      order.reduce((c, a) => apply(c, { raiseAbility: a }).character, pc());
    expect(raise(['body', 'skill', 'mind']).abilities).toEqual(
      raise(['mind', 'skill', 'body']).abilities,
    );
  });
});

describe('applySoloEffect：HP・行動値', () => {
  it('すでに HP を持っていれば変えない', () => {
    const c = pc({ hp: { current: 15, max: 15 } });
    expect(apply(c, { raiseAbility: 'body' }).character.hp).toEqual({ current: 15, max: 15 });
  });

  // HP・行動値は作成のルールから来る（冒険者だけにする C3）。HP を持つキャラクターでは古い実装でも
  // 変わらないので、このテストだけでは守れない。守りは型の変更（成長の値の引数を消し、hp・baseActionValue を必須にした）
  it('戦闘スキルを得ても、能力値を上げても、HP・行動値は入力と同じで、文にも出ない', () => {
    const c = pc({ hp: { current: 12, max: 18 }, baseActionValue: 8 });
    const { character, lines } = apply(c, { raiseAbility: 'body', gainCards: [slash] });
    expect(character.hp).toEqual({ current: 12, max: 18 });
    expect(character.baseActionValue).toBe(8);
    expect(lines).toEqual(['体が1上がった（体 4）', '『斬撃』を習った']);
  });
});

describe('resolveGainCards', () => {
  it('gainCards → gainCardIds の順に、深く複製して返す', () => {
    const r = resolveGainCards({ gainCards: [voucher()], gainCardIds: ['c-slash'] }, system.cards);
    if (!r.ok) throw new Error(r.error);
    expect(r.cards.map((c) => c.id)).toEqual(['v1', 'c-slash']);
    expect(r.cards[1]).toEqual(slash);
    expect(r.cards[1]).not.toBe(slash);
    expect(r.cards[1]?.tags).not.toBe(slash.tags);
  });

  it('どちらも無ければ空', () => {
    expect(resolveGainCards({}, system.cards)).toEqual({ ok: true, cards: [] });
  });

  it('一覧に無い id は誤りで、文に id が入る', () => {
    const r = resolveGainCards({ gainCardIds: ['c-slash', 'c-nope'] }, system.cards);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/c-nope/);
  });
});

describe('applySoloEffect：カードの出入り', () => {
  it('gainCardIds の戦闘スキルは一覧から引いて「習った」、スキルでないカードは「受け取った」', () => {
    const { character, lines } = apply(pc(), { gainCardIds: ['c-slash', 'c-lantern'] });
    expect(character.deck).toEqual([slash, lantern]);
    expect(lines).toEqual(['『斬撃』を習った', '『灯火のランタン』を受け取った']);
  });

  it('得たカードの tags に push しても、一覧のカードは元のまま', () => {
    const before = structuredClone(system.cards);
    const { character } = apply(pc(), { gainCardIds: ['c-slash'] });
    character.deck[0]?.tags.push('汚す');
    expect(system.cards).toEqual(before);
  });

  it('一覧に無い id と手放すタグを両方持つとき、失敗してキャラクターは変わらない', () => {
    const c = pc({ deck: [voucher()] });
    const r = applySoloEffect(c, { consumeTag: '引換', gainCardIds: ['c-nope'] }, system);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/c-nope/);
    expect(c.deck.map((x) => x.id)).toEqual(['v1']);
  });

  it('得たカードは元の定義と同じ ID の別オブジェクト', () => {
    const { character } = apply(pc(), { gainCards: [slash] });
    expect(character.deck).toHaveLength(1);
    expect(character.deck[0]).toEqual(slash);
    expect(character.deck[0]).not.toBe(slash);
  });

  it('手放すタグのカードは1枚だけ減る', () => {
    const c = pc({ deck: [voucher('a'), voucher('b')] });
    const { character, lines } = apply(c, { consumeTag: '引換', gainCards: [slash] });
    expect(character.deck.map((x) => x.id)).toEqual(['b', 'c-slash']);
    expect(lines).toContain('『aからの報酬』を手放した');
    expect(lines).toContain('『斬撃』を習った');
  });

  it('手放すタグのカードが無ければ失敗し、キャラクターは変わらない', () => {
    const c = pc();
    const r = applySoloEffect(c, { consumeTag: '引換', gainCards: [slash] }, system);
    expect(r).toEqual({ ok: false, error: '『引換』のカードを持っていない' });
    expect(c.deck).toEqual([]);
  });

  it('スキル以外のカードは「受け取った」', () => {
    expect(apply(pc(), { gainCards: [voucher()] }).lines).toContain('『v1からの報酬』を受け取った');
  });

  it('文には達成カードの名前・タグを書かない', () => {
    const { lines } = apply(pc(), {
      raiseAbility: 'body',
      gainCards: [voucher()],
      achievement,
    });
    expect(lines.join('\n')).not.toMatch(/猪|達成/);
  });

  it('入力のキャラクターを書き換えず、CP も変えない', () => {
    const c = pc({ deck: [voucher()] });
    const snapshot = structuredClone(c);
    const { character } = apply(c, {
      raiseAbility: 'mind',
      consumeTag: '引換',
      gainCards: [slash],
    });
    expect(c).toEqual(snapshot);
    expect(character.cp).toEqual({ total: 5, spent: 0 });
  });
});

describe('grantEndingTag（結末タグの即時反映。仮ルール）', () => {
  it('持っていなければ足し、入力は書き換えない', () => {
    const c = pc({ endingTags: ['灯りの回廊を経験'] });
    const next = grantEndingTag(c, '冒険者になった');
    expect(next.endingTags).toEqual(['灯りの回廊を経験', '冒険者になった']);
    expect(c.endingTags).toEqual(['灯りの回廊を経験']);
  });
  it('すでに持っていれば重ねない', () => {
    const c = pc({ endingTags: ['冒険者になった'] });
    // 同じキャラクターを返す（呼び出し側は、これで「得た」と記録しないことを判断する）
    expect(grantEndingTag(c, '冒険者になった')).toBe(c);
  });
});

describe('isSoloRuleCard（画面に「仮ルール」と出すカードか）', () => {
  it.each<[string, Partial<CardDef>, boolean]>([
    ['成長の効果を持つ', { soloEffect: { raiseAbility: 'body' } }, true],
    ['使える条件を持つ', { playWhen: { hasTags: ['攻撃'] } }, true],
    ['説明文つきで次のシーンへ進む', { description: '門をくぐった。', nextNodeId: 'exam' }, true],
    [
      '説明文を持つが次のシーンへ進まない（GMレスの選択肢の描写。決着済み）',
      { description: '辺りを見回した。' },
      false,
    ],
    ['次のシーンへ進むが説明文が無い', { nextNodeId: 'exam' }, false],
    ['空文字の説明文で次のシーンへ進む', { description: '', nextNodeId: 'exam' }, false],
    [
      '配る条件だけを持つ（手札に出た時点で満たしている）',
      { dealWhen: { lacksTags: ['達成:猪'] } },
      false,
    ],
    ['どれも持たない', {}, false],
  ])('%s → %s', (_, extra, expected) => {
    expect(isSoloRuleCard(card('x', [], { kind: 'choice', ...extra }))).toBe(expected);
  });
});
