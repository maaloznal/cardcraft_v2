import { expect, test } from '@playwright/test';

test.describe('Welcome and project entry points', () => {
  test('welcome page explains the product and opens the editor', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Превращайте мысли/ })).toBeVisible();
    // Primary CTA is "Открыть редактор" → /editor/ (canonical route map)
    await expect(page.getByRole('link', { name: 'Открыть редактор' }).first()).toHaveAttribute('href', /\/editor\/?/);
    await expect(page.getByText('50 000', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Открыть редактор' }).first().click();
    await expect(page).toHaveURL(/\/editor\/?$/);
    await expect(page.locator('#editorCardsList .card-editor-block')).toHaveCount(1);
  });

  test('guest opens the editor without creating a project', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('flashcard-onboarding-seen', '1');
    });
    await page.goto('/editor/');
    await expect(page.getByRole('heading', { name: 'Сначала создайте проект' })).toHaveCount(0);
    await expect(page.locator('.project-badge')).toContainText('Локальный черновик');
    await expect(page.locator('.project-create-top')).toHaveCount(0);

    await page.locator('.project-badge').click();
    await expect(page.getByRole('link', { name: /Проекты после регистрации/ })).toBeVisible();
    await page.locator('[data-field="title"]').first().fill('Гостевой черновик');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('flashcard-cards') || '')).toContain('Гостевой черновик');
  });

  test('documentation contains the core workflow and project rules', async ({ page }) => {
    await page.goto('/docs/');
    await expect(page.getByRole('heading', { name: 'Как работать в Cardcraft' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Проекты', exact: true })).toBeVisible();
    await expect(page.getByText(/их количество не ограничено/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Создание с ИИ' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Хранение и синхронизация' })).toBeVisible();
  });

  test('welcome and documentation stay readable on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Превращайте мысли/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Открыть редактор' }).first()).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');

    await page.goto('/docs/');
    await expect(page.getByRole('heading', { name: 'Как работать в Cardcraft' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Содержание' })).toBeVisible();
  });
});
