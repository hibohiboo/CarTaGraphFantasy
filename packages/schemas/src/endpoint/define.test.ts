// 一覧の1項目の定義（docs/plans/2026-10-11-APIドキュメント.md T3）。応答の書き漏らしを型で止める。

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineEndpoint, failure, routeKey, success } from './define';

const ok = success('成功', z.strictObject({}));

describe('defineEndpoint', () => {
  it('成功の応答（200 か 201）があれば作れる', () => {
    expect(
      defineEndpoint({ method: 'get', path: '/x', summary: 'x', responses: { 200: ok } }).path,
    ).toBe('/x');
    expect(
      defineEndpoint({ method: 'post', path: '/x', summary: 'x', responses: { 201: ok } }).path,
    ).toBe('/x');
  });

  it('応答が空・失敗の応答だけ・一覧に無い状態コードは、型で止まる', () => {
    // @ts-expect-error 応答が空
    defineEndpoint({ method: 'get', path: '/x', summary: 'x', responses: {} });
    const onlyFailure = { 404: failure('無い') };
    // @ts-expect-error 成功の応答が無い
    defineEndpoint({ method: 'get', path: '/x', summary: 'x', responses: onlyFailure });
    // @ts-expect-error 3桁でない状態コード
    defineEndpoint({ method: 'get', path: '/x', summary: 'x', responses: { 200: ok, 2000: ok } });
    expect(true).toBe(true);
  });
});

describe('routeKey', () => {
  it('パスの引数の名前によらず同じルートは同じキー、メソッドが違えば別のキー', () => {
    expect(routeKey({ method: 'get', path: '/sessions/:id' })).toBe(
      routeKey({ method: 'get', path: '/sessions/:sid' }),
    );
    expect(routeKey({ method: 'get', path: '/sessions/:id' })).not.toBe(
      routeKey({ method: 'patch', path: '/sessions/:id' }),
    );
    expect(routeKey({ method: 'get', path: '/sessions/:id' })).not.toBe(
      routeKey({ method: 'get', path: '/sessions/:id/play' }),
    );
  });
});
