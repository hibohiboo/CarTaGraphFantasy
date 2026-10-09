// システム製作者のルール（リポジトリ直下の rules/*.json）を読み込む（docs/plans/2026-10-10-ルールとカードプールのJSON管理.md）。
// 検査（形・数値の関係・カードの id の重複と CP コスト・基本カードプールの参照）は packages/domain の loadRules。誤りがあれば読み込みで止まる。
// ファイルは2つで固定なので glob にせず直接 import する（ファイル名の誤りはビルドで止まる）。

import type { CardDef } from '@cartagraph/domain/card/model';
import { loadRules } from '@cartagraph/domain/character/creation';
import rawCards from '../../../../rules/cards.json';
import rawCreation from '../../../../rules/character-creation.json';

export const { systemCards, characterCreation } = loadRules({
  cards: ['rules/cards.json', rawCards],
  creation: ['rules/character-creation.json', rawCreation],
});

/**
 * システムのカードを id で引く（無い id は例外）。返すのは深い複製：一覧は resetDb() で戻らないモジュールの定数なので、
 * デッキ・手札に入れて書き換えても一覧を汚さないようにする
 */
export function systemCard(id: string): CardDef {
  const card = systemCards.find((c) => c.id === id);
  if (!card) throw new Error(`カード「${id}」が rules/cards.json に無い`);
  return structuredClone(card);
}
