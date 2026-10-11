// API の一覧（endpoints.ts）から OpenAPI 3.1 の文書を作る（docs/plans/2026-10-11-APIドキュメント.md G3）。
// zod 4 の z.toJSONSchema で各スキーマを JSON Schema（2020-12。OpenAPI 3.1 と同じ）にし、名前の付いた型は
// components.schemas に1回だけ出して $ref で参照する。scripts/build-api-docs.mjs が JSON に書き、Redoc の HTML にする。

import { autoCombatStateSchema, combatRecordSchema } from '@cartagraph/domain/autoCombat/model';
import { cardDefSchema } from '@cartagraph/domain/card/model';
import { characterSchema } from '@cartagraph/domain/character/model';
import { libraryEntrySchema } from '@cartagraph/domain/library/model';
import { deckNodeSchema, scenarioSchema } from '@cartagraph/domain/scenario/model';
import {
  feedItemSchema,
  participantSchema,
  proposalSchema,
  recruitmentSchema,
  sessionSchema,
} from '@cartagraph/domain/session/model';
import { currentUserSchema } from '@cartagraph/domain/user/model';
import { z } from 'zod';
import { cardPoolSchema } from '../card-pool/response';
import { type Endpoint, errorBodySchema } from '../endpoint/define';
import {
  scenarioDraftSaveResultSchema,
  scenarioDraftSchema,
  scenarioSaveResultSchema,
} from '../scenarios/response';
import { endpoints } from './endpoints';

type Json = Record<string, unknown>;

/**
 * components.schemas に名前で出す型。循環するスキーマ（CardDef・DeckNode の getter）は必ず登録する
 * （登録しないと、名前の無い循環が壊れた参照になる）。仮ルールの型は説明に「仮ルール」と書く
 */
const named: [z.ZodType, string, string?][] = [
  [currentUserSchema, 'CurrentUser'],
  [cardDefSchema, 'CardDef'],
  [
    cardPoolSchema,
    'CardPool',
    '仮ルールを含む：能力値の配分（abilities）と作成時の HP・基本行動値（docs/provisional/character-creation.md）',
  ],
  [characterSchema, 'Character'],
  [deckNodeSchema, 'DeckNode'],
  [scenarioSchema, 'Scenario', '公開のファイルの検査（業務の検査を含む）を通ったシナリオ'],
  [
    scenarioDraftSchema,
    'ScenarioDraft',
    '下書きを含みうるシナリオ。業務の検査を外した形（下書きの API を分けたら直す）',
  ],
  [scenarioSaveResultSchema, 'ScenarioSaveResult'],
  [scenarioDraftSaveResultSchema, 'ScenarioDraftSaveResult'],
  [recruitmentSchema, 'Recruitment'],
  [participantSchema, 'Participant'],
  [proposalSchema, 'Proposal'],
  [feedItemSchema, 'FeedItem'],
  [
    autoCombatStateSchema,
    'AutoCombatState',
    '仮ルール：自動戦闘（docs/provisional/auto-combat.md）',
  ],
  [combatRecordSchema, 'CombatRecord', '仮ルール：自動戦闘（docs/provisional/auto-combat.md）'],
  [sessionSchema, 'Session'],
  [libraryEntrySchema, 'LibraryEntry'],
  [errorBodySchema, 'Error', '失敗の応答の本文。どの API も同じ形'],
];

const registry = z.registry<{ id: string; description?: string }>();
for (const [schema, id, description] of named) {
  registry.add(schema, description ? { id, description } : { id });
}

/** タグ（URL の最初の区切り）の説明 */
const TAGS: Record<string, string> = {
  me: 'ログインユーザー（バックエンドが無いので固定）',
  'card-pool': 'キャラクター作成のカードプールとルール',
  characters: 'キャラクター（PC）',
  scenarios: 'シナリオの作成・保存・公開と、シナリオから始めること',
  recruitments: '募集と応募',
  sessions: 'セッションの進行',
  library: '共有設定',
};

const REF_FROM = '#/$defs/';
const REF_TO = '#/components/schemas/';

/** $defs の参照を components の参照に書き換える（入れ子もすべて） */
function rewriteRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteRefs);
  if (value === null || typeof value !== 'object') return value;
  const out: Json = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = k === '$ref' && typeof v === 'string' ? v.replace(REF_FROM, REF_TO) : rewriteRefs(v);
  }
  return out;
}

/** 1つのスキーマを変換し、名前の付いた型は components に移す。同じ名前で中身が違えば誤り */
function convert(schema: z.ZodType, io: 'input' | 'output', components: Json): Json {
  const { $schema: _, $defs, ...rest } = z.toJSONSchema(schema, { metadata: registry, io }) as Json;
  for (const [id, def] of Object.entries(($defs as Json | undefined) ?? {})) {
    const rewritten = rewriteRefs(def);
    if (id in components && JSON.stringify(components[id]) !== JSON.stringify(rewritten)) {
      throw new Error(`components.schemas の ${id} が、変換のたびに違う形になった`);
    }
    components[id] = rewritten;
  }
  return rewriteRefs(rest) as Json;
}

const pathParams = (path: string): string[] =>
  [...path.matchAll(/:([^/]+)/g)].map((m) => m[1] as string);

/** `/sessions/:id/play` → `/sessions/{id}/play` */
const openApiPath = (path: string) => path.replace(/:([^/]+)/g, '{$1}');

/** `POST /sessions/:id/play` → `postSessionsByIdPlay` */
function operationId(e: Endpoint): string {
  const words = e.path
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith(':') ? `by-${seg.slice(1)}` : seg))
    .flatMap((seg) => seg.split('-'));
  return e.method + words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function operation(e: Endpoint, components: Json): Json {
  const parameters: Json[] = pathParams(e.path).map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
  if (e.query) {
    const query = convert(e.query, 'input', components);
    const props = (query.properties ?? {}) as Record<string, Json>;
    const required = new Set((query.required ?? []) as string[]);
    for (const [name, { description, ...schema }] of Object.entries(props)) {
      parameters.push({ name, in: 'query', required: required.has(name), description, schema });
    }
  }
  const responses: Json = {};
  for (const [status, res] of Object.entries(e.responses)) {
    if (!res) continue;
    responses[status] = {
      description: res.description,
      content: { 'application/json': { schema: convert(res.schema, 'output', components) } },
    };
  }
  return {
    operationId: operationId(e),
    summary: e.summary,
    ...(e.description ? { description: e.description } : {}),
    tags: [e.path.split('/')[1]],
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(e.body
      ? {
          requestBody: {
            // 本文が空なら {} として読むので、{} が通る本文は省いてよい
            required: !e.body.schema.safeParse({}).success,
            content: {
              'application/json': { schema: convert(e.body.schema, 'input', components) },
            },
          },
        }
      : {}),
    responses,
  };
}

/** OpenAPI 3.1 の文書 */
export function buildOpenApiDocument(list: readonly Endpoint[] = endpoints): Json {
  const components: Json = {};
  const paths: Record<string, Json> = {};
  for (const e of list) {
    const p = openApiPath(e.path);
    paths[p] = { ...paths[p], [e.method]: operation(e, components) };
  }
  const usedTags = [...new Set(list.map((e) => e.path.split('/')[1] as string))];
  return {
    openapi: '3.1.0',
    info: {
      title: 'カルタグラフ API',
      version: '0.0.0',
      description:
        'カルタグラフの Web アプリが使う API。バックエンドはまだ無く、モック（MSW）がこの一覧どおりに応答する（テストで確かめている）。一覧の正は packages/schemas。',
    },
    servers: [{ url: '/api', description: 'モック（MSW）。バックエンドは未実装' }],
    tags: usedTags.map((name) => ({ name, description: TAGS[name] ?? name })),
    paths,
    components: { schemas: components },
  };
}
