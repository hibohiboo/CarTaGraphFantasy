// キャラクター（docs/cartagraph/character-growth.md、典型ロールは role-and-scenario.md、称号は comparison-and-titles.md）。

import type { CardDef } from '../card/model';
import type { Abilities } from '../check/model';

/** 典型ロールの通称（PCが持つデータから導出する。固定属性ではない） */
export type CharacterArchetype = 'traveler' | 'explorer' | 'adventurer';

export const ARCHETYPE_LABEL: Record<CharacterArchetype, string> = {
  traveler: '旅人',
  explorer: '探索者',
  adventurer: '冒険者',
};

export interface Character {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  /** 能力値を持たなければ旅人 */
  abilities?: Abilities;
  hp?: { current: number; max: number };
  /** 戦闘用の基本行動値（冒険者のみ） */
  baseActionValue?: number;
  /** キャラクターデッキ（所有・構成デッキ） */
  deck: CardDef[];
  /** 称号タグ（特徴カードの一種。所有者が反映を選んだもの） */
  titles: string[];
  /** 結末タグ（後続シナリオの前提タグと突き合わせる） */
  endingTags: string[];
  cp: { total: number; spent: number };
  createdAt: string;
}
