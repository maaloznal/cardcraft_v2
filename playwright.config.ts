import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Cardcraft E2E tests (PRIORITY 2).
 *
 * Runs against the dev server on http://localhost:3000.
 * In CI, webServer launches `bun run dev` automatically.
 * Locally, reuses an already-running dev server.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Cardcraft uses localStorage — sequential is safer
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker — shared localStorage state
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
