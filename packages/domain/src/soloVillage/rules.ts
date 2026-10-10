// GM不在のセッションでの村の成長（docs/cartagraph/solo-village.md、仮ルール）の計算。
// 使える条件（選べない理由）と成長の効果の適用を純粋関数で行う（Functional Core）。条件そのものの判定は card/condition.ts。
// 適用するかどうか（GM不在のセッション＝Session.gmless か）の判断と書き込みは、呼び出し側（MSW ハンドラ等）が行う。

import { conditionFailure, hasTag } from '../card/condition';
import type { CardDef, SoloEffect } from '../card/model';
import type { Character } from '../character/model';
import type { Abilities } from '../check/model';
import type { Session } from '../session/model';

const ACHIEVEMENT_TAG = '達成';
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
 * 成長の効果でキャラクターデッキへ加えるカード：シナリオ固有のカード（gainCards）→ システムのカード（gainCardIds を
 * 一覧から引く）の順に、深く複製して返す。一覧に無い id は誤り（読み込み時の検査で止まるので、ここに来るのは
 * MSW のメモリ上で壊したときだけ。docs/plans/2026-10-10-ルールとカードプールのJSON管理.md E7）
 */
export function resolveGainCards(
  effect: SoloEffect,
  systemCards: CardDef[],
): { ok: true; cards: CardDef[] } | { ok: false; error: string } {
  const cards = [...(effect.gainCards ?? [])];
  for (const id of effect.gainCardIds ?? []) {
    const found = systemCards.find((c) => c.id === id);
    if (!found) return { ok: false, error: `カード「${id}」がシステムのカード一覧に無い` };
    cards.push(found);
  }
  return { ok: true, cards: cards.map((c) => structuredClone(c)) };
}

/**
 * 成長の効果を適用した後のキャラクターと、描写・feed に出す文を返す。入力は書き換えない。
 * 文には達成カードを書かない（GM専用ゾーンの存在をPLに見せないため）。
 * 達成カードを場に置くのは呼び出し側の仕事。
 * system はシステムのカード一覧（gainCardIds を引く）と能力値の上限（rules/character-creation.json の
 * abilities.max。solo-village.md「能力値の上がり方」）
 */
export function applySoloEffect(
  character: Character,
  effect: SoloEffect,
  system: { cards: CardDef[]; abilityMax: number },
): { ok: true; character: Character; lines: string[] } | { ok: false; error: string } {
  const gained = resolveGainCards(effect, system.cards);
  if (!gained.ok) return gained;
  const lines: string[] = [];
  let deck = [...character.deck];

  if (effect.consumeTag) {
    const tag = effect.consumeTag;
    const i = deck.findIndex((c) => c.tags.includes(tag));
    if (i < 0) return { ok: false, error: `『${tag}』のカードを持っていない` };
    lines.push(`『${deck[i].name}』を手放した`);
    deck = deck.filter((_, j) => j !== i);
  }

  const abilities = { ...character.abilities };
  if (effect.raiseAbility) {
    const key = effect.raiseAbility;
    const label = ABILITY_LABEL[key];
    if (abilities[key] >= system.abilityMax) {
      lines.push(`${label}はこれ以上上がらない（${label} ${abilities[key]}）`);
    } else {
      abilities[key] += 1;
      lines.push(`${label}が1上がった（${label} ${abilities[key]}）`);
    }
  }

  for (const card of gained.cards) {
    deck.push(card);
    lines.push(`『${card.name}』を${card.kind === 'skill' ? '習った' : '受け取った'}`);
  }

  // HP・行動値は作成したときから持ち、成長の効果では変わらない（solo-village.md）
  return { ok: true, character: { ...character, deck, abilities }, lines };
}
