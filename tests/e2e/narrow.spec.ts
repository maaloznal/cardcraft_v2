import { test, expect } from '@playwright/test';
import { gotoApp, getHorizontalOverflow } from './helpers';

/**
 * P-MOBILE: narrow phone tests (320×568 — iPhone SE 1st gen).
 *
 * Per spec B in the task requirements:
 *   - Top bar doesn't break
 *   - Elements don't overflow
 *   - Main actions remain accessible
 */

test.describe('Narrow phone (320×568)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoApp(page);
  });

  test('B1: no horizontal overflow on 320px viewport', async ({ page }) => {
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('B2: top bar fits within 320px width', async ({ page }) => {
    const topBar = await page.locator('.top-bar').boundingBox();
    expect(topBar).not.toBeNull();
    expect(topBar!.width).toBeLessThanOrEqual(320);
  });

  test('B3: card count remains visible on narrow screens', async ({ page }) => {
    await expect(page.locator('#cardCountBadge')).toBeVisible();
  });

  test('B4: mobile navigation remains accessible while redundant controls yield space', async ({ page }) => {
    await expect(page.locator('#modeEditorTab')).toBeVisible();
    await expect(page.locator('#modePreviewTab')).toBeVisible();
    await expect(page.locator('#toggleSidebarBtn')).not.toBeVisible();
    await expect(page.locator('#undoBtn')).not.toBeVisible();
    await expect(page.locator('#redoBtn')).not.toBeVisible();
  });

  test('B5: brand name still visible', async ({ page }) => {
    const brand = page.locator('.brand-name');
    await expect(brand).toBeVisible();
    const text = await brand.textContent();
    expect(text).toContain('Cardcraft');
  });

  test('B6: no element exceeds viewport width (excluding off-screen sidebar)', async ({ page }) => {
    // Check for any element wider than viewport (overflow).
    // The sidebar (and its children) is intentionally translated off-screen
    // (translateX(-100%)) when collapsed — those elements' right edge is
    // negative / off-screen, which is expected behavior, not a bug.
    // We exclude:
    // - #editorSidebar and descendants (off-screen when collapsed)
    // - elements with position: fixed (intentionally off-screen)
    // - elements inside inactive modal-overlay (modal-card has width: 340px
    //   but max-width: calc(100vw - 16px) only when .active; when inactive
    //   it's display:none but its bounding box still reports full width)
    // - elements with display: none (not visible, no overflow)
    const overflow = await page.evaluate(() => {
      const vw = window.innerWidth;
      const overflowing: string[] = [];
      document.body.querySelectorAll('*').forEach((el) => {
        if (el.closest('#editorSidebar')) return;
        const style = getComputedStyle(el);
        if (style.position === 'fixed') return;
        if (el.closest('#onboardingOverlay')) return;
        // Skip inactive modal overlays (display: none)
        if (style.display === 'none') return;
        if (el.closest('.modal-overlay:not(.active)')) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        if (rect.right > vw + 1) {
          overflowing.push(`${el.tagName}.${el.className} (right=${rect.right.toFixed(0)})`);
        }
      });
      return { count: overflowing.length, samples: overflowing.slice(0, 10) };
    });
    if (overflow.count > 0) {
      console.log('Overflowing elements on 320px:', overflow.samples);
    }
    expect(overflow.count).toBe(0);
  });
});
