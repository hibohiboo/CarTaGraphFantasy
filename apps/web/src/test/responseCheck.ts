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
    return [`${label}：本文が JSON でない（${text === '' ? '空' : text.slice(0, 40)}）`];
  }
  return checkResponse(endpoint, response.status, body);
}

const errors: string[] = [];
/** 応答の検査のうち、まだ終わっていないもの */
const pending = new Set<Promise<void>>();
/**
 * 応答がまだ届いていないリクエスト。requestId → リクエストを出したときのテストの名前（応答が次のテストの間に
 * 届いても、出したテストの分にする。テストの本体が応答を待たずに終わっても、後片付けの前に届くまで待つ）
 */
const inFlight = new Map<string, string>();

/** テストの終わりに、応答が届くのを待つ上限 */
const SETTLE_TIMEOUT_MS = 2000;

const currentTest = () => expect.getState().currentTestName ?? '（テストの外）';

/** server の応答をすべて検査し、誤りを貯める。検査の中の例外も誤りとして貯める（未処理の reject にしない） */
export function watchResponses(server: SetupServer): void {
  server.events.on('request:start', ({ requestId }) => {
    inFlight.set(requestId, currentTest());
  });
  // 応答を返さずに終わったリクエスト（一覧の外で onUnhandledRequest が止めたもの・HttpResponse.error() など）は、
  // response:mocked が来ないので、ここで外す。response:mocked より先に来ても検査を取りこぼさないよう、次の周回で外す
  server.events.on('request:end', ({ requestId }) => {
    setTimeout(() => inFlight.delete(requestId), 0);
  });
  server.events.on('unhandledException', ({ request, requestId, error }) => {
    const test = inFlight.get(requestId) ?? currentTest();
    errors.push(
      `${request.method} ${new URL(request.url).pathname}：ハンドラが例外を投げた（${String(error)}）（テスト：${test}）`,
    );
  });
  server.events.on('response:mocked', ({ request, response, requestId }) => {
    const test = inFlight.get(requestId) ?? currentTest();
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
    inFlight.delete(requestId);
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * 応答がまだ届いていないリクエストと、処理中の検査がすべて終わるのを待つ（待つ間に始まったものも待つ）。
 * 上限までに応答が届かなければ、そのリクエストを誤りにして待つのをやめる
 */
export async function settleResponseChecks(): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (pending.size > 0 || inFlight.size > 0) {
    if (Date.now() > deadline) {
      for (const test of inFlight.values()) {
        errors.push(
          `${SETTLE_TIMEOUT_MS}ms 待っても応答が届かないリクエストがある（テスト：${test}）`,
        );
      }
      inFlight.clear();
      return;
    }
    if (pending.size > 0) await Promise.race([Promise.all([...pending]), tick()]);
    else await tick();
  }
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
