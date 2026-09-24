import { test, expect } from '@playwright/test';
import { gotoApp, getPreviewCardCount, changeHiddenSelect, getSelectOptions } from './helpers';

/**
 * E2E: undo/redo.
 * Covers MasterTask.md PRIORITY 2 scenarios: 8, 9.
 */

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('8. undo — reverts last action', async ({ page }) => {
    const before = await getPreviewCardCount(page);
    // Add a card
    await page.locator('#addCardBtn').click();
    await expect.poll(() => getPreviewCardCount(page)).toBe(before + 1);
    // Undo
    await page.keyboard.press('Control+z');
    await expect.poll(() => getPreviewCardCount(page)).toBe(before);
    // Undo button should be enabled before, then disabled after undoing the only action
  });

  test('9. redo — reapplies undone action', async ({ page }) => {
    const before = await getPreviewCardCount(page);
    // Add a card
    await page.locator('#addCardBtn').click();
    await expect.poll(() => getPreviewCardCount(page)).toBe(before + 1);
    // Undo
    await page.keyboard.press('Control+z');
    await expect.poll(() => getPreviewCardCount(page)).toBe(before);
    // Redo
    await page.keyboard.press('Control+y');
    await expect.poll(() => getPreviewCardCount(page)).toBe(before + 1);
  });

  test('8b. undo reverts theme change (P1-8)', async ({ page }) => {
    // Get initial theme
    const initialTheme = await page.locator('#themeSelect').inputValue();
    // Change theme via hidden select (reliable in E2E)
    const themes = await getSelectOptions(page, 'themeSelect');
    const newTheme = themes[2]; // 3rd option
    await changeHiddenSelect(page, 'themeSelect', newTheme);
    await page.waitForTimeout(300);
    const changedTheme = await page.locator('#themeSelect').inputValue();
    expect(changedTheme).not.toBe(initialTheme);
    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    // Theme should be restored
    const undoneTheme = await page.locator('#themeSelect').inputValue();
    expect(undoneTheme).toBe(initialTheme);
  });

  test('8c. undo reverts progress bar style change (P1-8)', async ({ page }) => {
    // Get initial progress style
    const initialStyle = await page.locator('#progressBarStyleSelect').inputValue();
    // Change progress style via hidden select
    const styles = await getSelectOptions(page, 'progressBarStyleSelect');
    const newStyle = styles.find((s) => s !== initialStyle) ?? styles[1];
    await changeHiddenSelect(page, 'progressBarStyleSelect', newStyle);
    await page.waitForTimeout(300);
    const changedStyle = await page.locator('#progressBarStyleSelect').inputValue();
    expect(changedStyle).not.toBe(initialStyle);
    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    // Style should be restored
    const undoneStyle = await page.locator('#progressBarStyleSelect').inputValue();
    expect(undoneStyle).toBe(initialStyle);
  });
});
