// 典型ロール（旅人・探索者・冒険者）を、PCが今持つデータから導く（docs/cartagraph/scenario-type.md）。

import type { Character, CharacterArchetype } from './model';

/** 戦闘スキルカードを持つか（冒険者の条件） */
export function hasCombatSkill(c: Pick<Character, 'deck'>): boolean {
  return c.deck.some((card) => card.tags.includes('戦闘スキル'));
}

/** PCが現在持つデータから典型ロールを導く */
export function deriveArchetype(c: Pick<Character, 'abilities' | 'deck'>): CharacterArchetype {
  if (hasCombatSkill(c)) return 'adventurer';
  if (c.abilities) return 'explorer';
  return 'traveler';
}
