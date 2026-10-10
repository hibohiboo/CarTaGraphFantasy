// MSW のハンドラが API の本文を読む、ただ1つの口（docs/plans/2026-10-10-APIスキーマの共用.md G5）。
// 本文の文字列の読み方（空なら {}、壊れた JSON は本文の誤り）と検査・メッセージは packages/schemas の
// safeParseBodyText（将来のバックエンドと共用）。ここは本文を文字列で受け取って渡し、通らなければ 422 の応答にするだけ。
// ほかのハンドラが request.json()・request.text() を直接呼ぶのは Biome の GritQL プラグイン
// （scripts/biome/no-request-body.grit）が止める（このファイルだけ除外）。

import {
  type AnyRequestBody,
  type BodyOutput,
  safeParseBodyText,
} from '@cartagraph/schemas/body/parse';
import { HttpResponse } from 'msw';

/** 本文を読んで検査する。Content-Type によらず、本文の文字列を JSON として読む */
export async function readBody<B extends AnyRequestBody>(
  request: Request,
  body: B,
): Promise<{ ok: true; data: BodyOutput<B> } | { ok: false; response: Response }> {
  const result = safeParseBodyText(body, await request.text());
  if (result.ok) return { ok: true, data: result.data as BodyOutput<B> };
  return {
    ok: false,
    response: HttpResponse.json({ message: result.message }, { status: 422 }),
  };
}
