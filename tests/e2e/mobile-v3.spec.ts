import { test, expect, type Page } from '@playwright/test';
import { gotoApp, switchToEditorMode, switchToPreviewMode, getHorizontalOverflow } from './helpers';

/**
 * P4-UX-V3: regression tests for mobile UX iteration 3.
 * Covers:
 *   - Exclusive subsections within Дизайн (only one open at a time on phone)
 *   - Settings summary in Дизайн header (format + theme)
 *   - Scroll position preservation when switching editor/preview
 *   - No regressions on tablet/desktop
 */

/* ─── Helper: get all expanded sidebar-accordions inside Дизайн body ─── */
async function getExpandedDesignSubsections(page: Page): Promise<number> {
  return page.evaluate(() => {
    const designAccordion = document.querySelector(
      '.sidebar-fixed-header > .sidebar-accordion'
    );
    if (!designAccordion) return -1;
    const body = designAccordion.querySelector('.sidebar-accordion-body');
    if (!body) return -1;
    // Count direct children that are expanded
    return Array.from(body.querySelectorAll(':scope > .sidebar-accordion'))
      .filter((el) => el.classList.contains('expanded')).length;
  });
}

/* ═══════════════════════════════════════════════════════════════════
 * STAGE 1: Exclusive subsections (320×568)
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P4-S1: Exclusive subsections in Дизайн (phone)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoApp(page);
    await switchToEditorMode(page);
  });

  test('s1-1: open Дизайн, then open Формат — only Формат expanded', async ({ page }) => {
    // Click Дизайн header to expand
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Click Формат header
    const formatHeader = page.locator('.sidebar-accordion-body > .sidebar-accordion').first()
      .locator('.sidebar-accordion-header');
    await formatHeader.click();
    await page.waitForTimeout(200);
    // Only 1 subsection should be expanded
    const count = await getExpandedDesignSubsections(page);
    expect(count, 'only 1 subsection should be expanded').toBe(1);
  });

  test('s1-2: open Формат then Тема — only Тема expanded', async ({ page }) => {
    // Open Дизайн
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Open Формат
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    await subsections.nth(0).locator('.sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Open Тема
    await subsections.nth(1).locator('.sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Only 1 should be expanded
    const count = await getExpandedDesignSubsections(page);
    expect(count, 'opening Тема should close Формат').toBe(1);
  });

  test('s1-3: repeated tap on same subsection closes it', async ({ page }) => {
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    const formatHeader = subsections.nth(0).locator('.sidebar-accordion-header');
    // Open
    await formatHeader.click();
    await page.waitForTimeout(200);
    expect(await getExpandedDesignSubsections(page)).toBe(1);
    // Close
    await formatHeader.click();
    await page.waitForTimeout(200);
    expect(await getExpandedDesignSubsections(page)).toBe(0);
  });

  test('s1-4: aria-expanded matches actual state', async ({ page }) => {
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Check Дизайн itself has aria-expanded=true
    const designToggle = page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header');
    await expect(designToggle).toHaveAttribute('aria-expanded', 'true');
    // Open a subsection
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    const formatToggle = subsections.nth(0).locator('.sidebar-accordion-header');
    await formatToggle.click();
    await page.waitForTimeout(200);
    await expect(formatToggle).toHaveAttribute('aria-expanded', 'true');
    // Open another — first should become false
    const themeToggle = subsections.nth(1).locator('.sidebar-accordion-header');
    await themeToggle.click();
    await page.waitForTimeout(200);
    await expect(formatToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(themeToggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('s1-5: Дизайн can be collapsed independently', async ({ page }) => {
    const designToggle = page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header');
    // Open Дизайн
    await designToggle.click();
    await page.waitForTimeout(200);
    await expect(designToggle).toHaveAttribute('aria-expanded', 'true');
    // Open a subsection
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    await subsections.nth(0).locator('.sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Close Дизайн
    await designToggle.click();
    await page.waitForTimeout(200);
    await expect(designToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('s1-6: × button closes sidebar', async ({ page }) => {
    // Sidebar should be open (from beforeEach switchToEditorMode)
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    // Close via ×
    await page.locator('#closeSidebarBtn').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#editorSidebar')).toHaveClass(/\bcollapsed\b/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * STAGE 2: Settings summary (390×844)
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P4-S2: Settings summary in Дизайн header (phone)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
  });

  test('s2-1: summary shows format and theme after init', async ({ page }) => {
    const summary = page.locator('#designSummary');
    await expect(summary).not.toBeEmpty();
    const text = await summary.textContent();
    expect(text).toContain('·');
  });

  test('s2-2: summary updates after changing format', async ({ page }) => {
    // Open Дизайн
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Change format to 4:5
    await page.evaluate(() => {
      const sel = document.getElementById('formatSelect') as HTMLSelectElement;
      sel.value = 'aspect-4-5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    // Close Дизайн to see summary
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    const text = await page.locator('#designSummary').textContent();
    expect(text).toContain('4:5');
  });

  test('s2-3: no horizontal overflow at 390px', async ({ page }) => {
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * STAGE 3: Scroll position preservation (390×844)
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P4-S3: Scroll position preservation (phone)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
  });

  test('s3-1: editor scroll position restored after switching to preview and back', async ({ page }) => {
    // Add multiple cards to create scrollable content
    for (let i = 0; i < 5; i++) {
      await page.locator('#addCardBtn').click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    // Scroll editor sidebar using mouse.wheel
    const scrollArea = page.locator('.sidebar-scroll-area');
    // Use mouse.wheel for real scroll input
    const box = await scrollArea.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 50);
      await page.mouse.wheel(0, 200);
    }
    await page.waitForTimeout(300);
    const scrolledTo = await scrollArea.evaluate((el) => el.scrollTop);
    // Verify we actually scrolled
    if (scrolledTo === 0) {
      // Mouse wheel didn't work — set scrollTop directly as fallback
      await scrollArea.evaluate((el) => { el.scrollTop = 200; });
      await page.waitForTimeout(100);
    }
    const savedScroll = await scrollArea.evaluate((el) => el.scrollTop);
    // Switch to preview
    await switchToPreviewMode(page);
    await page.waitForTimeout(500);
    // Switch back to editor
    await switchToEditorMode(page);
    await page.waitForTimeout(500);
    // Check scroll position restored (with tolerance)
    const restoredScroll = await scrollArea.evaluate((el) => el.scrollTop);
    expect(Math.abs(restoredScroll - savedScroll), `saved=${savedScroll}, restored=${restoredScroll}`).toBeLessThan(60);
  });

  test('s3-2: preview scroll position restored after switching to editor and back', async ({ page }) => {
    // Add cards for scrollable preview
    for (let i = 0; i < 3; i++) {
      await page.locator('#addCardBtn').click();
      await page.waitForTimeout(100);
    }
    // Switch to preview first
    await switchToPreviewMode(page);
    await page.waitForTimeout(500);
    // Scroll preview using mouse.wheel
    const preview = page.locator('#previewWorkspace');
    const box = await preview.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 50);
      await page.mouse.wheel(0, 150);
    }
    await page.waitForTimeout(300);
    const scrolledTo = await preview.evaluate((el) => el.scrollTop);
    if (scrolledTo === 0) {
      await preview.evaluate((el) => { el.scrollTop = 150; });
      await page.waitForTimeout(100);
    }
    const savedScroll = await preview.evaluate((el) => el.scrollTop);
    // Switch to editor
    await switchToEditorMode(page);
    await page.waitForTimeout(500);
    // Switch back to preview
    await switchToPreviewMode(page);
    await page.waitForTimeout(500);
    const restoredScroll = await preview.evaluate((el) => el.scrollTop);
    expect(Math.abs(restoredScroll - savedScroll), `saved=${savedScroll}, restored=${restoredScroll}`).toBeLessThan(60);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * STAGE 4: Tablet and desktop regression checks
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P4-S4: Tablet/desktop regression', () => {
  test('s4-1: tablet split-view no horizontal overflow (768×1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoApp(page);
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('s4-2: desktop no horizontal overflow (1280×800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('s4-3: tablet — multiple design subsections can be open (non-exclusive)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoApp(page);
    // Open Дизайн
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Open two subsections
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    await subsections.nth(0).locator('.sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    await subsections.nth(1).locator('.sidebar-accordion-header').click();
    await page.waitForTimeout(200);
    // Both should be open (non-exclusive on tablet)
    const count = await getExpandedDesignSubsections(page);
    expect(count, 'tablet should allow multiple open subsections').toBe(2);
  });
});
