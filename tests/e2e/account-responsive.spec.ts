import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

for (const viewport of [
  { name: 'narrow phone', width: 320, height: 568 },
  { name: 'Xiaomi class phone', width: 393, height: 873 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
]) {
  test(`account actions stay even and inside their container on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await gotoApp(page);
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'account-actions-fixture';
      fixture.style.cssText = 'position:fixed;z-index:9999;left:24px;top:90px;width:calc(100vw - 48px);padding:8px;background:white';
      fixture.innerHTML = `
        <div class="account-project-actions">
          <button class="account-primary">Открыть</button>
          <button class="account-secondary">Переименовать</button>
          <button class="account-danger">Удалить</button>
        </div>
        <div class="account-footer-actions" style="margin-top:16px">
          <a class="account-secondary">Документация</a>
          <a class="account-secondary">На главную</a>
          <button class="account-danger">Выйти</button>
        </div>`;
      document.body.append(fixture);
    });

    for (const selector of ['.account-project-actions', '.account-footer-actions']) {
      const group = page.locator(`#account-actions-fixture ${selector}`);
      const groupBox = await group.boundingBox();
      expect(groupBox).not.toBeNull();
      const items = group.locator(':scope > *');
      const count = await items.count();
      const boxes = [];
      for (let index = 0; index < count; index += 1) {
        const box = await items.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(groupBox!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(groupBox!.x + groupBox!.width + 0.5);
        expect(box!.height).toBeGreaterThanOrEqual(viewport.width <= 700 ? 44 : 42);
        boxes.push(box!);
      }
      for (let left = 0; left < boxes.length; left += 1) {
        for (let right = left + 1; right < boxes.length; right += 1) {
          const a = boxes[left];
          const b = boxes[right];
          const overlaps = a.x < b.x + b.width && a.x + a.width > b.x
            && a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlaps).toBe(false);
        }
      }
    }
  });
}
