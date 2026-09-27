// docs/plans/2026-09-27-村パート.md「5. 新規テストケース（ドメイン単体）」に対応する。
import { describe, expect, it } from 'vitest';
import {
  type Abilities,
  type CardDef,
  type Character,
  deriveArchetype,
  type Session,
} from './index';
import {
  applySoloEffect,
  grantEndingTag,
  heldCards,
  meetsCondition,
  unplayableReason,
} from './soloVillage';

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
const growth = { hp: 20, baseActionValue: 10 };

const traveler = (extra: Partial<Character> = {}): Character => ({
  id: 'pc',
  name: '新人',
  ownerId: 'u',
  ownerName: 'U',
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
function apply(c: Character, effect: Parameters<typeof applySoloEffect>[1], g = growth) {
  const r = applySoloEffect(c, effect, g);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('meetsCondition', () => {
  const held = [voucher(), slash];
  it('条件が無ければ真', () => {
    expect(meetsCondition(undefined, held)).toBe(true);
    expect(meetsCondition({}, held)).toBe(true);
  });
  it('空配列の条件は真', () => {
    expect(meetsCondition({ hasTags: [], lacksTags: [], lacksCards: [] }, [])).toBe(true);
  });
  it('hasTags：すべて持てば真、1つ欠ければ偽', () => {
    expect(meetsCondition({ hasTags: ['引換', '攻撃'] }, held)).toBe(true);
    expect(meetsCondition({ hasTags: ['引換', '回復'] }, held)).toBe(false);
  });
  it('lacksTags：1枚も無ければ真、1枚あれば偽', () => {
    expect(meetsCondition({ lacksTags: ['達成:猪'] }, held)).toBe(true);
    expect(meetsCondition({ lacksTags: ['達成:猪'] }, [...held, achievement])).toBe(false);
  });
  it('lacksCards：そのIDのカードが無ければ真、あれば偽', () => {
    expect(meetsCondition({ lacksCards: ['c-heavy-blow'] }, held)).toBe(true);
    expect(meetsCondition({ lacksCards: ['c-slash'] }, held)).toBe(false);
  });
  it('複数の項目は、すべて満たして真', () => {
    expect(meetsCondition({ hasTags: ['引換'], lacksCards: ['c-heavy-blow'] }, held)).toBe(true);
    expect(meetsCondition({ hasTags: ['引換'], lacksCards: ['c-slash'] }, held)).toBe(false);
  });
});

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
    ['body', { body: 2, skill: 1, mind: 1 }, '体が1上がった（体 2）'],
    ['skill', { body: 1, skill: 2, mind: 1 }, '技が1上がった（技 2）'],
    ['mind', { body: 1, skill: 1, mind: 2 }, '心が1上がった（心 2）'],
  ])('能力値が無ければ各1で持ち、%s に＋1する（旅人→探索者）', (ability, expected, line) => {
    const before = traveler();
    const { character, lines } = apply(before, { raiseAbility: ability });
    expect(character.abilities).toEqual(expected);
    expect(lines).toContain(line);
    expect(deriveArchetype(before)).toBe('traveler');
    expect(deriveArchetype(character)).toBe('explorer');
  });

  it('能力値があれば＋1し、ほかの2つは変わらない', () => {
    const c = traveler({ abilities: { body: 2, skill: 1, mind: 1 }, hp: { current: 20, max: 20 } });
    expect(apply(c, { raiseAbility: 'skill' }).character.abilities).toEqual({
      body: 2,
      skill: 2,
      mind: 1,
    });
  });

  it('上限5：4なら5に上がり、5なら5のまま', () => {
    const at = (body: number) =>
      traveler({ abilities: { body, skill: 1, mind: 1 }, hp: { current: 20, max: 20 } });
    expect(apply(at(4), { raiseAbility: 'body' }).character.abilities?.body).toBe(5);
    const capped = apply(at(5), { raiseAbility: 'body' });
    expect(capped.character.abilities?.body).toBe(5);
    expect(capped.lines).toEqual(['体はこれ以上上がらない（体 5）']);
  });

  it('上げる順番によらず同じ結果になる', () => {
    const raise = (order: (keyof Abilities)[]) =>
      order.reduce((c, a) => apply(c, { raiseAbility: a }).character, traveler());
    expect(raise(['body', 'skill', 'mind']).abilities).toEqual(
      raise(['mind', 'skill', 'body']).abilities,
    );
  });
});

describe('applySoloEffect：HP・行動値', () => {
  it('能力値を初めて得たとき、HP を持つ', () => {
    const { character, lines } = apply(traveler(), { raiseAbility: 'body' });
    expect(character.hp).toEqual({ current: 20, max: 20 });
    expect(character.baseActionValue).toBeUndefined();
    expect(lines).toContain('HPを得た（HP 20）');
  });
  it('すでに HP を持っていれば変えない', () => {
    const c = traveler({ abilities: { body: 1, skill: 1, mind: 1 }, hp: { current: 15, max: 15 } });
    expect(apply(c, { raiseAbility: 'body' }).character.hp).toEqual({ current: 15, max: 15 });
  });
  it('シナリオが成長の値を持たなければ HP は付かない', () => {
    const r = applySoloEffect(traveler(), { raiseAbility: 'body' }, undefined);
    expect(r.ok && r.character.hp).toBeUndefined();
    expect(r.ok && r.character.abilities).toEqual({ body: 2, skill: 1, mind: 1 });
  });

  it('戦闘スキルを初めて得たとき、行動値を持つ（探索者→冒険者）', () => {
    const explorer = traveler({
      abilities: { body: 2, skill: 1, mind: 1 },
      hp: { current: 20, max: 20 },
    });
    const { character, lines } = apply(explorer, { gainCards: [slash] });
    expect(character.baseActionValue).toBe(10);
    expect(lines).toContain('行動値を得た（行動値 10）');
    expect(deriveArchetype(explorer)).toBe('explorer');
    expect(deriveArchetype(character)).toBe('adventurer');
  });
  it('すでに行動値を持っていれば変えない', () => {
    const c = traveler({ hp: { current: 20, max: 20 }, baseActionValue: 8, deck: [slash] });
    const heavy = card('c-heavy-blow', ['戦闘スキル', '攻撃'], { kind: 'skill' });
    expect(apply(c, { gainCards: [heavy] }).character.baseActionValue).toBe(8);
  });
  it('戦闘スキルでないカード（引換カード）を得ても行動値は付かない', () => {
    const explorer = traveler({
      abilities: { body: 2, skill: 1, mind: 1 },
      hp: { current: 20, max: 20 },
    });
    expect(apply(explorer, { gainCards: [voucher()] }).character.baseActionValue).toBeUndefined();
  });
  it('能力値を持たなくても、戦闘スキルを得れば HP と行動値の両方を持つ', () => {
    const { character } = apply(traveler(), { gainCards: [slash] });
    expect(character.hp).toEqual({ current: 20, max: 20 });
    expect(character.baseActionValue).toBe(10);
  });
});

describe('applySoloEffect：カードの出入り', () => {
  it('得たカードは元の定義と同じ ID の別オブジェクト', () => {
    const { character } = apply(traveler(), { gainCards: [slash] });
    expect(character.deck).toHaveLength(1);
    expect(character.deck[0]).toEqual(slash);
    expect(character.deck[0]).not.toBe(slash);
  });

  it('手放すタグのカードは1枚だけ減る', () => {
    const c = traveler({ deck: [voucher('a'), voucher('b')] });
    const { character, lines } = apply(c, { consumeTag: '引換', gainCards: [slash] });
    expect(character.deck.map((x) => x.id)).toEqual(['b', 'c-slash']);
    expect(lines).toContain('『aからの報酬』を手放した');
    expect(lines).toContain('『斬撃』を習った');
  });

  it('手放すタグのカードが無ければ失敗し、キャラクターは変わらない', () => {
    const c = traveler();
    const r = applySoloEffect(c, { consumeTag: '引換', gainCards: [slash] }, growth);
    expect(r).toEqual({ ok: false, error: '『引換』のカードを持っていない' });
    expect(c.deck).toEqual([]);
  });

  it('スキル以外のカードは「受け取った」', () => {
    expect(apply(traveler(), { gainCards: [voucher()] }).lines).toContain(
      '『v1からの報酬』を受け取った',
    );
  });

  it('文には達成カードの名前・タグを書かない', () => {
    const { lines } = apply(traveler(), {
      raiseAbility: 'body',
      gainCards: [voucher()],
      achievement,
    });
    expect(lines.join('\n')).not.toMatch(/猪|達成/);
  });

  it('入力のキャラクターを書き換えず、CP も変えない', () => {
    const c = traveler({ deck: [voucher()] });
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

describe('grantEndingTag（結末タグの即時付与。仮ルール）', () => {
  it('持っていなければ足し、入力は書き換えない', () => {
    const c = traveler({ endingTags: ['灯りの回廊を経験'] });
    const next = grantEndingTag(c, '冒険者になった');
    expect(next.endingTags).toEqual(['灯りの回廊を経験', '冒険者になった']);
    expect(c.endingTags).toEqual(['灯りの回廊を経験']);
  });
  it('すでに持っていれば重ねない', () => {
    const c = traveler({ endingTags: ['冒険者になった'] });
    expect(grantEndingTag(c, '冒険者になった').endingTags).toEqual(['冒険者になった']);
  });
});
