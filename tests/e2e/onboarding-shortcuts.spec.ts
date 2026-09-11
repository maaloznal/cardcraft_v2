import { test, expect } from '@playwright/test';

/**
 * E2E tests for onboarding (P22) + shortcuts panel (P23).
 *
 * P22: Onboarding overlay shows on first visit, can be skipped,
 *      can be restarted via shortcuts panel button.
 * P23: ? key opens shortcuts panel, Escape closes it.
 *
 * NOTE: gotoApp() in helpers.ts sets flashcard-onboarding-seen='1' to
 * prevent onboarding from blocking tests. These tests manipulate the
 * flag directly to test onboarding behavior.
 */

const ONBOARDING_KEY = 'flashcard-onboarding-seen';

test.describe('P22: Onboarding', () => {
  test('onboarding shows on first visit (no localStorage flag)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Do NOT set onboarding-seen flag — simulate first visit
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('#onboardingOverlay')).toHaveClass(/active/);
  });

  test('onboarding does NOT show after Skip (flag set)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Skip onboarding
    await page.locator('#closeOnboardingBtn').click();
    await page.waitForTimeout(500);
    // Flag should be set
    const flag = await page.evaluate(() => localStorage.getItem('flashcard-onboarding-seen'));
    expect(flag).toBe('1');
    // Onboarding should be hidden
    await expect(page.locator('#onboardingOverlay')).not.toHaveClass(/active/);
  });

  test('onboarding does NOT show on reload after Skip', async ({ page, context }) => {
    // Use a fresh context (no addInitScript) so reload preserves localStorage
    // Clear storage on first load, then test persistence
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Reload to apply cleared storage (app boots fresh)
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Onboarding should show (first visit)
    await expect(page.locator('#onboardingOverlay')).toHaveClass(/active/);
    // Skip onboarding
    await page.locator('#closeOnboardingBtn').click();
    await page.waitForTimeout(500);
    // Navigate again (not reload — goto triggers full load but preserves localStorage)
    // Use evaluate to set flag explicitly (Skip already sets it, but addInitScript is not used here)
    await page.evaluate(() => localStorage.setItem('flashcard-onboarding-seen', '1'));
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Onboarding should NOT show (flag is set, no initScript to clear it)
    await expect(page.locator('#onboardingOverlay')).not.toHaveClass(/active/);
  });

  test('Start button also closes onboarding + sets flag', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.locator('#onboardingStartBtn').click();
    await page.waitForTimeout(500);
    const flag = await page.evaluate(() => localStorage.getItem('flashcard-onboarding-seen'));
    expect(flag).toBe('1');
    await expect(page.locator('#onboardingOverlay')).not.toHaveClass(/active/);
  });

  test('restart onboarding via shortcuts panel button', async ({ page }) => {
    // Start with onboarding already seen
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('flashcard-onboarding-seen', '1');
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Onboarding should NOT be visible
    await expect(page.locator('#onboardingOverlay')).not.toHaveClass(/active/);
    // Open shortcuts panel
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    await page.waitForTimeout(500);
    await expect(page.locator('#shortcutsOverlay')).toHaveClass(/active/);
    // Click "Показать онбординг снова"
    await page.locator('#restartOnboardingBtn').click();
    await page.waitForTimeout(500);
    // Onboarding should be visible, shortcuts should be closed
    await expect(page.locator('#onboardingOverlay')).toHaveClass(/active/);
    await expect(page.locator('#shortcutsOverlay')).not.toHaveClass(/active/);
  });
});

test.describe('P23: Shortcuts panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('flashcard-onboarding-seen', '1');
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('? key opens shortcuts panel', async ({ page }) => {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    await page.waitForTimeout(500);
    await expect(page.locator('#shortcutsOverlay')).toHaveClass(/active/);
  });

  test('Escape closes shortcuts panel', async ({ page }) => {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    await page.waitForTimeout(500);
    await expect(page.locator('#shortcutsOverlay')).toHaveClass(/active/);
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await page.waitForTimeout(500);
    await expect(page.locator('#shortcutsOverlay')).not.toHaveClass(/active/);
  });

  test('close button closes shortcuts panel', async ({ page }) => {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    await page.waitForTimeout(500);
    await page.locator('#closeShortcutsBtn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#shortcutsOverlay')).not.toHaveClass(/active/);
  });

  test('shortcuts panel lists real shortcuts', async ({ page }) => {
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    await page.waitForTimeout(500);
    // Verify at least Ctrl+S, Ctrl+Z, Escape, Tab, arrows, ? are listed
    const bodyText = await page.locator('.shortcuts-body').textContent();
    expect(bodyText).toContain('Ctrl');
    expect(bodyText).toContain('Esc');
    expect(bodyText).toContain('Tab');
    expect(bodyText).toContain('↓');
    expect(bodyText).toContain('?');
  });
});
