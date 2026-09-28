import { test, expect } from '@playwright/test';
import {
  gotoApp,
  typeInEditor,
  getPreviewCardTitle,
  getHorizontalOverflow,
  getTouchTargetSize,
  getFontSize,
  switchToEditorMode,
  switchToPreviewMode,
  closeMobileSidebar,
} from './helpers';

/**
 * P-MOBILE: mobile tests — iPhone 14 viewport (390×844).
 *
 * These tests run in the `mobile-chrome` project (Playwright devices.iPhone 14).
 * They verify the phone-specific behavior:
 *   - No horizontal overflow
 *   - Mobile mode switcher (Editor / Preview tabs) visible and functional
 *   - Switching modes changes the visible area
 *   - Typed text persists across mode switches
 *   - Card fits in viewport
 *   - Touch targets >= 44×44px (effective hit area via min-width/min-height)
 *   - Input font-size >= 16px (no iOS auto-zoom)
 *   - Close button (×) dismisses sidebar
 *   - Destructive action (Удалить все) requires confirmation
 *
 * Per spec A in the task requirements.
 */

test.describe('Mobile (390×844) — phone mode', () => {
  test.beforeEach(async ({ page }) => {
    // iPhone 14 project already sets viewport, but we enforce it explicitly
    // in case the test runs in chromium project during local debugging.
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
  });

  test('A1: no horizontal overflow on phone viewport', async ({ page }) => {
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });

  test('A2: mobile mode switcher is visible with Editor + Preview tabs', async ({ page }) => {
    const switcher = page.locator('#mobileModeSwitcher');
    await expect(switcher).toBeVisible();

    // Both tabs visible
    await expect(page.locator('#modeEditorTab')).toBeVisible();
    await expect(page.locator('#modePreviewTab')).toBeVisible();
    // Close button is only visible when sidebar is open (CSS: visibility:hidden
    // by default, shown when .cc-root.sidebar-open). It exists in DOM though.
    await expect(page.locator('#closeSidebarBtn')).toBeAttached();
  });

  test('A3: default mode is preview (sidebar collapsed on phone)', async ({ page }) => {
    // data-mobile-mode attribute on .cc-root
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'preview');
    // Sidebar should be collapsed initially
    await expect(page.locator('#editorSidebar')).toHaveClass(/\bcollapsed\b/);
  });

  test('A4: switching to editor mode opens sidebar', async ({ page }) => {
    await switchToEditorMode(page);
    // data-mobile-mode = editor
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'editor');
    // Sidebar is NOT collapsed (it's open)
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);
    // Editor tab is marked active (aria-selected=true)
    await expect(page.locator('#modeEditorTab')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#modePreviewTab')).toHaveAttribute('aria-selected', 'false');
  });

  test('A5: switching to preview mode closes sidebar', async ({ page }) => {
    // First open editor
    await switchToEditorMode(page);
    // Then switch back to preview
    await switchToPreviewMode(page);
    // Sidebar collapsed again
    await expect(page.locator('#editorSidebar')).toHaveClass(/\bcollapsed\b/);
    // data-mobile-mode = preview
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'preview');
  });

  test('A6: typed text persists across mode switches', async ({ page }) => {
    // Open editor
    await switchToEditorMode(page);
    // Type into the title field of card 1
    const testText = 'MOBILE PERSISTENCE TEST';
    await typeInEditor(page, 0, 'title', testText);

    // Switch to preview
    await switchToPreviewMode(page);
    // Verify the title appears in the preview card
    const previewTitle = await getPreviewCardTitle(page, 0);
    expect(previewTitle).toBe(testText);

    // Switch back to editor — verify the text is still in the input
    await switchToEditorMode(page);
    const inputValue = await page
      .locator('#editorCardsList .card-editor-block:nth-child(1) input[data-field="title"]')
      .inputValue();
    expect(inputValue).toBe(testText);
  });

  test('A7: card fits within phone viewport (no horizontal scroll for card)', async ({ page }) => {
    // Switch to preview so card is visible
    await switchToPreviewMode(page);
    // Get the card's bounding box
    const cardBox = await page.locator('#cardsArea .card').first().boundingBox();
    expect(cardBox).not.toBeNull();
    // Card width should not exceed viewport width
    expect(cardBox!.width).toBeLessThanOrEqual(390);
  });

  test('A8: close button (×) dismisses sidebar', async ({ page }) => {
    // Open sidebar first
    await switchToEditorMode(page);
    await expect(page.locator('#editorSidebar')).not.toHaveClass(/\bcollapsed\b/);

    // Close button should now be visible (CSS shows it when .cc-root.sidebar-open)
    await expect(page.locator('#closeSidebarBtn')).toBeVisible();

    // Tap close button
    await closeMobileSidebar(page);

    // Sidebar is now collapsed
    await expect(page.locator('#editorSidebar')).toHaveClass(/\bcollapsed\b/);
    // data-mobile-mode should be preview (close = switch to preview)
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'preview');
  });

  test('A9: undo button has >= 44px touch target', async ({ page }) => {
    const size = await getTouchTargetSize(page, '#undoBtn');
    // Effective touch target (min-width + min-height) should be >= 44px
    // We check min-width/min-height because the actual button may be smaller
    // but with ::before hit area extension the effective area is larger.
    // The CSS sets min-width: 44px and min-height: 44px on .btn-icon on mobile.
    // However, getBoundingClientRect returns the rendered size which equals
    // the min-width when content is smaller. So we check the rendered size OR
    // the min-width/min-height — whichever is the effective target.
    const effectiveWidth = Math.max(size.width, size.minWidth);
    const effectiveHeight = Math.max(size.height, size.minHeight);
    expect(effectiveWidth).toBeGreaterThanOrEqual(44);
    expect(effectiveHeight).toBeGreaterThanOrEqual(44);
  });

  test('A10: redo button has >= 44px touch target', async ({ page }) => {
    const size = await getTouchTargetSize(page, '#redoBtn');
    const effectiveWidth = Math.max(size.width, size.minWidth);
    const effectiveHeight = Math.max(size.height, size.minHeight);
    expect(effectiveWidth).toBeGreaterThanOrEqual(44);
    expect(effectiveHeight).toBeGreaterThanOrEqual(44);
  });

  test('A11: editor mode button has >= 44px touch target', async ({ page }) => {
    const size = await getTouchTargetSize(page, '#modeEditorTab');
    const effectiveWidth = Math.max(size.width, size.minWidth);
    const effectiveHeight = Math.max(size.height, size.minHeight);
    expect(effectiveWidth).toBeGreaterThanOrEqual(44);
    expect(effectiveHeight).toBeGreaterThanOrEqual(44);
  });

  test('A12: input font-size >= 16px (no iOS auto-zoom)', async ({ page }) => {
    await switchToEditorMode(page);
    // Check title input font-size (use input selector — clear-field button also has data-field)
    const fontSize = await getFontSize(
      page,
      '#editorCardsList .card-editor-block:nth-child(1) input[data-field="title"]',
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('A13: textarea font-size >= 16px', async ({ page }) => {
    await switchToEditorMode(page);
    const fontSize = await getFontSize(
      page,
      '#editorCardsList .card-editor-block:nth-child(1) textarea[data-field="text"]',
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('A14: select font-size >= 16px', async ({ page }) => {
    await switchToEditorMode(page);
    const fontSize = await getFontSize(page, '#formatSelect');
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('A15: destructive action (Удалить все) requires confirmation', async ({ page }) => {
    await switchToEditorMode(page);
    // Add a card so we have 2 (initial is 1, but deleteAll requires > 0)
    await page.locator('#addCardBtn').click();
    await expect(page.locator('#editorCardsList .card-editor-block')).toHaveCount(2);

    // Tap "Удалить все"
    await page.locator('#deleteAllBtn').click();

    // A confirm dialog should appear (specifically the confirm overlay, NOT the color modal)
    await expect(page.locator('#confirmOverlay')).toBeVisible({ timeout: 3000 });

    // The card count should still be 2 (not deleted yet)
    await expect(page.locator('#editorCardsList .card-editor-block')).toHaveCount(2);

    // Cancel the confirm — try multiple ways (button click, then Escape fallback)
    const cancelBtn = page.locator('#confirmOverlay [data-action="cancel"], #confirmOverlay .btn-secondary').first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Cards still there
    await expect(page.locator('#editorCardsList .card-editor-block')).toHaveCount(2);
  });

  test('A16: destructive action is separated from download (different containers)', async ({ page }) => {
    await switchToEditorMode(page);
    // "Скачать все" is in .sidebar-primary-actions
    const downloadContainer = page.locator('.sidebar-primary-actions');
    // "Удалить все" is in .sidebar-destructive-actions (separate section)
    const deleteContainer = page.locator('.sidebar-destructive-actions');

    await expect(downloadContainer).toBeVisible();
    await expect(deleteContainer).toBeVisible();

    // Verify "Скачать все" is NOT in the same container as "Удалить все"
    const downloadInDelete = await deleteContainer.locator('#saveAll').count();
    expect(downloadInDelete).toBe(0);
    const deleteInDownload = await downloadContainer.locator('#deleteAllBtn').count();
    expect(deleteInDownload).toBe(0);
  });

  test('A17: top bar fits within phone viewport', async ({ page }) => {
    const topBar = await page.locator('.top-bar').boundingBox();
    expect(topBar).not.toBeNull();
    expect(topBar!.width).toBeLessThanOrEqual(390);
    // No horizontal overflow from top bar
    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);
  });
});
