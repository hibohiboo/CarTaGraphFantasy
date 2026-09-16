import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetDb } from '../mocks/handlers';
import { server } from '../mocks/node';

// Node 24 は globalThis.localStorage に「--localstorage-file 未指定だと使えない」実験的な
// getter/setter を定義しており、jsdom の window（＝このテスト環境では globalThis と同一）でも
// これが localStorage.setItem 等を undefined にしてしまう。configurable なので、動く
// 簡易実装で上書きする（本番のブラウザでは window.localStorage がそのまま使われるので影響しない）。
function installTestLocalStorage() {
  const store = new Map<string, string>();
  const impl: Storage = {
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: impl });
}
installTestLocalStorage();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  window.localStorage.clear();
});
afterAll(() => server.close());
