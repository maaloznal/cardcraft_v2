import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * E2E: modal behavior — color modal open/close, ESC, focus.
 * Covers MasterTask.md PRIORITY 2 scenarios: 12, 18.
 */

test.describe('Color modal', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('12. color modal opens via palette button', async ({ page }) => {
    // Click palette button on first card
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="palette"]').click();
    // Modal should be visible
    await expect(page.locator('#colorModal')).toHaveClass(/active/);
    // Modal title should show card number
    await expect(page.locator('#modalCardTitle')).toContainText('Стили · Карточка 1');
  });

  test('18a. ESC closes color modal', async ({ page }) => {
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="palette"]').click();
    await expect(page.locator('#colorModal')).toHaveClass(/active/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#colorModal')).not.toHaveClass(/active/);
  });

  test('18b. close button closes color modal', async ({ page }) => {
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="palette"]').click();
    await expect(page.locator('#colorModal')).toHaveClass(/active/);
    await page.locator('#closeModalBtn').click();
    await expect(page.locator('#colorModal')).not.toHaveClass(/active/);
  });

  test('18c. apply button closes color modal', async ({ page }) => {
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="palette"]').click();
    await expect(page.locator('#colorModal')).toHaveClass(/active/);
    await page.locator('#applyColorsBtn').click();
    await expect(page.locator('#colorModal')).not.toHaveClass(/active/);
  });

  test('18d. word style popup opens on dblclick + closes on ESC', async ({ page }) => {
    // Type text in first card
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('Double Click Me');
    await expect(page.locator('#cardsArea .card-title').first()).toContainText('Double Click Me');
    // Double-click a word in preview
    await page.locator('#cardsArea .card-title').first().dblclick();
    // Word popup should open
    await expect(page.locator('#wordStylePopup')).toHaveClass(/active/);
    // ESC closes it
    await page.keyboard.press('Escape');
    await expect(page.locator('#wordStylePopup')).not.toHaveClass(/active/);
  });
});
