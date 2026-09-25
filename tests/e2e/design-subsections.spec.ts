import { test, expect, type Page } from '@playwright/test';
import { gotoApp, getHorizontalOverflow } from './helpers';

/**
 * P4-V3-REGRESSION: desktop design-subsection + breakpoint-transition tests.
 *
 * P9-FIX: these tests were previously inside mobile-v3.spec.ts, which only
 * matches the `mobile-chrome` Playwright project (iPhone 14 device emulation).
 * Running desktop/tablet regression checks under an iPhone user-agent is a
 * false-positive risk: the UA, touch flag, and device-pixel-ratio are all
 * mobile even though setViewportSize() widens the layout.
 *
 * This file's name does NOT match any project's testMatch for mobile/tablet
 * (mobile-chrome: mobile|narrow|mobile-v2|mobile-v3; tablet-chrome: tablet;
 * a11y-mobile: mobile-accessibility) and is NOT in the chromium project's
 * testIgnore list — so it runs ONLY in the `chromium` project (Desktop Chrome,
 * desktop UA, no touch). That is the correct environment for these checks.
 */

/* ─── Helper: count expanded subsections inside Дизайн body ─── */
async function getExpandedDesignSubsections(page: Page): Promise<number> {
  return page.evaluate(() => {
    const designAccordion = document.querySelector('.sidebar-fixed-header > .sidebar-accordion');
    if (!designAccordion) return -1;
    const body = designAccordion.querySelector('.sidebar-accordion-body');
    if (!body) return -1;
    return Array.from(body.querySelectorAll(':scope > .sidebar-accordion'))
      .filter((el) => el.classList.contains('expanded')).length;
  });
}

/* ═══ Desktop regression (1280×800, chromium) ═══ */

test.describe('Desktop design subsections (non-exclusive, 1280×800)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
  });

  test('D1: no horizontal overflow at 1280px', async ({ page }) => {
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('D2: multiple subsections can be open simultaneously (non-exclusive)', async ({ page }) => {
    // Open Дизайн
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    // Open two subsections
    await subsections.nth(0).locator('.sidebar-accordion-header').click();
    await subsections.nth(1).locator('.sidebar-accordion-header').click();
    // Both should remain open (non-exclusive on desktop)
    await expect.poll(() => getExpandedDesignSubsections(page)).toBe(2);
  });

  test('D3: aria-expanded reflects non-exclusive open state', async ({ page }) => {
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    const fmtToggle = subsections.nth(0).locator('.sidebar-accordion-header');
    const themeToggle = subsections.nth(1).locator('.sidebar-accordion-header');
    await fmtToggle.click();
    await themeToggle.click();
    // Both should have aria-expanded=true (non-exclusive on desktop)
    await expect(fmtToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(themeToggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('D4: closes on Escape and returns focus to the top-bar trigger', async ({ page }) => {
    const design = page.locator('[data-design-accordion]');
    const trigger = design.locator(':scope > .sidebar-accordion-header');
    await trigger.click();
    await expect(design).toHaveClass(/\bexpanded\b/);
    await page.keyboard.press('Escape');
    await expect(design).not.toHaveClass(/\bexpanded\b/);
    await expect(trigger).toBeFocused();
  });
});

/* ═══ Breakpoint transition (chromium, resize) ═══ */
/* TABLET-UX: verifies that entering a touch-sized layout collapses extra-open
 * subsections (exclusive-mode enforcement on breakpoint
 * change in CardCraftApp.ts). Runs in chromium so the resize is clean
 * (desktop UA, no touch). */

test.describe('Breakpoint transition: desktop → tablet', () => {
  test('B1: desktop→tablet collapses extra open subsections', async ({ page }) => {
    // Start on desktop (non-exclusive)
    await page.setViewportSize({ width: 1024, height: 800 });
    await gotoApp(page);
    // Open Дизайн + two subsections
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    await subsections.nth(0).locator('.sidebar-accordion-header').click();
    await subsections.nth(1).locator('.sidebar-accordion-header').click();
    // Confirm both open on desktop (non-exclusive)
    await expect.poll(() => getExpandedDesignSubsections(page)).toBe(2);
    // Resize to tablet — triggers matchMedia change event
    await page.setViewportSize({ width: 834, height: 1112 });
    // Wait for the matchMedia change handler to run + DOM update
    await expect.poll(
      () => getExpandedDesignSubsections(page),
      { message: 'tablet should have at most 1 open subsection after resize', timeout: 5000, intervals: [100] },
    ).toBeLessThanOrEqual(1);
  });

  test('B2: tablet→desktop keeps the current subsection open', async ({ page }) => {
    // Start on tablet (exclusive)
    await page.setViewportSize({ width: 834, height: 1112 });
    await gotoApp(page);
    await page.locator('.sidebar-fixed-header > .sidebar-accordion > .sidebar-accordion-header').click();
    const subsections = page.locator('.sidebar-accordion-body > .sidebar-accordion');
    // Open one subsection on tablet
    await subsections.nth(0).locator('.sidebar-accordion-header').click();
    await expect.poll(() => getExpandedDesignSubsections(page)).toBe(1);
    // Resize to desktop — exclusive turns off, the one open stays open
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect.poll(
      () => getExpandedDesignSubsections(page),
      { message: 'the open subsection should remain open after desktop resize', timeout: 5000, intervals: [100] },
    ).toBeGreaterThanOrEqual(1);
  });
});
