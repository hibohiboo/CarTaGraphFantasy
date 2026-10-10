import type { Abilities } from '@cartagraph/domain/check/model';

/**
 * 旅立ちの酒場の「得意の3択」で配る能力値。
 * 体技心の配分方法は正式仕様として未決（docs/provisional/character-creation.md）。
 * ここでは3択の固定プリセットという、このチュートリアル固有の仮ルールで進める
 * （CharacterCreatePageの「合計を範囲内で自由配分」とは別の仮ルール）。
 * キャラクターの作成（POST /api/characters）が配分を rules/character-creation.json の abilities で検査するので、
 * どのプリセットも合計を abilities.total（いまは9）に揃え、どれも min〜max に収める（tutorial.test.tsx が確かめる）
 */
export const ABILITY_PRESETS: { id: string; name: string; abilities: Abilities }[] = [
  { id: 'preset-body', name: '力自慢', abilities: { body: 5, skill: 2, mind: 2 } },
  { id: 'preset-skill', name: '身軽さ', abilities: { body: 2, skill: 5, mind: 2 } },
  { id: 'preset-mind', name: '知恵者', abilities: { body: 2, skill: 2, mind: 5 } },
];
