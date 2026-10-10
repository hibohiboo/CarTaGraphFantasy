// MSW のハンドラが API の本文を読む、ただ1つの口（docs/plans/2026-10-10-APIスキーマの共用.md G5）。
// 検査とメッセージは packages/schemas の safeParseBody（将来のバックエンドと共用）。ここは本文を読んで渡し、
// 通らなければ 422 の応答にするだけ。ほかのハンドラが request.json()・request.text() を直接呼ぶのは
// Biome の GritQL プラグイン（scripts/biome/no-request-body.grit）が止める（このファイルだけ除外）。

import {
  type AnyRequestBody,
  type BodyOutput,
  safeParseBody,
} from '@cartagraph/schemas/body/parse';
import { HttpResponse } from 'msw';

/**
 * 本文を読んで検査する。本文の文字列が空なら {} として扱う（本文を付けない api.post(url) の呼び出し）。
 * JSON として壊れていれば、本文そのものの誤り
 */
export async function readBody<B extends AnyRequestBody>(
  request: Request,
  body: B,
): Promise<{ ok: true; data: BodyOutput<B> } | { ok: false; response: Response }> {
  const text = await request.text();
  let raw: unknown;
  try {
    raw = text === '' ? {} : JSON.parse(text);
  } catch {
    raw = undefined;
  }
  const result = safeParseBody(body, raw);
  if (result.ok) return { ok: true, data: result.data as BodyOutput<B> };
  return {
    ok: false,
    response: HttpResponse.json({ message: result.message }, { status: 422 }),
  };
}
