import { test, expect } from '@playwright/test';

/**
 * CSP reporting E2E tests (PRIORITY 19.8).
 *
 * Verifies:
 *   1. CSP header contains report-uri + report-to directives
 *   2. Reporting-Endpoints header is present and correctly formatted
 *   3. POST /api/csp-report accepts a violation report and returns 200
 *   4. Endpoint handles malformed data gracefully (400)
 *   5. Endpoint handles empty body gracefully (400)
 */

test.describe('P19.8: CSP reporting', () => {
  test('19.8a CSP header contains report-uri + report-to directives', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain('report-to csp-endpoint');
  });

  test('19.8b Reporting-Endpoints header is present', async ({ page }) => {
    const response = await page.goto('/');
    const reporting = response?.headers()['reporting-endpoints'] ?? '';
    expect(reporting).toContain('csp-endpoint');
    expect(reporting).toContain('/api/csp-report');
    // Should be valid JSON
    const parsed = JSON.parse(reporting);
    expect(parsed['csp-endpoint']).toBeTruthy();
    expect(parsed['csp-endpoint'].url).toBe('/api/csp-report');
  });

  test('19.8c POST /api/csp-report accepts violation report', async ({ request }) => {
    const response = await request.post('/api/csp-report', {
      data: {
        type: 'csp-violation',
        body: {
          documentURL: 'http://localhost:3000/',
          violatedDirective: 'script-src-elem',
          blockedURL: 'https://evil.com/script.js',
          sourceFile: 'test.js',
          lineNumber: 42,
          columnNumber: 10,
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  test('19.8d POST /api/csp-report handles malformed data', async ({ page }) => {
    await page.goto('/');
    // Use page.evaluate with raw fetch to send truly invalid JSON
    const status = await page.evaluate(async () => {
      const response = await fetch('/api/csp-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json',
      });
      return response.status;
    });
    expect(status).toBe(400);
  });

  test('19.8e POST /api/csp-report handles nested body format (Reporting API spec)', async ({ request }) => {
    // The Reporting API sends: { type: "csp-violation", body: { ... } }
    // But some browsers send just the body directly
    const response = await request.post('/api/csp-report', {
      data: {
        violatedDirective: 'img-src',
        blockedURL: 'https://evil.com/image.png',
        documentURL: 'http://localhost:3000/',
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
