/**
 * export-controller.ts — PNG export + clipboard copy + batch download.
 *
 * Owns:
 *   - generateAndDownloadPng(node, filename) — single card PNG download
 *   - copyCardToClipboard(node) — clipboard copy with PNG fallback
 *   - downloadAllPng() — batch download all cards with progress + cancel
 *   - cancelExport() — abort a running batch export
 *
 * P3-2: html-to-image is lazy-loaded (dynamic import in ExportManager).
 * P3-3: batch export sets isExporting in UIState (blocks editing via CSS),
 *       shows progress, supports cancel via AbortController, and uses
 *       priority toasts for errors/completion so they aren't blocked by
 *       the long progress toast.
 *
 * Public API:
 *   generateAndDownloadPng(node, filename)
 *   copyCardToClipboard(node)
 *   downloadAllPng()
 *   cancelExport()
 *   destroy() — cancels any in-flight export
 */

import * as Export from '@/export/ExportManager';
import type { OrchestratorContext } from './types';
import { withExportMode } from './export-mode';

export interface ExportController {
  generateAndDownloadPng(node: HTMLElement, filename: string): Promise<void>;
  copyCardToClipboard(node: HTMLElement): Promise<void>;
  downloadAllPng(): Promise<void>;
  cancelExport(): void;
  destroy(): void;
}

export function createExportController(ctx: OrchestratorContext): ExportController {
  const { root, stateManager } = ctx;

  /** AbortController for the current batch export (null when idle). */
  let batchAbort: AbortController | null = null;

  async function generateAndDownloadPng(node: HTMLElement, filename: string): Promise<void> {
    try {
      await withExportMode(root, node, (n) => Export.downloadPng(n, filename, root));
      ctx.storage.showToast('Карточка успешно скачана!');
    } catch {
      ctx.storage.showToast('Ошибка при скачивании', 2500, { priority: true });
    }
  }

  async function copyCardToClipboard(node: HTMLElement): Promise<void> {
    try {
      if (!window.isSecureContext) {
        ctx.storage.showToast('Копирование требует HTTPS. Скачиваю PNG вместо копирования…');
        await generateAndDownloadPng(node, 'card-copy.png');
        return;
      }
      const result = await withExportMode(root, node, (n) => Export.copyToClipboard(n, root));
      if (result.success) {
        ctx.storage.showToast('Карточка скопирована в буфер!');
        return;
      }
      if (result.fallback) {
        ctx.storage.showToast('Буфер обмена недоступен. Скачиваю PNG…');
        await generateAndDownloadPng(node, 'card-copy.png');
      }
    } catch {
      ctx.storage.showToast('Копирование не удалось. Скачиваю PNG…', 2500, { priority: true });
      try {
        await generateAndDownloadPng(node, 'card-copy.png');
      } catch {
        /* already toasted */
      }
    }
  }

  async function downloadAllPng(): Promise<void> {
    // Prevent overlapping batch exports
    if (batchAbort) {
      ctx.storage.showToast('Экспорт уже идёт…');
      return;
    }
    const cards = stateManager.getCards();
    const total = cards.length;
    const abort = new AbortController();
    batchAbort = abort;
    // P3-3: block editing during export via UIState + CSS
    stateManager.setUI({ isExporting: true });
    root.classList.add('exporting-busy');

    let downloaded = 0;
    try {
      ctx.storage.showToast(`Генерация PNG: 0 из ${total}...`, 60000);
      for (let i = 0; i < total; i++) {
        if (abort.signal.aborted) break;
        const node = document.getElementById(`card-node-${cards[i].id}`);
        if (node) {
          try {
            await withExportMode(root, node, (n) =>
              Export.downloadPng(n, `card-${i + 1}.png`, root, abort.signal),
            );
            downloaded++;
          } catch (err) {
            // AbortError → user cancelled; other errors → skip card
            if (err instanceof DOMException && err.name === 'AbortError') break;
            /* ignore — continue batch */
          }
          if (abort.signal.aborted) break;
          ctx.storage.showToast(`Скачано ${downloaded} из ${total}...`, 60000);
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      if (abort.signal.aborted && downloaded < total) {
        ctx.storage.showToast(
          `Экспорт отменён. Скачано ${downloaded} из ${total}.`,
          2500,
          { priority: true },
        );
      } else {
        ctx.storage.showToast(`Готово! Скачано ${downloaded} из ${total} карточек.`, 2500, {
          priority: true,
        });
      }
    } finally {
      batchAbort = null;
      stateManager.setUI({ isExporting: false });
      root.classList.remove('exporting-busy');
    }
  }

  function cancelExport(): void {
    if (batchAbort) {
      batchAbort.abort();
    }
  }

  return {
    generateAndDownloadPng,
    copyCardToClipboard,
    downloadAllPng,
    cancelExport,
    destroy() {
      // Cancel any in-flight export on teardown
      if (batchAbort) batchAbort.abort();
      root.classList.remove('exporting-busy');
    },
  };
}
