import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('Application color theme', () => {
  test('starts light and toggles dark then light', async ({ page }) => {
    await gotoApp(page);
    const html = page.locator('html');
    const toggle = page.locator('#uiThemeToggle');

    await expect(html).toHaveAttribute('data-ui-theme', 'light');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(html).toHaveAttribute('data-ui-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-label', 'Включить светлую тему');
    await toggle.click();
    await expect(html).toHaveAttribute('data-ui-theme', 'light');
  });

  test('persists dark mode across reload without changing the card theme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('flashcard-onboarding-seen', '1'));
    await page.goto('/');
    await expect(page.locator('#cardsArea .card')).toHaveCount(1);
    const card = page.locator('#cardsArea .card').first();
    const beforeTheme = await card.getAttribute('data-theme');

    await page.locator('#uiThemeToggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('cardcraft-ui-theme'))).toBe('dark');
    expect(await card.getAttribute('data-theme')).toBe(beforeTheme);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'dark');
    await expect(page.locator('#uiThemeToggle')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('#cardsArea .card').first().getAttribute('data-theme')).toBe(beforeTheme);
  });
});
