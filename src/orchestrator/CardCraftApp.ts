/**
 * CardCraftApp — main orchestrator that wires up all modular classes.
 *
 * Public API:
 *   initCardCraftApp(root)  — boot the app, returns cleanup function
 *   THEME_GROUPS            — re-export for page.tsx static rendering
 *
 * Architecture:
 *   User event → renderer callback → orchestrator dispatches action
 *   → StateManager notifies subscribers → UI controls synced (ui-appliers)
 *   → PreviewRenderer / EditorRenderer / WordEditorManager update DOM
 *   → StorageManager.save (debounced, save-load.ts) + HistoryManager.schedulePush (debounced)
 *
 * Extracted modules:
 *   - save-load.ts         — localStorage persistence + initial load
 *   - ui-appliers.ts       — sync DOM controls to state (idempotent)
 *   - export-controller.ts — PNG download, clipboard copy, batch export
 *   - keyboard-controller.ts — Ctrl+Z/Y/S, Escape priority, doc click
 *   - context.ts           — shared context interface for controllers
 *   - toast.ts             — ToastQueue
 *   - resizers.ts          — VerticalResize, HorizontalResize
 *   - export-mode.ts       — withExportMode helper
 */
'use client';

import { StateManager } from '@/state/StateManager';
import type { AppState } from '@/state/StateManager';
import { HistoryManager } from '@/history/HistoryManager';
import { PreviewRenderer, type PreviewSettings } from '@/preview/PreviewRenderer';
import { EditorRenderer } from '@/editor/EditorRenderer';
import { WordEditorManager } from '@/word-editor/WordEditorManager';
import * as Theme from '@/themes/ThemeManager';
import { findOrphanWordStyleKeys } from '@/styles/StyleHelpers';
import { SidebarAccordion, ModalAccordion } from '@/ui/Accordion';
import { Modal } from '@/ui/Modal';
import { Dropdown } from '@/ui/Dropdown';
import type { Card, Snapshot } from '@/core/types';
import { MODAL_FIELDS } from '@/core/constants';
import { splitOnce } from '@/core/utils';
import { ToastQueue } from './toast';
import { VerticalResize, HorizontalResize } from './resizers';
import type { OrchestratorContext, DomRefs, OrchestratorState, ListenerTracker } from './context';
import { scheduleSave, saveNow, loadFromLocalStorage, clearSaveTimer } from './save-load';
import {
  applyThemeToWorkspace,
  applyGradientAngle,
  applyNumberingVisibility,
  applyProgressBarVisibility,
  applyProgressBarStyle,
  applyListStyle,
  applyCharLimit,
  updateCharCounter,
  updateCardCountBadge,
  updateUndoRedoButtons,
} from './ui-appliers';
import { generateAndDownloadPng, copyCardToClipboard, downloadAllPng } from './export-controller';
import { bindKeyboardAndDocHandlers, createSaveOnUnload } from './keyboard-controller';

// Re-export theme data for page.tsx static rendering
export { THEME_GROUPS } from '@/themes/themeData';

// ─── Main entry point ──────────────────────────────────────────

export function initCardCraftApp(root: HTMLElement): () => void {
  /* ---------- 1. Error traps ---------- */
  const errorHandler = (e: ErrorEvent): void => {
    console.error('[Cardcraft] Runtime error:', e.message, e.filename + ':' + e.lineno);
  };
  const unhandledRejection = (e: PromiseRejectionEvent): void => {
    console.error('[Cardcraft] Unhandled promise rejection:', e.reason);
  };
  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', unhandledRejection);

  /* ---------- 2. Helpers ---------- */
  function guard<T>(label: string, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (err) {
      console.error('[Cardcraft] Error in ' + label + ':', err);
      return undefined;
    }
  }

  const perfEnabled = typeof performance !== 'undefined' && !!performance.now;
  function perfMark(label: string): () => void {
    if (!perfEnabled) return () => {};
    const start = performance.now();
    return () => {
      const dur = performance.now() - start;
      if (dur > 16) {
        console.warn('[Cardcraft:perf] Slow ' + label + ': ' + dur.toFixed(1) + 'ms');
      }
    };
  }

  /* ---------- 3. DOM element cache ---------- */
  const $ = <T extends Element = HTMLElement>(sel: string): T | null =>
    root.querySelector<T>(sel);

  const dom: DomRefs = {
    root,
    editorSidebar: $<HTMLElement>('#editorSidebar'),
    toggleSidebarBtn: $<HTMLButtonElement>('#toggleSidebarBtn'),
    sidebarBackdrop: $<HTMLElement>('#sidebarBackdrop'),
    editorCardsList: $<HTMLElement>('#editorCardsList'),
    cardsArea: $<HTMLElement>('#cardsArea'),
    themeSelect: $<HTMLSelectElement>('#themeSelect'),
    formatSelect: $<HTMLSelectElement>('#formatSelect'),
    themeDropdown: $<HTMLElement>('#themeDropdown'),
    themeDropdownTrigger: $<HTMLButtonElement>('#themeDropdownTrigger'),
    themeDropdownLabel: $<HTMLElement>('#themeDropdownLabel'),
    gradientAngleSlider: $<HTMLInputElement>('#gradientAngleSlider'),
    gradientAngleValue: $<HTMLElement>('#gradientAngleValue'),
    numberingToggle: $<HTMLInputElement>('#numberingToggle'),
    progressBarToggle: $<HTMLInputElement>('#progressBarToggle'),
    progressBarStyleSelect: $<HTMLSelectElement>('#progressBarStyleSelect'),
    listStyleSelect: $<HTMLSelectElement>('#listStyleSelect'),
    charLimitToggle: $<HTMLInputElement>('#charLimitToggle'),
    charCounter: $<HTMLElement>('#charCounter'),
    charCounterText: $<HTMLElement>('#charCounterText'),
    listNumSizeSlider: $<HTMLInputElement>('#listNumSizeSlider'),
    listNumSizeValue: $<HTMLElement>('#listNumSizeValue'),
    resizeDividerH: $<HTMLElement>('#resizeDividerH'),
    resizeDividerV: $<HTMLElement>('#resizeDividerV'),
    previewWorkspace: $<HTMLElement>('#previewWorkspace'),
    toastEl: $<HTMLElement>('#toast'),
    colorModal: $<HTMLElement>('#colorModal'),
    resetCardColorsBtn: $<HTMLButtonElement>('#resetCardColorsBtn'),
    modalCardTitle: $<HTMLElement>('#modalCardTitle'),
    modalCardThemeDropdown: $<HTMLElement>('#modalCardThemeDropdown'),
    modalCardThemeLabel: $<HTMLElement>('#modalCardThemeLabel'),
    wordStylePopup: $<HTMLElement>('#wordStylePopup'),
    wordPopupHeader: $<HTMLElement>('#wordPopupHeader'),
    sizeSlider: $<HTMLInputElement>('#sizeSlider'),
    sizeValue: $<HTMLElement>('#sizeValue'),
    wordStyleList: $<HTMLElement>('#wordStyleList'),
    addCardBtn: $<HTMLButtonElement>('#addCardBtn'),
    saveAllBtn: $<HTMLButtonElement>('#saveAll'),
    clearAllTextBtn: $<HTMLButtonElement>('#clearAllTextBtn'),
    deleteAllBtn: $<HTMLButtonElement>('#deleteAllBtn'),
    confirmOverlay: $<HTMLElement>('#confirmOverlay'),
    confirmOk: $<HTMLButtonElement>('#confirmOk'),
    confirmCancel: $<HTMLButtonElement>('#confirmCancel'),
    undoBtn: $<HTMLButtonElement>('#undoBtn'),
    redoBtn: $<HTMLButtonElement>('#redoBtn'),
    themeToggleBtn: $<HTMLButtonElement>('#themeToggleBtn'),
    cardCountBadge: $<HTMLElement>('#cardCountBadge'),
  };

  /* ---------- 4. State variables (orchestrator-local) ---------- */
  const state: OrchestratorState = {
    activeCardIndexForColors: null,
    lastActiveField: 'title',
    sidebarWasCollapsedBeforeModal: true,
    activeCardIndexForWord: null,
    activeFieldForWord: null,
  };

  // Tracked listeners for cleanup
  const docListeners: Array<{ type: string; fn: EventListener }> = [];
  const elementListeners: Array<{
    el: EventTarget;
    type: string;
    fn: EventListener;
    opts?: boolean | AddEventListenerOptions;
  }> = [];

  function addEl<K extends keyof HTMLElementEventMap>(
    el: EventTarget | null | undefined,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    opts?: boolean | AddEventListenerOptions,
  ): void {
    if (!el) return;
    const listener = fn as EventListener;
    el.addEventListener(type, listener, opts);
    elementListeners.push({ el, type: type as string, fn: listener, opts });
  }

  function addDoc<K extends keyof DocumentEventMap>(
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
  ): void {
    const listener = fn as EventListener;
    document.addEventListener(type, listener);
    docListeners.push({ type: type as string, fn: listener });
  }

  const listeners: ListenerTracker = { docListeners, elementListeners, addEl, addDoc };

  /* ---------- 5. Module instantiation ---------- */
  const stateManager = new StateManager();
  const historyManager = new HistoryManager<Snapshot>();
  const previewRenderer = new PreviewRenderer(dom.cardsArea!);
  const editorRenderer = new EditorRenderer(dom.editorCardsList!);
  const wordEditorManager = new WordEditorManager(
    dom.wordStylePopup!,
    dom.wordPopupHeader!,
    dom.sizeSlider!,
    dom.sizeValue!,
    dom.wordStyleList!,
  );
  const toastQueue = new ToastQueue(dom.toastEl!);

  // Accordion controllers (defaults: initial='none' — matches old behavior)
  const sidebarAccordion = new SidebarAccordion(root, {
    initial: 'none',
    onChange: () => autoAdjustHeaderHeight(),
  });
  const modalAccordion = new ModalAccordion(dom.colorModal!, { initial: 'none' });

  // Modal controller — ESC handled centrally, so disable auto-ESC
  const colorModalController = new Modal(dom.colorModal!, {
    closeOnEscape: false,
    closeOnBackdrop: true,
    closeSelector: '#closeModalBtn, #applyColorsBtn',
    initialFocusSelector: '#closeModalBtn',
  });

  // Theme dropdown controllers
  const themeDropdownController = new Dropdown(dom.themeDropdown!, {
    triggerSelector: '.theme-dropdown-trigger',
    menuSelector: '.theme-dropdown-panel',
    itemSelector: '.theme-item',
    closeOnEscape: false,
    closeOnClickOutside: true,
  });
  const modalCardThemeDropdownController = new Dropdown(dom.modalCardThemeDropdown!, {
    triggerSelector: '.theme-dropdown-trigger',
    menuSelector: '.theme-dropdown-panel',
    itemSelector: '.modal-card-theme-item',
    closeOnEscape: false,
    closeOnClickOutside: true,
  });

  // Resize handlers
  const verticalResize = new VerticalResize(dom.resizeDividerH!, dom.editorSidebar!);
  const horizontalResize = new HorizontalResize(dom.resizeDividerV!, dom.editorSidebar!);

  /* ---------- 6. Toast ---------- */
  function showToast(msg: string, duration = 2500): void {
    toastQueue.show(msg, duration);
  }

  /* ---------- 7. Rendering wrappers ---------- */
  function renderPreview(): void {
    const end = perfMark('renderPreview');
    try {
      const settings = stateManager.getSettings();
      const previewSettings: PreviewSettings = {
        theme: settings.theme,
        format: settings.format,
        progressBarStyle: settings.progressBarStyle,
        showCardNumbers: settings.showCardNumbers,
        showProgressBar: settings.showProgressBar,
      };
      previewRenderer.render(stateManager.getCards(), previewSettings);
      updateCardCountBadge(ctx);
    } catch (err) {
      console.error('[Cardcraft] Error in renderPreview:', err);
    } finally {
      end();
    }
  }

  function renderEditor(): void {
    try {
      editorRenderer.render(stateManager.getCards());
    } catch (err) {
      console.error('[Cardcraft] Error in renderEditor:', err);
    }
  }

  /* ---------- 8. History helpers ---------- */
  function pushHistory(): void {
    historyManager.push(stateManager.snapshot());
    updateUndoRedoButtons(ctx);
  }

  function scheduleHistoryPush(): void {
    historyManager.schedulePush(stateManager.snapshot());
  }

  /* ---------- 9. Modal / Word popup ---------- */
  function closeColorModal(): void {
    colorModalController.close();
  }

  function closeWordStylePopup(): void {
    wordEditorManager.close();
    state.activeFieldForWord = null;
    state.activeCardIndexForWord = null;
  }

  function closeAllOverlaysOnCardMutation(): void {
    if (colorModalController.isOpen) {
      colorModalController.close();
    }
    if (wordEditorManager.isOpen) {
      closeWordStylePopup();
    }
    state.activeCardIndexForColors = null;
    state.activeCardIndexForWord = null;
    state.activeFieldForWord = null;
  }

  function openColorModal(index: number): void {
    state.activeCardIndexForColors = index;
    if (dom.modalCardTitle) dom.modalCardTitle.textContent = `Стили · Карточка ${index + 1}`;

    // Capture sidebar state before opening (don't change it)
    state.sidebarWasCollapsedBeforeModal = dom.editorSidebar?.classList.contains('collapsed') ?? true;

    const card = stateManager.getCard(index);
    if (!card) return;
    const currentColors = card.colors || {};
    const currentSectionStyles = card.sectionStyles || {};

    MODAL_FIELDS.forEach((f) => {
      const input = $<HTMLInputElement>(`#col-${f.key}`);
      const hexText = $<HTMLElement>(`#hex-${f.key}`);
      if (currentColors[f.key]) {
        if (input) input.value = currentColors[f.key];
        if (hexText) {
          hexText.textContent = currentColors[f.key];
          hexText.classList.remove('is-auto');
        }
      } else {
        if (input) input.value = '#000000';
        if (hexText) {
          hexText.textContent = 'АВТО';
          hexText.classList.add('is-auto');
        }
      }
      if (!f.hasStyleControls) return;
      const formatBtns = root.querySelectorAll<HTMLElement>(
        `.format-btn-section[data-field="${f.key}"]`,
      );
      const sl = $<HTMLInputElement>(`.size-slider-section[data-field="${f.key}"]`);
      const sv = $<HTMLElement>(`.size-value-section[data-field="${f.key}"]`);
      const styles = currentSectionStyles[f.key];
      formatBtns.forEach((btn) => {
        const fmt = btn.dataset.format;
        btn.classList.remove('active');
        if (!styles) return;
        if (fmt === 'bold' && styles.fontWeight === 'bold') btn.classList.add('active');
        else if (fmt === 'italic' && styles.fontStyle === 'italic') btn.classList.add('active');
        else if (fmt === 'underline' && styles.textDecoration?.includes('underline'))
          btn.classList.add('active');
        else if (fmt === 'strikethrough' && styles.textDecoration?.includes('line-through'))
          btn.classList.add('active');
      });
      if (sl && sv) {
        const sz = styles?.fontSize ?? f.defaultSize;
        sl.value = String(sz);
        sv.textContent = `${sz}px`;
      }
    });

    selectRowField('title');

    // Sync per-card theme dropdown
    const cardThemeVal = card.theme && card.theme !== 'default' ? card.theme : 'default';
    if (dom.modalCardThemeLabel) {
      dom.modalCardThemeLabel.textContent =
        cardThemeVal === 'default' ? 'По умолчанию' : Theme.getThemeLabel(cardThemeVal);
    }
    dom.modalCardThemeDropdown?.querySelectorAll<HTMLElement>('.modal-card-theme-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.modalCardTheme === cardThemeVal);
    });

    // Sync listNumSize slider
    const savedNumSize = card.colors?.listNumSize;
    if (dom.listNumSizeSlider) dom.listNumSizeSlider.value = String(savedNumSize || 22);
    if (dom.listNumSizeValue) dom.listNumSizeValue.textContent = `${savedNumSize || 22}px`;

    colorModalController.open();
  }

  function openWordStylePopup(
    x: number,
    y: number,
    selectedText: string,
    field: string,
    cardIndex: number,
  ): void {
    state.activeFieldForWord = field;
    state.activeCardIndexForWord = cardIndex;
    const card = stateManager.getCard(cardIndex);
    if (!card) return;
    const key = `${field}::${selectedText}`;
    const existing = card.wordStyles?.[key];
    wordEditorManager.open(x, y, selectedText, field, cardIndex, existing);
  }

  function selectRowField(field: string): void {
    state.lastActiveField = field;
    root.querySelectorAll<HTMLElement>('.color-picker-row').forEach((row) => {
      row.classList.toggle('active', row.dataset.rowField === field);
    });
    const label = $<HTMLElement>('#presetTargetLabel');
    if (label) {
      const cfg = MODAL_FIELDS.find((f) => f.key === field);
      label.textContent = cfg?.label || field;
    }
    // Sync swatch active state
    const card = state.activeCardIndexForColors !== null ? stateManager.getCard(state.activeCardIndexForColors) : null;
    const currentColor = card?.colors?.[field];
    root.querySelectorAll<HTMLElement>('.color-swatch, .color-preset[data-color]').forEach((sw) => {
      if (sw.classList.contains('color-preset') && dom.wordStylePopup?.contains(sw)) return;
      const swatchColor = sw.dataset.preset || sw.dataset.color || '';
      sw.classList.toggle('active', currentColor === swatchColor);
    });
  }

  /* ---------- 10. Card operations ---------- */
  function addCard(): void {
    stateManager.dispatch({ type: 'ADD_CARD' });
    renderEditor();
    renderPreview();
    editorRenderer.collapseLastCard();
    pushHistory();
    scheduleSave(ctx, { silent: true });
    showToast('Карточка добавлена');
  }

  function deleteCard(idx: number): void {
    if (!Number.isInteger(idx) || idx < 0 || idx >= stateManager.getCardCount()) return;
    if (stateManager.getCardCount() <= 1) return;
    closeAllOverlaysOnCardMutation();
    stateManager.dispatch({ type: 'DELETE_CARD', payload: idx });
    renderEditor();
    renderPreview();
    pushHistory();
    scheduleSave(ctx, { silent: true });
    showToast('Карточка удалена');
  }

  function duplicateCard(idx: number): void {
    stateManager.dispatch({ type: 'DUPLICATE_CARD', payload: idx });
    renderEditor();
    renderPreview();
    pushHistory();
    scheduleSave(ctx, { silent: true });
    showToast('Карточка дублирована');
  }

  function moveCard(idx: number, dir: number): void {
    stateManager.dispatch({ type: 'MOVE_CARD', payload: { idx, dir } });
    renderEditor();
    renderPreview();
    pushHistory();
    scheduleSave(ctx, { silent: true });
  }

  function restore(s: Snapshot): void {
    closeAllOverlaysOnCardMutation();
    stateManager.restore(s);
    renderEditor();
    renderPreview();
    scheduleSave(ctx, { silent: true });
    updateUndoRedoButtons(ctx);
  }

  function undo(): void {
    const snap = historyManager.undo();
    if (!snap) return;
    restore(snap);
    showToast('Действие отменено');
  }

  function redo(): void {
    const snap = historyManager.redo();
    if (!snap) return;
    restore(snap);
    showToast('Действие повторено');
  }

  /* ---------- 11. Sidebar ---------- */
  function setSidebarOpen(open: boolean): void {
    if (!dom.editorSidebar) return;
    if (open) {
      dom.editorSidebar.classList.remove('collapsed');
      root.classList.add('sidebar-open');
    } else {
      dom.editorSidebar.classList.add('collapsed');
      root.classList.remove('sidebar-open');
    }
  }

  /* ---------- 11b. UI Theme (light / dark / auto) ---------- */
  const UI_THEME_KEY = 'cardcraft-ui-theme';
  type UiTheme = 'light' | 'dark' | 'auto';
  // Cycle: light → dark → auto → light
  function toggleUiTheme(): void {
    const current = (root.getAttribute('data-ui-theme') as UiTheme) || 'auto';
    const next: UiTheme = current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light';
    applyUiTheme(next);
  }
  function applyUiTheme(theme: UiTheme): void {
    root.setAttribute('data-ui-theme', theme);
    try { localStorage.setItem(UI_THEME_KEY, theme); } catch { /* ignore */ }
    // Update button title
    const btn = dom.themeToggleBtn;
    if (btn) {
      const labels: Record<UiTheme, string> = {
        light: 'Светлая тема (сейчас: светлая)',
        dark: 'Тёмная тема (сейчас: тёмная)',
        auto: 'Авто тема (по системе)',
      };
      btn.title = labels[theme];
      btn.setAttribute('aria-label', labels[theme]);
    }
  }
  function loadUiTheme(): void {
    let theme: UiTheme = 'auto';
    try {
      const saved = localStorage.getItem(UI_THEME_KEY) as UiTheme | null;
      if (saved === 'light' || saved === 'dark' || saved === 'auto') theme = saved;
    } catch { /* ignore */ }
    applyUiTheme(theme);
  }

  /* ---------- 11c. Auto-adjust sidebar header height ----------
     When sidebar accordions expand/collapse, automatically adjust
     .sidebar-fixed-header height so all expanded content is visible.
     When accordion collapses, shrink header so card fields get maximum space. */
  function autoAdjustHeaderHeight(): void {
    if (!dom.editorSidebar) return;
    const fixedHeader = dom.editorSidebar.querySelector<HTMLElement>('.sidebar-fixed-header');
    if (!fixedHeader) return;
    // Reset to auto first so scrollHeight measures actual content,
    // not the previously-set fixed height (scrollHeight = max(content, client))
    fixedHeader.style.height = 'auto';
    fixedHeader.style.flex = '';
    // Force reflow then measure natural content height
    const naturalHeight = fixedHeader.offsetHeight;
    const sidebarHeight = dom.editorSidebar.getBoundingClientRect().height;
    // Max allowed: sidebar height minus minimum scroll area (120px for card fields)
    const maxHeight = sidebarHeight - 120;
    // New height: natural content height, capped at maxHeight, min 60px
    const newHeight = Math.min(Math.max(naturalHeight, 60), maxHeight);
    fixedHeader.style.height = `${newHeight}px`;
    fixedHeader.style.flex = 'none';
  }

  /* ---------- 12. Build context ---------- */
  const ctx: OrchestratorContext = {
    dom,
    state,
    stateManager,
    historyManager,
    previewRenderer,
    editorRenderer,
    wordEditorManager,
    toastQueue,
    listeners,
    showToast,
    scheduleSave: (opts) => scheduleSave(ctx, opts),
    saveNow: (opts) => saveNow(ctx, opts),
    pushHistory,
    scheduleHistoryPush,
    renderPreview,
    renderEditor,
    closeColorModal,
    closeWordStylePopup,
    closeAllOverlaysOnCardMutation,
    undo,
    redo,
    updateUndoRedoButtons: () => updateUndoRedoButtons(ctx),
    setSidebarOpen,
  };

  /* ---------- 13. State subscriber (sync UI controls, NO re-render) ---------- */
  const unsubscribeState = stateManager.subscribe((appState: AppState) => {
    // Sync selects/toggles/sliders (idempotent — only update if differs)
    if (dom.themeSelect && dom.themeSelect.value !== appState.settings.theme) {
      dom.themeSelect.value = appState.settings.theme;
    }
    if (dom.formatSelect && dom.formatSelect.value !== appState.settings.format) {
      dom.formatSelect.value = appState.settings.format;
    }
    if (dom.gradientAngleSlider && dom.gradientAngleSlider.value !== String(appState.settings.gradientAngle)) {
      dom.gradientAngleSlider.value = String(appState.settings.gradientAngle);
    }
    if (dom.gradientAngleValue) dom.gradientAngleValue.textContent = `${appState.settings.gradientAngle}°`;
    if (dom.numberingToggle && dom.numberingToggle.checked !== appState.settings.showCardNumbers) {
      dom.numberingToggle.checked = appState.settings.showCardNumbers;
    }
    if (dom.progressBarToggle && dom.progressBarToggle.checked !== appState.settings.showProgressBar) {
      dom.progressBarToggle.checked = appState.settings.showProgressBar;
    }
    if (dom.progressBarStyleSelect && dom.progressBarStyleSelect.value !== appState.settings.progressBarStyle) {
      dom.progressBarStyleSelect.value = appState.settings.progressBarStyle;
    }
    if (dom.listStyleSelect && dom.listStyleSelect.value !== appState.settings.listStyleType) {
      dom.listStyleSelect.value = appState.settings.listStyleType;
    }
    if (dom.charLimitToggle && dom.charLimitToggle.checked !== appState.settings.charLimitEnabled) {
      dom.charLimitToggle.checked = appState.settings.charLimitEnabled;
    }
    // Apply CSS state
    applyThemeToWorkspace(ctx);
    applyGradientAngle(ctx);
    applyNumberingVisibility(ctx);
    applyProgressBarVisibility(ctx);
    applyProgressBarStyle(ctx);
    applyListStyle(ctx);
    applyCharLimit(ctx);
    updateUndoRedoButtons(ctx);
  });

  /* ---------- 14. Preview renderer callbacks ---------- */
  previewRenderer.onAction((action, data) => {
    if (action === 'download') {
      const node = document.getElementById(String(data.cardId));
      if (node) void generateAndDownloadPng(ctx, node, String(data.filename || 'card.png'));
    } else if (action === 'copy') {
      const node = document.getElementById(String(data.cardId));
      if (node) void copyCardToClipboard(ctx, node);
    } else if (action === 'delete-preview') {
      deleteCard(Number(data.index));
    } else if (action === 'dblclick') {
      const text = String(data.text || '');
      const field = String(data.field || '');
      const cardIndex = Number(data.cardIndex);
      if (text.length > 0) {
        openWordStylePopup(Number(data.x), Number(data.y), text, field, cardIndex);
      }
    }
  });

  /* ---------- 15. Editor renderer callbacks ---------- */
  editorRenderer.onAction((action, data) => {
    if (action === 'input' || action === 'paste') {
      const idx = Number(data.index);
      const field = String(data.field);
      const value = String(data.value);
      stateManager.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx, field: field as keyof Card, value } });
      const card = stateManager.getCard(idx);
      if (!card) return;
      const orphans = findOrphanWordStyleKeys(card);
      let changed = false;
      for (const key of orphans) {
        stateManager.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx, key } });
        changed = true;
      }
      const updatedCard = stateManager.getCard(idx);
      if (updatedCard) {
        previewRenderer.updateCardField(updatedCard, field, idx);
      }
      updateCharCounter(ctx, idx);
      if (changed && state.activeCardIndexForWord === idx && state.activeFieldForWord === field) {
        const c = stateManager.getCard(idx);
        if (c) wordEditorManager.renderWordStyleList(c);
      }
      scheduleSave(ctx, { silent: true });
      scheduleHistoryPush();
    } else if (action === 'palette') {
      openColorModal(Number(data.index));
    } else if (action === 'delete') {
      deleteCard(Number(data.index));
    } else if (action === 'duplicate') {
      duplicateCard(Number(data.index));
    } else if (action === 'move') {
      moveCard(Number(data.index), Number(data.dir));
    } else if (action === 'focus') {
      updateCharCounter(ctx, Number(data.index));
    } else if (action === 'clear-field') {
      // Clear a single field on a card
      const idx = Number(data.index);
      const field = String(data.field) as keyof Card;
      stateManager.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx, field, value: '' } });
      const card = stateManager.getCard(idx);
      if (card) {
        const orphans = findOrphanWordStyleKeys(card);
        for (const key of orphans) {
          stateManager.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx, key } });
        }
        const updated = stateManager.getCard(idx);
        if (updated) previewRenderer.updateCardField(updated, field, idx);
      }
      // Re-render editor to update input values
      renderEditor();
      updateCharCounter(ctx, idx);
      scheduleSave(ctx, { silent: true });
      scheduleHistoryPush();
    }
  });

  /* ---------- 16. Word editor callbacks ---------- */
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
    scheduleSave(ctx, { silent: true });
    scheduleHistoryPush();
  });

  wordEditorManager.onRemoveWord((cardIndex, key) => {
    stateManager.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx: cardIndex, key } });
    const updated = stateManager.getCard(cardIndex);
    if (!updated) return;
    const [field] = splitOnce(key, '::');
    if (field) previewRenderer.updateCardStyle(updated, field, cardIndex);
    else renderPreview();
    wordEditorManager.renderWordStyleList(updated);
    pushHistory();
    scheduleSave(ctx, { silent: true });
  });

  wordEditorManager.onClear((cardIndex, field, word) => {
    const key = `${field}::${word}`;
    stateManager.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx: cardIndex, key } });
    const updated = stateManager.getCard(cardIndex);
    if (updated) {
      previewRenderer.updateCardStyle(updated, field, cardIndex);
      wordEditorManager.renderWordStyleList(updated);
    }
    pushHistory();
    scheduleSave(ctx, { silent: true });
    showToast('Стиль слова сброшен');
  });

  /* ---------- 17. Modal dropdown callbacks ---------- */
  themeDropdownController.onOpen(() => dom.themeDropdown?.classList.add('open'));
  themeDropdownController.onClose(() => {
    dom.themeDropdown?.classList.remove('open');
    dom.themeDropdownTrigger?.setAttribute('aria-expanded', 'false');
  });
  themeDropdownController.onSelect((value) => {
    if (dom.themeSelect) {
      dom.themeSelect.value = value;
      dom.themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  modalCardThemeDropdownController.onOpen(() => dom.modalCardThemeDropdown?.classList.add('open'));
  modalCardThemeDropdownController.onClose(() => dom.modalCardThemeDropdown?.classList.remove('open'));
  modalCardThemeDropdownController.onSelect((value, item) => {
    if (state.activeCardIndexForColors === null) return;
    const label = item.dataset.label || 'По умолчанию';
    stateManager.dispatch({
      type: 'SET_CARD_THEME',
      payload: { idx: state.activeCardIndexForColors, theme: value === 'default' ? undefined : value },
    });
    if (dom.modalCardThemeLabel) dom.modalCardThemeLabel.textContent = label;
    dom.modalCardThemeDropdown?.querySelectorAll('.modal-card-theme-item').forEach((it) => {
      it.classList.toggle('selected', it === item);
    });
    const updated = stateManager.getCard(state.activeCardIndexForColors);
    if (updated) previewRenderer.updateCardTheme(updated, stateManager.getTheme());
    pushHistory();
    scheduleSave(ctx, { silent: true });
  });

  /* ---------- 18. Modal open/close with sidebar + focus preservation ---------- */
  colorModalController.onOpen(() => {
    dom.previewWorkspace?.classList.add('modal-open');
  });
  colorModalController.onClose(() => {
    dom.previewWorkspace?.classList.remove('modal-open');
    state.activeCardIndexForColors = null;
    if (dom.editorSidebar) {
      if (state.sidebarWasCollapsedBeforeModal) {
        dom.editorSidebar.classList.add('collapsed');
        root.classList.remove('sidebar-open');
      } else {
        dom.editorSidebar.classList.remove('collapsed');
        root.classList.add('sidebar-open');
      }
    }
  });

  /* ---------- 19. Static event bindings ---------- */
  function bindStatic(): void {
    // Theme select change (hidden native select — driven by custom dropdown)
    addEl(dom.themeSelect, 'change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      stateManager.dispatch({ type: 'SET_GLOBAL_THEME', payload: value });
      renderPreview();
      scheduleSave(ctx, { silent: true });
    });

    // Format select change
    addEl(dom.formatSelect, 'change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      stateManager.dispatch({ type: 'SET_FORMAT', payload: value });
      applyCharLimit(ctx);
      renderPreview();
      scheduleSave(ctx, { silent: true });
    });

    // Char limit toggle
    addEl(dom.charLimitToggle, 'change', (e) => {
      const target = e.target as HTMLInputElement;
      stateManager.dispatch({ type: 'SET_CHAR_LIMIT', payload: target.checked });
      applyCharLimit(ctx);
      updateCharCounter(ctx, 0);
      scheduleSave(ctx, { silent: true });
    });

    // Gradient angle slider
    addEl(dom.gradientAngleSlider, 'input', (e) => {
      const target = e.target as HTMLInputElement;
      const angle = Number(target.value);
      stateManager.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: angle });
      scheduleSave(ctx, { silent: true });
    });

    // Numbering toggle
    addEl(dom.numberingToggle, 'change', (e) => {
      const target = e.target as HTMLInputElement;
      stateManager.dispatch({ type: 'SET_SHOW_CARD_NUMBERS', payload: target.checked });
      scheduleSave(ctx, { silent: true });
    });

    // Progress bar toggle
    addEl(dom.progressBarToggle, 'change', (e) => {
      const target = e.target as HTMLInputElement;
      stateManager.dispatch({ type: 'SET_SHOW_PROGRESS_BAR', payload: target.checked });
      scheduleSave(ctx, { silent: true });
    });

    // Progress bar style select
    addEl(dom.progressBarStyleSelect, 'change', (e) => {
      const target = e.target as HTMLSelectElement;
      stateManager.dispatch({ type: 'SET_PROGRESS_BAR_STYLE', payload: target.value });
      renderPreview();
      scheduleSave(ctx, { silent: true });
    });

    // List style select
    addEl(dom.listStyleSelect, 'change', (e) => {
      const target = e.target as HTMLSelectElement;
      stateManager.dispatch({ type: 'SET_LIST_STYLE', payload: target.value });
      scheduleSave(ctx, { silent: true });
    });

    // List num size slider
    addEl(dom.listNumSizeSlider, 'input', (e) => {
      const target = e.target as HTMLInputElement;
      const size = Number(target.value);
      if (dom.listNumSizeValue) dom.listNumSizeValue.textContent = `${size}px`;
      if (state.activeCardIndexForColors !== null) {
        stateManager.dispatch({
          type: 'SET_CARD_COLOR',
          payload: { idx: state.activeCardIndexForColors, key: 'listNumSize', value: String(size) },
        });
        const card = stateManager.getCard(state.activeCardIndexForColors);
        if (!card) return;
        previewRenderer.updateCardField(card, 'listNumSize', state.activeCardIndexForColors);
        scheduleSave(ctx, { silent: true });
        scheduleHistoryPush();
      }
    });

    // Sidebar buttons
    addEl(dom.addCardBtn, 'click', () => addCard());
    addEl(dom.saveAllBtn, 'click', () => void downloadAllPng(ctx));

    // Clear all text — clears all text fields on all cards (keeps card structure)
    addEl(dom.clearAllTextBtn, 'click', () => {
      const cards = stateManager.getCards();
      const fields: Array<keyof Card> = ['title', 'subtitle', 'text', 'listItems', 'footer', 'cta'];
      cards.forEach((_, idx) => {
        for (const field of fields) {
          stateManager.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx, field, value: '' } });
        }
        // Clear all word styles for this card
        const card = stateManager.getCard(idx);
        if (card && card.wordStyles) {
          for (const key of Object.keys(card.wordStyles)) {
            stateManager.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx, key } });
          }
        }
      });
      renderEditor();
      renderPreview();
      pushHistory();
      scheduleSave(ctx, { silent: true });
      showToast('Текст очищен во всех карточках');
    });

    // Delete all — with confirm flow
    addEl(dom.deleteAllBtn, 'click', () => {
      if (stateManager.getCardCount() <= 1) {
        showToast('Нельзя удалить единственную карточку');
        return;
      }
      dom.confirmOverlay?.classList.add('active');
    });
    addEl(dom.confirmCancel, 'click', () => dom.confirmOverlay?.classList.remove('active'));
    addEl(dom.confirmOverlay, 'click', (e) => {
      if (e.target === dom.confirmOverlay) dom.confirmOverlay?.classList.remove('active');
    });
    addEl(dom.confirmOk, 'click', () => {
      dom.confirmOverlay?.classList.remove('active');
      stateManager.dispatch({ type: 'CLEAR_ALL' });
      renderEditor();
      renderPreview();
      pushHistory();
      scheduleSave(ctx, { silent: true });
      showToast('Все карточки удалены');
    });

    // Undo / Redo
    addEl(dom.undoBtn, 'click', () => undo());
    addEl(dom.redoBtn, 'click', () => redo());

    // UI Theme toggle (light / dark / auto)
    addEl(dom.themeToggleBtn, 'click', () => toggleUiTheme());

    // Sidebar toggle
    addEl(dom.toggleSidebarBtn, 'click', () => {
      const open = dom.editorSidebar?.classList.contains('collapsed');
      setSidebarOpen(!!open);
    });
    addEl(dom.sidebarBackdrop, 'click', () => setSidebarOpen(false));

    // Color picker rows — select active field
    root.querySelectorAll<HTMLElement>('.color-picker-row').forEach((row) => {
      addEl(row, 'click', (e) => {
        if ((e.target as HTMLElement).closest('.btn-reset-single')) return;
        const f = row.dataset.rowField;
        if (f) selectRowField(f);
      });
    });

    // Color inputs
    MODAL_FIELDS.forEach((f) => {
      const input = $<HTMLInputElement>(`#col-${f.key}`);
      const hexText = $<HTMLElement>(`#hex-${f.key}`);
      addEl(input, 'input', (e) => {
        if (state.activeCardIndexForColors === null) return;
        const target = e.target as HTMLInputElement;
        stateManager.dispatch({
          type: 'SET_CARD_COLOR',
          payload: { idx: state.activeCardIndexForColors, key: f.key, value: target.value },
        });
        if (hexText) {
          hexText.textContent = target.value;
          hexText.classList.remove('is-auto');
        }
        selectRowField(f.key);
        const card = stateManager.getCard(state.activeCardIndexForColors);
        if (card) previewRenderer.updateCardStyle(card, f.key, state.activeCardIndexForColors);
        scheduleSave(ctx, { silent: true });
        scheduleHistoryPush();
      });
    });

    // Reset single color
    root.querySelectorAll<HTMLElement>('[data-reset]').forEach((btn) => {
      addEl(btn, 'click', (e) => {
        e.stopPropagation();
        const f = btn.dataset.reset || '';
        if (state.activeCardIndexForColors === null) return;
        stateManager.dispatch({
          type: 'DELETE_CARD_COLOR',
          payload: { idx: state.activeCardIndexForColors, key: f },
        });
        const hexText = $<HTMLElement>(`#hex-${f}`);
        const input = $<HTMLInputElement>(`#col-${f}`);
        if (hexText) {
          hexText.textContent = 'АВТО';
          hexText.classList.add('is-auto');
        }
        if (input) input.value = '#000000';
        selectRowField(f);
        const card = stateManager.getCard(state.activeCardIndexForColors);
        if (card) previewRenderer.updateCardStyle(card, f, state.activeCardIndexForColors);
        scheduleSave(ctx, { silent: true });
        scheduleHistoryPush();
      });
    });

    // Color swatches + presets (non-popup)
    root.querySelectorAll<HTMLElement>('.color-swatch, .color-preset[data-color]').forEach((sw) => {
      if (sw.classList.contains('color-preset') && dom.wordStylePopup?.contains(sw)) return;
      addEl(sw, 'click', () => {
        if (state.activeCardIndexForColors === null) return;
        const hex = sw.dataset.preset || sw.dataset.color || '';
        const f = state.lastActiveField || 'title';
        stateManager.dispatch({
          type: 'SET_CARD_COLOR',
          payload: { idx: state.activeCardIndexForColors, key: f, value: hex },
        });
        const input = $<HTMLInputElement>(`#col-${f}`);
        const hexText = $<HTMLElement>(`#hex-${f}`);
        if (input) input.value = hex;
        if (hexText) {
          hexText.textContent = hex;
          hexText.classList.remove('is-auto');
        }
        selectRowField(f);
        const card = stateManager.getCard(state.activeCardIndexForColors);
        if (card) previewRenderer.updateCardStyle(card, f, state.activeCardIndexForColors);
        scheduleSave(ctx, { silent: true });
        scheduleHistoryPush();
      });
    });

    // Section format buttons — toggle fontWeight/fontStyle/textDecoration via dispatch
    root.querySelectorAll<HTMLElement>('.format-btn-section').forEach((btn) => {
      addEl(btn, 'click', (e) => {
        e.stopPropagation();
        const field = btn.dataset.field || '';
        const fmt = btn.dataset.format || '';
        if (state.activeCardIndexForColors === null) return;
        const card = stateManager.getCard(state.activeCardIndexForColors);
        if (!card) return;
        const existing = card.sectionStyles?.[field] ?? {};
        let styleUpdate: Partial<import('@/core/types').SectionStyle> = {};
        if (fmt === 'bold') {
          const newWeight = existing.fontWeight === 'bold' ? undefined : 'bold';
          styleUpdate = { fontWeight: newWeight };
          btn.classList.toggle('active', newWeight === 'bold');
        } else if (fmt === 'italic') {
          const newStyle = existing.fontStyle === 'italic' ? undefined : 'italic';
          styleUpdate = { fontStyle: newStyle };
          btn.classList.toggle('active', newStyle === 'italic');
        } else if (fmt === 'underline' || fmt === 'strikethrough') {
          const d = existing.textDecoration || '';
          const token = fmt === 'underline' ? 'underline' : 'line-through';
          const has = d.split(/\s+/).includes(token);
          let parts = d.split(/\s+/).filter((p) => p && p !== token);
          if (!has) parts.push(token);
          parts = parts.filter((p, i) => parts.indexOf(p) === i);
          styleUpdate = { textDecoration: parts.length > 0 ? parts.join(' ') : undefined };
          btn.classList.toggle('active', !has);
        }
        stateManager.dispatch({
          type: 'UPDATE_CARD_SECTION_STYLE',
          payload: { idx: state.activeCardIndexForColors, field, style: styleUpdate },
        });
        const updated = stateManager.getCard(state.activeCardIndexForColors);
        if (updated) previewRenderer.updateCardStyle(updated, field, state.activeCardIndexForColors);
        scheduleSave(ctx, { silent: true });
        scheduleHistoryPush();
      });
    });

    // Section size sliders
    root.querySelectorAll<HTMLInputElement>('.size-slider-section').forEach((sl) => {
      addEl(sl, 'input', (e) => {
        e.stopPropagation();
        const field = sl.dataset.field || '';
        const size = Number(sl.value);
        if (state.activeCardIndexForColors === null) return;
        stateManager.dispatch({
          type: 'UPDATE_CARD_SECTION_STYLE',
          payload: { idx: state.activeCardIndexForColors, field, style: { fontSize: size } },
        });
        const sv = $<HTMLElement>(`.size-value-section[data-field="${field}"]`);
        if (sv) sv.textContent = `${size}px`;
        const card = stateManager.getCard(state.activeCardIndexForColors);
        if (card) previewRenderer.updateCardStyle(card, field, state.activeCardIndexForColors);
        scheduleSave(ctx, { silent: true });
        scheduleHistoryPush();
      });
    });

    // Reset all card colors + section styles
    addEl(dom.resetCardColorsBtn, 'click', () => {
      if (state.activeCardIndexForColors === null) return;
      const card = stateManager.getCard(state.activeCardIndexForColors);
      if (!card) return;
      stateManager.dispatch({
        type: 'SET_CARD_COLORS',
        payload: { idx: state.activeCardIndexForColors, colors: {} },
      });
      stateManager.dispatch({
        type: 'SET_CARD_SECTION_STYLES',
        payload: { idx: state.activeCardIndexForColors, sectionStyles: {} },
      });
      MODAL_FIELDS.forEach((f) => {
        const hexText = $<HTMLElement>(`#hex-${f.key}`);
        const input = $<HTMLInputElement>(`#col-${f.key}`);
        if (hexText) {
          hexText.textContent = 'АВТО';
          hexText.classList.add('is-auto');
        }
        if (input) input.value = '#000000';
        root
          .querySelectorAll<HTMLElement>(`.format-btn-section[data-field="${f.key}"]`)
          .forEach((b) => b.classList.remove('active'));
        const sl = $<HTMLInputElement>(`.size-slider-section[data-field="${f.key}"]`);
        const sv = $<HTMLElement>(`.size-value-section[data-field="${f.key}"]`);
        if (sl && sv) {
          sl.value = String(f.defaultSize);
          sv.textContent = `${f.defaultSize}px`;
        }
      });
      const updated = stateManager.getCard(state.activeCardIndexForColors);
      if (updated) {
        MODAL_FIELDS.forEach((f) =>
          previewRenderer.updateCardStyle(updated, f.key, state.activeCardIndexForColors!),
        );
      }
      pushHistory();
      scheduleSave(ctx, { silent: true });
      showToast('Все кастомные цвета и стили карточки сброшены');
    });

    // Keyboard shortcuts + document-level handlers
    bindKeyboardAndDocHandlers(ctx);

    // Save on unload (synchronous, no debounce)
    window.addEventListener('beforeunload', createSaveOnUnload(ctx));
  }

  /* ---------- 20. Init sequence ---------- */
  guard('loadFromLocalStorage', () => loadFromLocalStorage(ctx));
  guard('bindStatic', bindStatic);
  guard('renderEditor', renderEditor);
  guard('renderPreview', renderPreview);
  guard('applyCharLimit', () => applyCharLimit(ctx));
  guard('loadUiTheme', loadUiTheme);
  // Initial history snapshot
  historyManager.init(stateManager.snapshot());
  updateUndoRedoButtons(ctx);
  // Sidebar: open on desktop, closed on mobile
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    setSidebarOpen(true);
  } else {
    setSidebarOpen(false);
  }
  console.log('[Cardcraft] Initialized successfully:', stateManager.getCardCount(), 'cards loaded');

  /* ---------- 21. Cleanup ---------- */
  return () => {
    docListeners.forEach(({ type, fn }) => document.removeEventListener(type, fn));
    docListeners.length = 0;
    elementListeners.forEach(({ el, type, fn, opts }) => el.removeEventListener(type, fn, opts));
    elementListeners.length = 0;
    window.removeEventListener('beforeunload', createSaveOnUnload(ctx));
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', unhandledRejection);
    sidebarAccordion.destroy();
    modalAccordion.destroy();
    colorModalController.destroy();
    themeDropdownController.destroy();
    modalCardThemeDropdownController.destroy();
    wordEditorManager.destroy();
    verticalResize.destroy();
    horizontalResize.destroy();
    toastQueue.destroy();
    unsubscribeState();
    clearSaveTimer();
    historyManager.clear();
  };
}
