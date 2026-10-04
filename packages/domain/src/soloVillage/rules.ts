// GM不在のセッションでの村の成長（docs/cartagraph/solo-village.md、仮ルール）の計算。
// 使える条件（選べない理由）と成長の効果の適用を純粋関数で行う（Functional Core）。条件そのものの判定は card/condition.ts。
// 適用するかどうか（GM不在のセッション＝Session.gmless か）の判断と書き込みは、呼び出し側（MSW ハンドラ等）が行う。

import { conditionFailure, hasTag } from '../card/condition';
import type { CardDef, SoloEffect } from '../card/model';
import { hasCombatSkill } from '../character/archetype';
import type { Character } from '../character/model';
import type { Abilities } from '../check/model';
import type { Scenario } from '../scenario/model';
import type { Session } from '../session/model';

const ACHIEVEMENT_TAG = '達成';
/** 能力値の上限（balance.md「1〜5程度」。仮ルール） */
const ABILITY_MAX = 5;
const ABILITY_LABEL: Record<keyof Abilities, string> = { body: '体', skill: '技', mind: '心' };

/** 条件の判定に使うカード：キャラクターデッキと、GM専用ゾーンのうちタグ「達成」を持つもの */
export function heldCards(character: Pick<Character, 'deck'>, field: Session['field']): CardDef[] {
  return [...character.deck, ...field.gmOnly.filter((c) => c.tags.includes(ACHIEVEMENT_TAG))];
}

/**
 * 選べない理由（選べるなら null）。例：「『引換』のカードが必要」。
 * 使える条件に加え、成長の効果で手放すタグのカードを持っていなければ選べない（solo-village.md「成長の効果」）
 */
export function unplayableReason(card: CardDef, held: CardDef[]): string | null {
  // 手放すのはキャラクターデッキのカードなので、達成カード（GM専用ゾーン）は数えない
  const consume = card.soloEffect?.consumeTag;
  const deckCards = held.filter((c) => !c.tags.includes(ACHIEVEMENT_TAG));
  if (consume && !hasTag(deckCards, consume)) return `『${consume}』のカードが必要`;
  return conditionFailure(card.playWhen, held);
}

/**
 * 画面に「仮ルール」と出すべきカードか（architecture.md「境界」）。成長の効果・使える条件を持つカードと、
 * 説明文つきで次のシーンへ進むカード（シーンに入ったときの描写。solo-village.md「描写」）。
 * 説明文を持つが次のシーンへ進まないカードは、決着済みの「GMレスセッションでの選択肢の描写」なので含めない
 */
export function isSoloRuleCard(card: CardDef): boolean {
  return Boolean(card.soloEffect || card.playWhen || (card.nextNodeId && card.description));
}

/**
 * 結末タグを重ねずに足した新しいキャラクターを返す（solo-village.md「結末タグ」、仮ルール）。入力は書き換えない。
 * すでに持っていれば、入力と同じキャラクターを返す
 */
export function grantEndingTag(character: Character, tag: string): Character {
  if (character.endingTags.includes(tag)) return character;
  return { ...character, endingTags: [...character.endingTags, tag] };
}

/**
 * 成長の効果を適用した後のキャラクターと、描写・feed に出す文を返す。入力は書き換えない。
 * 文には達成カードを書かない（GM専用ゾーンの存在をPLに見せないため）。
 * 達成カードを場に置くのは呼び出し側の仕事。
 */
export function applySoloEffect(
  character: Character,
  effect: SoloEffect,
  growth: Scenario['soloGrowth'],
): { ok: true; character: Character; lines: string[] } | { ok: false; error: string } {
  const lines: string[] = [];
  let deck = [...character.deck];

  if (effect.consumeTag) {
    const tag = effect.consumeTag;
    const i = deck.findIndex((c) => c.tags.includes(tag));
    if (i < 0) return { ok: false, error: `『${tag}』のカードを持っていない` };
    lines.push(`『${deck[i].name}』を手放した`);
    deck = deck.filter((_, j) => j !== i);
  }

  let abilities = character.abilities && { ...character.abilities };
  if (effect.raiseAbility) {
    const key = effect.raiseAbility;
    const label = ABILITY_LABEL[key];
    // 能力値を持たなければ各1から始める（体・技・心の初期配分は未解決論点。仮ルール）
    abilities ??= { body: 1, skill: 1, mind: 1 };
    if (abilities[key] >= ABILITY_MAX) {
      lines.push(`${label}はこれ以上上がらない（${label} ${abilities[key]}）`);
    } else {
      abilities[key] += 1;
      lines.push(`${label}が1上がった（${label} ${abilities[key]}）`);
    }
  }

  for (const gained of effect.gainCards ?? []) {
    deck.push(structuredClone(gained));
    lines.push(`『${gained.name}』を${gained.kind === 'skill' ? '習った' : '受け取った'}`);
  }

  const next: Character = { ...character, deck, ...(abilities && { abilities }) };
  // 探索者（能力値）か冒険者（戦闘スキル）になったのに HP が無ければ持つ。行動値は冒険者だけ
  if (growth && !next.hp && (next.abilities || hasCombatSkill(next))) {
    next.hp = { current: growth.hp, max: growth.hp };
    lines.push(`HPを得た（HP ${growth.hp}）`);
  }
  if (growth && next.baseActionValue === undefined && hasCombatSkill(next)) {
    next.baseActionValue = growth.baseActionValue;
    lines.push(`行動値を得た（行動値 ${growth.baseActionValue}）`);
  }
  return { ok: true, character: next, lines };
}
