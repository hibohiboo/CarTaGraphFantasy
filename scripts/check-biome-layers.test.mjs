// check-biome-layers.mjs の、層の表と biome.json の突き合わせ（pnpm tools:test）

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findLayerErrors, requiredGroups } from './check-biome-layers.mjs';

/** 層の override を1つ作る（patterns の group をまとめて渡す） */
const override = (includes, ...groups) => ({
  includes,
  linter: {
    rules: {
      style: {
        noRestrictedImports: {
          level: 'error',
          options: { patterns: groups.map((group) => ({ group, message: 'm' })) },
        },
      },
    },
  },
});

describe('requiredGroups', () => {
  it('app は層の外（mocks・test）と、entities に限ったパッケージだけを止める', () => {
    assert.deepEqual(requiredGroups('app'), [
      '@/mocks',
      '@/mocks/**',
      '@/test',
      '@/test/**',
      '@cartagraph/schemas',
      '@cartagraph/schemas/**',
    ]);
  });

  it('pages は app と自分の層、層の外、schemas を止める', () => {
    assert.deepEqual(requiredGroups('pages'), [
      '@/app',
      '@/app/**',
      '@/pages',
      '@/pages/**',
      '@/mocks',
      '@/mocks/**',
      '@/test',
      '@/test/**',
      '@cartagraph/schemas',
      '@cartagraph/schemas/**',
    ]);
  });

  it('entities は schemas を止めない（import してよい層）', () => {
    assert.ok(!requiredGroups('entities').includes('@cartagraph/schemas'));
    assert.ok(requiredGroups('entities').includes('@/entities/**'));
  });
});

describe('findLayerErrors', () => {
  const full = (layer, include) => override([include], requiredGroups(layer));

  it('層ごとの override が必要な禁止をみな持っていれば誤りは無い', () => {
    const config = {
      overrides: [
        full('pages', 'apps/web/src/pages/**'),
        full('pages', 'apps/web/src/pages/*.ts'),
        full('entities', 'apps/web/src/entities/**'),
      ],
    };
    assert.deepEqual(findLayerErrors(config, { requireAll: false }), []);
  });

  it('禁止が別の pattern に分かれていてもよい', () => {
    const groups = requiredGroups('shared');
    const config = {
      overrides: [override(['apps/web/src/shared/**'], groups.slice(0, 4), groups.slice(4))],
    };
    assert.deepEqual(findLayerErrors(config, { requireAll: false }), []);
  });

  it('層の直下のファイル用の override に1つでも足し忘れると、override と禁止つきで誤り', () => {
    const config = {
      overrides: [
        full('widgets', 'apps/web/src/widgets/**'),
        override(
          ['apps/web/src/widgets/*.ts'],
          requiredGroups('widgets').filter((g) => !g.startsWith('@cartagraph/schemas')),
        ),
      ],
    };
    assert.deepEqual(findLayerErrors(config, { requireAll: false }), [
      'biome.json の apps/web/src/widgets/*.ts の noRestrictedImports に、@cartagraph/schemas・@cartagraph/schemas/** の禁止が無い（後ろの override は前の禁止を置き換えるので、この override にも書く）',
    ]);
  });

  it('層の override で noRestrictedImports を持たないものは、ほかの規則のための override として見ない', () => {
    const config = {
      overrides: [{ includes: ['apps/web/src/**'], linter: { rules: { performance: {} } } }],
    };
    assert.deepEqual(findLayerErrors(config, { requireAll: false }), []);
  });

  it('層の名前を含まない apps/web の override（mocks など）は見ない', () => {
    const config = { overrides: [override(['apps/web/src/mocks/**'], ['x'])] };
    assert.deepEqual(findLayerErrors(config, { requireAll: false }), []);
  });

  it('どの層にも禁止の override が1つも無ければ誤り（表と biome.json がずれた）', () => {
    const errors = findLayerErrors({ overrides: [full('app', 'apps/web/src/app/**')] });
    assert.ok(errors.some((e) => e.includes('pages')));
  });
});
