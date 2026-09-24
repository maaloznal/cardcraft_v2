import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Cardcraft E2E tests (PRIORITY 2).
 *
 * Runs against the dev server on http://localhost:3000.
 * In CI, webServer launches `bun run dev` automatically.
 * Locally, reuses an already-running dev server.
 *
 * P-MOBILE: added mobile + tablet projects for responsive tests.
 * - chromium:      desktop (1280×720) — existing tests
 * - mobile-chrome:  390×844 (iPhone 14) — phone portrait
 * - tablet-chrome:  768×1024 (iPad portrait) — tablet portrait (split-view)
 * - tablet-land:    1024×768 (iPad landscape) — tablet landscape
 *
 * Single worker (localStorage shared state). Mobile specs use
 * page.setViewportSize() explicitly so they work in the chromium project
 * too — but the dedicated projects ensure proper userAgent + touch flags.
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
      // P-MOBILE: exclude mobile/tablet-specific specs from the desktop chromium
      // project — they have their own dedicated projects (mobile-chrome,
      // tablet-chrome) with proper device emulation. Running them in chromium
      // causes false failures because setViewportSize after gotoApp doesn't
      // re-trigger CSS @media rules for already-rendered elements.
      testIgnore: /.*\/(mobile|narrow|tablet|mobile-accessibility|mobile-v2)\.spec\.ts/,
    },
    // P-MOBILE: phone — iPhone 14 viewport (390×844) + touch + mobile userAgent.
    // NOTE: We use channel:'chromium' (not the default Safari/webkit) because
    // the CI sandbox may not be able to install webkit system deps (libGLESv2,
    // libenchant, etc.) without sudo. Chromium-based emulation is sufficient
    // for our responsive tests — it sets the correct viewport, touch events,
    // and mobile user-agent. The tests assert CSS-computed values (font-size,
    // touch target size) which are viewport-driven, not browser-engine-driven.
    // Mobile specs (tests/e2e/mobile.spec.ts, narrow.spec.ts) match this project
    // via testMatch.
    {
      name: 'mobile-chrome',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
      },
      testMatch: /.*\/(mobile|narrow|mobile-v2)\.spec\.ts/,
    },
    // P-MOBILE: tablet portrait — iPad (gen 7) covers 768-1023px range.
    // Same chromium engine as mobile-chrome (same rationale).
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'chromium',
      },
      testMatch: /.*\/tablet\.spec\.ts/,
    },
    // P-MOBILE: mobile-accessibility tests use setViewportSize() to switch
    // between mobile/tablet/desktop in the same test file. Runs in the
    // chromium project (desktop Chrome) with explicit viewport overrides.
    // Excluded from the main chromium project's testIgnore so it runs there.
    {
      name: 'a11y-mobile',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\/mobile-accessibility\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
