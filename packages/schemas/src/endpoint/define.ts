// API の一覧の1項目（メソッド・パス・本文・状態コードごとの応答）の定義（docs/plans/2026-10-11-APIドキュメント.md G2）。
// 一覧から OpenAPI の文書を作り（api/openapi.ts）、モック（MSW）の応答が一覧どおりかを検査する（check.ts）。

import { z } from 'zod';
import type { AnyRequestBody } from '../body/parse';

export type Method = 'get' | 'post' | 'patch';

/** 一覧に書ける状態コード。今のモックが返すものだけ（増やすときはここに足す） */
export type StatusCode = 200 | 201 | 403 | 404 | 409 | 422 | 500;

export interface EndpointResponse {
  /** その状態コードになるのはどんなときか */
  description: string;
  schema: z.ZodType;
}

/** 成功の応答（200 か 201）を必ず1つ持つ。失敗の応答は返しうるものだけを書く */
export type EndpointResponses = ({ 200: EndpointResponse } | { 201: EndpointResponse }) &
  Partial<Record<StatusCode, EndpointResponse>>;

export interface Endpoint {
  method: Method;
  /** `/sessions/:id/play` の形（MSW のハンドラと同じ書き方。`/api` は付けない） */
  path: string;
  /** 画面の操作の言葉で短く（例：「カードをプレイする」） */
  summary: string;
  description?: string;
  /** リクエストの本文（本文を読む API だけ）。受け取る側の検査と同じもの */
  body?: AnyRequestBody;
  responses: EndpointResponses;
}

export function defineEndpoint(endpoint: Endpoint): Endpoint {
  return endpoint;
}

/** 失敗の応答の本文。どの API も同じ形 */
export const errorBodySchema = z.strictObject({ message: z.string() });

/** 失敗の応答（本文は { message }） */
export const failure = (description: string): EndpointResponse => ({
  description,
  schema: errorBodySchema,
});

/** 成功の応答 */
export const success = (description: string, schema: z.ZodType): EndpointResponse => ({
  description,
  schema,
});

/** パスの引数の名前をそろえる（`:id` と `:sid` は同じルート）。一覧の重複の検査に使う */
export const routeKey = (e: Pick<Endpoint, 'method' | 'path'>): string =>
  `${e.method.toUpperCase()} ${e.path.replace(/:[^/]+/g, ':')}`;
