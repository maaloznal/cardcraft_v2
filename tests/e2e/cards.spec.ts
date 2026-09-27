import { test, expect } from '@playwright/test';
import { gotoApp, getPreviewCardCount, getEditorCardCount, getPreviewCardTitle } from './helpers';

/**
 * E2E: card CRUD operations.
 * Covers MasterTask.md PRIORITY 2 scenarios: 3, 4, 5, 6, 7.
 */

test.describe('Card operations', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('3. create card — Add button increases count', async ({ page }) => {
    const before = await getPreviewCardCount(page);
    await page.locator('#addCardBtn').click();
    await expect.poll(() => getPreviewCardCount(page)).toBe(before + 1);
    expect(await getEditorCardCount(page)).toBe(before + 1);
  });

  test('4. edit card — typing in editor updates preview', async ({ page }) => {
    // Type in first card's title
    const editorInput = page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]');
    await editorInput.fill('Edited Title E2E');
    // Preview should update
    await expect(page.locator('#cardsArea .card-title').first()).toContainText('Edited Title E2E');
  });

  test('4a. story card keeps copy balanced and away from the upper edge', async ({ page }) => {
    const editor = page.locator('#editorCardsList .card-editor-block').first();
    await editor.locator('[data-field="title"]').fill('Продуманный заголовок для красивой карточки');
    await editor.locator('[data-field="text"]').fill('Основной текст переносится аккуратно и сохраняет ровный визуальный ритм без случайных разрывов обычных слов.');
    await page.locator('#formatSelect').evaluate((select) => {
      const element = select as HTMLSelectElement;
      element.value = 'aspect-9-16';
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const card = page.locator('#cardsArea .card').first();
    const copy = card.locator('.card-copy');
    await expect(card).toHaveAttribute('data-format', 'aspect-9-16');
    await expect(copy).toBeVisible();
    await expect(card.locator('.card-title')).toHaveCSS('text-wrap', 'balance');
    await expect(card.locator('.card-text')).toHaveCSS('text-wrap', 'pretty');
    await expect(card.locator('.card-text')).toHaveCSS('word-break', 'normal');

    const spacing = await page.evaluate(() => {
      const cardRect = document.querySelector('#cardsArea .card')!.getBoundingClientRect();
      const copyRect = document.querySelector('#cardsArea .card-copy')!.getBoundingClientRect();
      return {
        above: copyRect.top - cardRect.top,
        below: cardRect.bottom - copyRect.bottom,
      };
    });
    expect(spacing.above).toBeGreaterThan(80);
    expect(spacing.below).toBeGreaterThan(80);
  });

  test('4aa. AI improvement is presented as a separate full-width card action', async ({ page }) => {
    const action = page.locator('#cardsArea .btn-card-ai').first();
    await expect(action).toBeVisible();
    await expect(action).toContainText('Улучшить с ИИ');
    const actionBox = await action.boundingBox();
    const actionsBox = await page.locator('#cardsArea .card-actions').first().boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(actionBox!.width).toBeGreaterThanOrEqual(actionsBox!.width - 1);

    await action.click();
    await expect(page).toHaveURL(/\/login\/?\?mode=signup&next=\/editor$/);
  });

  test('4b. desktop card title does not replace the explicit collapse button', async ({ page }) => {
    const card = page.locator('#editorCardsList .card-editor-block').first();
    await card.locator('[data-field="title"]').fill('Desktop Title');
    await card.locator('.card-collapse-toggle').click();
    await expect(card).toHaveClass(/\bcollapsed\b/);

    await card.locator('.card-editor-title-group').click();
    await expect(card).toHaveClass(/\bcollapsed\b/);

    await card.locator('.card-collapse-toggle').click();
    await expect(card).not.toHaveClass(/\bcollapsed\b/);
  });

  test('5. delete card — removes from editor + preview', async ({ page }) => {
    const before = await getPreviewCardCount(page);
    // Add a card first (so we have at least 2, can delete 1)
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(400);
    expect(await getPreviewCardCount(page)).toBe(before + 1);
    // Ensure first card block is expanded (collapse toggle if collapsed)
    const firstBlock = page.locator('#editorCardsList .card-editor-block').first();
    const isCollapsed = await firstBlock.evaluate((el) => el.classList.contains('collapsed'));
    if (isCollapsed) {
      await firstBlock.locator('[data-action="collapse"]').click();
      await page.waitForTimeout(200);
    }
    // Delete the first card via editor delete button (use evaluate for reliability)
    await firstBlock.locator('[data-action="delete"]').click({ timeout: 5000 }).catch(async () => {
      // Fallback: dispatch click via evaluate (button may be inside collapsed body)
      await firstBlock.locator('[data-action="delete"]').dispatchEvent('click');
    });
    await page.waitForTimeout(400);
    expect(await getPreviewCardCount(page)).toBe(before);
    expect(await getEditorCardCount(page)).toBe(before);
  });

  test('6. duplicate card — copy appears after original', async ({ page }) => {
    const before = await getPreviewCardCount(page);
    // Type in first card
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('Original');
    await page.waitForTimeout(500);
    await expect(page.locator('#cardsArea .card-title').first()).toContainText('Original');
    // Verify count unchanged after typing
    expect(await getPreviewCardCount(page)).toBe(before);
    // Duplicate first card via dispatchEvent (avoids potential double-click from click())
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="duplicate"]').dispatchEvent('click');
    await page.waitForTimeout(500);
    // Should have exactly +1 card
    expect(await getPreviewCardCount(page)).toBe(before + 1);
    // Both first and second card should have "Original" title (copy has same content)
    expect(await getPreviewCardTitle(page, 0)).toBe('Original');
    expect(await getPreviewCardTitle(page, 1)).toBe('Original');
  });

  test('7. move card — down then up reorders', async ({ page }) => {
    // Add 2 cards with distinct titles
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('First');
    await page.locator('#addCardBtn').click();
    await page.locator('#editorCardsList .card-editor-block').nth(1).locator('[data-field="title"]').fill('Second');
    await expect(page.locator('#cardsArea .card-title').nth(0)).toContainText('First');
    await expect(page.locator('#cardsArea .card-title').nth(1)).toContainText('Second');
    // Move first card down
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="move"][data-dir="1"]').click();
    // Now "Second" should be first, "First" second
    await expect(page.locator('#cardsArea .card-title').nth(0)).toContainText('Second');
    await expect(page.locator('#cardsArea .card-title').nth(1)).toContainText('First');
    // Move it back up (the card that's now at index 1, which is "First")
    await page.locator('#editorCardsList .card-editor-block').nth(1).locator('[data-action="move"][data-dir="-1"]').click();
    await expect(page.locator('#cardsArea .card-title').nth(0)).toContainText('First');
    await expect(page.locator('#cardsArea .card-title').nth(1)).toContainText('Second');
  });
});
