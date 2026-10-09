// キャラクター作成のルール（rules/character-creation.json）の読み込みと、能力値の配分の判定
// （docs/cartagraph/character-growth.md。能力値の配分と作成時の HP は仮ルール。
// docs/plans/2026-10-10-ルールとカードプールのJSON管理.md）。
// 読み込みは誤りがあればファイルのパスを含めて例外を投げる（apps/web/src/mocks/rulesFiles.ts が起動時に使う）。

import { z } from 'zod';
import { parseSystemCards } from '../card/catalog';
import type { CardDef } from '../card/model';
import type { Abilities } from '../check/model';
import { type CharacterCreationRules, characterCreationRulesSchema } from './model';

/** 形・数値の関係に加え、基本カードプールの id がカード一覧に実在し、CP コストを持つかを確かめる */
export function parseCharacterCreationRules(
  path: string,
  raw: unknown,
  cards: CardDef[],
): CharacterCreationRules {
  const parsed = characterCreationRulesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${path} の形が誤っている:\n${z.prettifyError(parsed.error)}`);
  }
  const rules = parsed.data;
  const errors = basicPoolErrors(rules.basicPoolCardIds, cards);
  if (errors.length > 0) {
    throw new Error(
      `${path} の基本カードプールに誤りがある:\n${errors.map((e) => `- ${e}`).join('\n')}`,
    );
  }
  return rules;
}

function basicPoolErrors(ids: string[], cards: CardDef[]): string[] {
  if (ids.length === 0) return ['基本カードプールが空'];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`「${id}」が重複している`);
    seen.add(id);
    const card = cards.find((c) => c.id === id);
    if (!card) errors.push(`「${id}」がカード一覧に無い`);
    else if (card.cpCost === undefined || !Number.isInteger(card.cpCost) || card.cpCost < 0)
      errors.push(
        `「${id}」の CP コストが無いか、0以上の整数でない（基本カードプールのカードは CP で選ぶ）`,
      );
  }
  return errors;
}

/** 基本カードプールのカード（basicPoolCardIds の順） */
export function basicPool(rules: CharacterCreationRules, cards: CardDef[]): CardDef[] {
  return rules.basicPoolCardIds.flatMap((id) => cards.filter((c) => c.id === id));
}

/** 画面の能力値の初期値：合計を3つにできるだけ均等に配り、余りは体から1ずつ（仮ルールの範囲に収まる） */
export function defaultAbilities(a: CharacterCreationRules['abilities']): Abilities {
  const base = Math.floor(a.total / 3);
  const rest = a.total - base * 3;
  return { body: base + (rest > 0 ? 1 : 0), skill: base + (rest > 1 ? 1 : 0), mind: base };
}

/** 合計がちょうど total で、どれも min〜max か（仮ルール） */
export function abilitiesValid(values: Abilities, a: CharacterCreationRules['abilities']): boolean {
  const list = [values.body, values.skill, values.mind];
  const sum = list.reduce((s, v) => s + v, 0);
  return sum === a.total && list.every((v) => v >= a.min && v <= a.max);
}

/** rules/ の2ファイル（[パス, 中身]）を読み、検査する */
export function loadRules(files: {
  cards: [path: string, raw: unknown];
  creation: [path: string, raw: unknown];
}): { systemCards: CardDef[]; characterCreation: CharacterCreationRules } {
  const systemCards = parseSystemCards(...files.cards);
  const characterCreation = parseCharacterCreationRules(...files.creation, systemCards);
  return { systemCards, characterCreation };
}
