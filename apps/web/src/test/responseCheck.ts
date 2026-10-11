// MSW が返した応答を API の一覧（packages/schemas）と照らす（docs/plans/2026-10-11-APIドキュメント.md G7）。
// ここに置くのは、リクエストに当たる一覧の項目を探すことと、誤りを貯めることだけ。形の検査と誤りの文は
// packages/schemas の checkResponse（apps/web は zod を直接使わない）。setup.ts が組み込み、ずれたらテストを落とす。

import { endpoints } from '@cartagraph/schemas/api/endpoints';
import { checkResponse } from '@cartagraph/schemas/endpoint/check';
import type { Endpoint } from '@cartagraph/schemas/endpoint/define';
import { matchRequestUrl } from 'msw';
import type { SetupServer } from 'msw/node';
import { expect } from 'vitest';

/** モックの API の置き場所（shared/api/api.ts の base と同じ） */
const API_BASE = '/api';

/** リクエストに当たる一覧の項目。クエリ文字列は照合に使わない */
export function findEndpoint(request: Request): Endpoint | undefined {
  const url = new URL(request.url);
  const method = request.method.toLowerCase();
  return endpoints.find(
    (e) =>
      e.method === method && matchRequestUrl(url, `${API_BASE}${e.path}`, location.origin).matches,
  );
}

/** 1つの応答の誤り（一覧どおりなら空）。本文は MSW が複製して渡すので、ここで読んでも呼び出し側は読める */
export async function checkMockedResponse(request: Request, response: Response): Promise<string[]> {
  const endpoint = findEndpoint(request);
  if (!endpoint) {
    const { pathname } = new URL(request.url);
    return [
      `${request.method} ${pathname}：API の一覧（packages/schemas の api/endpoints.ts）に無い`,
    ];
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    const label = `${endpoint.method.toUpperCase()} ${endpoint.path} → ${response.status}`;
    return [`${label}：本文が JSON でない（${text.slice(0, 40)}）`];
  }
  return checkResponse(endpoint, response.status, body);
}

const errors: string[] = [];
const pending = new Set<Promise<void>>();
/** requestId → リクエストを出したときのテストの名前（応答が次のテストの間に届いても、出したテストの分にする） */
const testOfRequest = new Map<string, string>();

const currentTest = () => expect.getState().currentTestName ?? '（テストの外）';

/** server の応答をすべて検査し、誤りを貯める。検査の中の例外も誤りとして貯める（未処理の reject にしない） */
export function watchResponses(server: SetupServer): void {
  server.events.on('request:start', ({ requestId }) => {
    testOfRequest.set(requestId, currentTest());
  });
  server.events.on('response:mocked', ({ request, response, requestId }) => {
    const test = testOfRequest.get(requestId) ?? currentTest();
    testOfRequest.delete(requestId);
    const label = `${request.method} ${new URL(request.url).pathname}`;
    const check: Promise<void> = checkMockedResponse(request, response)
      .then(
        (found) => {
          for (const e of found) errors.push(`${e}（テスト：${test}）`);
        },
        (e: unknown) => {
          errors.push(`${label}：応答の検査の途中で例外（${String(e)}）（テスト：${test}）`);
        },
      )
      .finally(() => {
        pending.delete(check);
      });
    pending.add(check);
  });
}

/** 処理中の検査がすべて終わるのを待つ（待つ間に始まった検査も待つ） */
export async function settleResponseChecks(): Promise<void> {
  while (pending.size > 0) await Promise.all([...pending]);
}

/** 貯まった誤りを取り出して空にする */
export function takeResponseErrors(): string[] {
  return errors.splice(0);
}

/** 貯まった誤りがあれば投げる（setup.ts の afterEach・afterAll が呼ぶ） */
export function throwIfResponseErrors(): void {
  const found = takeResponseErrors();
  if (found.length === 0) return;
  throw new Error(
    `MSW の応答が API の一覧（packages/schemas）と違う（${found.length}件）。一覧かハンドラ・テストの差し替えを直す：\n${found.join('\n')}`,
  );
}
