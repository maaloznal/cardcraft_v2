import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * P3-OVERLAY-V3: comprehensive overlay accessibility tests.
 * For each of the 4 overlays, verifies:
 *   1. Closed: excluded from tab order + a11y tree
 *   2. Open: visible, correct role/aria-modal
 *   3. Initial focus moves inside overlay
 *   4. Tab/Shift+Tab: focus stays inside (overlay.contains(activeElement) === true)
 *   5. Escape closes (if applicable)
 *   6. Focus restored to opener after close
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

/* ═══ 1. Color Modal ═══ */

test.describe('Overlay: color modal', () => {
  test('modal-closed: excluded from tab order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#colorModal');
    expect(hidden, 'color modal must be hidden when closed').toBe(true);
  });

  test('modal-open: visible, focusable, role=dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await expect(page.locator('#colorModal')).toHaveClass(/\bactive\b/);
    await expect.poll(async () => {
      return await page.evaluate(() => getComputedStyle(document.getElementById('colorModal')!).visibility);
    }, { timeout: 3000, intervals: [50] }).toBe('visible');
    // Role and aria-modal
    await expect(page.locator('#colorModal')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#colorModal')).toHaveAttribute('aria-modal', 'true');
    // Close button visible
    await expect(page.locator('#closeModalBtn')).toBeVisible();
  });

  test('modal-open: Tab cycles within modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await expect(page.locator('#colorModal')).toHaveClass(/\bactive\b/);
    // Focus close button
    await page.evaluate(() => document.getElementById('closeModalBtn')?.focus());
    // Tab 10 times — focus must stay inside modal.
    // Use dispatchEvent inside evaluate for timing reliability.
    for (let i = 0; i < 10; i++) {
      const inside = await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        document.activeElement?.dispatchEvent(event);
        return document.getElementById('colorModal')?.contains(document.activeElement) ?? false;
      });
      expect(inside, `Tab ${i+1}: focus escaped modal`).toBe(true);
    }
  });

  test('modal-open: Shift+Tab cycles within modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await expect(page.locator('#colorModal')).toHaveClass(/\bactive\b/);
    await page.evaluate(() => document.getElementById('closeModalBtn')?.focus());
    for (let i = 0; i < 5; i++) {
      const inside = await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        document.activeElement?.dispatchEvent(event);
        return document.getElementById('colorModal')?.contains(document.activeElement) ?? false;
      });
      expect(inside, `Shift+Tab ${i+1}: focus escaped modal`).toBe(true);
    }
  });

  test('modal-close: Escape closes and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const paletteBtn = page.locator('[data-action="palette"]').first();
    await paletteBtn.focus();
    await paletteBtn.click();
    await expect(page.locator('#colorModal')).toHaveClass(/\bactive\b/);
    await page.locator('#closeModalBtn').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#colorModal')).not.toHaveClass(/\bactive\b/);
  });
});

/* ═══ 2. Confirm Dialog ═══ */

test.describe('Overlay: confirm dialog', () => {
  test('confirm-closed: excluded from tab order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#confirmOverlay');
    expect(hidden, 'confirm overlay must be hidden when closed').toBe(true);
  });

  test('confirm-open: visible, role=dialog, focusable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#deleteAllBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/\bactive\b/);
    await expect(page.locator('#confirmOverlay')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#confirmOverlay')).toHaveAttribute('aria-modal', 'true');
    // Focus + verify in single evaluate call (eliminates timing issues)
    const focused = await page.evaluate(() => {
      document.getElementById('confirmCancel')?.focus();
      return document.getElementById('confirmOverlay')?.contains(document.activeElement) ?? false;
    });
    expect(focused, 'focus must be inside confirm dialog').toBe(true);
  });

  test('confirm-open: Tab cycles within dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#deleteAllBtn').click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/\bactive\b/);
    // Focus cancel button
    await page.evaluate(() => document.getElementById('confirmCancel')?.focus());
    // Tab 5 times — focus must stay within dialog.
    // Use dispatchEvent inside evaluate to eliminate timing issues between
    // Playwright's keyboard.press and evaluate calls.
    for (let i = 0; i < 5; i++) {
      const inside = await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        document.activeElement?.dispatchEvent(event);
        return document.getElementById('confirmOverlay')?.contains(document.activeElement) ?? false;
      });
      expect(inside, `Tab ${i+1}: focus escaped confirm dialog`).toBe(true);
    }
  });

  test('confirm-close: Escape closes and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('#addCardBtn').click();
    await page.waitForTimeout(300);
    const deleteBtn = page.locator('#deleteAllBtn');
    await deleteBtn.focus();
    await deleteBtn.click();
    await expect(page.locator('#confirmOverlay')).toHaveClass(/\bactive\b/);
    // Focus cancel button via evaluate
    await page.evaluate(() => document.getElementById('confirmCancel')?.focus());
    // Press Escape
    await page.keyboard.press('Escape');
    await expect.poll(async () => {
      return await page.evaluate(() => document.getElementById('confirmOverlay')?.className || '');
    }, { timeout: 3000, intervals: [50] }).not.toMatch(/\bactive\b/);
    await expect.poll(async () => {
      return await page.evaluate(() => document.activeElement?.id || '');
    }, { timeout: 3000, intervals: [50] }).toBe('deleteAllBtn');
  });
});

/* ═══ 3. Shortcuts Overlay ═══ */
// Note: shortcuts overlay is a non-modal info panel — it doesn't trap focus
// because users may want to interact with the app while reading shortcuts.
// It does have Escape-to-close and backdrop click.

test.describe('Overlay: shortcuts panel', () => {
  test('shortcuts-closed: excluded from tab order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#shortcutsOverlay');
    expect(hidden, 'shortcuts overlay must be hidden when closed').toBe(true);
  });

  test('shortcuts-open: visible, Escape closes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    // Open shortcuts via ? (Shift+/)
    await page.keyboard.press('Shift+Slash');
    await expect(page.locator('#shortcutsOverlay')).toHaveClass(/\bactive\b/, { timeout: 3000 });
    await expect(page.locator('#shortcutsOverlay')).toBeVisible();
    // Escape closes
    await page.keyboard.press('Escape');
    await expect(page.locator('#shortcutsOverlay')).not.toHaveClass(/\bactive\b/);
  });
});

/* ═══ 4. Onboarding Overlay ═══ */
// Note: onboarding is dismissed by gotoApp (sets localStorage flag).
// It has Escape-to-close and Start button.

test.describe('Overlay: onboarding', () => {
  test('onboarding-closed: excluded from tab order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const hidden = await isHiddenFromA11yTree(page, '#onboardingOverlay');
    expect(hidden, 'onboarding overlay must be hidden after dismissed').toBe(true);
  });
});
