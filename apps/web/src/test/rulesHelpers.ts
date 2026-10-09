// rules/*.json の値からテストの入力を作る（rulesFiles.test.ts・pages.test.tsx）。
// CP 予算やカードのコストをテストに書き写さないため（docs/process/rules/testing.md「独自のマジック値を作らない」）。

import type { CardDef } from '@cartagraph/domain/card/model';
import { basicPool } from '@cartagraph/domain/character/creation';
import { characterCreation, systemCards } from '../mocks/rulesFiles';

/** 基本カードプールから、CP コストの合計がちょうど target になる組（無ければ例外） */
export function cardsCosting(target: number): CardDef[] {
  const cards = basicPool(characterCreation, systemCards);
  const pick = (from: number, rest: number): CardDef[] | null => {
    if (rest === 0) return [];
    for (let i = from; i < cards.length; i++) {
      const card = cards[i];
      const cost = card?.cpCost ?? 0;
      if (card && cost > 0 && cost <= rest) {
        const tail = pick(i + 1, rest - cost);
        if (tail) return [card, ...tail];
      }
    }
    return null;
  };
  const found = pick(0, target);
  if (!found) throw new Error(`CP の合計が ${target} になるカードの組が基本カードプールに無い`);
  return found;
}
