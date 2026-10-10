// API のリクエストの本文の検査と、誤りのときのメッセージ（docs/plans/2026-10-10-APIスキーマの共用.md G2）。
// モック（apps/web の MSW）と将来のバックエンドが同じ検査・同じメッセージを使う。通らなければ呼び出し側が 422 で返す。
// zod の error パラメータは使わない（配列・オブジェクトに付けても要素の誤りに効かず、既定の英語の文と見分けられないため）。
// 個別のメッセージは「誤りの場所の最初のキー → 文」の表で持つ。

import type { z } from 'zod';

/** 本文のスキーマと、個別のメッセージの表（キーは最初の区切り。'' は本文そのものの誤り） */
export interface RequestBody<S extends z.ZodType> {
  schema: S;
  messages: Readonly<Record<string, string>>;
}

/** どの本文のスキーマでもよいときの型（使う側が zod を import せずに済むように） */
export type AnyRequestBody = RequestBody<z.ZodType>;

/** 送る側の型（画面の mutation が使う） */
export type BodyInput<B extends RequestBody<z.ZodType>> = z.input<B['schema']>;
/** 検査を通った後の型（受け取る側が使う） */
export type BodyOutput<B extends RequestBody<z.ZodType>> = z.output<B['schema']>;

const SHAPE_ERROR = '本文の形が正しくありません';

export function defineBody<S extends z.ZodType>(
  schema: S,
  messages: Record<string, string> = {},
): RequestBody<S> {
  return { schema, messages };
}

type Parsed<S extends z.ZodType> = { ok: true; data: z.output<S> } | { ok: false; message: string };

/** 本文（JSON として読んだ値）を検査する。誤りが複数あれば最初の1件の文を返す */
export function safeParseBody<S extends z.ZodType>(body: RequestBody<S>, raw: unknown): Parsed<S> {
  const result = body.schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const path = (result.error.issues[0]?.path ?? []).map(String);
  return { ok: false, message: messageAt(body, path) };
}

/**
 * 本文の文字列を読んで検査する（受け取る側はこれを使う）。空・空白だけなら {} として扱う（本文を付けない呼び出し）。
 * JSON として壊れていれば、スキーマに渡さず本文そのものの誤りにする
 */
export function safeParseBodyText<S extends z.ZodType>(
  body: RequestBody<S>,
  text: string,
): Parsed<S> {
  if (text.trim() === '') return safeParseBody(body, {});
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: messageAt(body, []) };
  }
  return safeParseBody(body, raw);
}

/** 誤りの場所の文。表は自分のキーだけを見る（constructor などの組み込みの名前を引かない） */
function messageAt(body: AnyRequestBody, path: string[]): string {
  const first = path[0] ?? '';
  if (Object.hasOwn(body.messages, first)) return body.messages[first] as string;
  return path.length === 0 ? SHAPE_ERROR : `${SHAPE_ERROR}（${path.join('.')}）`;
}
