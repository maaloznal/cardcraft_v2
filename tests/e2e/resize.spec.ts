import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * P1-RESIZE-V2: desktop resize tests — run in chromium project (1280×720).
 * These tests use real Playwright mouse API (page.mouse) for drag.
 * Separated from mobile-v2.spec.ts because resize needs desktop viewport,
 * not mobile device emulation (iPhone has isMobile:true which affects
 * mouse event generation in headless Chromium).
 */

/** Update aria-valuenow on the divider to reflect current sidebar width. */
async function getSidebarWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.getElementById('editorSidebar')!.getBoundingClientRect().width);
}

test.describe('P1-resize: desktop sidebar resize', () => {
  test('resize-1: real mouse drag changes computed sidebar width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    const initialWidth = await getSidebarWidth(page);
    // Real Playwright mouse API — hover divider first to ensure mouse is on it
    const divider = page.locator('#resizeDividerV');
    await divider.hover();
    const dividerBox = await divider.boundingBox();
    const startX = dividerBox!.x + dividerBox!.width / 2;
    const startY = dividerBox!.y + dividerBox!.height / 2;
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const newWidth = await getSidebarWidth(page);
    expect(newWidth, `width: ${initialWidth} → ${newWidth}`).toBeGreaterThan(initialWidth + 40);
  });

  test('resize-2: real reload persists sidebar width', async ({ browser }) => {
    // Use separate context WITHOUT addInitScript clearing localStorage
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('flashcard-onboarding-seen', '1');
    });
    await page.goto('/');
    await expect.poll(() => page.locator('#editorCardsList .card-editor-block').count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);

    // Real mouse drag — hover divider first
    const divider = page.locator('#resizeDividerV');
    await divider.hover();
    const dividerBox = await divider.boundingBox();
    const startX = dividerBox!.x + dividerBox!.width / 2;
    const startY = dividerBox!.y + dividerBox!.height / 2;
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const savedWidth = await page.evaluate(() => localStorage.getItem('flashcard-sidebar-width'));
    expect(savedWidth, 'localStorage must have saved width').not.toBeNull();
    const widthBefore = Math.round(await getSidebarWidth(page));

    // Reload — localStorage preserved (no clear)
    await page.reload();
    await expect.poll(() => page.locator('#editorCardsList .card-editor-block').count()).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(500);
    const widthAfter = Math.round(await getSidebarWidth(page));
    expect(Math.abs(widthAfter - widthBefore), `before: ${widthBefore}, after: ${widthAfter}`).toBeLessThanOrEqual(5);
    await context.close();
  });

  test('resize-3: divider has keyboard accessibility', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    const divider = page.locator('#resizeDividerV');
    await expect(divider).toHaveAttribute('role', 'separator');
    await expect(divider).toHaveAttribute('tabindex', '0');
    await expect(divider).toHaveAttribute('aria-valuemin');
    await expect(divider).toHaveAttribute('aria-valuemax');
    await expect(divider).toHaveAttribute('aria-valuenow');
  });

  test('resize-4: keyboard ArrowRight increases width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    const widthBefore = await getSidebarWidth(page);
    // Focus divider and press ArrowRight
    await page.locator('#resizeDividerV').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const widthAfter = await getSidebarWidth(page);
    expect(widthAfter, `keyboard ArrowRight: ${widthBefore} → ${widthAfter}`).toBeGreaterThan(widthBefore + 5);
  });

  test('resize-5: keyboard Home sets min width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    await page.locator('#resizeDividerV').focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(200);
    const width = await getSidebarWidth(page);
    expect(width).toBeLessThanOrEqual(265); // 260 + 5px tolerance
  });

  test('resize-6: keyboard End sets max width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    await page.locator('#resizeDividerV').focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(200);
    const width = await getSidebarWidth(page);
    expect(width).toBeGreaterThanOrEqual(395); // 400 - 5px tolerance
  });
});
