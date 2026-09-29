import { test, expect } from '@playwright/test';

// GitHub Pages cannot implement a Next.js POST collector. Do not advertise one.
test('static hosting does not advertise an unavailable CSP reporting collector', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['content-security-policy'] ?? '').not.toMatch(/report-uri|report-to/);
  expect(headers['reporting-endpoints'] ?? '').not.toContain('/api/csp-report');
});
