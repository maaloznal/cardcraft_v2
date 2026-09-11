/**
 * keyboard-controller.ts — Escape priority + Ctrl shortcuts.
 *
 * Owns:
 *   - handleKeyDown(e) — Escape closes overlays in priority order
 *     (themeDropdown → modalCardThemeDropdown → wordStylePopup → colorModal);
 *     Ctrl+S saves; Ctrl+Z undo; Ctrl+Y or Ctrl+Shift+Z redo.
 *   - bind(ctx) — register the keydown handler on document via ctx.listeners
 *     (so cleanup happens automatically via ctx.listeners.destroy()).
 *
 * Extracted from CardCraftApp.ts section 22's keydown handler (lines 1226-1254).
 *
 * Public API:
 *   bind()
 *   destroy() — no-op (listener is tracked by ctx.listeners)
 */

import type { OrchestratorContext } from './types';

export interface KeyboardController {
  bind(): void;
  destroy(): void;
}

export function createKeyboardController(ctx: OrchestratorContext): KeyboardController {
  const { refs, themeDropdownController, modalCardThemeDropdownController } = ctx;

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      // P3-3: if a batch export is running, Escape cancels it first
      if (ctx.stateManager.getUI().isExporting) {
        ctx.exporter.cancelExport();
        return;
      }
      // Priority: themeDropdown → modalCardThemeDropdown → wordStylePopup → colorModal
      if (refs.themeDropdown?.classList.contains('open')) {
        themeDropdownController.close();
      } else if (refs.modalCardThemeDropdown?.classList.contains('open')) {
        modalCardThemeDropdownController.close();
      } else if (refs.wordStylePopup?.classList.contains('active')) {
        ctx.wordPopup.closeWordStylePopup();
      } else if (refs.colorModal?.classList.contains('active')) {
        ctx.modal.closeColorModal();
      }
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      ctx.storage.saveCardsToLocalStorage({ silent: false });
    } else if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      ctx.history.undo();
    } else if (mod && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      ctx.history.redo();
    } else if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      ctx.history.redo();
    }
  }

  return {
    bind() {
      ctx.listeners.addDoc('keydown', handleKeyDown);
    },
    destroy() {
      /* listener is tracked + cleaned up by ctx.listeners.destroy() */
    },
  };
}
