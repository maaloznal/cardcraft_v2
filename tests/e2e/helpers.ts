import { expect, type Page } from '@playwright/test';

/**
 * Helper: navigate to the app with cleared storage.
 * Uses addInitScript to clear localStorage BEFORE the page loads on every
 * navigation. This guarantees a clean default state (1 empty card) for each
 * test. Tests that need to verify persistence (test 16) must NOT use reload —
 * they should check localStorage directly instead.
 *
 * P22 fix: also sets the onboarding-seen flag so the onboarding overlay
 * doesn't show and block clicks during tests.
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    // P22: dismiss onboarding overlay so it doesn't intercept clicks in tests
    localStorage.setItem('flashcard-onboarding-seen', '1');
  });
  await page.goto('/');
  // Wait for init — at least 1 card in editor + preview
  await expect
    .poll(() => page.locator('#cardsArea .card-wrapper, #editorCardsList .card-editor-block').count())
    .toBeGreaterThanOrEqual(1);
}

/** Helper: count cards in preview */
export async function getPreviewCardCount(page: Page): Promise<number> {
  return page.locator('#cardsArea .card-wrapper').count();
}

/** Helper: count cards in editor */
export async function getEditorCardCount(page: Page): Promise<number> {
  return page.locator('#editorCardsList .card-editor-block').count();
}

/** Helper: get the Nth card's title text in preview */
export async function getPreviewCardTitle(page: Page, index: number): Promise<string> {
  const titles = page.locator('#cardsArea .card-title');
  return (await titles.nth(index).textContent()) ?? '';
}

/** Helper: type into a field of the Nth editor card */
export async function typeInEditor(
  page: Page,
  cardIndex: number,
  field: string,
  text: string,
): Promise<void> {
  // P-MOBILE: explicitly match input/textarea only — the new clear-field
  // button (.btn-clear-field) uses data-clear-for (not data-field) so it
  // doesn't conflict. But to be safe we scope to input/textarea elements.
  const input = page.locator(
    `#editorCardsList .card-editor-block:nth-child(${cardIndex + 1}) input[data-field="${field}"], ` +
      `#editorCardsList .card-editor-block:nth-child(${cardIndex + 1}) textarea[data-field="${field}"]`,
  );
  await input.fill(text);
}

/**
 * Helper: change a hidden <select> value + dispatch change event.
 * Playwright's selectOption doesn't reliably fire change on hidden selects,
 * so we use evaluate to set value + dispatch the event manually.
 */
export async function changeHiddenSelect(page: Page, selectId: string, value: string): Promise<void> {
  await page.evaluate(
    ({ id, val }) => {
      const sel = document.getElementById(id) as HTMLSelectElement | null;
      if (!sel) throw new Error(`Select #${id} not found`);
      sel.value = val;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { id: selectId, val: value },
  );
}

/** Helper: get all option values from a <select> */
export async function getSelectOptions(page: Page, selectId: string): Promise<string[]> {
  return page.locator(`#${selectId} option`).evaluateAll((opts) =>
    opts.map((o) => (o as HTMLOptionElement).value),
  );
}

/* =====================================================================
 * P-MOBILE: viewport + mobile-mode helpers
 * ===================================================================== */

/** Standard mobile viewports used by tests. */
export const MOBILE_VIEWPORTS = {
  iphone14: { width: 390, height: 844 }, // iPhone 12/13/14
  iphoneSE: { width: 375, height: 667 }, // iPhone SE 2nd gen
  narrow: { width: 320, height: 568 }, // iPhone SE 1st gen / very narrow
  tabletPortrait: { width: 768, height: 1024 }, // iPad portrait
  tabletLandscape: { width: 1024, height: 768 }, // iPad landscape
} as const;

/** Apply a mobile viewport (390×844) to the page. */
export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORTS.iphone14);
}

/** Apply a narrow viewport (320×568) to the page. */
export async function setNarrowViewport(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORTS.narrow);
}

/** Apply a tablet portrait viewport (768×1024) to the page. */
export async function setTabletViewport(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORTS.tabletPortrait);
}

/** Apply a tablet landscape viewport (1024×768) to the page. */
export async function setTabletLandscapeViewport(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORTS.tabletLandscape);
}

/**
 * Open the mobile sidebar by tapping the sidebar toggle button.
 * On compact screens (<768px) this opens the focused editor view.
 * Equivalent to clicking the "burger" icon in the top bar.
 */
export async function openMobileSidebar(page: Page): Promise<void> {
  await page.locator('#toggleSidebarBtn').click();
  // Wait for sidebar to be visible (no longer .collapsed)
  await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
}

/**
 * Close the mobile sidebar via the explicit close button (×).
 * The close button is only visible in compact mode (<768px), but the click is
 * a no-op on desktop/tablet where the button is hidden.
 */
export async function closeMobileSidebar(page: Page): Promise<void> {
  await page.locator('#closeSidebarBtn').click();
  await expect(page.locator('#editorSidebar')).toHaveClass(/\bcollapsed\b/);
}

/**
 * Switch mobile mode to "editor" by tapping the Редактор tab.
 * This opens the sidebar and sets data-mobile-mode="editor" on .cc-root.
 */
export async function switchToEditorMode(page: Page): Promise<void> {
  await page.locator('#modeEditorTab').click();
  await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'editor');
}

/**
 * Switch mobile mode to "preview" by tapping the Просмотр tab.
 * This closes the sidebar and sets data-mobile-mode="preview" on .cc-root.
 */
export async function switchToPreviewMode(page: Page): Promise<void> {
  await page.locator('#modePreviewTab').click();
  await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'preview');
}

/**
 * Check if the page has horizontal overflow (content wider than viewport).
 * Returns the number of pixels of overflow (0 = no overflow).
 */
export async function getHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
  });
}

/**
 * Check if the page has vertical overflow beyond viewport (excluding
 * intentional scroll areas). Returns the difference in pixels.
 */
export async function getVerticalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  });
}

/**
 * Get the effective touch target size of an element, accounting for ::before
 * pseudo-element extension. Returns the bounding box of the clickable area.
 *
 * Note: ::before with negative inset doesn't change the element's own
 * bounding box — it only extends the hit area visually. So we check both
 * the element's own size and verify the min-width/min-height CSS props.
 */
export async function getTouchTargetSize(
  page: Page,
  selector: string,
): Promise<{ width: number; height: number; minWidth: number; minHeight: number }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) throw new Error(`Element ${sel} not found`);
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      width: rect.width,
      height: rect.height,
      minWidth: parseFloat(style.minWidth) || 0,
      minHeight: parseFloat(style.minHeight) || 0,
    };
  }, selector);
}

/**
 * Get the font-size (in px) of an element. Used to verify inputs have
 * >=16px on mobile (prevents iOS Safari auto-zoom).
 */
export async function getFontSize(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) throw new Error(`Element ${sel} not found`);
    return parseFloat(getComputedStyle(el).fontSize);
  }, selector);
}

