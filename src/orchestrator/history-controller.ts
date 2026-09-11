/**
 * history-controller.ts — undo/redo + history push scheduling.
 *
 * Owns:
 *   - pushHistory() — immediate snapshot + update undo/redo buttons
 *   - scheduleHistoryPush() — debounced snapshot (merges rapid changes)
 *   - restore(snapshot) — apply snapshot, re-render, close modal/popup,
 *     reset stale active indices
 *   - undo() / redo() — pop/push + restore + toast
 *   - updateUndoRedoButtons() — disable undo/redo buttons at stack ends
 *
 * Extracted from CardCraftApp.ts section 18 (lines 773-814).
 *
 * Public API:
 *   pushHistory()
 *   scheduleHistoryPush()
 *   restore(snapshot)
 *   undo()
 *   redo()
 *   updateUndoRedoButtons()
 *   destroy() — no-op (historyManager.clear() called separately)
 */

import type { Snapshot } from '@/core/types';
import type { OrchestratorContext } from './types';

export interface HistoryController {
  pushHistory(): void;
  scheduleHistoryPush(): void;
  restore(s: Snapshot): void;
  undo(): void;
  redo(): void;
  updateUndoRedoButtons(): void;
  destroy(): void;
}

export function createHistoryController(ctx: OrchestratorContext): HistoryController {
  const { stateManager, historyManager, refs, uiState } = ctx;

  function updateUndoRedoButtons(): void {
    if (refs.undoBtn) refs.undoBtn.disabled = !historyManager.canUndo;
    if (refs.redoBtn) refs.redoBtn.disabled = !historyManager.canRedo;
  }

  function pushHistory(): void {
    historyManager.push(stateManager.snapshot());
    updateUndoRedoButtons();
  }

  function scheduleHistoryPush(): void {
    historyManager.schedulePush(stateManager.snapshot());
  }

  function restore(s: Snapshot): void {
    stateManager.restore(s);
    ctx.uiAppliers.renderEditor();
    ctx.uiAppliers.renderPreview();
    ctx.storage.scheduleSave({ silent: true });
    updateUndoRedoButtons();
    // Close modal and word popup, reset stale active indices
    ctx.modal.closeColorModal();
    ctx.wordPopup.closeWordStylePopup();
    uiState.activeCardIndexForColors = null;
    uiState.activeCardIndexForWord = null;
    uiState.lastActiveField = 'title';
  }

  function undo(): void {
    const snap = historyManager.undo();
    if (!snap) return;
    restore(snap);
    ctx.storage.showToast('Действие отменено');
  }

  function redo(): void {
    const snap = historyManager.redo();
    if (!snap) return;
    restore(snap);
    ctx.storage.showToast('Действие повторено');
  }

  return {
    pushHistory,
    scheduleHistoryPush,
    restore,
    undo,
    redo,
    updateUndoRedoButtons,
    destroy() {
      /* historyManager.clear() is called separately by CardCraftApp.cleanup. */
    },
  };
}
