import { test, expect } from '@playwright/test';

test('static hosting enforces a meta CSP without advertising an unavailable collector', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['content-security-policy']).toBeUndefined();
  expect(headers['content-security-policy'] ?? '').not.toMatch(/report-uri|report-to/);
  expect(headers['reporting-endpoints'] ?? '').not.toContain('/api/csp-report');

  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).not.toMatch(/frame-ancestors|report-uri|report-to/);
});
