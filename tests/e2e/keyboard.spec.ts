import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * E2E: keyboard navigation.
 * Covers MasterTask.md PRIORITY 2 scenario: 17.
 */

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('17a. Tab cycles through focusable elements', async ({ page }) => {
    // Start from body, Tab should move focus to first focusable element
    await page.focus('body');
    await page.keyboard.press('Tab');
    // Some element should be focused (not body)
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTag).not.toBe('BODY');
  });

  test('17b. Ctrl+S saves (shows toast)', async ({ page }) => {
    await page.keyboard.press('Control+s');
    // Toast should appear with save confirmation
    await expect(page.locator('#toast')).toContainText(/сохранен/i);
  });

  test('17c. Ctrl+Z / Ctrl+Y undo/redo', async ({ page }) => {
    // Add a card
    await page.locator('#addCardBtn').click();
    const afterAdd = await page.locator('#cardsArea .card-wrapper').count();
    expect(afterAdd).toBeGreaterThanOrEqual(2);
    // Ctrl+Z undoes
    await page.keyboard.press('Control+z');
    await expect.poll(() => page.locator('#cardsArea .card-wrapper').count()).toBe(afterAdd - 1);
    // Ctrl+Y redoes
    await page.keyboard.press('Control+y');
    await expect.poll(() => page.locator('#cardsArea .card-wrapper').count()).toBe(afterAdd);
  });

  test('17d. Ctrl+Shift+Z also redoes', async ({ page }) => {
    await page.locator('#addCardBtn').click();
    const afterAdd = await page.locator('#cardsArea .card-wrapper').count();
    await page.keyboard.press('Control+z');
    await expect.poll(() => page.locator('#cardsArea .card-wrapper').count()).toBe(afterAdd - 1);
    // Ctrl+Shift+Z should redo
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => page.locator('#cardsArea .card-wrapper').count()).toBe(afterAdd);
  });
});
