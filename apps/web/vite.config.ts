import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';
import { scenarioFilePlugin } from './vite/scenarioFilePlugin';

// GitHub Pages では docs サイト配下の /CarTaGraphFantasy/app/ に置く（scripts/copy-web-to-pages.mjs）。
// ローカル開発では / のまま。
const base = process.env.WEB_BASE ?? '/';

export default defineConfig({
  base,
  // 開発サーバーで公開したシナリオを scenarios/<id>.json に書く口（docs/architecture/web-app.md「ローカル開発の注意」）
  plugins: [react(), scenarioFilePlugin()],
  // FSD の層をまたぐ import は @/<層>/... で書く（docs/process/rules/architecture.md「依存の向き」）。tsconfig の paths と揃える
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // 5173 番が埋まっていたら、別のポートで黙って起動せず失敗させる。別の作業ツリーやブランチで動いている
  // 開発サーバーを、気づかずに確かめてしまわないため（docs/process/evolution.md 2026-10-04）
  server: { port: 5173, strictPort: true, host: '0.0.0.0' },
  build: {
    rollupOptions: {
      output: {
        // ライブラリ本体とアプリ本体を分け、アプリ側の変更でライブラリのキャッシュが無効にならないようにする
        manualChunks: {
          react: ['react', 'react-dom', 'react-router', '@tanstack/react-query'],
          msw: ['msw', 'msw/browser'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    css: false,
    // e2e/ は Playwright 専用（apps/web/playwright.config.ts）。Vitest の既定includeは
    // .test.ts/.spec.ts の両方を拾うため、明示的に除外しないと二重に実行されてしまう
    exclude: [...configDefaults.exclude, '**/e2e/**'],
  },
});
