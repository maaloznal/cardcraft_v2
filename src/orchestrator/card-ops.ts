/**
 * card-ops.ts — card operations (add/delete/duplicate/move).
 *
 * P1-2..P1-5: each operation now uses O(1) DOM updates (insertCard /
 *   removeCard / moveCard) on BOTH editor and preview renderers, instead
 *   of full rebuild. Progress bars + card numbers are updated in O(n)
 *   via updateProgressBars() (still much cheaper than full render()).
 *
 * Each operation:
 *   1. Dispatches the typed action via StateManager
 *   2. O(1) DOM update on editor + preview (O(n) for progress/tags)
 *   3. Pushes history + schedules save
 *   4. Toasts user feedback (except move — silent)
 *
 * Public API:
 *   addCard()
 *   deleteCard(idx)
 *   duplicateCard(idx)
 *   moveCard(idx, dir)
 *   destroy() — no-op (stateless)
 */

import type { OrchestratorContext } from './types';
import type { PreviewSettings } from '@/preview/PreviewRenderer';

export interface CardOpsController {
  addCard(): void;
  deleteCard(idx: number): void;
  duplicateCard(idx: number): void;
  moveCard(idx: number, dir: number): void;
  destroy(): void;
}

export function createCardOpsController(ctx: OrchestratorContext): CardOpsController {
  const { stateManager, editorRenderer, previewRenderer, uiAppliers } = ctx;

  /** Build PreviewSettings from current state (for updateProgressBars / insertCard) */
  function previewSettings(): PreviewSettings {
    const s = stateManager.getSettings();
    return {
      theme: s.theme,
      format: s.format,
      progressBarStyle: s.progressBarStyle,
      showCardNumbers: s.showCardNumbers,
      showProgressBar: s.showProgressBar,
    };
  }

  /** O(n) update of progress bars + card number tags after structural change */
  function updateProgressAndTags(): void {
    previewRenderer.updateProgressBars(stateManager.getCards(), previewSettings());
  }

  function addCard(): void {
    stateManager.dispatch({ type: 'ADD_CARD' });
    const cards = stateManager.getCards();
    const newCard = cards[cards.length - 1];
    const total = cards.length;
    // P1-2: O(1) insertion on editor + preview instead of full rebuild
    editorRenderer.insertCard(newCard, total - 1, total);
    previewRenderer.insertCard(newCard, total - 1, total, previewSettings());
    // Progress bars + tags need reindex (O(n), but no DOM rebuild)
    updateProgressAndTags();
    uiAppliers.updateCardCountBadge();
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
    const cardId = stateManager.getCard(idx)?.id;
    stateManager.dispatch({ type: 'DELETE_CARD', payload: { idx } });
    // P1-3: O(1) removal on editor + preview
    editorRenderer.removeCard(idx);
    if (cardId) previewRenderer.removeCard(cardId);
    // Progress bars + tags need reindex (O(n))
    updateProgressAndTags();
    uiAppliers.updateCardCountBadge();
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
    ctx.storage.showToast('Карточка удалена');
  }

  function duplicateCard(idx: number): void {
    stateManager.dispatch({ type: 'DUPLICATE_CARD', payload: { idx } });
    const cards = stateManager.getCards();
    const copy = cards[idx + 1];
    const total = cards.length;
    if (copy) {
      // P1-4: O(1) insertion after original on editor + preview
      editorRenderer.insertCard(copy, idx + 1, total);
      previewRenderer.insertCard(copy, idx + 1, total, previewSettings());
    }
    updateProgressAndTags();
    uiAppliers.updateCardCountBadge();
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
    ctx.storage.showToast('Карточка дублирована');
  }

  function moveCard(idx: number, dir: number): void {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= stateManager.getCardCount()) return;
    stateManager.dispatch({ type: 'MOVE_CARD', payload: { idx, dir } });
    // P1-5: O(1) DOM swap on editor + preview (no full rebuild)
    editorRenderer.moveCard(idx, newIdx);
    // Preview: swap wrapper positions by index
    const previewWrappers = document.querySelectorAll<HTMLElement>('#cardsArea > .card-wrapper');
    const a = previewWrappers[idx];
    const b = previewWrappers[newIdx];
    if (a && b) {
      if (idx < newIdx) {
        b.parentElement?.insertBefore(b, a);
      } else {
        b.parentElement?.insertBefore(a, b);
      }
    }
    // Progress bars + tags need reindex (positions changed)
    updateProgressAndTags();
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
