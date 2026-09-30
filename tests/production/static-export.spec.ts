import { expect, test } from '@playwright/test';

test('published entry point renders and loads its static assets', async ({ page }) => {
  const failedResponses: string[] = [];
  await page.addInitScript(() => {
    const target = window as Window & { __cspViolations?: string[] };
    target.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      target.__cspViolations?.push(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  page.on('response', (response) => {
    const responseUrl = new URL(response.url());
    if (
      response.status() >= 400
      && responseUrl.origin === 'http://127.0.0.1:4173'
      && responseUrl.pathname.includes('/_next/static/')
    ) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('./');

  await expect(page).toHaveTitle(/Карточки для соцсетей/i);
  await expect(page.locator('body')).toContainText(/Cardcraft/i);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /\/cardcraft_v2\/manifest\.webmanifest$/);
  expect(failedResponses).toEqual([]);
  expect(await page.evaluate(() => (
    window as Window & { __cspViolations?: string[] }
  ).__cspViolations)).toEqual([]);
});

test('primary exported routes work below the GitHub Pages base path', async ({ page }) => {
  for (const route of ['editor/', 'login/', 'account/', 'docs/', 'admin/']) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('body'), route).not.toBeEmpty();
  }
});

test('service worker and manifest are available at their published URLs', async ({ request, baseURL }) => {
  const root = new URL(baseURL!);
  const responses = await Promise.all([
    request.get(new URL('sw.js', root).toString()),
    request.get(new URL('manifest.webmanifest', root).toString()),
  ]);

  for (const response of responses) expect(response.ok()).toBe(true);
});
