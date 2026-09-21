import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages では docs サイト配下の /CarTaGraphFantasy/app/ に置く（scripts/copy-web-to-pages.mjs）。
// ローカル開発では / のまま。
const base = process.env.WEB_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173, host: '0.0.0.0' },
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
  },
});
