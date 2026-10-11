// API の一覧（docs/plans/2026-10-11-APIドキュメント.md T5）。

import { describe, expect, it } from 'vitest';
import type { AnyRequestBody } from '../body/parse';
import * as characters from '../characters/request';
import { routeKey } from '../endpoint/define';
import * as recruitments from '../recruitments/request';
import * as scenarios from '../scenarios/request';
import * as sessions from '../sessions/request';
import { endpoints } from './endpoints';

/** request.ts が定義した本文のスキーマのすべて */
const allBodies = [characters, recruitments, scenarios, sessions].flatMap((m) =>
  Object.values(m).filter(
    (v): v is AnyRequestBody => typeof v === 'object' && v !== null && 'schema' in v,
  ),
);

describe('API の一覧', () => {
  it('同じメソッドとパス（引数の名前はそろえる）が2回出ない', () => {
    const keys = endpoints.map(routeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('request.ts の本文のスキーマ（16本）は、どれもちょうど1つの API の body になっている', () => {
    expect(allBodies).toHaveLength(16);
    for (const body of allBodies) {
      expect(endpoints.filter((e) => e.body === body)).toHaveLength(1);
    }
    expect(endpoints.filter((e) => e.body !== undefined)).toHaveLength(16);
  });

  it('パスは / で始まり、/api を付けない', () => {
    for (const e of endpoints) {
      expect(e.path).toMatch(/^\//);
      expect(e.path.startsWith('/api')).toBe(false);
    }
  });
});
