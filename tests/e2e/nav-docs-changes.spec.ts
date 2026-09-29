import { expect, test } from '@playwright/test';

/**
 * E2E tests for the last navigation/docs changes:
 *   1. Sticky transparent landing nav (no background, accent-colored text)
 *   2. Docs nav button spacing (О проекте / Открыть редактор no longer stuck)
 *   3. Docs scrollspy TOC (active section tracked on scroll)
 *
 * Note: these tests use page.goto('/') directly (not gotoApp) because the
 * landing page has no #cardsArea — it's the welcome page, not the editor.
 */

/** Navigate to the landing page and wait for the nav to render. */
async function gotoLanding(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('flashcard-onboarding-seen', '1');
  });
  await page.goto('/');
  await expect(page.locator('.welcome-nav')).toBeVisible();
}

test.describe('Navigation + Docs scrollspy (last changes)', () => {

  test('landing nav: Apple.com frosted glass, dark text, blue CTA', async ({ page }) => {
    await gotoLanding(page);
    const nav = page.locator('.welcome-nav');

    // Sticky
    const position = await nav.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');

    // Opaque white background (not translucent)
    const bg = await nav.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');

    // Hairline bottom border
    const border = await nav.evaluate((el) => getComputedStyle(el).borderBottomWidth);
    expect(parseFloat(border)).toBeGreaterThan(0);

    // Apple near-black text (#1d1d1f)
    const brandColor = await page.locator('.welcome-brand').evaluate((el) => getComputedStyle(el).color);
    expect(brandColor).toBe('rgb(29, 29, 31)');

    const linkColor = await page.locator('.welcome-nav-link').first().evaluate((el) => getComputedStyle(el).color);
    expect(linkColor).toBe('rgb(29, 29, 31)');

    // CTA: Apple-blue pill with white text
    const ctaBg = await page.locator('.welcome-nav-cta').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(ctaBg).toBe('rgb(0, 113, 227)');
    const ctaColor = await page.locator('.welcome-nav-cta').first().evaluate((el) => getComputedStyle(el).color);
    expect(ctaColor).toBe('rgb(255, 255, 255)');
  });

  test('landing nav: stays sticky when scrolling to dark section', async ({ page }) => {
    await gotoLanding(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Scroll to the first dark section
    await page.evaluate(() => {
      document.querySelectorAll('.welcome-section-dark')[0]?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(600);

    // Nav should be stuck at top (top <= 0)
    const navTop = await page.locator('.welcome-nav').evaluate((el) => el.getBoundingClientRect().top);
    expect(navTop).toBeLessThanOrEqual(0);
  });

  test('docs nav: buttons are not stuck together (gap exists)', async ({ page }) => {
    await page.goto('/docs/');
    await expect(page.locator('.welcome-nav')).toBeVisible();

    // The container uses .welcome-nav-links with a flex gap
    const gap = await page.locator('.welcome-nav-links').evaluate((el) => getComputedStyle(el).gap);
    expect(gap).not.toBe('normal');
    expect(parseFloat(gap)).toBeGreaterThan(0);

    // "О проекте" link and CTA should have horizontal space between them
    const aboutLink = page.locator('.welcome-nav-link', { hasText: 'О проекте' });
    const cta = page.locator('.welcome-nav-cta', { hasText: 'Открыть редактор' });
    await expect(aboutLink).toBeVisible();
    await expect(cta).toBeVisible();

    const aboutRight = await aboutLink.evaluate((el) => el.getBoundingClientRect().right);
    const ctaLeft = await cta.evaluate((el) => el.getBoundingClientRect().left);
    expect(ctaLeft - aboutRight).toBeGreaterThan(8); // at least 8px gap
  });

  test('docs scrollspy: active section updates on scroll', async ({ page }) => {
    await page.goto('/docs/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.docs-toc')).toBeVisible();

    // Initially "Быстрый старт" (first section) should be active
    const initialActive = await page.locator('.docs-toc-link-active').textContent();
    expect(initialActive?.trim()).toBe('Быстрый старт');

    // Scroll to "design" section
    await page.evaluate(() => {
      document.getElementById('design')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(800);

    // Active TOC link should now be "Дизайн и форматы"
    const activeAfter = await page.locator('.docs-toc-link-active').textContent();
    expect(activeAfter?.trim()).toBe('Дизайн и форматы');

    // aria-current="location" on the active link
    const ariaCurrent = await page.locator('.docs-toc-link-active').getAttribute('aria-current');
    expect(ariaCurrent).toBe('location');
  });

  test('docs scrollspy: TOC stays sticky while scrolling content', async ({ page }) => {
    await page.goto('/docs/');
    await page.setViewportSize({ width: 1280, height: 800 });
    // Scroll down past the header
    await page.evaluate(() => {
      document.getElementById('editor')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(600);

    // TOC should be sticky (its top should be near the viewport top, not scrolled away)
    const tocTop = await page.locator('.docs-toc').evaluate((el) => el.getBoundingClientRect().top);
    expect(tocTop).toBeLessThan(120); // within sticky range
    expect(tocTop).toBeGreaterThan(-10); // not scrolled off-screen
  });

  test('docs TOC: clicking a link scrolls to the section', async ({ page }) => {
    await page.goto('/docs/');
    await page.setViewportSize({ width: 1280, height: 800 });
    // Click the "Скачивание" TOC link
    await page.locator('.docs-toc-link', { hasText: 'Скачивание' }).click();
    await page.waitForTimeout(800);

    // The #export section heading should be near the top of the viewport
    const headingTop = await page.locator('#export').evaluate((el) => el.getBoundingClientRect().top);
    expect(headingTop).toBeLessThan(120); // accounting for sticky nav offset
    expect(headingTop).toBeGreaterThan(-10);
  });

  test('mobile: burger visible (no CTA in navbar), drawer opens with CTA', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoLanding(page);

    // Burger exists and is 44px
    const burger = page.locator('.welcome-nav-burger');
    await expect(burger).toBeVisible();
    const burgerBox = await burger.boundingBox();
    expect(burgerBox?.width).toBeGreaterThanOrEqual(44);
    expect(burgerBox?.height).toBeGreaterThanOrEqual(44);

    // CTA should NOT be visible in the navbar on mobile (it's in the drawer)
    const navbarCta = page.locator('.welcome-nav-mobile .welcome-nav-cta');
    await expect(navbarCta).toHaveCount(0);

    // aria-expanded false initially
    await expect(burger).toHaveAttribute('aria-expanded', 'false');

    // Open drawer
    await burger.click();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    const drawer = page.locator('.welcome-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('role', 'dialog');
    await expect(drawer).toHaveAttribute('aria-modal', 'true');

    // Drawer contains the canonical routes
    await expect(page.locator('.welcome-drawer-link', { hasText: 'Документация' })).toHaveAttribute('href', /\/docs\/?/);
    await expect(page.locator('.welcome-drawer-link', { hasText: 'Войти' })).toHaveAttribute('href', /\/login\/?/);
    await expect(page.locator('.welcome-drawer-cta', { hasText: 'Открыть редактор' })).toHaveAttribute('href', /\/editor\/?/);
  });
});
