import { test, expect } from '@playwright/test';
import {
  gotoApp,
  getPreviewCardCount,
  downloadPngAndReadDimensions,
  downloadPngAndInspect,
  inspectPngDownload,
  setExportQuality,
  switchToEditorMode,
  switchToPreviewMode,
} from './helpers';

/**
 * E2E: export + quality + cancel.
 *
 * P-EXPORT-Q: verifies the PNG output width is deterministic and detached
 * from the on-screen card size. Each quality level produces a fixed width:
 *   ×2 → 760 px, ×3 → 1140 px (default), ×4 → 1520 px.
 * Dimensions are read from the PNG IHDR chunk (standard Node Buffer — no
 * extra dependency). Tests run in the `chromium` desktop project; a separate
 * mobile/tablet parity test confirms identical sizes on 390×844 and 768×1024.
 */

const TIMEOUT = { timeout: 30000 };

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    // Fill the title so the card has content (avoids empty-card hint)
    await page
      .locator('#editorCardsList .card-editor-block')
      .first()
      .locator('[data-field="title"]')
      .fill('Export Test');
  });

  test('13. single card PNG export triggers download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', TIMEOUT);
    await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('14. batch export cancel via Escape', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.locator('#addCardBtn').click();
    }
    await expect.poll(() => getPreviewCardCount(page)).toBe(4);
    await page.locator('#saveAll').click();
    await expect(page.locator('.cc-root')).toHaveClass(/exporting-busy/, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.cc-root')).not.toHaveClass(/exporting-busy/, { timeout: 5000 });
    await expect(page.locator('#toast')).toContainText(/отменён|Готово/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * P-EXPORT-Q: deterministic PNG dimensions per quality level.
 * Reads the IHDR chunk of the downloaded PNG and asserts exact widths.
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('Export quality — deterministic PNG width', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page
      .locator('#editorCardsList .card-editor-block')
      .first()
      .locator('[data-field="title"]')
      .fill('Quality Test');
  });

  test('×2 produces a 760 px wide PNG', async ({ page }) => {
    await setExportQuality(page, 'x2');
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'q2');
    expect(dims.width, '×2 PNG must be exactly 760 px wide').toBe(760);
    expect(dims.height, '×2 PNG must have a positive height').toBeGreaterThan(0);
  });

  test('×3 produces a 1140 px wide PNG', async ({ page }) => {
    await setExportQuality(page, 'x3');
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'q3');
    expect(dims.width, '×3 PNG must be exactly 1140 px wide').toBe(1140);
    expect(dims.height).toBeGreaterThan(0);
  });

  test('×4 produces a 1520 px wide PNG', async ({ page }) => {
    await setExportQuality(page, 'x4');
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'q4');
    expect(dims.width, '×4 PNG must be exactly 1520 px wide').toBe(1520);
    expect(dims.height).toBeGreaterThan(0);
  });

  test('default quality (no explicit selection) is ×3 → 1140 px', async ({ page }) => {
    // Do NOT call setExportQuality — verify the default is ×3
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'default');
    expect(dims.width, 'default quality must be ×3 → 1140 px').toBe(1140);
  });

  test('the <select> reflects the chosen quality and is keyboard-accessible', async ({ page }) => {
    await setExportQuality(page, 'x4');
    const sel = page.locator('#exportQualitySelect');
    await expect(sel).toHaveValue('x4');
    // Label is associated via htmlFor → clicking the label focuses the select
    await page.locator('.export-quality-label').click();
    await expect(sel).toBeFocused();
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Persistence + content preservation
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('Export quality — persistence + content', () => {
  test('chosen quality is written to localStorage and reflected by the <select>', async ({ page }) => {
    // gotoApp clears storage on load; setExportQuality writes the key.
    await gotoApp(page);
    await setExportQuality(page, 'x2');
    // The select reflects the chosen value immediately (state → UI sync)
    await expect(page.locator('#exportQualitySelect')).toHaveValue('x2');
    // StorageManager.save is debounced (CONFIG.SAVE_DEBOUNCE_MS = 400ms) — poll
    // until the value lands in localStorage. (We don't reload because gotoApp's
    // addInitScript clears storage on every navigation; the unit suite covers
    // the reload→load path.)
    await expect.poll(
      () => page.evaluate(() => localStorage.getItem('flashcard-export-quality')),
      { message: 'quality must be persisted to localStorage', timeout: 3000, intervals: [100] },
    ).toBe('x2');
  });

  test('9:16 format card is not cropped (height reflects aspect ratio)', async ({ page }) => {
    await gotoApp(page);
    // Open Дизайн + Формат subsection so #formatSelect is visible/actionable
    await setExportQuality(page, 'x3'); // opens Дизайн accordion
    const formatToggle = page
      .locator('.sidebar-accordion-body > .sidebar-accordion', { hasText: 'Формат' })
      .locator('.sidebar-accordion-header');
    if ((await formatToggle.getAttribute('aria-expanded')) === 'false') {
      await formatToggle.click();
      await page.waitForTimeout(200);
    }
    await page.locator('#formatSelect').selectOption('aspect-9-16');
    await page.waitForTimeout(400);
    // Fill the title so the card has content
    await page.locator('#editorCardsList .card-editor-block').first().locator('[data-field="title"]').fill('Aspect 9:16');
    await page.waitForTimeout(300);
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'aspect916');
    expect(dims.width).toBe(1140);
    // 9:16 min-height is 675 CSS px → ×3 should be ≥ 2025px (content may add more)
    expect(dims.height, '9:16 must not be cropped — height ≥ 2025').toBeGreaterThanOrEqual(2025);
  });

  test('long text content is not cropped (height grows with content)', async ({ page }) => {
    await gotoApp(page);
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(12);
    await page
      .locator('#editorCardsList .card-editor-block')
      .first()
      .locator('[data-field="text"]')
      .fill(longText);
    await page.waitForTimeout(400);
    await setExportQuality(page, 'x3');
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'long');
    expect(dims.width).toBe(1140);
    // The long text must produce a tall image — well above a single-line card
    expect(dims.height, 'long text must not be cropped').toBeGreaterThan(800);
  });

  test('batch export uses the selected quality for every card', async ({ page }) => {
    await gotoApp(page);
    for (let i = 0; i < 2; i++) {
      await page.locator('#addCardBtn').click();
      await page.waitForTimeout(150);
    }
    await expect.poll(() => getPreviewCardCount(page)).toBe(3);
    await setExportQuality(page, 'x2');
    const widths: number[] = [];
    for (let i = 0; i < 3; i++) {
      const dims = await downloadPngAndReadDimensions(page, async () => {
        await page
          .locator('#cardsArea .card-wrapper')
          .nth(i)
          .locator('[data-action="download"]')
          .click();
      }, `batch-${i}`);
      widths.push(dims.width);
    }
    // Every card uses the selected quality → every PNG is 760 px
    expect(widths).toEqual([760, 760, 760]);
  });

  test('UI is not left blocked after a batch export cancel (no .exporting-busy)', async ({ page }) => {
    await gotoApp(page);
    for (let i = 0; i < 3; i++) {
      await page.locator('#addCardBtn').click();
      await page.waitForTimeout(150);
    }
    await setExportQuality(page, 'x4');
    await page.locator('#saveAll').click();
    await expect(page.locator('.cc-root')).toHaveClass(/exporting-busy/, { timeout: 5000 });
    await page.keyboard.press('Escape');
    // The blocker class must be removed even on cancel
    await expect(page.locator('.cc-root')).not.toHaveClass(/exporting-busy/, { timeout: 5000 });
    // And the .exporting class (single-card mode) must not linger either
    await expect(page.locator('.cc-root')).not.toHaveClass(/(?:^|\s)exporting(?:\s|$)/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Viewport parity: the SAME card downloads identical dimensions on a
 * 390×844 phone and a 768×1024 tablet. This is the core fix — the old code
 * exported the on-screen size, so a phone got ~650-760px while desktop got
 * 760px. Now every viewport produces the deterministic quality-based width.
 * ═══════════════════════════════════════════════════════════════════ */

test.describe('Export quality — viewport parity (×3)', () => {
  test('Xiaomi Android downloads a decodable, non-black PNG', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 393, height: 873 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; 2109119DG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    });
    const mobilePage = await context.newPage();
    try {
      await gotoApp(mobilePage);
      await switchToEditorMode(mobilePage);
      await mobilePage
        .locator('#editorCardsList .card-editor-block')
        .first()
        .locator('[data-field="title"]')
        .fill('Xiaomi PNG');
      await mobilePage
        .locator('#editorCardsList .card-editor-block')
        .first()
        .locator('[data-field="text"]')
        .fill('Проверка корректного мобильного экспорта без чёрного изображения.');
      await switchToPreviewMode(mobilePage);
      const inspection = await downloadPngAndInspect(mobilePage, async () => {
        await mobilePage.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
      }, 'xiaomi');
      expect(inspection.width).toBe(1140);
      expect(inspection.byteLength).toBeGreaterThan(1_000);
      expect(inspection.nonBlackPixelRatio, 'PNG must contain visible non-black pixels').toBeGreaterThan(0.25);
      expect(inspection.darkPixelRatio, 'PNG must contain visible text or other dark details').toBeGreaterThan(0.002);
      expect(inspection.luminanceRange, 'PNG must not be a solid-color image').toBeGreaterThan(40);
    } finally {
      await context.close();
    }
  });

  test('Xiaomi Android batch export from hidden preview produces valid cards', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 393, height: 873 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; 2109119DG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    });
    const mobilePage = await context.newPage();
    try {
      await gotoApp(mobilePage);
      await switchToEditorMode(mobilePage);
      for (let index = 0; index < 2; index++) {
        await mobilePage.locator('#addCardBtn').click();
      }
      const editors = mobilePage.locator('#editorCardsList .card-editor-block');
      for (let index = 0; index < 3; index++) {
        await editors.nth(index).locator('[data-field="title"]').fill(`Карточка ${index + 1}`);
        await editors.nth(index).locator('[data-field="text"]').fill('Проверка пакетного мобильного экспорта.');
      }
      await expect(mobilePage.locator('.preview-workspace')).toHaveCSS('visibility', 'hidden');
      await expect(mobilePage.locator('#cardsArea .card-title').first()).toHaveCSS('visibility', 'hidden');

      const downloads: import('@playwright/test').Download[] = [];
      mobilePage.on('download', (download) => downloads.push(download));
      await mobilePage.locator('#saveAll').click();
      await expect.poll(() => downloads.length, { timeout: 60000 }).toBe(3);

      for (let index = 0; index < downloads.length; index++) {
        const inspection = await inspectPngDownload(mobilePage, downloads[index], `xiaomi-batch-${index}`);
        expect(inspection.width).toBe(1140);
        expect(inspection.byteLength).toBeGreaterThan(1_000);
        expect(inspection.nonBlackPixelRatio, `batch PNG ${index + 1} must not be black`).toBeGreaterThan(0.25);
        expect(inspection.darkPixelRatio, `batch PNG ${index + 1} must contain visible text`).toBeGreaterThan(0.002);
        expect(inspection.luminanceRange, `batch PNG ${index + 1} must not be solid white`).toBeGreaterThan(40);
      }
    } finally {
      await context.close();
    }
  });

  test('390×844 phone downloads a 1140 px PNG', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    // On phone the sidebar starts collapsed (preview mode) — switch to editor
    // so the Дизайн accordion (and the title input) become reachable.
    await switchToEditorMode(page);
    await page
      .locator('#editorCardsList .card-editor-block')
      .first()
      .locator('[data-field="title"]')
      .fill('Phone parity');
    await page.waitForTimeout(200);
    // Switch back to preview so the card download button is tappable
    await switchToPreviewMode(page);
    await page.waitForTimeout(200);
    // Default quality ×3 must produce 1140px even on a narrow phone screen
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'phone');
    expect(dims.width, 'phone ×3 must be 1140 px (not the on-screen ~342px×2)').toBe(1140);
  });

  test('768×1024 tablet downloads a 1140 px PNG', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoApp(page);
    await page
      .locator('#editorCardsList .card-editor-block')
      .first()
      .locator('[data-field="title"]')
      .fill('Tablet parity');
    const dims = await downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'tablet');
    expect(dims.width, 'tablet ×3 must be 1140 px (identical to phone + desktop)').toBe(1140);
  });

  test('no UI jump during export (visible card width unchanged)', async ({ page }) => {
    await gotoApp(page);
    const beforeWidth = await page
      .locator('#cardsArea .card')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    // Trigger export and immediately measure again mid-flight
    const dimsPromise = downloadPngAndReadDimensions(page, async () => {
      await page.locator('#cardsArea .card-wrapper').first().locator('[data-action="download"]').click();
    }, 'nojump');
    await dimsPromise;
    const afterWidth = await page
      .locator('#cardsArea .card')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(afterWidth - beforeWidth), 'visible card must not resize during export').toBeLessThan(1);
  });
});
