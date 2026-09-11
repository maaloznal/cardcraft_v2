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
      // Priority: themeDropdown → modalCardThemeDropdown → wordStylePopup → colorModal → confirmOverlay
      if (refs.themeDropdown?.classList.contains('open')) {
        themeDropdownController.close();
      } else if (refs.modalCardThemeDropdown?.classList.contains('open')) {
        modalCardThemeDropdownController.close();
      } else if (refs.wordStylePopup?.classList.contains('active')) {
        ctx.wordPopup.closeWordStylePopup();
      } else if (refs.colorModal?.classList.contains('active')) {
        ctx.modal.closeColorModal();
      } else if (refs.confirmOverlay?.classList.contains('active')) {
        // confirmOverlay focus trap handles its own Escape
      }
    }
    // P5: ArrowUp/ArrowDown to move cards when a card editor header is focused
    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      const active = document.activeElement as HTMLElement | null;
      // Only trigger when focus is inside a card-editor-header (not inside inputs)
      const inHeader = active?.closest('.card-editor-header');
      if (inHeader) {
        e.preventDefault();
        const block = active?.closest('.card-editor-block') as HTMLElement | null;
        if (!block) return;
        const blocks = Array.from(
          document.querySelectorAll<HTMLElement>('#editorCardsList .card-editor-block'),
        );
        const idx = blocks.indexOf(block);
        if (idx === -1) return;
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= blocks.length) return;
        ctx.cardOps.moveCard(idx, dir);
        // Re-focus the same logical position (now at newIdx) after DOM swap
        requestAnimationFrame(() => {
          const newBlocks = Array.from(
            document.querySelectorAll<HTMLElement>('#editorCardsList .card-editor-block'),
          );
          newBlocks[newIdx]?.querySelector<HTMLElement>('.card-editor-header')?.focus();
        });
        return;
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
    /** Register the keydown handler on document via ctx.listeners (auto-cleaned on teardown). */
    bind() {
      ctx.listeners.addDoc('keydown', handleKeyDown);
    },
    /** No-op — the keydown listener is tracked + removed by ctx.listeners.destroy(). */
    destroy() {
      /* listener is tracked + cleaned up by ctx.listeners.destroy() */
    },
  };
}
