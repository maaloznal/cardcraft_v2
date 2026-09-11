/**
 * card-ops.ts — card operations (add/delete/duplicate/move).
 *
 * Each operation:
 *   1. Dispatches the typed action via StateManager
 *   2. Re-renders editor + preview
 *   3. Pushes history + schedules save
 *   4. Toasts user feedback (except move — silent)
 *
 * Extracted from CardCraftApp.ts section 17 (lines 731-771).
 *
 * Public API:
 *   addCard()
 *   deleteCard(idx)
 *   duplicateCard(idx)
 *   moveCard(idx, dir)
 *   destroy() — no-op (stateless)
 */

import type { OrchestratorContext } from './types';

export interface CardOpsController {
  addCard(): void;
  deleteCard(idx: number): void;
  duplicateCard(idx: number): void;
  moveCard(idx: number, dir: number): void;
  destroy(): void;
}

export function createCardOpsController(ctx: OrchestratorContext): CardOpsController {
  const { stateManager, editorRenderer } = ctx;

  function addCard(): void {
    stateManager.dispatch({ type: 'ADD_CARD' });
    ctx.uiAppliers.renderEditor();
    ctx.uiAppliers.renderPreview();
    editorRenderer.collapseLastCard();
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
    ctx.storage.showToast('Карточка добавлена');
  }

  function deleteCard(idx: number): void {
    const cardCount = stateManager.getCardCount();
    if (cardCount <= 1) return;
    // Protect against NaN and invalid indices
    if (Number.isNaN(idx) || !Number.isFinite(idx)) return;
    if (idx < 0 || idx >= cardCount) return;
    stateManager.dispatch({ type: 'DELETE_CARD', payload: { idx } });
    ctx.uiAppliers.renderEditor();
    ctx.uiAppliers.renderPreview();
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
    ctx.storage.showToast('Карточка удалена');
  }

  function duplicateCard(idx: number): void {
    stateManager.dispatch({ type: 'DUPLICATE_CARD', payload: { idx } });
    ctx.uiAppliers.renderEditor();
    ctx.uiAppliers.renderPreview();
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
    ctx.storage.showToast('Карточка дублирована');
  }

  function moveCard(idx: number, dir: number): void {
    stateManager.dispatch({ type: 'MOVE_CARD', payload: { idx, dir } });
    ctx.uiAppliers.renderEditor();
    ctx.uiAppliers.renderPreview();
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
  }

  return {
    addCard,
    deleteCard,
    duplicateCard,
    moveCard,
    destroy() {
      /* stateless */
    },
  };
}
