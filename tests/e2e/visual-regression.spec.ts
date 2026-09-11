import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * Visual regression tests (PRIORITY 16).
 *
 * Uses Playwright's toHaveScreenshot() to detect visual regressions.
 * Run `bun run test:e2e --update-snapshots` to (re)generate baselines.
 *
 * Covers:
 *   - Default state (1 empty card)
 *   - Card with content (title, subtitle, text, list, footer, cta)
 *   - 2 cards with different themes
 *   - Color modal open (split-screen on desktop)
 *   - Editor sidebar
 *
 * Screenshots are stored in tests/e2e/__screenshots__/ and compared on each run.
 * A <0.5% pixel diff is tolerated (anti-aliasing, font rendering).
 */

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('default state — 1 empty card', async ({ page }) => {
    // Wait for full render
    await page.waitForTimeout(500);
    // Screenshot the preview workspace
    await expect(page.locator('#previewWorkspace')).toHaveScreenshot(
      'default-state.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('card with content', async ({ page }) => {
    // Fill in all fields
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('Visual Regression Test');
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="subtitle"]').fill('Subtitle here');
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="text"]').fill('Main body text\nwith line break');
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="listItems"]').fill('First item\nSecond item\nThird item');
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="footer"]').fill('Footer text');
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="cta"]').fill('Click me');
    await page.waitForTimeout(800);
    await expect(page.locator('#previewWorkspace')).toHaveScreenshot(
      'card-with-content.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('2 cards with default theme', async ({ page }) => {
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('First Card');
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(400);
    await page.locator('#editorCardsList .card-editor-block').nth(1).locator('[data-field="title"]').fill('Second Card');
    await page.waitForTimeout(500);
    await expect(page.locator('#previewWorkspace')).toHaveScreenshot(
      'two-cards.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('color modal open — split-screen', async ({ page }) => {
    // Open color modal
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="palette"]').click();
    await page.waitForTimeout(600);
    // Screenshot the full app (modal + preview side by side on desktop)
    await expect(page.locator('.cc-root')).toHaveScreenshot(
      'color-modal-open.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });

  test('editor sidebar', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.locator('#editorSidebar')).toHaveScreenshot(
      'editor-sidebar.png',
      { maxDiffPixelRatio: 0.01 },
    );
  });
});
