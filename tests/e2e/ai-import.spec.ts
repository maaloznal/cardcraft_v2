import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('AI text import dialog', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.locator('#aiImportBtn').click();
  });

  test('opens accessibly and enforces the 10,000 character client limit', async ({ page }) => {
    const dialog = page.locator('#aiImportModal');
    await expect(dialog).toHaveClass(/active/);
    await expect(dialog).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#aiSourceText')).toBeFocused();
    await expect(page.locator('#aiSourceText')).toHaveAttribute('maxlength', '10000');
    await page.locator('#aiSourceText').fill('Короткий текст.');
    await expect(page.locator('#aiCharCount')).toContainText('15 / 10 000');
    await expect(page.locator('#aiGenerateBtn')).toBeEnabled();
  });

  test('defaults to preserve mode and exposes improve mode', async ({ page }) => {
    await expect(page.locator('input[name="aiTextMode"][value="preserve"]')).toBeChecked();
    await page.locator('input[name="aiTextMode"][value="improve"]').check();
    await expect(page.locator('input[name="aiTextMode"][value="improve"]')).toBeChecked();
  });

  test('closes with Escape and restores focus', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('#aiImportModal')).not.toHaveClass(/active/);
    await expect(page.locator('#aiImportBtn')).toBeFocused();
  });
});

test('AI dialog fits a 390×844 phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page);
  await page.locator('#aiImportBtn').click();
  const panel = page.locator('.ai-import-panel');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await expect(page.locator('#aiGenerateBtn')).toHaveCSS('min-height', '44px');
});
