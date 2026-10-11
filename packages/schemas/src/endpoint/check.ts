// 返った応答が一覧のとおりかを確かめる（docs/plans/2026-10-11-APIドキュメント.md G2・G7）。
// モック（apps/web のテストで MSW の応答）と、将来のバックエンドの契約テストが使う。apps/web は zod を直接使わないので、
// 誤りの文もここで作る。

import type { Endpoint, EndpointResponse } from './define';

/** 1つの応答で並べる誤りの数の上限（同じ原因の誤りが配列の要素ごとに並ぶのを抑える） */
const MAX_ISSUES = 5;

/** 誤りの文の配列を返す。一覧どおりなら空 */
export function checkResponse(endpoint: Endpoint, status: number, body: unknown): string[] {
  const label = `${endpoint.method.toUpperCase()} ${endpoint.path} → ${status}`;
  const responses = endpoint.responses as Partial<Record<number, EndpointResponse>>;
  const expected = responses[status];
  if (!expected) {
    const listed = Object.keys(endpoint.responses).join('・');
    return [`${label}：一覧に無い状態コード（一覧にあるのは ${listed}）`];
  }
  const parsed = expected.schema.safeParse(body);
  if (parsed.success) return [];
  const { issues } = parsed.error;
  const shown = issues.slice(0, MAX_ISSUES).map((issue) => {
    const where = issue.path.length === 0 ? '本文' : issue.path.map(String).join('.');
    return `${label}：${where} が一覧の形と違う（${issue.message}）`;
  });
  const rest = issues.length - shown.length;
  return rest > 0 ? [...shown, `${label}：ほか ${rest} 件`] : shown;
}
