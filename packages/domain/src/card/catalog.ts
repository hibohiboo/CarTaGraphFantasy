// システムのカード一覧（rules/cards.json）を読み、検査してカードの列にする
// （docs/plans/2026-10-10-ルールとカードプールのJSON管理.md）。
// 形（systemCardsFileSchema）と id の重複を確かめ、誤りがあればファイルのパスを含めて例外を投げる。
// apps/web（MSW。apps/web/src/mocks/rulesFiles.ts）とシミュレーションのスクリプトが使う。

import { z } from 'zod';
import { type CardDef, systemCardsFileSchema } from './model';

export function parseSystemCards(path: string, raw: unknown): CardDef[] {
  const parsed = systemCardsFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${path} の形が誤っている:\n${z.prettifyError(parsed.error)}`);
  }
  const { cards } = parsed.data;
  // scenario/refs.ts の duplicates は依存の向き（card は scenario を読めない）で使えないので、ここで数える
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.id)) dup.add(c.id);
    seen.add(c.id);
  }
  const badCost = cards.filter(
    (c) => c.cpCost !== undefined && !(Number.isInteger(c.cpCost) && c.cpCost >= 0),
  );
  if (badCost.length > 0) {
    throw new Error(
      `${path} の CP コストが0以上の整数でない:\n${badCost.map((c) => `- 「${c.id}」の CP コスト ${c.cpCost}`).join('\n')}`,
    );
  }
  if (dup.size > 0) {
    throw new Error(
      `${path} のカード id が重複している:\n${[...dup].map((id) => `- 「${id}」が重複`).join('\n')}`,
    );
  }
  return cards;
}
