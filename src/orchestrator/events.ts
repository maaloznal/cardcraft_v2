/**
 * events.ts — split bindStatic into 9 focused bind* functions (P2-2).
 *
 * Each bind* function:
 *   - Takes the OrchestratorContext
 *   - Registers event listeners via ctx.listeners.addEl / addDoc (so
 *     cleanup is centralized in ctx.listeners.destroy())
 *   - Returns void (cleanup is handled centrally)
 *
 * bindAll(ctx) calls all 9 + returns a composite cleanup function.
 *
 * The 9 functions:
 *   - bindTopbarEvents()    — theme select, format select, char limit
 *                             toggle, gradient angle, numbering, progress
 *                             bar, list style
 *   - bindSidebarEvents()   — add card, save all, delete all + confirm
 *                             dialog, undo/redo, sidebar toggle, backdrop,
 *                             beforeunload save
 *   - bindEditorEvents()    — no-op (editor events handled by
 *                             editorRenderer.onAction in callbacks.ts)
 *   - bindPreviewEvents()   — no-op (preview events handled by
 *                             previewRenderer.onAction in callbacks.ts)
 *   - bindModalEvents()     — color picker rows, color inputs, reset
 *                             single color, color swatches, section format
 *                             buttons, section size sliders, reset all,
 *                             list num size slider
 *   - bindPopupEvents()     — word popup close-on-outside-click
 *   - bindExportEvents()    — no-op (export via preview callbacks)
 *   - bindKeyboardEvents()  — delegates to ctx.keyboard.bind()
 *   - bindResizeEvents()    — no-op (VerticalResize/HorizontalResize have
 *                             own destroy())
 *
 * Extracted from CardCraftApp.ts section 22 (lines 907-1258).
 */

import { MODAL_FIELDS } from '@/core/constants';
import type { OrchestratorContext } from './types';

/* ─── bindTopbarEvents ───────────────────────────────────────── */

export function bindTopbarEvents(ctx: OrchestratorContext): void {
  const { refs, stateManager, uiAppliers, charLimit, storage, history, previewRenderer } = ctx;

  // Theme select change (hidden native select — driven by custom dropdown)
  // P1-7: global theme change → O(n) updateCardTheme loop (not full rebuild)
  // P1-8: pushHistory so undo restores the previous theme
  ctx.listeners.addEl(refs.themeSelect, 'change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    stateManager.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: value } });
    // O(n) theme update — re-apply data-theme attr on each card node
    const globalTheme = stateManager.getTheme();
    stateManager.getCards().forEach((card) => previewRenderer.updateCardTheme(card, globalTheme));
    storage.scheduleSave({ silent: true });
    history.pushHistory();
  });

  // Format select change
  // P1-8: pushHistory so undo restores the previous format
  ctx.listeners.addEl(refs.formatSelect, 'change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    stateManager.dispatch({ type: 'SET_FORMAT', payload: { format: value } });
    charLimit.applyCharLimit();
    uiAppliers.renderPreview();
    storage.scheduleSave({ silent: true });
    history.pushHistory();
  });

  // Char limit toggle
  // P1-8: pushHistory so undo restores char-limit state
  ctx.listeners.addEl(refs.charLimitToggle, 'change', (e) => {
    stateManager.dispatch({
      type: 'SET_CHAR_LIMIT',
      payload: { enabled: (e.target as HTMLInputElement).checked },
    });
    charLimit.applyCharLimit();
    charLimit.updateCharCounter(0);
    storage.scheduleSave({ silent: true });
    history.pushHistory();
  });

  // Gradient angle slider — debounced history (rapid slider movement)
  // P1-8: now captured in snapshot; P3 note: no save (preserves old behavior)
  ctx.listeners.addEl(refs.gradientAngleSlider, 'input', (e) => {
    const angle = Number((e.target as HTMLInputElement).value);
    stateManager.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: { angle } });
    history.scheduleHistoryPush();
  });

  // Numbering toggle
  // P1-8: pushHistory so undo restores numbering visibility
  ctx.listeners.addEl(refs.numberingToggle, 'change', (e) => {
    stateManager.dispatch({
      type: 'SET_SHOW_CARD_NUMBERS',
      payload: { show: (e.target as HTMLInputElement).checked },
    });
    // O(n) update tags + progress bars (not full rebuild)
    previewRenderer.updateProgressBars(stateManager.getCards(), {
      theme: stateManager.getTheme(),
      format: stateManager.getFormat(),
      progressBarStyle: stateManager.getSettings().progressBarStyle,
      showCardNumbers: stateManager.getSettings().showCardNumbers,
      showProgressBar: stateManager.getSettings().showProgressBar,
    });
    storage.scheduleSave({ silent: true });
    history.pushHistory();
  });

  // Progress bar toggle
  // P1-8: pushHistory so undo restores progress bar visibility
  ctx.listeners.addEl(refs.progressBarToggle, 'change', (e) => {
    stateManager.dispatch({
      type: 'SET_SHOW_PROGRESS_BAR',
      payload: { show: (e.target as HTMLInputElement).checked },
    });
    // Visibility is applied via CSS class by state-subscriber (O(1))
    storage.scheduleSave({ silent: true });
    history.pushHistory();
  });

  // Progress bar style select
  // P1-6: use updateProgressBars() (O(n)) instead of full renderPreview() rebuild
  // P1-8: pushHistory so undo restores the previous progress style
  ctx.listeners.addEl(refs.progressBarStyleSelect, 'change', (e) => {
    stateManager.dispatch({
      type: 'SET_PROGRESS_BAR_STYLE',
      payload: { style: (e.target as HTMLSelectElement).value },
    });
    previewRenderer.updateProgressBars(stateManager.getCards(), {
      theme: stateManager.getTheme(),
      format: stateManager.getFormat(),
      progressBarStyle: stateManager.getSettings().progressBarStyle,
      showCardNumbers: stateManager.getSettings().showCardNumbers,
      showProgressBar: stateManager.getSettings().showProgressBar,
    });
    storage.scheduleSave({ silent: true });
    history.pushHistory();
  });

  // List style select
  // P1-8: pushHistory so undo restores list style
  ctx.listeners.addEl(refs.listStyleSelect, 'change', (e) => {
    stateManager.dispatch({
      type: 'SET_LIST_STYLE',
      payload: { style: (e.target as HTMLSelectElement).value },
    });
    storage.scheduleSave({ silent: true });
    history.pushHistory();
  });
}

/* ─── bindSidebarEvents ──────────────────────────────────────── */

export function bindSidebarEvents(ctx: OrchestratorContext): void {
  const { refs, stateManager, uiAppliers, history, sidebar, cardOps, exporter, storage } = ctx;

  // Sidebar buttons
  ctx.listeners.addEl(refs.addCardBtn, 'click', () => cardOps.addCard());
  ctx.listeners.addEl(refs.saveAllBtn, 'click', () => void exporter.downloadAllPng());

  // Delete all — with confirm flow
  ctx.listeners.addEl(refs.deleteAllBtn, 'click', () => {
    if (stateManager.getCardCount() <= 1) {
      storage.showToast('Нельзя удалить единственную карточку');
      return;
    }
    refs.confirmOverlay?.classList.add('active');
    stateManager.setUI({ confirmDialogOpen: true });
  });
  ctx.listeners.addEl(refs.confirmCancel, 'click', () => {
    refs.confirmOverlay?.classList.remove('active');
    stateManager.setUI({ confirmDialogOpen: false });
  });
  ctx.listeners.addEl(refs.confirmOverlay, 'click', (e) => {
    if (e.target === refs.confirmOverlay) {
      refs.confirmOverlay?.classList.remove('active');
      stateManager.setUI({ confirmDialogOpen: false });
    }
  });
  ctx.listeners.addEl(refs.confirmOk, 'click', () => {
    refs.confirmOverlay?.classList.remove('active');
    stateManager.setUI({ confirmDialogOpen: false });
    stateManager.dispatch({ type: 'CLEAR_ALL' });
    uiAppliers.renderEditor();
    uiAppliers.renderPreview();
    history.pushHistory();
    storage.scheduleSave({ silent: true });
    storage.showToast('Все карточки удалены');
  });

  // Undo / Redo
  ctx.listeners.addEl(refs.undoBtn, 'click', () => history.undo());
  ctx.listeners.addEl(refs.redoBtn, 'click', () => history.redo());

  // Sidebar toggle
  ctx.listeners.addEl(refs.toggleSidebarBtn, 'click', () => {
    const open = refs.editorSidebar?.classList.contains('collapsed');
    sidebar.setSidebarOpen(!!open);
  });
  ctx.listeners.addEl(refs.sidebarBackdrop, 'click', () => sidebar.setSidebarOpen(false));

  // Save on unload (synchronous, no debounce)
  window.addEventListener('beforeunload', storage.saveOnUnload);
}

/* ─── bindEditorEvents ───────────────────────────────────────── */

export function bindEditorEvents(_ctx: OrchestratorContext): void {
  // No-op — editor events are delegated to editorRenderer.onAction
  // (wired in callbacks.ts via wireRendererCallbacks).
  void _ctx;
}

/* ─── bindPreviewEvents ──────────────────────────────────────── */

export function bindPreviewEvents(_ctx: OrchestratorContext): void {
  // No-op — preview events are delegated to previewRenderer.onAction
  // (wired in callbacks.ts via wireRendererCallbacks).
  void _ctx;
}

/* ─── bindModalEvents ────────────────────────────────────────── */

export function bindModalEvents(ctx: OrchestratorContext): void {
  const { root, refs, stateManager, previewRenderer, uiState, modal, history, storage } = ctx;

  // List num size slider — DO push history
  ctx.listeners.addEl(refs.listNumSizeSlider, 'input', (e) => {
    const size = Number((e.target as HTMLInputElement).value);
    if (refs.listNumSizeValue) refs.listNumSizeValue.textContent = `${size}px`;
    if (uiState.activeCardIndexForColors !== null) {
      // P1-1: dispatch granular SET_CARD_COLOR_FIELD instead of mutating card.colors
      stateManager.dispatch({
        type: 'SET_CARD_COLOR_FIELD',
        payload: {
          idx: uiState.activeCardIndexForColors,
          field: 'listNumSize',
          value: String(size),
        },
      });
      const card = stateManager.getCard(uiState.activeCardIndexForColors);
      if (card) previewRenderer.updateCardField(card, 'listNumSize', uiState.activeCardIndexForColors);
      history.scheduleHistoryPush();
      storage.scheduleSave({ silent: true });
    }
  });

  // Color picker rows — select active field
  root.querySelectorAll<HTMLElement>('.color-picker-row').forEach((row) => {
    ctx.listeners.addEl(row, 'click', (e) => {
      if ((e.target as HTMLElement).closest('.btn-reset-single')) return;
      const f = row.dataset.rowField;
      if (f) modal.selectRowField(f);
    });
  });

  // Color inputs
  MODAL_FIELDS.forEach((f) => {
    const input = refs.$<HTMLInputElement>(`#col-${f.key}`);
    const hexText = refs.$<HTMLElement>(`#hex-${f.key}`);
    ctx.listeners.addEl(input, 'input', (e) => {
      if (uiState.activeCardIndexForColors === null) return;
      const value = (e.target as HTMLInputElement).value;
      // P1-1: dispatch granular SET_CARD_COLOR_FIELD instead of mutating card.colors
      stateManager.dispatch({
        type: 'SET_CARD_COLOR_FIELD',
        payload: { idx: uiState.activeCardIndexForColors, field: f.key, value },
      });
      if (hexText) {
        hexText.textContent = value;
        hexText.classList.remove('is-auto');
      }
      modal.selectRowField(f.key);
      const card = stateManager.getCard(uiState.activeCardIndexForColors);
      if (card) previewRenderer.updateCardStyle(card, f.key, uiState.activeCardIndexForColors);
      history.scheduleHistoryPush();
      storage.scheduleSave({ silent: true });
    });
  });

  // Reset single color
  root.querySelectorAll<HTMLElement>('[data-reset]').forEach((btn) => {
    ctx.listeners.addEl(btn, 'click', (e) => {
      e.stopPropagation();
      const f = btn.dataset.reset || '';
      if (uiState.activeCardIndexForColors === null) return;
      // P1-1: dispatch DELETE_CARD_COLOR_FIELD instead of `delete card.colors[f]`
      stateManager.dispatch({
        type: 'DELETE_CARD_COLOR_FIELD',
        payload: { idx: uiState.activeCardIndexForColors, field: f },
      });
      const hexText = refs.$<HTMLElement>(`#hex-${f}`);
      const input = refs.$<HTMLInputElement>(`#col-${f}`);
      if (input) input.value = '';
      if (hexText) {
        hexText.textContent = '';
        hexText.classList.add('is-auto');
      }
      modal.selectRowField(f);
      const card = stateManager.getCard(uiState.activeCardIndexForColors);
      if (card) previewRenderer.updateCardStyle(card, f, uiState.activeCardIndexForColors);
      history.scheduleHistoryPush();
      storage.scheduleSave({ silent: true });
    });
  });

  // Color swatches + presets (non-popup)
  root.querySelectorAll<HTMLElement>('.color-swatch, .color-preset[data-color]').forEach((sw) => {
    if (sw.classList.contains('color-preset') && refs.wordStylePopup?.contains(sw)) return;
    ctx.listeners.addEl(sw, 'click', () => {
      if (uiState.activeCardIndexForColors === null) return;
      const hex = sw.dataset.preset || sw.dataset.color || '';
      const f = uiState.lastActiveField || 'title';
      // P1-1: dispatch granular SET_CARD_COLOR_FIELD instead of mutating card.colors
      stateManager.dispatch({
        type: 'SET_CARD_COLOR_FIELD',
        payload: { idx: uiState.activeCardIndexForColors, field: f, value: hex },
      });
      const input = refs.$<HTMLInputElement>(`#col-${f}`);
      const hexText = refs.$<HTMLElement>(`#hex-${f}`);
      if (input) input.value = hex;
      if (hexText) {
        hexText.textContent = hex;
        hexText.classList.remove('is-auto');
      }
      modal.selectRowField(f);
      const card = stateManager.getCard(uiState.activeCardIndexForColors);
      if (card) previewRenderer.updateCardStyle(card, f, uiState.activeCardIndexForColors);
      history.scheduleHistoryPush();
      storage.scheduleSave({ silent: true });
    });
  });

  // Section format buttons — DO push history
  root.querySelectorAll<HTMLElement>('.format-btn-section').forEach((btn) => {
    ctx.listeners.addEl(btn, 'click', (e) => {
      e.stopPropagation();
      const field = btn.dataset.field || '';
      const fmt = btn.dataset.format || '';
      if (uiState.activeCardIndexForColors === null) return;
      const card = stateManager.getCard(uiState.activeCardIndexForColors);
      if (!card) return;
      const idx = uiState.activeCardIndexForColors;
      // P1-1: dispatch granular SET_SECTION_STYLE_FIELD instead of mutating card.sectionStyles
      const currentStyles = card.sectionStyles[field] ?? {};
      if (fmt === 'bold') {
        const next = currentStyles.fontWeight === 'bold' ? undefined : 'bold';
        stateManager.dispatch({
          type: 'SET_SECTION_STYLE_FIELD',
          payload: { idx, field, property: 'fontWeight', value: next },
        });
        btn.classList.toggle('active', next === 'bold');
      } else if (fmt === 'italic') {
        const next = currentStyles.fontStyle === 'italic' ? undefined : 'italic';
        stateManager.dispatch({
          type: 'SET_SECTION_STYLE_FIELD',
          payload: { idx, field, property: 'fontStyle', value: next },
        });
        btn.classList.toggle('active', next === 'italic');
      } else if (fmt === 'underline' || fmt === 'strikethrough') {
        const token = fmt === 'underline' ? 'underline' : 'line-through';
        const d = currentStyles.textDecoration || '';
        const has = d.includes(token);
        const next = has ? d.replace(token, '').trim() : (d + ' ' + token).trim();
        stateManager.dispatch({
          type: 'SET_SECTION_STYLE_FIELD',
          payload: { idx, field, property: 'textDecoration', value: next || undefined },
        });
        btn.classList.toggle('active', !has);
      }
      const updated = stateManager.getCard(idx);
      if (updated) previewRenderer.updateCardStyle(updated, field, idx);
      storage.scheduleSave({ silent: true });
      history.scheduleHistoryPush();
    });
  });

  // Section size sliders — DO push history
  root.querySelectorAll<HTMLInputElement>('.size-slider-section').forEach((sl) => {
    ctx.listeners.addEl(sl, 'input', (e) => {
      e.stopPropagation();
      const field = sl.dataset.field || '';
      const size = Number(sl.value);
      if (uiState.activeCardIndexForColors === null) return;
      // P1-1: dispatch SET_SECTION_FONT_SIZE instead of mutating card.sectionStyles[field].fontSize
      stateManager.dispatch({
        type: 'SET_SECTION_FONT_SIZE',
        payload: { idx: uiState.activeCardIndexForColors, field, size },
      });
      const sv = refs.$<HTMLElement>(`.size-value-section[data-field="${field}"]`);
      if (sv) sv.textContent = `${size}px`;
      const card = stateManager.getCard(uiState.activeCardIndexForColors);
      if (card) previewRenderer.updateCardStyle(card, field, uiState.activeCardIndexForColors);
      history.scheduleHistoryPush();
      storage.scheduleSave({ silent: true });
    });
  });

  // Reset all card colors + section styles
  ctx.listeners.addEl(refs.resetCardColorsBtn, 'click', () => {
    if (uiState.activeCardIndexForColors === null) return;
    // P1-1: single atomic RESET_CARD_STYLES dispatch replaces the old
    // `card.colors = {}; card.sectionStyles = {};` direct mutation + two dispatches.
    stateManager.dispatch({
      type: 'RESET_CARD_STYLES',
      payload: { idx: uiState.activeCardIndexForColors },
    });
    MODAL_FIELDS.forEach((f) => {
      const hexText = refs.$<HTMLElement>(`#hex-${f.key}`);
      const input = refs.$<HTMLInputElement>(`#col-${f.key}`);
      if (hexText) {
        hexText.textContent = 'АВТО';
        hexText.classList.add('is-auto');
      }
      if (input) input.value = '#000000';
      root
        .querySelectorAll<HTMLElement>(`.format-btn-section[data-field="${f.key}"]`)
        .forEach((b) => b.classList.remove('active'));
      const sl = refs.$<HTMLInputElement>(`.size-slider-section[data-field="${f.key}"]`);
      const sv = refs.$<HTMLElement>(`.size-value-section[data-field="${f.key}"]`);
      if (sl && sv) {
        sl.value = String(f.defaultSize);
        sv.textContent = `${f.defaultSize}px`;
      }
    });
    const updated = stateManager.getCard(uiState.activeCardIndexForColors);
    if (updated) {
      MODAL_FIELDS.forEach((f) =>
        previewRenderer.updateCardStyle(updated, f.key, uiState.activeCardIndexForColors!),
      );
    }
    history.pushHistory();
    storage.scheduleSave({ silent: true });
    storage.showToast('Все кастомные цвета и стили карточки сброшены');
  });
}

/* ─── bindPopupEvents ────────────────────────────────────────── */

export function bindPopupEvents(ctx: OrchestratorContext): void {
  const { refs } = ctx;

  // Document-level click: close word popup (5-condition check)
  // Note: theme dropdown click-outside handled by Dropdown class
  ctx.listeners.addDoc('click', (e) => {
    const t = e.target as HTMLElement;
    if (!refs.wordStylePopup?.classList.contains('active')) return;
    if (refs.wordStylePopup.contains(t)) return;
    if (refs.editorSidebar?.contains(t)) return;
    if (refs.colorModal?.contains(t)) return;
    if (t.closest('.cc-styled-word')) return;
    if (t.closest('input, textarea, select, button')) return;
    ctx.wordPopup.closeWordStylePopup();
  });
}

/* ─── bindExportEvents ───────────────────────────────────────── */

export function bindExportEvents(_ctx: OrchestratorContext): void {
  // No-op — export is initiated via previewRenderer.onAction 'download'/'copy'
  // (wired in callbacks.ts) + saveAllBtn 'click' (wired in bindSidebarEvents).
  void _ctx;
}

/* ─── bindKeyboardEvents ─────────────────────────────────────── */

export function bindKeyboardEvents(ctx: OrchestratorContext): void {
  // Delegate to keyboard-controller — handler logic + Escape priority lives there.
  ctx.keyboard.bind();
}

/* ─── bindResizeEvents ───────────────────────────────────────── */

export function bindResizeEvents(_ctx: OrchestratorContext): void {
  // No-op — VerticalResize + HorizontalResize instances are constructed in
  // CardCraftApp.ts and have their own destroy() methods called during cleanup.
  // They register their own pointerdown listeners internally.
  void _ctx;
}

/* ─── bindAll — composite entry point ────────────────────────── */

export function bindAll(ctx: OrchestratorContext): () => void {
  bindTopbarEvents(ctx);
  bindSidebarEvents(ctx);
  bindEditorEvents(ctx);
  bindPreviewEvents(ctx);
  bindModalEvents(ctx);
  bindPopupEvents(ctx);
  bindExportEvents(ctx);
  bindKeyboardEvents(ctx);
  bindResizeEvents(ctx);
  // Composite cleanup: remove all tracked listeners + the beforeunload handler.
  return () => {
    ctx.listeners.destroy();
    window.removeEventListener('beforeunload', ctx.storage.saveOnUnload);
  };
}
