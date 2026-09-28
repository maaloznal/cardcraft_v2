import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test('custom card limit applies to the total text across all fields', async ({ page }) => {
  await gotoApp(page);
  await page.getByRole('button', { name: 'ДИЗАЙН' }).click();
  await page.getByRole('button', { name: 'Формат' }).click();

  await page.locator('#charLimitInput').fill('100');
  await page.locator('#charLimitInput').blur();
  await page.locator('#charLimitToggle').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const firstCard = page.locator('#editorCardsList .card-editor-block').first();
  await firstCard.locator('input[data-field="title"]').fill('a'.repeat(80));
  await firstCard.locator('textarea[data-field="subtitle"]').fill('b'.repeat(50));

  await expect(firstCard.locator('textarea[data-field="subtitle"]')).toHaveValue('b'.repeat(20));
  await expect(page.locator('#charCounterText')).toHaveText('100 / 100');
});
