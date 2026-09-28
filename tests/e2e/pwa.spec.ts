import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('PWA installability assets', () => {
  test('page exposes a standalone manifest with required icons', async ({ page, request }) => {
    await gotoApp(page);

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/manifest.webmanifest');

    const response = await request.get(manifestHref!);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/editor/');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
    ]));
  });

  test('service worker and install icons are served locally', async ({ request }) => {
    const worker = await request.get('/sw.js');
    expect(worker.ok()).toBe(true);
    expect(await worker.text()).toContain("cardcraft-shell-v2");

    for (const icon of [
      '/favicon-32.png',
      '/favicon-48.png',
      '/apple-touch-icon-180.png',
      '/cardcraft-logo.png',
      '/pwa-icon-192.png',
      '/pwa-icon-512.png',
      '/pwa-icon-maskable-512.png',
    ]) {
      const response = await request.get(icon);
      expect(response.ok(), icon).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
      expect((await response.body()).byteLength, icon).toBeGreaterThan(1000);
    }
  });

  test('page exposes the project icon for browsers and Apple home screen', async ({ page }) => {
    await gotoApp(page);

    await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute('href', '/favicon-32.png');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/apple-touch-icon-180.png',
    );
  });
});
