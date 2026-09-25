/**
 * export-controller.ts — PNG export + clipboard copy + batch download.
 *
 * Owns:
 *   - generateAndDownloadPng(node, filename) — single card PNG download
 *   - copyCardToClipboard(node) — clipboard copy with PNG fallback
 *   - downloadAllPng() — batch download all cards with progress + cancel
 *   - cancelExport() — abort a running batch export
 *
 * P-EXPORT-Q: every export path reads the current quality from StateManager
 *   (settings.exportQuality) and passes it to ExportManager. One setting
 *   governs single download, clipboard copy, and batch export.
 * P-EXPORT-CLEANUP: `.exporting` is toggled solely by withExportMode;
 *   `.exporting-busy` is toggled here in a try/finally so it's removed on
 *   success, error, and AbortError.
 * P-EXPORT-MEM: batch export runs sequentially (one card at a time) and never
 *   holds more than one data URL at once. ×4 failures surface a friendly
 *   Russian toast and leave the UI unblocked.
 */

import * as Export from '@/export/ExportManager';
import type { ExportQuality } from '@/core/types';
import type { OrchestratorContext } from './types';
import { withExportMode } from './export-mode';
import { Modal } from '@/ui/Modal';
import {
  buildCardPngFilename,
  buildCardsArchiveFilename,
  createZipArchive,
  type ZipEntry,
} from '@/export/ZipArchive';

export interface ExportController {
  generateAndDownloadPng(node: HTMLElement, filename: string): Promise<void>;
  copyCardToClipboard(node: HTMLElement): Promise<void>;
  openDownloadOptions(): void;
  downloadAllPng(): Promise<void>;
  downloadAllZip(): Promise<void>;
  cancelExport(): void;
  destroy(): void;
}

export function createExportController(ctx: OrchestratorContext): ExportController {
  const { root, stateManager, refs } = ctx;

  /** AbortController for the current batch export (null when idle). */
  let batchAbort: AbortController | null = null;
  const choiceModal = refs.exportChoiceModal
    ? new Modal(refs.exportChoiceModal, {
        closeSelector: '[data-modal-close]',
        closeOnBackdrop: true,
        closeOnEscape: true,
        initialFocusSelector: '#downloadZipBtn',
      })
    : null;

  function setChoiceBusy(busy: boolean, message = ''): void {
    if (refs.downloadZipBtn) refs.downloadZipBtn.disabled = busy;
    if (refs.downloadSeparateBtn) refs.downloadSeparateBtn.disabled = busy;
    if (refs.exportChoiceClose) refs.exportChoiceClose.disabled = busy;
    if (refs.exportChoiceCancel) refs.exportChoiceCancel.textContent = busy ? 'Отменить экспорт' : 'Отмена';
    if (refs.exportChoiceProgress) {
      refs.exportChoiceProgress.hidden = !busy && !message;
      refs.exportChoiceProgress.textContent = message;
    }
  }

  function updateProgress(message: string): void {
    setChoiceBusy(true, message);
    ctx.storage.showToast(message, 60_000);
  }

  function openDownloadOptions(): void {
    if (batchAbort) {
      ctx.storage.showToast('Экспорт уже идёт…');
      return;
    }
    setChoiceBusy(false);
    choiceModal?.open();
  }

  /** Current export quality from settings (read fresh on each call so a
   *  mid-batch change still applies to the next card). */
  function currentQuality(): ExportQuality {
    return stateManager.getExportQuality();
  }

  /** Translate an html-to-image / canvas error into a user-facing Russian
   *  message. ×4 is memory-heavy — guide the user to lower the quality. */
  function describeExportError(err: unknown, quality: ExportQuality): string {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return ''; // handled by the caller (cancel toast)
    }
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    // Canvas size limit / out-of-memory — most common ×4 failure on mobile
    if (
      msg.includes('canvas') ||
      msg.includes('memory') ||
      msg.includes('size') ||
      err instanceof TypeError
    ) {
      return quality === 'x4'
        ? 'Не хватает памяти для ×4. Выберите «Высокое ×3» и повторите.'
        : 'Не удалось сгенерировать PNG. Попробуйте более низкое качество.';
    }
    return 'Ошибка при экспорте карточки.';
  }

  /**
   * Render a single card node to PNG and trigger a browser download at the
   * current export quality. Surfaces success / failure toasts.
   */
  async function generateAndDownloadPng(node: HTMLElement, filename: string): Promise<void> {
    const quality = currentQuality();
    try {
      await withExportMode(root, () =>
        Export.downloadPng(node, filename, quality),
      );
      ctx.storage.showToast('Карточка успешно скачана!');
    } catch (err) {
      const msg = describeExportError(err, quality);
      if (msg) ctx.storage.showToast(msg, 3000, { priority: true });
    }
  }

  /**
   * Copy a card node's PNG to the clipboard at the current quality. Falls
   * back to downloading a PNG on insecure contexts (no Clipboard API), on
   * clipboard rejection, or on unexpected errors.
   */
  async function copyCardToClipboard(node: HTMLElement): Promise<void> {
    const quality = currentQuality();
    try {
      if (!window.isSecureContext) {
        ctx.storage.showToast('Копирование требует HTTPS. Скачиваю PNG вместо копирования…');
        await generateAndDownloadPng(node, 'card-copy.png');
        return;
      }
      const result = await withExportMode(root, () =>
        Export.copyToClipboard(node, quality),
      );
      if (result.success) {
        ctx.storage.showToast('Карточка скопирована в буфер!');
        return;
      }
      if (result.fallback) {
        ctx.storage.showToast('Буфер обмена недоступен. Скачиваю PNG…');
        await generateAndDownloadPng(node, 'card-copy.png');
      }
    } catch (err) {
      const msg = describeExportError(err, quality);
      if (msg) ctx.storage.showToast(msg, 3000, { priority: true });
      // Last-resort fallback: try a plain download
      try {
        await generateAndDownloadPng(node, 'card-copy.png');
      } catch {
        /* already toasted */
      }
    }
  }

  /**
   * Batch-download every card as card-<n>.png with a progress toast (60 s).
   * Blocks editing via UIState.isExporting + .exporting-busy on root, supports
   * cancel via AbortController, waits 250 ms between downloads to let the
   * browser flush each file. Sequential — never holds >1 data URL at once
   * (mobile memory safety). No-op (with toast) if a batch is already running.
   */
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
    // P-EXPORT-CLEANUP: block editing during export via UIState + CSS.
    // Removed in `finally` on success, error, and cancel.
    stateManager.setUI({ isExporting: true });
    root.classList.add('exporting-busy');

    let downloaded = 0;
    let firstErrorShown = false;
    try {
      updateProgress(`Подготовка карточки 0 из ${total}…`);
      for (let i = 0; i < total; i++) {
        if (abort.signal.aborted) break;
        const node = document.getElementById(`card-node-${cards[i].id}`);
        if (node) {
          // Read quality fresh per-card so a mid-batch change still applies.
          const quality = currentQuality();
          try {
            await withExportMode(root, () =>
              Export.downloadPng(node, buildCardPngFilename(i, total), quality, abort.signal),
            );
            downloaded++;
          } catch (err) {
            // AbortError → user cancelled; stop the loop.
            if (err instanceof DOMException && err.name === 'AbortError') break;
            // Other error (likely ×4 OOM) → show ONE friendly toast, then stop
            // the batch so the user isn't flooded with identical errors.
            if (!firstErrorShown) {
              firstErrorShown = true;
              const msg = describeExportError(err, quality);
              if (msg) ctx.storage.showToast(msg, 3000, { priority: true });
            }
            break;
          }
          if (abort.signal.aborted) break;
          updateProgress(`Скачано ${downloaded} из ${total}…`);
          // Let the browser flush the file before generating the next.
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      if (abort.signal.aborted && downloaded < total) {
        ctx.storage.showToast(
          `Экспорт отменён. Скачано ${downloaded} из ${total}.`,
          2500,
          { priority: true },
        );
      } else if (firstErrorShown) {
        // A non-abort error stopped the batch — completion toast already shown.
      } else {
        ctx.storage.showToast(`Готово! Скачано ${downloaded} из ${total} карточек.`, 2500, {
          priority: true,
        });
      }
    } finally {
      batchAbort = null;
      stateManager.setUI({ isExporting: false });
      root.classList.remove('exporting-busy');
      setChoiceBusy(false);
      choiceModal?.close();
    }
  }

  async function downloadAllZip(): Promise<void> {
    if (batchAbort) {
      ctx.storage.showToast('Экспорт уже идёт…');
      return;
    }
    const cards = stateManager.getCards();
    const total = cards.length;
    if (total === 0) {
      ctx.storage.showToast('Нет карточек для скачивания.', 2500, { priority: true });
      return;
    }

    const abort = new AbortController();
    batchAbort = abort;
    stateManager.setUI({ isExporting: true });
    root.classList.add('exporting-busy');

    try {
      const entries = async function* (): AsyncGenerator<ZipEntry> {
        for (let i = 0; i < total; i++) {
          if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          updateProgress(`Подготовка карточки ${i + 1} из ${total}…`);
          const node = document.getElementById(`card-node-${cards[i].id}`);
          if (!node) throw new Error(`Card node ${i + 1} is missing`);
          const blob = await Export.generateBlob(node, currentQuality(), abort.signal);
          if (!blob || blob.size === 0) throw new Error(`PNG ${i + 1} is empty`);
          yield { name: buildCardPngFilename(i, total), blob };
        }
      };

      const zipBlob = await withExportMode(root, async () => {
        const archive = await createZipArchive(
          entries(),
          abort.signal,
          () => updateProgress('Создание ZIP-архива…'),
        );
        return archive;
      });
      if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (zipBlob.size === 0) throw new Error('ZIP archive is empty');
      Export.downloadBlob(zipBlob, buildCardsArchiveFilename());
      ctx.storage.showToast(`Готово! ${total} карточек сохранены в ZIP.`, 3000, { priority: true });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        ctx.storage.showToast('Экспорт отменён.', 2500, { priority: true });
      } else {
        const message = describeExportError(error, currentQuality());
        ctx.storage.showToast(message || 'Не удалось создать ZIP-архив.', 3500, { priority: true });
      }
    } finally {
      batchAbort = null;
      stateManager.setUI({ isExporting: false });
      root.classList.remove('exporting-busy');
      setChoiceBusy(false);
      choiceModal?.close();
    }
  }

  /** Abort the running batch export (if any) — the downloadAllPng loop checks the signal between cards. */
  function cancelExport(): void {
    if (batchAbort) {
      batchAbort.abort();
    }
  }

  ctx.listeners.addEl(refs.downloadZipBtn, 'click', () => void downloadAllZip());
  ctx.listeners.addEl(refs.downloadSeparateBtn, 'click', () => void downloadAllPng());
  choiceModal?.onClose(() => {
    if (batchAbort) batchAbort.abort();
  });

  return {
    generateAndDownloadPng,
    copyCardToClipboard,
    openDownloadOptions,
    downloadAllPng,
    downloadAllZip,
    cancelExport,
    /** Abort any in-flight batch export and remove the .exporting-busy blocker class — call on app teardown. */
    destroy() {
      if (batchAbort) batchAbort.abort();
      choiceModal?.destroy();
      root.classList.remove('exporting-busy');
      root.classList.remove('exporting');
    },
  };
}
