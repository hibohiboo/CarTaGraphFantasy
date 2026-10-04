// ページ描画のテストで共有する描画の手順（docs/process/rules/testing.md「テストの独立性」）。
// テストごとに自分の QueryClient とメモリルーターを作り、共有の状態を持たない。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routeObjects } from '@/app/router';

/** path を開いた状態でアプリを描画し、画面を移るためのルーターを返す */
export function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
