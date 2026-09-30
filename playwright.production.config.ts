import { defineConfig, devices } from '@playwright/test';

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '/cardcraft_v2').replace(/\/$/, '');
export default defineConfig({
  testDir: './tests/production',
  outputDir: 'test-results-production',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:4173${basePath}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: `http://127.0.0.1:4173${basePath}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
