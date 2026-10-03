// 能力値のキーの zod スキーマと Abilities の型が一致すること
// （docs/plans/2026-10-03-domainのディレクトリ分割.md で scenario/model.test.ts から移した）。

import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { Abilities, abilityKeySchema } from './model';

describe('abilityKeySchema', () => {
  it('能力値のキーの列挙が Abilities のキーと一致する', () => {
    expectTypeOf<z.infer<typeof abilityKeySchema>>().toEqualTypeOf<keyof Abilities>();
  });
});
