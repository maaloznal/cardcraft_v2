import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test('AI creation requires authentication', async ({ page }) => {
  await gotoApp(page);
  const button = page.locator('#aiImportBtn');
  await expect(button).toContainText('Войти / зарегистрироваться для ИИ');
  await expect(button).toHaveAttribute('data-ai-access', 'denied');
  await button.click();
  await expect(page).toHaveURL(/\/login\/?\?mode=signup$/);
  await expect(page.getByRole('button', { name: 'Зарегистрироваться', exact: true })).toBeVisible();
});

test.describe('AI text import dialog', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    // Dialog behavior is tested independently from authentication. Production
    // keeps this denied until AuthProvider reports a real Supabase session.
    await page.locator('#aiImportBtn').evaluate((button) => {
      (button as HTMLElement).dataset.aiAccess = 'granted';
    });
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

  test('offers roles, a visual theme and a custom per-card limit', async ({ page }) => {
    await expect(page.locator('input[name="aiRole"][value="content-strategist"]')).toBeChecked();
    await expect(page.locator('#aiRoleLabel')).toHaveText('Контент-стратег');
    await expect(page.locator('#aiTargetChars')).toHaveValue('350');
    await expect(page.locator('#aiThemeSelect')).toHaveValue('');

    await page.locator('#aiRolePicker summary').click();
    await page.locator('input[name="aiRole"][value="smm-editor"]').check();
    await expect(page.locator('#aiRoleLabel')).toHaveText('SMM-редактор');
    await page.locator('#aiThemeSelect').selectOption('spearmint-fresh');
    await page.locator('#aiTargetChars').fill('420');
    await page.locator('#aiTargetChars').blur();

    const preferences = await page.evaluate(() => JSON.parse(localStorage.getItem('flashcard-ai-import-prefs') || '{}'));
    expect(preferences).toEqual({ role: 'smm-editor', theme: 'spearmint-fresh', targetChars: 420 });
  });

  test('estimates the card count and rejects an invalid target before sending', async ({ page }) => {
    await page.locator('#aiSourceText').fill('Тестовый текст. '.repeat(80));
    await expect(page.locator('#aiCardEstimate')).toContainText('Ориентировочно');
    await page.locator('#aiTargetChars').fill('100');
    await page.locator('#aiTargetChars').blur();
    await expect(page.locator('#aiImportError')).toContainText('от 180 до 2 200');
    await page.locator('#aiGenerateBtn').click();
    await expect(page.locator('#aiImportError')).toContainText('от 180 до 2 200');
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
  await expect(page.locator('#aiImportBtn')).toBeHidden();
  await expect(page.locator('#mobileAiImportBtn')).toBeVisible();
  await page.locator('#mobileAiImportBtn').evaluate((button) => {
    (button as HTMLElement).dataset.aiAccess = 'granted';
  });
  await page.locator('#mobileAiImportBtn').click();
  const panel = page.locator('.ai-import-panel');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await expect(page.locator('#aiGenerateBtn')).toHaveCSS('min-height', '44px');
  await expect(page.locator('#aiRolePicker summary')).toBeVisible();
  await expect(page.locator('#aiThemeSelect')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobileAiImportBtn')).toBeFocused();
});

for (const viewport of [
  { name: 'portrait', width: 768, height: 1024 },
  { name: 'landscape', width: 1024, height: 768 },
]) {
  test(`AI dialog fits a tablet in ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await gotoApp(page);
    await page.locator('#aiImportBtn').evaluate((button) => {
      (button as HTMLElement).dataset.aiAccess = 'granted';
    });
    await page.locator('#aiImportBtn').click();
    const panel = page.locator('.ai-import-panel');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.locator('#aiRolePicker summary')).toBeVisible();
    await expect(page.locator('#aiThemeSelect')).toBeVisible();
    await expect(page.locator('#aiTargetChars')).toBeVisible();
  });
}
