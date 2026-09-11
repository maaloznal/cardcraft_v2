import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * XSS security audit (PRIORITY 19.4).
 *
 * Verifies that user-generated content in all card fields is properly escaped
 * and cannot inject HTML/scripts. Tests:
 *   - Title field with <script> tag
 *   - Subtitle with <img onerror>
 *   - Text with <svg onload>
 *   - List items with <a href="javascript:">
 *   - Footer with </div> breakout
 *   - CTA with event handler attribute
 *
 * Verifies:
 *   - No <script> tags injected into DOM
 *   - No event handlers (onerror, onload) execute
 *   - Content renders as escaped text, not HTML
 */

test.describe('XSS security audit (P19.4)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('19.4a title field — script tag escaped', async ({ page }) => {
    const payload = '<script>alert("XSS")</script>';
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill(payload);
    await page.waitForTimeout(500);
    // Verify preview shows escaped text, not executed script
    const titleText = await page.locator('#cardsArea .card-title').first().textContent();
    expect(titleText).toContain('<script>');
    expect(titleText).toContain('alert');
    // No actual script tag in DOM
    const scriptCount = await page.locator('#cardsArea script').count();
    expect(scriptCount).toBe(0);
  });

  test('19.4b subtitle — img onerror does not execute', async ({ page }) => {
    const payload = '<img src=x onerror=alert(1)>';
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="subtitle"]').fill(payload);
    await page.waitForTimeout(500);
    // No img element with onerror in preview
    const imgCount = await page.locator('#cardsArea img[onerror]').count();
    expect(imgCount).toBe(0);
    // Text should be escaped
    const subtitleText = await page.locator('#cardsArea .card-subtitle').first().textContent();
    expect(subtitleText).toContain('<img');
  });

  test('19.4c text — svg onload does not execute', async ({ page }) => {
    const payload = '<svg onload=alert(1)>';
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="text"]').fill(payload);
    await page.waitForTimeout(500);
    const svgCount = await page.locator('#cardsArea svg[onload]').count();
    expect(svgCount).toBe(0);
  });

  test('19.4d list items — javascript: URL not clickable', async ({ page }) => {
    const payload = '<a href="javascript:alert(1)">click</a>';
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="listItems"]').fill(payload);
    await page.waitForTimeout(500);
    // No anchor with javascript: href
    const anchorCount = await page.locator('#cardsArea a[href^="javascript:"]').count();
    expect(anchorCount).toBe(0);
  });

  test('19.4e footer — HTML breakout prevented', async ({ page }) => {
    const payload = '</div></div><script>alert(1)</script>';
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="footer"]').fill(payload);
    await page.waitForTimeout(500);
    const scriptCount = await page.locator('#cardsArea script').count();
    expect(scriptCount).toBe(0);
  });

  test('19.4f cta — event handler attribute escaped', async ({ page }) => {
    const payload = '" onmouseover="alert(1)';
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="cta"]').fill(payload);
    await page.waitForTimeout(500);
    // No element with onmouseover in preview
    const handlerCount = await page.locator('#cardsArea [onmouseover]').count();
    expect(handlerCount).toBe(0);
  });

  test('19.4g localStorage injection — card.id sanitized on load', async ({ page }) => {
    // Inject malicious card.id into localStorage, reload, verify no XSS
    await page.evaluate(() => {
      const maliciousCards = [
        {
          id: '"><script>alert(1)</script>',
          title: 'Test',
          subtitle: '',
          text: '',
          listItems: '',
          footer: '',
          cta: '',
          colors: {},
          wordStyles: {},
          sectionStyles: {},
        },
      ];
      localStorage.setItem('flashcard-cards', JSON.stringify(maliciousCards));
    });
    await page.reload();
    await page.waitForTimeout(1500);
    // card.id should be sanitized — no script in DOM
    const scriptCount = await page.locator('script:not([src])').count();
    // The malicious script tag should not be in the DOM as an executable element
    // (it may appear as text content but not as a script element)
    const maliciousScripts = await page
      .locator('script')
      .evaluateAll((scripts) =>
        scripts.filter((s) => !s.src && s.textContent?.includes('alert')).length,
      );
    expect(maliciousScripts).toBe(0);
  });
});
