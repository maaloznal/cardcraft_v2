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

  test('18e. arbitrary selected phrase opens the text style popup', async ({ page }) => {
    const input = page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]');
    await input.fill('Можно выделить целую фразу на карточке');
    const title = page.locator('#cardsArea .card-title').first();
    await expect(title).toContainText('Можно выделить целую фразу на карточке');

    await title.evaluate((element) => {
      const textNode = element.firstChild;
      if (!textNode) throw new Error('Preview title has no text node');
      const range = document.createRange();
      range.setStart(textNode, 6);
      range.setEnd(textNode, 27);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
    });

    await expect(page.locator('#wordStylePopup')).toHaveClass(/active/);
    await expect(page.locator('#wordStylePopup')).toContainText('выделить целую фразу');
    await page.locator('#wordStylePopup [data-format="bold"]').click();
    const styledPhrase = title.locator('.cc-styled-word');
    await expect(styledPhrase).toHaveText('выделить целую фразу');
    await expect(styledPhrase).toHaveCSS('font-weight', '700');
  });
});
