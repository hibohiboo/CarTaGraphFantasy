// 配る条件・使える条件の判定（docs/cartagraph/solo-village.md「配る条件・使える条件」、GM不在のソロの仮ルール）。
// セッションの遷移（session/transition.ts）と村のルール（soloVillage/rules.ts）の両方が使うので、
// 循環を避けてカードの側に置く（docs/process/rules/architecture.md「packages/domain の中の置き場所」）。

import type { CardCondition, CardDef } from './model';

/** 手持ちのカードに、このタグのカードがあるか */
export const hasTag = (held: CardDef[], tag: string) => held.some((c) => c.tags.includes(tag));

export function meetsCondition(cond: CardCondition | undefined, held: CardDef[]): boolean {
  return conditionFailure(cond, held) === null;
}

/** 条件を満たさない理由（満たすなら null）。画面に出す選べない理由の文言 */
export function conditionFailure(cond: CardCondition | undefined, held: CardDef[]): string | null {
  if (!cond) return null;
  const missing = cond.hasTags?.find((t) => !hasTag(held, t));
  if (missing) return `『${missing}』のカードが必要`;
  const forbidden = cond.lacksTags?.find((t) => hasTag(held, t));
  if (forbidden) return `『${forbidden}』のカードを持っていると選べない`;
  const owned = held.find((c) => cond.lacksCards?.includes(c.id));
  if (owned) return `『${owned.name}』をすでに持っている`;
  return null;
}
