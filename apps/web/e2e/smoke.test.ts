import { expect, test } from '@playwright/test';
import { routes } from '../src/app/routes';

/** ErrorNote（role="alert"）を見本として意図的に表示しているページ */
const INTENTIONAL_ALERT_PATHS = new Set(['/admin/components']);

/**
 * routes.ts（サイトマップの唯一の情報源）を巡回し、全ルートが実ブラウザで
 * 例外なく描画できることを確認するスモークテスト。動的ルートは route.example
 * （routes.ts側で全件用意済み）を使う。
 */
for (const route of routes) {
  const target = route.path.includes(':') ? (route.example ?? route.path) : route.path;

  test(`${route.title}（${target}）が描画できる`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(`/#${target}`);
    await page.waitForLoadState('networkidle');

    if (!INTENTIONAL_ALERT_PATHS.has(route.path)) {
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
}
