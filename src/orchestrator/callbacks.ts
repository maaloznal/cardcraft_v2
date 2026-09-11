/**
 * callbacks.ts — wires renderer callbacks to controller methods.
 *
 * These are the "composition root" wirings: PreviewRenderer / EditorRenderer
 * / WordEditorManager emit action callbacks; this module routes them to the
 * appropriate controller methods (cardOps, modal, wordPopup, exporter,
 * charLimit, history, storage, uiAppliers).
 *
 * Modal/Dropdown primitive callbacks (onOpen/onClose/onSelect) are wired
 * inside their respective controllers (modal-controller, theme-controller),
 * not here — those are 1:1 controller→primitive relationships.
 *
 * Extracted from CardCraftApp.ts sections 11-13 (lines 466-573).
 *
 * Public API:
 *   wireRendererCallbacks(ctx) — register all renderer callbacks
 */

import type { Card } from '@/core/types';
import { pruneOrphanWordStyles } from '@/styles/StyleHelpers';
import { splitOnce } from '@/core/utils';
import type { OrchestratorContext } from './types';

export function wireRendererCallbacks(ctx: OrchestratorContext): void {
  const { stateManager, previewRenderer, editorRenderer, wordEditorManager, uiState } = ctx;

  /* ---------- Preview renderer callbacks ---------- */
  previewRenderer.onAction((action, data) => {
    if (action === 'download') {
      const node = document.getElementById(String(data.cardId));
      if (node) void ctx.exporter.generateAndDownloadPng(node, String(data.filename || 'card.png'));
    } else if (action === 'copy') {
      const node = document.getElementById(String(data.cardId));
      if (node) void ctx.exporter.copyCardToClipboard(node);
    } else if (action === 'delete-preview') {
      // P1-1: resolve index from stable cardId (format: "card-node-<id>")
      const cardId = String(data.cardId || '').replace(/^card-node-/, '');
      const idx = stateManager.getCards().findIndex((c) => c.id === cardId);
      if (idx >= 0) ctx.cardOps.deleteCard(idx);
    } else if (action === 'dblclick') {
      const text = String(data.text || '');
      const field = String(data.field || '');
      // P1-1: resolve index from stable cardId
      const cardId = String(data.cardId || '').replace(/^card-node-/, '');
      const cardIndex = stateManager.getCards().findIndex((c) => c.id === cardId);
      if (text.length > 0 && cardIndex >= 0) {
        ctx.wordPopup.openWordStylePopup(
          Number(data.x),
          Number(data.y),
          text,
          field,
          cardIndex,
        );
      }
    }
  });

  /* ---------- Editor renderer callbacks ---------- */
  editorRenderer.onAction((action, data) => {
    if (action === 'input' || action === 'paste') {
      const idx = Number(data.index);
      const field = String(data.field) as keyof Card;
      const value = String(data.value);
      const card = stateManager.getCard(idx);
      if (!card) return;
      // P1-1: dispatch typed UPDATE_CARD_FIELD instead of direct mutation.
      // The state subscriber does NOT re-render preview/editor on card-content
      // changes (only on settings changes), so O(1) typing responsiveness is
      // preserved. The direct DOM update via previewRenderer.updateCardField
      // still happens below.
      stateManager.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx, field, value } });
      const updated = stateManager.getCard(idx);
      if (!updated) return;
      const changed = pruneOrphanWordStyles(updated);
      // pruneOrphanWordStyles may have removed keys — sync back to state if changed
      if (changed) {
        stateManager.dispatch({
          type: 'SET_CARD_WORD_STYLES',
          payload: { idx, wordStyles: { ...updated.wordStyles } },
        });
      }
      const finalCard = stateManager.getCard(idx)!;
      previewRenderer.updateCardField(finalCard, field, idx);
      ctx.charLimit.updateCharCounter(idx);
      if (changed && uiState.activeCardIndexForWord === idx && uiState.activeFieldForWord === field) {
        wordEditorManager.renderWordStyleList(finalCard);
      }
      ctx.storage.scheduleSave({ silent: true });
      ctx.history.scheduleHistoryPush();
    } else if (action === 'palette') {
      ctx.modal.openColorModal(Number(data.index));
    } else if (action === 'delete') {
      ctx.cardOps.deleteCard(Number(data.index));
    } else if (action === 'duplicate') {
      ctx.cardOps.duplicateCard(Number(data.index));
    } else if (action === 'move') {
      ctx.cardOps.moveCard(Number(data.index), Number(data.dir));
    } else if (action === 'focus') {
      ctx.charLimit.updateCharCounter(Number(data.index));
    }
  });

  /* ---------- Word editor callbacks ---------- */
  wordEditorManager.onStyleChange((cardIndex, field, word, styles) => {
    const card = stateManager.getCard(cardIndex);
    if (!card) return;
    const key = `${field}::${word}`;
    const newWordStyles = { ...(card.wordStyles || {}), [key]: styles };
    stateManager.dispatch({
      type: 'SET_CARD_WORD_STYLES',
      payload: { idx: cardIndex, wordStyles: newWordStyles },
    });
    const updated = stateManager.getCard(cardIndex);
    if (updated) {
      previewRenderer.updateCardStyle(updated, field, cardIndex);
      wordEditorManager.renderWordStyleList(updated);
    }
    ctx.storage.scheduleSave({ silent: true });
    ctx.history.scheduleHistoryPush();
  });

  wordEditorManager.onRemoveWord((cardIndex, key) => {
    stateManager.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx: cardIndex, key } });
    const updated = stateManager.getCard(cardIndex);
    if (!updated) return;
    const [field] = splitOnce(key, '::');
    if (field) previewRenderer.updateCardStyle(updated, field, cardIndex);
    else ctx.uiAppliers.renderPreview();
    wordEditorManager.renderWordStyleList(updated);
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
  });

  wordEditorManager.onClear((cardIndex, field, word) => {
    const key = `${field}::${word}`;
    stateManager.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx: cardIndex, key } });
    const updated = stateManager.getCard(cardIndex);
    if (updated) {
      previewRenderer.updateCardStyle(updated, field, cardIndex);
      wordEditorManager.renderWordStyleList(updated);
    }
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
    ctx.storage.showToast('Стиль слова сброшен');
  });
}
