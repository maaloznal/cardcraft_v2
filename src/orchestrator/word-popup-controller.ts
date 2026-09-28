/**
 * word-popup-controller.ts — word-style popup open/close.
 *
 * Owns:
 *   - openWordStylePopup(x, y, text, field, cardIndex) — set UI state,
 *     read existing word styles, open the WordEditorManager popup
 *   - closeWordStylePopup() — close popup + reset UI state
 *
 * Extracted from CardCraftApp.ts section 16 (lines 706-729).
 *
 * Public API:
 *   openWordStylePopup(x, y, selectedText, field, cardIndex)
 *   closeWordStylePopup()
 *   destroy() — no-op (wordEditorManager.destroy() called separately)
 */

import type { OrchestratorContext } from './types';

export interface WordPopupController {
  openWordStylePopup(
    x: number,
    y: number,
    selectedText: string,
    field: string,
    cardIndex: number,
  ): void;
  closeWordStylePopup(): void;
  destroy(): void;
}

export function createWordPopupController(ctx: OrchestratorContext): WordPopupController {
  const { stateManager, wordEditorManager, uiState } = ctx;

  function openWordStylePopup(
    x: number,
    y: number,
    selectedText: string,
    field: string,
    cardIndex: number,
  ): void {
    uiState.activeFieldForWord = field;
    uiState.activeCardIndexForWord = cardIndex;
    stateManager.setUI({ wordPopupOpen: true });
    const card = stateManager.getCard(cardIndex);
    if (!card) return;
    const key = `${field}::${selectedText}`;
    const existing = card.wordStyles?.[key];
    wordEditorManager.open(x, y, selectedText, field, cardIndex, existing);
  }

  function closeWordStylePopup(): void {
    wordEditorManager.close();
    uiState.activeFieldForWord = null;
    uiState.activeCardIndexForWord = null;
    stateManager.setUI({ wordPopupOpen: false });
  }

  return {
    openWordStylePopup,
    closeWordStylePopup,
    destroy() {
      /* wordEditorManager.destroy() is called separately by CardCraftApp.cleanup. */
    },
  };
}
