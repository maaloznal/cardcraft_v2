import { expect, test, type Locator } from '@playwright/test';
import { gotoApp } from './helpers';

async function selectText(field: Locator, mode: 'word' | 'all', pointer: 'mouse' | 'touch') {
  await field.evaluate((element, { mode, pointer }) => {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: pointer }));
    const range = document.createRange();
    if (mode === 'all') range.selectNodeContents(element);
    else {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const first = walker.nextNode();
      if (!first) throw new Error('No text');
      range.setStart(first, 0); range.setEnd(first, 5);
    }
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    // Native long-press may emit pointercancel, without any pointerup.
    element.dispatchEvent(new PointerEvent(pointer === 'touch' ? 'pointercancel' : 'pointerup', { bubbles: true, pointerType: pointer }));
    document.dispatchEvent(new Event('selectionchange'));
  }, { mode, pointer });
}

for (const device of [{ name: 'desktop', width: 1280, height: 850, touch: false }, { name: 'phone', width: 390, height: 844, touch: true }, { name: 'tablet', width: 1024, height: 768, touch: true }]) {
  test(`long selection and word inside it stay editable on ${device.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height }, hasTouch: device.touch, isMobile: device.touch, baseURL: 'http://localhost:3000' });
    const page = await context.newPage();
    try {
      await gotoApp(page);
      if (await page.locator('#modeEditorTab').isVisible()) await page.locator('#modeEditorTab').click();
      const longText = 'Alpha beta gamma. '.repeat(35);
      await page.locator('#editorCardsList textarea[data-field="text"]').first().fill(longText);
      if (await page.locator('#modePreviewTab').isVisible()) await page.locator('#modePreviewTab').click();
      const field = page.locator('#cardsArea .card-text').first();
      const popup = page.locator('#wordStylePopup');
      await expect(field).toBeVisible();
      await selectText(field, 'all', device.touch ? 'touch' : 'mouse');
      if (device.touch) {
        await expect(popup).not.toBeVisible();
        await page.getByRole('button', { name: 'Оформить выделение' }).tap();
      }
      await expect(popup).toBeVisible();
      await popup.locator('[data-format="bold"]').click();
      await expect(field.locator('.cc-styled-word').first()).toHaveCSS('font-weight', '700');
      await expect(page.locator('.word-list-word')).toHaveText(/…$/);
      let box = (await popup.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(360);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(device.height + 1);
      await page.getByRole('button', { name: 'Закрыть настройки текста' }).click();
      await selectText(field, 'word', device.touch ? 'touch' : 'mouse');
      if (device.touch) await page.getByRole('button', { name: 'Оформить выделение' }).tap();
      await expect(popup).toBeVisible();
      await popup.locator('[data-color="#dc2626"]').click();
      await expect(field.locator('.cc-styled-word').first()).toHaveText('Alpha');
      await expect(field.locator('.cc-styled-word').first()).toHaveCSS('color', 'rgb(220, 38, 38)');
      await expect(field.locator('.cc-styled-word').first()).toHaveCSS('font-weight', '700');
      box = (await popup.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(360);
      await page.screenshot({ path: test.info().outputPath(`selection-${device.name}.png`) });
      await page.getByRole('button', { name: 'Закрыть настройки текста' }).click();
      // A range spanning fields must not apply to either field by accident.
      await page.locator('#cardsArea').evaluate((area) => {
        const range = document.createRange(); range.selectNodeContents(area);
        window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
        area.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
        document.dispatchEvent(new Event('selectionchange'));
      });
      await expect(page.getByRole('button', { name: 'Оформить выделение' })).not.toBeVisible();
    } finally { await context.close().catch(() => {}); }
  });
}

for (const width of [390, 768, 1024, 1280]) {
  test(`documentation headings navigate back only on compact screens (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/docs/');
    await page.locator('.docs-toc-link[href="#text-styling"]').click();
    await expect(page.locator('#text-styling')).toContainText('Оформить выделение');
    if (width <= 1024) {
      await page.locator('#text-styling .docs-heading-mobile').click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
      await expect(page.locator('.docs-toc')).toBeInViewport();
    } else {
      await expect(page.locator('#text-styling .docs-heading-mobile')).not.toBeVisible();
      await expect(page.locator('.docs-toc')).toHaveCSS('position', 'sticky');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`docs-${width}.png`) });
  });
}

for (const width of [390, 768, 1024]) {
  test(`tap-based text formatting without native selection (${width})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true, isMobile: true, baseURL: 'http://localhost:3000' });
    const page = await context.newPage();
    try {
      await gotoApp(page);
      if (await page.locator('#modeEditorTab').isVisible()) await page.locator('#modeEditorTab').tap();
      await page.locator('#editorCardsList textarea[data-field="text"]').first().fill('Alpha beta gamma');
      if (await page.locator('#modePreviewTab').isVisible()) await page.locator('#modePreviewTab').tap();
      await page.getByRole('button', { name: 'Оформить текст карточки 1', exact: true }).tap();
      const dialog = page.getByRole('dialog', { name: 'Оформление текста' });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Часть карточки').selectOption('text');
      await dialog.getByRole('button', { name: 'beta', exact: true }).tap();
      await dialog.getByRole('button', { name: 'gamma', exact: true }).tap();
      await dialog.getByRole('button', { name: 'Оформить', exact: true }).tap();
      const popup = page.locator('#wordStylePopup');
      await expect(popup).toBeVisible();
      await popup.locator('[data-format="bold"]').tap();
      await expect(page.locator('#cardsArea .card-text .cc-styled-word').first()).toHaveText('beta gamma');
      await expect(page.locator('#cardsArea .card-text .cc-styled-word').first()).toHaveCSS('font-weight', '700');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`text-picker-${width}.png`) });
    } finally { await context.close(); }
  });
}
