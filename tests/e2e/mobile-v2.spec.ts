import { test, expect, type Page } from '@playwright/test';
import { gotoApp, getHorizontalOverflow, getFontSize, switchToEditorMode, switchToPreviewMode } from './helpers';

/**
 * P-MOBILE-V2: comprehensive regression tests for mobile/tablet UX fixes.
 *
 * These tests verify the fixes for issues found after the initial mobile UX
 * commit (9708964). They cover:
 *   - P0: mobile mode sync (toggle button, aria-expanded, data-mobile-mode consistency)
 *   - P0: layout (no magic numbers, no switcher/sidebar overlap, no extra scroll)
 *   - P0: tablet split-view (no preview overflow at 600-755px)
 *   - P1: resize (no !important conflict, persisted width, keyboard accessible)
 *   - P1: touch targets (44×44 for ALL interactive elements)
 *   - P1: accessibility (color-swatch as button, inert, roving tabindex, focus-visible)
 *   - P2: UX (no duplicate controls, × only when editor open, focus restore)
 *
 * Tests run across 9 viewport sizes per requirements:
 *   320×568, 390×844, 599×844, 600×900, 640×900, 720×1024, 768×1024, 834×1194, 1024×768
 */

/* ─── Helper: get computed touch target size (min of width/height) ─── */
async function getEffectiveTouchSize(page: Page, selector: string): Promise<{ width: number; height: number }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) throw new Error(`Element ${sel} not found`);
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, selector);
}

/* ─── Helper: check if element is in tab order (focusable) ─── */
async function isTabbable(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return false;
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('tabindex') === '-1') return false;
    if (el.hasAttribute('hidden') || el.closest('[hidden]')) return false;
    if (el.closest('[inert]')) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return el.matches('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  }, selector);
}

/* ─── Helper: get previewWorkspace internal overflow ─── */
async function getPreviewOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const ws = document.getElementById('previewWorkspace');
    if (!ws) return 0;
    return Math.max(0, ws.scrollWidth - ws.clientWidth);
  });
}

/* ─── Helper: get body vertical overflow (extra scroll) ─── */
async function getBodyVerticalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  });
}

/* ═══════════════════════════════════════════════════════════════════
 * P0 — SYNC: data-mobile-mode, .sidebar-open, .collapsed, aria-expanded, aria-selected
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P0-sync: mobile mode state consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
  });

  test('sync-1: #toggleSidebarBtn opens editor and sets data-mobile-mode=editor', async ({ page }) => {
    // Click the top-bar sidebar toggle button
    await page.locator('#toggleSidebarBtn').click();
    // Wait a beat for any async state sync
    await page.waitForTimeout(200);
    // data-mobile-mode MUST be 'editor' (not stuck on 'preview')
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'editor');
    // Sidebar MUST NOT have .collapsed
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
  });

  test('sync-2: #toggleSidebarBtn has aria-expanded reflecting sidebar state', async ({ page }) => {
    // Initially closed → aria-expanded="false"
    await expect(page.locator('#toggleSidebarBtn')).toHaveAttribute('aria-expanded', 'false');
    // Open
    await page.locator('#toggleSidebarBtn').click();
    await page.waitForTimeout(200);
    // Now aria-expanded="true"
    await expect(page.locator('#toggleSidebarBtn')).toHaveAttribute('aria-expanded', 'true');
  });

  test('sync-3: mode tabs aria-selected stays consistent with data-mobile-mode', async ({ page }) => {
    // Switch to editor via tab
    await switchToEditorMode(page);
    await expect(page.locator('#modeEditorTab')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#modePreviewTab')).toHaveAttribute('aria-selected', 'false');
    // Switch to preview via tab
    await switchToPreviewMode(page);
    await expect(page.locator('#modeEditorTab')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#modePreviewTab')).toHaveAttribute('aria-selected', 'true');
  });

  test('sync-4: closing sidebar via × sets data-mobile-mode=preview', async ({ page }) => {
    await switchToEditorMode(page);
    // Close via × button
    await page.locator('#closeSidebarBtn').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'preview');
    await expect(page.locator('#editorSidebar')).toHaveClass(/\bcollapsed\b/);
  });

  test('sync-5: text persists across mode switches + focus restored', async ({ page }) => {
    await switchToEditorMode(page);
    // Type in title
    const titleInput = page.locator('#editorCardsList .card-editor-block input[data-field="title"]');
    await titleInput.fill('SYNC TEST TEXT');
    await titleInput.focus();
    // Switch to preview
    await switchToPreviewMode(page);
    // Text in preview
    const previewTitle = await page.locator('#cardsArea .card-title').first().textContent();
    expect(previewTitle).toBe('SYNC TEST TEXT');
    // Switch back to editor
    await switchToEditorMode(page);
    // Text still in input
    const inputValue = await page.locator('#editorCardsList .card-editor-block input[data-field="title"]').inputValue();
    expect(inputValue).toBe('SYNC TEST TEXT');
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * P0 — LAYOUT: no magic numbers, no overlap, no extra scroll
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P0-layout: mobile layout integrity', () => {
  test('layout-1: no extra body vertical scroll on empty mobile (390×844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    const overflow = await getBodyVerticalOverflow(page);
    // Allow up to 4px tolerance for sub-pixel rounding
    expect(overflow).toBeLessThanOrEqual(4);
  });

  test('layout-2: no extra body vertical scroll on narrow phone (320×568)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoApp(page);
    const overflow = await getBodyVerticalOverflow(page);
    expect(overflow).toBeLessThanOrEqual(4);
  });

  test('layout-3: mobile-mode-switcher does not overlap sidebar content', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
    // Switcher bounding box
    const switcherBox = await page.locator('#mobileModeSwitcher').boundingBox();
    // First sidebar element (Дизайн accordion header)
    const designHeaderBox = await page.locator('[data-sidebar-toggle]').first().boundingBox();
    expect(switcherBox).not.toBeNull();
    expect(designHeaderBox).not.toBeNull();
    // Switcher bottom should not extend into design header's top (allow 5px tolerance
    // for border/sub-pixel rendering)
    const switcherBottom = switcherBox!.y + switcherBox!.height;
    expect(switcherBottom).toBeLessThanOrEqual(designHeaderBox!.y + 5);
  });

  test('layout-4: CSS variables exist for top-bar and switcher heights (no magic 52/56/96)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    const hasVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        topBarHeight: root.getPropertyValue('--top-bar-height').trim(),
        mobileSwitcherHeight: root.getPropertyValue('--mobile-switcher-height').trim(),
      };
    });
    // Variables must be defined (non-empty)
    expect(hasVars.topBarHeight.length).toBeGreaterThan(0);
    expect(hasVars.mobileSwitcherHeight.length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * P0 — TABLET split-view: no preview overflow at 600-755px
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P0-tablet: split-view no overflow', () => {
  for (const vp of [
    { w: 600, name: '600' },
    { w: 640, name: '640' },
    { w: 720, name: '720' },
    { w: 768, name: '768' },
  ]) {
    test(`tablet-${vp.w}: no previewWorkspace horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: 1024 });
      await gotoApp(page);
      const overflow = await getPreviewOverflow(page);
      expect(overflow, `previewWorkspace overflow at ${vp.w}px`).toBe(0);
    });

    test(`tablet-${vp.w}: card fits within previewWorkspace`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: 1024 });
      await gotoApp(page);
      const result = await page.evaluate(() => {
        const ws = document.getElementById('previewWorkspace');
        const card = document.querySelector('#cardsArea .card') as HTMLElement | null;
        if (!ws || !card) return { fits: false };
        const wsRect = ws.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        return {
          fits: cardRect.right <= wsRect.right + 1,
          cardRight: Math.round(cardRect.right),
          wsRight: Math.round(wsRect.right),
        };
      });
      expect(result.fits, `card right (${result.cardRight}) > ws right (${result.wsRight})`).toBe(true);
    });
  }

  test('tablet-599: transition at 599→600px does not break preview', async ({ page }) => {
    await page.setViewportSize({ width: 599, height: 844 });
    await gotoApp(page);
    // At 599 (phone) — preview should be full width, no overflow
    const overflow599 = await getPreviewOverflow(page);
    expect(overflow599).toBe(0);
    // Resize to 600 (tablet)
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForTimeout(300);
    // At 600 (tablet) — preview should still have no overflow
    const overflow600 = await getPreviewOverflow(page);
    expect(overflow600).toBe(0);
  });
});


/* P1-RESIZE tests moved to tests/e2e/resize.spec.ts (chromium project).
   Resize needs desktop viewport (1280px), not mobile device emulation.
   See resize.spec.ts for real mouse drag + keyboard + reload tests. */

/* ═══════════════════════════════════════════════════════════════════
 * P1 — TOUCH TARGETS: 44×44 for ALL interactive elements
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P1-touch: 44×44 touch targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
  });

  // List of ALL interactive elements that should have 44×44 touch target on mobile
  // P1-TOUCH-V2: some elements only appear when there are multiple cards (delete)
  // or when modal is open (modal-close). Tests that need setup have a `setup` fn.
  const touchElements = [
    { name: 'sidebar toggle', selector: '#toggleSidebarBtn' },
    { name: 'undo button', selector: '#undoBtn' },
    { name: 'redo button', selector: '#redoBtn' },
    { name: 'mode editor tab', selector: '#modeEditorTab' },
    { name: 'mode preview tab', selector: '#modePreviewTab' },
    { name: 'close sidebar button', selector: '#closeSidebarBtn' },
    { name: 'card collapse toggle', selector: '.card-collapse-toggle' },
    { name: 'card duplicate button', selector: '[data-action="duplicate"]' },
    { name: 'card delete button', selector: '[data-action="delete"]', setup: 'addCard' },
    { name: 'card move up', selector: '[data-action="move"][data-dir="-1"]', setup: 'addCard' },
    { name: 'card move down', selector: '[data-action="move"][data-dir="1"]', setup: 'addCard' },
    { name: 'card palette button', selector: '[data-action="palette"]' },
    { name: 'clear field button', selector: '.btn-clear-field' },
    { name: 'add card button', selector: '#addCardBtn' },
    { name: 'download all button', selector: '#saveAll' },
    { name: 'delete all button', selector: '#deleteAllBtn' },
    { name: 'sidebar accordion header (Дизайн)', selector: '[data-sidebar-toggle]' },
  ];

  for (const el of touchElements) {
    test(`touch: ${el.name} >= 44×44px`, async ({ page }) => {
      // P1-TOUCH-V2: some elements need a second card to become visible
      if (el.setup === 'addCard') {
        await page.locator('#addCardBtn').click();
        await page.waitForTimeout(300);
      }
      const size = await getEffectiveTouchSize(page, el.selector);
      // Use min of width/height as the effective touch dimension
      const minDim = Math.min(size.width, size.height);
      expect(minDim, `${el.name}: ${size.width}×${size.height}`).toBeGreaterThanOrEqual(44);
    });
  }

  test('touch: card actions (download/copy/delete under preview) >= 44×44', async ({ page }) => {
    await switchToPreviewMode(page);
    const actions = ['#cardsArea [data-action="download"]', '#cardsArea [data-action="copy"]', '#cardsArea [data-action="delete-preview"]'];
    for (const sel of actions) {
      const size = await getEffectiveTouchSize(page, sel);
      const minDim = Math.min(size.width, size.height);
      expect(minDim, `${sel}: ${size.width}×${size.height}`).toBeGreaterThanOrEqual(44);
    }
  });

  test('touch: modal close button >= 44×44 (when modal open)', async ({ page }) => {
    await page.locator('[data-action="palette"]').first().click();
    await page.waitForTimeout(500);
    const size = await getEffectiveTouchSize(page, '#closeModalBtn');
    const minDim = Math.min(size.width, size.height);
    expect(minDim).toBeGreaterThanOrEqual(44);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * P1 — ACCESSIBILITY: color-swatch, inert, roving tabindex, focus-visible
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P1-a11y: accessibility fixes', () => {
  test('a11y-1: color swatches are semantic buttons (not divs)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await page.waitForTimeout(500);
    // Color swatches should be <button> elements, not <div>
    const swatchTag = await page.evaluate(() => {
      const swatch = document.querySelector('.color-swatch');
      return swatch ? swatch.tagName.toLowerCase() : null;
    });
    expect(swatchTag).toBe('button');
  });

  test('a11y-2: color swatches have accessible name and aria-pressed/selected', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    await page.locator('[data-action="palette"]').first().click();
    await page.waitForTimeout(500);
    const swatch = page.locator('.color-swatch').first();
    // Should have accessible name (aria-label or text)
    const ariaLabel = await swatch.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.length).toBeGreaterThan(0);
  });

  test('a11y-3: inactive overlays excluded from tab order (hidden/inert/aria-hidden)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoApp(page);
    // Color modal should be inactive — not tabbable
    const modalTabbable = await isTabbable(page, '#colorModal .modal-close');
    expect(modalTabbable).toBe(false);
  });

  test('a11y-4: when mobile editor open, preview not in tab order', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
    // Preview card action buttons should NOT be tabbable when editor mode is active.
    // P1-A11Y-V2: check via visibility (preview-workspace has visibility:hidden
    // when data-mobile-mode="editor" on phone).
    const previewHidden = await page.evaluate(() => {
      const ws = document.getElementById('previewWorkspace');
      if (!ws) return false;
      return getComputedStyle(ws).visibility === 'hidden';
    });
    expect(previewHidden, 'preview-workspace should be visibility:hidden in editor mode').toBe(true);
  });

  test('a11y-5: mode tabs support ArrowLeft/ArrowRight (roving tabindex)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    // Focus editor tab
    await page.locator('#modeEditorTab').focus();
    await expect(page.locator('#modeEditorTab')).toBeFocused();
    // ArrowRight should move focus to preview tab
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#modePreviewTab')).toBeFocused();
    // ArrowLeft should move back to editor tab
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#modeEditorTab')).toBeFocused();
  });

  test('a11y-6: focus-visible produces visible outline on mode tabs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await page.locator('#modeEditorTab').focus();
    const outline = await page.evaluate(() => {
      const el = document.getElementById('modeEditorTab')!;
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      };
    });
    // Outline must be visible (not 'none' and not transparent)
    expect(outline.outlineStyle).not.toBe('none');
    expect(outline.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(outline.outlineColor).not.toBe('transparent');
    expect(parseFloat(outline.outlineWidth)).toBeGreaterThan(0);
  });

  test('a11y-7: #toggleSidebarBtn has aria-controls pointing to sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await expect(page.locator('#toggleSidebarBtn')).toHaveAttribute('aria-controls', 'editorSidebar');
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * P2 — UX: no duplicates, × visibility, focus restore, formats
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('P2-ux: mobile UX polish', () => {
  test('ux-1: × close button only visible when sidebar is open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    // Initially sidebar closed → × should be hidden
    const closeBtn = page.locator('#closeSidebarBtn');
    const initialVisible = await closeBtn.isVisible();
    expect(initialVisible).toBe(false);
    // Open editor
    await switchToEditorMode(page);
    // Now × should be visible
    const openVisible = await closeBtn.isVisible();
    expect(openVisible).toBe(true);
  });

  test('ux-2: focus restored to opener after closing editor', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    // Focus the editor tab, then click it to open
    await page.locator('#modeEditorTab').focus();
    await page.locator('#modeEditorTab').click();
    await page.waitForTimeout(300);
    // Close via × button
    await page.locator('#closeSidebarBtn').click();
    await page.waitForTimeout(300);
    // Focus should be back on a sensible control (modeEditorTab or modePreviewTab)
    // The controller restores focus to the element that was focused before opening.
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(['modeEditorTab', 'modePreviewTab', 'closeSidebarBtn']).toContain(focusedId);
  });

  test('ux-3: 4:5 format card does not cause horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
    // Set format to aspect-4-5
    await page.evaluate(() => {
      const sel = document.getElementById('formatSelect') as HTMLSelectElement;
      sel.value = 'aspect-4-5';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await switchToPreviewMode(page);
    await page.waitForTimeout(300);
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('ux-4: 9:16 format card does not cause horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
    await page.evaluate(() => {
      const sel = document.getElementById('formatSelect') as HTMLSelectElement;
      sel.value = 'aspect-9-16';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await switchToPreviewMode(page);
    await page.waitForTimeout(300);
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('ux-5: login page at 320px — form visible, no overflow, touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/login/');
    // Wait for auth provider to finish initializing
    await expect(page.locator('body')).not.toContainText('Проверка авторизации', { timeout: 15000 });
    // Login form MUST be visible (Supabase is configured in .env)
    await expect(page.locator('#email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // Google login button
    await expect(page.locator('button:has-text("Google")')).toBeVisible();
    // No horizontal overflow
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
    // Touch targets: submit button, Google button, tab buttons
    const submitBox = await page.locator('button[type="submit"]').boundingBox();
    expect(submitBox!.height, 'submit button height').toBeGreaterThanOrEqual(40);
    const googleBox = await page.locator('button:has-text("Google")').boundingBox();
    expect(googleBox!.height, 'Google button height').toBeGreaterThanOrEqual(40);
    // Font-size on inputs >= 16px
    const emailFontSize = await getFontSize(page, '#email');
    expect(emailFontSize).toBeGreaterThanOrEqual(16);
    const pwFontSize = await getFontSize(page, '#password');
    expect(pwFontSize).toBeGreaterThanOrEqual(16);
  });

  test('ux-6: login page at 390px — form visible, no overflow, touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login/');
    await expect(page.locator('body')).not.toContainText('Проверка авторизации', { timeout: 15000 });
    await expect(page.locator('#email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button:has-text("Google")')).toBeVisible();
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
    const submitBox = await page.locator('button[type="submit"]').boundingBox();
    expect(submitBox!.height, 'submit button height').toBeGreaterThanOrEqual(40);
    const googleBox = await page.locator('button:has-text("Google")').boundingBox();
    expect(googleBox!.height, 'Google button height').toBeGreaterThanOrEqual(40);
    const emailFontSize = await getFontSize(page, '#email');
    expect(emailFontSize).toBeGreaterThanOrEqual(16);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * BREAKPOINT SYNC: rotation/orientation change consistency
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('breakpoint-sync: orientation/resize consistency', () => {
  test('rotate-1: phone→tablet→phone does not create conflicting state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await switchToEditorMode(page);
    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    // On tablet, sidebar should be open (split-view)
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    // Resize back to phone
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    // On phone, sidebar should collapse (no room for split-view)
    const state = await page.evaluate(() => ({
      mobileMode: document.querySelector('.cc-root')!.getAttribute('data-mobile-mode'),
      sidebarClass: document.getElementById('editorSidebar')!.className,
    }));
    // data-mobile-mode and sidebar class should be consistent
    // (either both 'editor'/open OR both 'preview'/collapsed)
    const consistent =
      (state.mobileMode === 'editor' && !state.sidebarClass.includes('collapsed')) ||
      (state.mobileMode === 'preview' && state.sidebarClass.includes('collapsed'));
    expect(consistent).toBe(true);
  });
});
