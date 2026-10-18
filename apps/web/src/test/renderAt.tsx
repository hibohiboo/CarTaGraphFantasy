// ページ描画のテストで共有する描画の手順（docs/process/rules/testing.md「テストの独立性」）。
// テストごとに自分の QueryClient とメモリルーターを作り、共有の状態を持たない。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect } from 'vitest';
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

/**
 * シナリオ編集のデッキの構造にある、ノード名の要素。公開の前の確かめの注意にも同じ名前が出るので、
 * デッキの行（data-kind を持つ要素）の中のものに絞る
 */
export async function deckNodeName(name: string): Promise<HTMLElement> {
  let found: HTMLElement | undefined;
  await waitFor(() => {
    found = screen.getAllByText(name).find((el) => el.closest('[data-kind]'));
    expect(found).toBeDefined();
  });
  return found as HTMLElement;
}
