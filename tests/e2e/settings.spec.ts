import { test, expect } from '@playwright/test';
import { gotoApp, changeHiddenSelect, getSelectOptions } from './helpers';

/**
 * E2E: settings — theme change + progress bar change.
 * Covers MasterTask.md PRIORITY 2 scenarios: 10, 11.
 */

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('10. theme change — applies to preview cards', async ({ page }) => {
    // Use hidden native select via direct dispatch (reliable in E2E)
    const themes = await getSelectOptions(page, 'themeSelect');
    expect(themes.length).toBeGreaterThan(2);
    const themeValue = themes[2]; // 3rd option (not default)
    await changeHiddenSelect(page, 'themeSelect', themeValue);
    await page.waitForTimeout(400);
    // themeSelect should reflect the chosen value
    expect(await page.locator('#themeSelect').inputValue()).toBe(themeValue);
    // Cards should have data-theme attribute matching
    const cardWithTheme = page.locator(`#cardsArea .card[data-theme="${themeValue}"]`);
    await expect(cardWithTheme.first()).toBeVisible();
  });

  test('11. progress bar style change — updates preview', async ({ page }) => {
    // Add a card to ensure we have visible progress bars
    await page.locator('#addCardBtn').click();
    // Change progress style via hidden select
    const styles = await getSelectOptions(page, 'progressBarStyleSelect');
    expect(styles.length).toBeGreaterThan(1);
    const newStyle = styles[1] !== 'default' ? styles[1] : styles[2];
    await changeHiddenSelect(page, 'progressBarStyleSelect', newStyle);
    await page.waitForTimeout(300);
    // Progress bars should exist
    const progressBars = page.locator('#cardsArea .progress');
    const count = await progressBars.count();
    expect(count).toBeGreaterThan(0);
    // Verify the style attribute on root changed
    const rootProgressStyle = await page.locator('.cc-root').getAttribute('data-progress-style');
    expect(rootProgressStyle).toBe(newStyle);
  });

  test('11b. progress bar toggle — hides/shows progress', async ({ page }) => {
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(300);
    // Initially progress bar should be visible (default = true)
    await expect(page.locator('#cardsArea .progress').first()).toBeVisible();
    // Toggle off via evaluate (progressBarToggle is inside accordion, may be hidden)
    await page.evaluate(() => {
      const toggle = document.getElementById('progressBarToggle') as HTMLInputElement | null;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    // Progress bar should be hidden via CSS
    await expect(page.locator('.cc-root')).toHaveClass(/no-progress-bar/);
  });
});
