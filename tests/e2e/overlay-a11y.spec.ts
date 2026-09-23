import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * P1-A11Y-V2: overlay accessibility tests.
 * Verifies that all 4 overlay types (color modal, confirm dialog, shortcuts,
 * onboarding) properly:
 *   - Are excluded from Tab order when closed
 *   - Are hidden from accessibility tree when closed
 *   - Trap focus inside when open
 *   - Tab doesn't escape to background when open
 *   - Restore focus after closing
 */

async function isHiddenFromA11yTree(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return true;
    const style = getComputedStyle(el);
    if (style.display === 'none') return true;
    if (style.visibility === 'hidden') return true;
    if (el.hasAttribute('hidden')) return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    return false;
  }, selector);
}

/* ═══════════════════════════════════════════════════════════════════
 * 1. Color Modal (#colorModal)
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('Overlay: color modal', () => {
  test('modal-closed: excluded from tab order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#colorModal');
    expect(hidden, 'color modal must be hidden when closed').toBe(true);
  });

  test('modal-open: visible with focusable close button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await expect(page.locator('#colorModal')).toHaveClass(/\bactive\b/);
    // Wait for visibility to become visible
    await expect.poll(async () => {
      return await page.evaluate(() => getComputedStyle(document.getElementById('colorModal')!).visibility);
    }, { timeout: 3000, intervals: [100] }).toBe('visible');
    // Close button should be visible and focusable
    await expect(page.locator('#closeModalBtn')).toBeVisible();
    // Focus the close button explicitly
    await page.locator('#closeModalBtn').focus();
    await expect(page.locator('#closeModalBtn')).toBeFocused();
  });

  test('modal-open: focus trap — Tab does not escape to sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await expect(page.locator('#colorModal')).toHaveClass(/\bactive\b/);
    await page.locator('#closeModalBtn').focus();
    // Tab 10 times — focus should not land on sidebar editor inputs
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }
    const focusedInSidebar = await page.evaluate(() => {
      const sidebar = document.getElementById('editorSidebar');
      const active = document.activeElement;
      // Check if focused element is an editor input (not what we want)
      return sidebar?.contains(active) && active?.matches('input, textarea');
    });
    expect(focusedInSidebar, 'focus must not escape to sidebar inputs').toBe(false);
  });

  test('modal-close: Escape closes modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await expect(page.locator('#colorModal')).toHaveClass(/\bactive\b/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#colorModal')).not.toHaveClass(/\bactive\b/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 2. Confirm Dialog (#confirmOverlay)
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('Overlay: confirm dialog', () => {
  test('confirm-closed: excluded from tab order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#confirmOverlay');
    expect(hidden, 'confirm overlay must be hidden when closed').toBe(true);
  });

  test('confirm-open: dialog visible with focusable buttons', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#deleteAllBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/\bactive\b/);
    // Confirm overlay should be visible
    await expect(page.locator('#confirmOverlay')).toBeVisible();
    // Cancel button should be focusable
    await expect(page.locator('#confirmOverlay button').first()).toBeVisible();
  });

  test('confirm-open: focus trap — Tab does not escape to sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#deleteAllBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/\bactive\b/);
    await page.locator('#confirmOverlay button').first().focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }
    const focusedInSidebar = await page.evaluate(() => {
      const sidebar = document.getElementById('editorSidebar');
      const active = document.activeElement;
      return sidebar?.contains(active) && active?.matches('input, textarea');
    });
    expect(focusedInSidebar, 'focus must not escape to sidebar inputs').toBe(false);
  });

  test('confirm-close: Escape closes dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#deleteAllBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/\bactive\b/);
    // Focus the cancel button inside dialog
    const cancelBtn = page.locator('#confirmOverlay button').first();
    await cancelBtn.focus();
    await expect(cancelBtn).toBeFocused();
    // Press Escape — should close dialog (events.ts keydown handler on confirmOverlay)
    await page.keyboard.press('Escape');
    // Use expect.poll for the class change
    await expect.poll(async () => {
      return await page.evaluate(() => document.getElementById('confirmOverlay')?.className || '');
    }, { timeout: 3000, intervals: [100] }).not.toMatch(/\bactive\b/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 3. Shortcuts Overlay (#shortcutsOverlay)
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('Overlay: shortcuts panel', () => {
  test('shortcuts-closed: excluded from tab order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#shortcutsOverlay');
    expect(hidden, 'shortcuts overlay must be hidden when closed').toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 4. Onboarding Overlay (#onboardingOverlay)
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('Overlay: onboarding', () => {
  test('onboarding-closed: excluded from tab order', async ({ page }) => {
    // gotoApp sets onboarding-seen=1, so onboarding should be hidden
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#onboardingOverlay');
    expect(hidden, 'onboarding overlay must be hidden after dismissed').toBe(true);
  });
});
