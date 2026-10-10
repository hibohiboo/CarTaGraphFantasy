// API の本文の検査とメッセージ（docs/plans/2026-10-10-APIスキーマの共用.md G2・T1）。

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineBody, safeParseBody } from './parse';

const body = defineBody(
  z.object({
    characterId: z.string(),
    characterIds: z.array(z.string()).optional(),
    choices: z.array(z.object({ name: z.string() })).optional(),
  }),
  { characterIds: '参加させるPCの指定の形が正しくありません' },
);

describe('safeParseBody', () => {
  it('通れば data を返し、知らないキーは捨てる', () => {
    expect(safeParseBody(body, { characterId: 'pc-1', luck: 99 })).toEqual({
      ok: true,
      data: { characterId: 'pc-1' },
    });
  });

  it('個別のメッセージを持たない項目の誤りは、場所つきの決まった文（完全一致）', () => {
    expect(safeParseBody(body, { characterId: 1 })).toEqual({
      ok: false,
      message: '本文の形が正しくありません（characterId）',
    });
  });

  it('入れ子の誤りは、場所を . でつなぐ', () => {
    expect(safeParseBody(body, { characterId: 'x', choices: [{ name: 1 }] })).toEqual({
      ok: false,
      message: '本文の形が正しくありません（choices.0.name）',
    });
  });

  it('最初のキーが表にあれば、入れ子・配列の要素の誤りでもその文', () => {
    for (const characterIds of ['pc-jin', ['pc-jin', 1]])
      expect(safeParseBody(body, { characterId: 'x', characterIds })).toEqual({
        ok: false,
        message: '参加させるPCの指定の形が正しくありません',
      });
  });

  it.each([null, 5, 'x', []])('本文そのものがオブジェクトでない（%o）なら、場所の無い文', (raw) => {
    expect(safeParseBody(body, raw)).toEqual({
      ok: false,
      message: '本文の形が正しくありません',
    });
  });

  it("本文そのものの誤りは、表の '' があればその文", () => {
    const narrate = defineBody(z.object({ flavor: z.string().optional() }), {
      '': '描写・選択肢の指定の形が正しくありません',
    });
    expect(safeParseBody(narrate, null)).toEqual({
      ok: false,
      message: '描写・選択肢の指定の形が正しくありません',
    });
  });

  it('誤りが複数あれば、最初の1件の文', () => {
    const two = defineBody(z.object({ a: z.string(), b: z.string() }), { b: 'b の文' });
    expect(safeParseBody(two, { a: 1, b: 1 })).toEqual({
      ok: false,
      message: '本文の形が正しくありません（a）',
    });
  });
});
