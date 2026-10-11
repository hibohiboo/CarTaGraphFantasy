// OpenAPI の文書（docs/plans/2026-10-11-APIドキュメント.md T6）。一覧と自分を比べるだけでなく、
// 参照が解決すること・本文と応答の厳しさ・省略可能と null の表し方を、文書の側から確かめる。

import { describe, expect, it } from 'vitest';
import { endpoints } from './endpoints';
import { buildOpenApiDocument } from './openapi';

type Json = Record<string, unknown>;

const doc = buildOpenApiDocument();
const paths = doc.paths as Record<string, Record<string, Json>>;
const schemas = (doc.components as { schemas: Record<string, Json> }).schemas;
const text = JSON.stringify(doc);

const op = (method: string, path: string): Json => {
  const o = paths[path]?.[method];
  if (!o) throw new Error(`文書に無い：${method} ${path}`);
  return o;
};
const responseSchema = (o: Json, status: string) =>
  (o.responses as Record<string, { content: { 'application/json': { schema: Json } } }>)[status]
    ?.content['application/json'].schema;
const bodySchema = (o: Json) =>
  (o.requestBody as { content: { 'application/json': { schema: Json } } }).content[
    'application/json'
  ].schema;

describe('OpenAPI の文書', () => {
  it('一覧のすべての API が paths に出る', () => {
    const count = Object.values(paths).reduce((n, p) => n + Object.keys(p).length, 0);
    expect(count).toBe(endpoints.length);
    expect(doc.openapi).toBe('3.1.0');
  });

  it('パスの引数は {id} の形で、parameters に path・必須で出る', () => {
    const o = op('post', '/sessions/{id}/proposals/{pid}/approve');
    expect(o.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'pid', in: 'path', required: true, schema: { type: 'string' } },
    ]);
    expect(Object.keys(paths).some((p) => p.includes(':'))).toBe(false);
  });

  it('下書きの API（/scenario-drafts・/scenarios/{id}/draft）は scenarios のタグに入り、ScenarioDraftView を返す', () => {
    expect(op('get', '/scenario-drafts').tags).toEqual(['scenarios']);
    expect(op('patch', '/scenarios/{id}/draft').tags).toEqual(['scenarios']);
    expect(responseSchema(op('get', '/scenarios/{id}/draft'), '200')).toEqual({
      $ref: '#/components/schemas/ScenarioDraftView',
    });
    expect(schemas.ScenarioDraftSaveResult).toBeUndefined();
    expect(Object.keys(op('patch', '/scenarios/{id}/draft').responses as Json)).not.toContain(
      '500',
    );
    expect(paths['/scenarios/{id}']?.patch).toBeUndefined();
  });

  it('本文を読む API にだけ requestBody が出る。{} が通る本文は省いてよい', () => {
    expect(op('post', '/sessions/{id}/play').requestBody).toMatchObject({ required: true });
    expect(op('post', '/sessions/{id}/proposals/{pid}/reject').requestBody).toMatchObject({
      required: false,
    });
    expect(op('get', '/me').requestBody).toBeUndefined();
    expect(op('post', '/sessions/{id}/end').requestBody).toBeUndefined();
  });

  it('本文は知らないキーを断らない（受け取る側は捨てる）、応答の strict な型は断る', () => {
    expect(bodySchema(op('post', '/sessions/{id}/play')).additionalProperties).toBeUndefined();
    expect(schemas.Session?.additionalProperties).toBe(false);
  });

  it('すべての $ref が components.schemas の実在する型を指す（壊れた参照・$defs・$id・$schema が残らない）', () => {
    const refs = [...text.matchAll(/"\$ref":"([^"]+)"/g)].map((m) => m[1] as string);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(/^#\/components\/schemas\//);
      expect(schemas[ref.slice('#/components/schemas/'.length)]).toBeDefined();
    }
    expect(text).not.toContain('$defs');
    expect(text).not.toContain('"$id"');
    expect(text).not.toContain('"$schema"');
    expect(text).not.toContain('__schema');
    expect(text).not.toContain('__shared');
  });

  it('名前の付いた型は1回だけ定義され、入れ子でも $ref で参照される', () => {
    expect(responseSchema(op('get', '/sessions/{id}'), '200')).toEqual({
      $ref: '#/components/schemas/Session',
    });
    expect(responseSchema(op('get', '/sessions'), '200')).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/Session' },
    });
    const session = schemas.Session as { properties: Record<string, Json> };
    expect(session.properties.autoCombat).toEqual({
      $ref: '#/components/schemas/AutoCombatState',
    });
  });

  it('省略可能な項目は required に入らず、null を持つ項目は null を許す', () => {
    const recruitment = schemas.Recruitment as {
      required: string[];
      properties: Record<string, Json>;
    };
    expect(recruitment.required).not.toContain('note');
    expect(recruitment.required).toContain('spaceModel');
    expect(JSON.stringify(recruitment.properties.spaceModel)).toContain('"null"');
  });

  it('状態コードごとに応答が出て、失敗の応答は { message } の型を参照する', () => {
    const o = op('get', '/characters/{id}');
    expect(Object.keys(o.responses as Json)).toEqual(['200', '404']);
    expect(responseSchema(o, '404')).toEqual({ $ref: '#/components/schemas/Error' });
    expect(schemas.Error).toMatchObject({ required: ['message'], additionalProperties: false });
  });

  it.each([
    'AutoCombatState',
    'CombatRecord',
    'CardPool',
    'CardDef',
    'DeckNode',
    'Scenario',
    'ScenarioDraft',
    'Session',
  ])('仮ルールの項目を持つ型（%s）は、説明に「仮ルール」と仮ルールのページを書く', (name) => {
    expect(schemas[name]?.description).toMatch(/仮ルール.*docs\/provisional\//);
  });

  it('仮ルール・仕様とのずれを書いた型は、文書の冒頭の一覧にも並ぶ（Redoc は応答の型の説明を出さないため）', () => {
    const info = (doc.info as { description: string }).description;
    expect(info).toContain('## 仮ルールと仕様とのずれ');
    for (const name of ['AutoCombatState', 'CardPool', 'CardDef', 'DeckNode', 'Session']) {
      expect(info).toContain(`- **${name}** — ${schemas[name]?.description}`);
    }
    expect(info).not.toContain('- **Error**');
  });

  it('仕様とずれたモックの振る舞いは、説明にそう書き、直す要望を示す', () => {
    expect(schemas.Session?.description).toMatch(/仕様とずれている.*gm-resume-suspended/);
    expect(op('post', '/sessions/{id}/resume').description).toMatch(
      /仕様とずれている.*gm-resume-suspended/,
    );
  });

  it('operationId は重複しない', () => {
    const ids = Object.values(paths).flatMap((p) => Object.values(p).map((o) => o.operationId));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
