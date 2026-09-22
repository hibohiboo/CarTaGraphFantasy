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

// jsdom は `canvas` npm パッケージ無しでは 2D コンテキストを実装しておらず、
// GameCard の useAutoFitCardName（カード名を1行に収めるためのCanvas文字幅計測）を
// 呼ぶたびに「not implemented」エラーをコンソールへ出してしまう。テストでは実際の
// 描画幅までは要らない（実ブラウザでの見た目はPlaywrightのスクリーンショットで確認する）ため、
// 文字数×フォントサイズの簡易近似を返すだけのスタブに差し替える。
function installTestCanvasMeasureText() {
  const stubContext = {
    font: '10px sans-serif',
    measureText(text: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
      return { width: text.length * size } as TextMetrics;
    },
  };
  HTMLCanvasElement.prototype.getContext = ((id: string) =>
    id === '2d' ? stubContext : null) as typeof HTMLCanvasElement.prototype.getContext;
}
installTestCanvasMeasureText();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  window.localStorage.clear();
});
afterAll(() => server.close());
