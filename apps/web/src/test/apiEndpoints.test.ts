// MSW のハンドラと API の一覧（packages/schemas）が1対1か（docs/plans/2026-10-11-APIドキュメント.md G6・T7）。
// ハンドラを足して一覧に書き漏らすと、API ドキュメントに載らず、応答の検査（responseCheck.ts）もできないため。

import { endpoints } from '@cartagraph/schemas/api/endpoints';
import { type Method, routeKey } from '@cartagraph/schemas/endpoint/define';
import { describe, expect, it } from 'vitest';
import { handlers } from '../mocks/handlers';

const METHODS: readonly string[] = ['get', 'post', 'patch'] satisfies Method[];

/** ハンドラのメソッドとパス（/api を外す）。文字列でないもの・一覧に書けないメソッドは誤り */
function handlerKey(info: { method?: unknown; path?: unknown }): string {
  const { method, path } = info;
  if (typeof method !== 'string' || typeof path !== 'string') {
    throw new Error(`メソッドとパスが文字列でないハンドラ：${String(method)} ${String(path)}`);
  }
  const m = method.toLowerCase();
  if (!METHODS.includes(m)) throw new Error(`一覧に書けないメソッドのハンドラ：${method} ${path}`);
  if (!path.startsWith('/api/')) throw new Error(`/api の外のハンドラ：${path}`);
  return routeKey({ method: m as Method, path: path.slice('/api'.length) });
}

describe('MSW のハンドラと API の一覧', () => {
  it('ハンドラと一覧の項目が、重複なく1対1に対応する', () => {
    const fromHandlers = handlers.map((h) => handlerKey(h.info));
    expect(new Set(fromHandlers).size).toBe(fromHandlers.length);
    expect([...fromHandlers].sort()).toEqual(endpoints.map(routeKey).sort());
  });
});
