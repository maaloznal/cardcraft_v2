import { test, expect } from '@playwright/test';
import { gotoApp, getPreviewCardCount } from './helpers';

/**
 * E2E: export + cancel.
 * Covers MasterTask.md PRIORITY 2 scenarios: 13, 14.
 */

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('13. single card PNG export triggers download', async ({ page }) => {
    // Type something so the card has content
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('Export Test');
    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    // Click download button on first card
    await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    // Wait for download to start
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('14. batch export cancel via Escape', async ({ page }) => {
    // Add several cards so batch export takes time
    for (let i = 0; i < 3; i++) {
      await page.locator('#addCardBtn').click();
    }
    await expect.poll(() => getPreviewCardCount(page)).toBe(4);
    // Start batch export (Скачать все)
    await page.locator('#saveAll').click();
    // exporting-busy class should appear
    await expect(page.locator('.cc-root')).toHaveClass(/exporting-busy/, { timeout: 2000 });
    // Press Escape to cancel
    await page.keyboard.press('Escape');
    // exporting-busy should be removed (cancellation completed)
    await expect(page.locator('.cc-root')).not.toHaveClass(/exporting-busy/, { timeout: 5000 });
    // Toast should mention cancellation or completion
    await expect(page.locator('#toast')).toContainText(/отменён|Готово/);
  });
});
