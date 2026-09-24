import { test, expect } from '@playwright/test';
import { gotoApp, getHorizontalOverflow } from './helpers';

/**
 * P-MOBILE: tablet tests.
 *
 * Per spec C (portrait, 768×1024) and D (landscape, 1024×768) in the task requirements:
 *
 * C. Tablet portrait (768×1024):
 *   - Editor and preview visible simultaneously (split-view, not overlay)
 *   - Editor can be collapsed and expanded
 *   - No dimming of workspace in split-view (no backdrop)
 *   - No horizontal overflow
 *
 * D. Tablet landscape (1024×768):
 *   - Layout doesn't jump or overlap
 *   - Preview remains readable
 *   - Desktop layout still works (≥1024px is desktop)
 */

test.describe('Tablet portrait (iPad gen 7, ~834×1194 / split-view)', () => {
  test.beforeEach(async ({ page }) => {
    // Use the device's default viewport (Playwright iPad gen 7 = 834×1194 in CSS px)
    // which falls in the 600-1023px range → split-view on tablet
    await gotoApp(page);
  });

  test('C1: editor sidebar and preview are both visible (split-view)', async ({ page }) => {
    // P0-SYNC-V2: wait for sidebar to be open (class removed) AND for the
    // margin-left transition to complete (margin-left: 0px). The sidebar
    // has transition: margin-left 300ms — querying boundingBox during
    // transition shows intermediate position causing false overlap.
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    // Wait for transition to complete: margin-left must be 0px
    await expect.poll(async () => {
      const ml = await page.evaluate(() => {
        return getComputedStyle(document.getElementById('editorSidebar')!).marginLeft;
      });
      return ml;
    }, { timeout: 5000, intervals: [100] }).toBe('0px');
    // Now both should be in final position
    await expect(page.locator('#editorSidebar')).toBeVisible();
    await expect(page.locator('#previewWorkspace')).toBeVisible();
    const sidebarBox = await page.locator('#editorSidebar').boundingBox();
    const previewBox = await page.locator('#previewWorkspace').boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(previewBox!.x + 5);
  });

  test('C2: editor can be collapsed and expanded', async ({ page }) => {
    // P-MOBILE: on tablet sidebar starts OPEN. Close it, then open again.
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);

    // Close (collapse)
    await page.locator('#toggleSidebarBtn').click();
    await expect(page.locator('#editorSidebar')).toHaveClass(/\bcollapsed\b/);

    // Open again
    await page.locator('#toggleSidebarBtn').click();
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
  });

  test('C3: no backdrop dimming in tablet split-view', async ({ page }) => {
    await page.locator('#toggleSidebarBtn').click();
    // Backdrop should be display:none on tablet (CSS @media 600-1023px)
    const backdropVisible = await page.locator('#sidebarBackdrop').isVisible();
    expect(backdropVisible).toBe(false);
  });

  test('C4: no horizontal overflow on tablet', async ({ page }) => {
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('C5: mobile mode switcher is hidden on tablet (split-view, no tabs needed)', async ({ page }) => {
    // The switcher is only visible on phone (<600px), hidden on tablet
    await expect(page.locator('#mobileModeSwitcher')).not.toBeVisible();
  });

  test('C6: input font-size >= 16px on tablet (max-width:1023px range)', async ({ page }) => {
    await page.locator('#toggleSidebarBtn').click();
    const fontSize = await page.evaluate(() => {
      const input = document.querySelector(
        '#editorCardsList .card-editor-block:nth-child(1) [data-field="title"]',
      ) as HTMLElement | null;
      if (!input) throw new Error('Input not found');
      return parseFloat(getComputedStyle(input).fontSize);
    });
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('C7: destructive action separated from download on tablet', async ({ page }) => {
    await page.locator('#toggleSidebarBtn').click();
    await expect(page.locator('.sidebar-primary-actions')).toBeVisible();
    await expect(page.locator('.sidebar-destructive-actions')).toBeVisible();

    // Verify the two are in different containers
    const downloadInDelete = await page.locator('.sidebar-destructive-actions #saveAll').count();
    expect(downloadInDelete).toBe(0);
    const deleteInDownload = await page.locator('.sidebar-primary-actions #deleteAllBtn').count();
    expect(deleteInDownload).toBe(0);
  });
});

test.describe('Tablet landscape (1024×768 — desktop layout)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoApp(page);
  });

  test('D1: layout doesn\'t jump — sidebar + preview both visible', async ({ page }) => {
    // P-MOBILE: at 1024px (desktop layout), sidebar is open by default
    // (CardCraftApp.ts threshold is 600px). Verify both are visible without
    // needing to click toggle.
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);

    // Both visible
    await expect(page.locator('#editorSidebar')).toBeVisible();
    await expect(page.locator('#previewWorkspace')).toBeVisible();

    // No overlap
    const sidebarBox = await page.locator('#editorSidebar').boundingBox();
    const previewBox = await page.locator('#previewWorkspace').boundingBox();
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(previewBox!.x + 5);
  });

  test('D2: no horizontal overflow at 1024px', async ({ page }) => {
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('D3: preview remains readable at 1024px (card width reasonable)', async ({ page }) => {
    await page.locator('#toggleSidebarBtn').click();
    const cardBox = await page.locator('#cardsArea .card').first().boundingBox();
    expect(cardBox).not.toBeNull();
    // Card should fit within preview workspace
    expect(cardBox!.width).toBeLessThanOrEqual(1024);
    expect(cardBox!.width).toBeGreaterThan(200); // readable, not collapsed to nothing
  });

  test('D4: desktop layout still works — mobile switcher hidden', async ({ page }) => {
    // At 1024px (desktop), mobile switcher is hidden
    await expect(page.locator('#mobileModeSwitcher')).not.toBeVisible();
  });
});

/* ═══ P4-V3-REGRESSION: design subsections (tablet, non-exclusive) ═══ */
/* P9-FIX: moved here from mobile-v3.spec.ts so it runs in the tablet-chrome
 * project (real iPad UA + touch) instead of mobile-chrome (iPhone UA).
 * On tablet (≥600px) the Дизайн subsections are NON-exclusive — multiple
 * can be open at once. */

async function getExpandedDesignSubsectionsTablet(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const designAccordion = document.querySelector('.sidebar-fixed-header > .sidebar-accordion');
    if (!designAccordion) return -1;
    const body = designAccordion.querySelector('.sidebar-accordion-body');
    if (!body) return -1;
    return Array.from(body.querySelectorAll(':scope > .sidebar-accordion'))
      .filter((el) => el.classList.contains('expanded')).length;
  });
}

test.describe('Tablet design subsections (non-exclusive, 768×1024)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoApp(page);
  });

  test('T1: multiple design subsections can be open simultaneously', async ({ page }) => {
    // Open Дизайн
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    // Open two subsections
    await subsections.nth(0).locator('.sidebar-accordion-header').click();
    await subsections.nth(1).locator('.sidebar-accordion-header').click();
    // Both should remain open (non-exclusive on tablet)
    await expect.poll(() => getExpandedDesignSubsectionsTablet(page)).toBe(2);
  });

  test('T2: aria-expanded reflects non-exclusive open state', async ({ page }) => {
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    const fmtToggle = subsections.nth(0).locator('.sidebar-accordion-header');
    const themeToggle = subsections.nth(1).locator('.sidebar-accordion-header');
    await fmtToggle.click();
    await themeToggle.click();
    // Both should have aria-expanded=true (non-exclusive)
    await expect(fmtToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(themeToggle).toHaveAttribute('aria-expanded', 'true');
  });
});
