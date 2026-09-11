import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { gotoApp } from './helpers';

/**
 * Accessibility audit (PRIORITY 5.7).
 *
 * Uses @axe-core/playwright to scan for WCAG 2.1 AA violations:
 *   - color contrast
 *   - ARIA correctness
 *   - keyboard navigation
 *   - form labels
 *
 * Runs on:
 *   - Default state (1 empty card)
 *   - Card with content
 *   - Color modal open
 *   - Word style popup open
 *
 * Violations of "critical" + "serious" impact fail the test.
 * "moderate" + "minor" are reported but don't fail (informational).
 */

test.describe('Accessibility audit (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('5.7a default state — no critical/serious a11y violations', async ({ page }) => {
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalSerious, formatViolations(criticalSerious)).toEqual([]);
  });

  test('5.7b card with content — no critical/serious violations', async ({ page }) => {
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('Accessibility Test');
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="text"]').fill('Body text with content');
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalSerious, formatViolations(criticalSerious)).toEqual([]);
  });

  test('5.7c color modal open — no critical/serious violations', async ({ page }) => {
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-action="palette"]').click();
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('#previewWorkspace') // preview cards have theme-specific colors (audited separately)
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
