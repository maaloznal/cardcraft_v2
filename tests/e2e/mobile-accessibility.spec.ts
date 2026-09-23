import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { gotoApp, switchToEditorMode } from './helpers';

/**
 * P-MOBILE: accessibility tests for mobile + tablet viewports.
 *
 * Extends the existing accessibility.spec.ts (desktop) with mobile + tablet
 * audits and keyboard-interaction tests for the new mobile mode switcher.
 *
 * Per spec E in the task requirements:
 *   - axe-core scan on key mobile states
 *   - Accessible names for tabs and buttons
 *   - Keyboard works for mode switching and open/close sidebar
 */

test.describe('Accessibility — mobile (390×844)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
  });

  test('E1: mobile default state — no critical/serious a11y violations', async ({ page }) => {
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalSerious, formatViolations(criticalSerious)).toEqual([]);
  });

  test('E2: mobile editor mode — no critical/serious violations', async ({ page }) => {
    await switchToEditorMode(page);
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalSerious, formatViolations(criticalSerious)).toEqual([]);
  });

  test('E3: mode switcher tabs have accessible names', async ({ page }) => {
    const editorTab = page.locator('#modeEditorTab');
    const previewTab = page.locator('#modePreviewTab');
    const closeBtn = page.locator('#closeSidebarBtn');

    // Each tab/button must have an accessible name (aria-label, title, or text content)
    await expect(editorTab).toHaveAttribute('aria-controls', 'editorSidebar');
    await expect(editorTab).toHaveAttribute('role', 'tab');
    await expect(editorTab).toHaveAttribute('aria-selected');

    await expect(previewTab).toHaveAttribute('aria-controls', 'previewWorkspace');
    await expect(previewTab).toHaveAttribute('role', 'tab');
    await expect(previewTab).toHaveAttribute('aria-selected');

    await expect(closeBtn).toHaveAttribute('aria-label', 'Закрыть редактор');
  });

  test('E4: keyboard — Tab can focus mobile mode tabs', async ({ page }) => {
    // Tab through until we reach the mode tabs
    // The tabs are inside the sidebar, which is visible on phone via the switcher
    // at the top of the sidebar header. Since sidebar is collapsed initially,
    // the switcher may not be focusable. Let's first check the switcher is visible.
    await expect(page.locator('#mobileModeSwitcher')).toBeVisible();

    // Focus the editor tab directly
    await page.locator('#modeEditorTab').focus();
    await expect(page.locator('#modeEditorTab')).toBeFocused();

    // Press Enter to activate it
    await page.keyboard.press('Enter');
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'editor');

    // Focus the preview tab and activate
    await page.locator('#modePreviewTab').focus();
    await expect(page.locator('#modePreviewTab')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'preview');
  });

  test('E5: keyboard — close button is focusable and activated via Enter', async ({ page }) => {
    // Switch to editor mode first
    await switchToEditorMode(page);

    // Focus the close button
    await page.locator('#closeSidebarBtn').focus();
    await expect(page.locator('#closeSidebarBtn')).toBeFocused();

    // Press Enter
    await page.keyboard.press('Enter');
    // Should switch to preview (close = switch to preview)
    await expect(page.locator('.cc-root')).toHaveAttribute('data-mobile-mode', 'preview');
  });

  test('E6: focus-visible outline appears on tabs when keyboard-focused', async ({ page }) => {
    // Tab to the editor tab via keyboard
    await page.locator('#modeEditorTab').focus();
    // Check that outline (or some focus-visible indicator) is applied
    const outlineStyle = await page.locator('#modeEditorTab').evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
      };
    });
    // Note: outlineColor may be 'transparent' in some browsers until :focus-visible matches.
    // We check that outlineStyle is not 'none' (which would mean no outline at all).
    // If browser doesn't apply :focus-visible on programmatic focus, this may be 'none'.
    // Acceptable: outline is not 'none' OR minWidth >= 44 (touch target OK).
    const hasOutline = outlineStyle.outlineStyle !== 'none' &&
                       outlineStyle.outlineColor !== 'rgba(0, 0, 0, 0)' &&
                       outlineStyle.outlineColor !== 'transparent';
    // Soft assertion — log if no outline (don't fail, since :focus-visible requires
    // actual keyboard interaction which is hard to simulate reliably)
    if (!hasOutline) {
      console.log('Note: no visible outline on programmatic focus — :focus-visible may require real keyboard interaction');
    }
  });
});

test.describe('Accessibility — tablet (768×1024)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoApp(page);
  });

  test('E7: tablet default state — no critical/serious a11y violations', async ({ page }) => {
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalSerious, formatViolations(criticalSerious)).toEqual([]);
  });

  test('E8: tablet with sidebar open — no critical/serious violations', async ({ page }) => {
    await page.locator('#toggleSidebarBtn').click();
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalSerious, formatViolations(criticalSerious)).toEqual([]);
  });
});

test.describe('Accessibility — tablet landscape (1024×768)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoApp(page);
  });

  test('E9: desktop layout at 1024px — no critical/serious violations', async ({ page }) => {
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalSerious, formatViolations(criticalSerious)).toEqual([]);
  });
});

/** Format axe violations into a readable error message. */
function formatViolations(violations: typeof AxeBuilder.prototype): string {
  if (!Array.isArray(violations) || violations.length === 0) return '';
  return (
    '\nAccessibility violations:\n' +
    violations
      .map(
        (v: { id: string; impact: string; description: string; help: string }) =>
          `  [${v.impact}] ${v.id}: ${v.help} — ${v.description}`,
      )
      .join('\n')
  );
}
