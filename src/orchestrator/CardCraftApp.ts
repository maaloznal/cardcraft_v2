/**
 * CardCraftApp — orchestrator that wires up all modular classes
 * to replace the 2731-line "God Function" in src/lib/card-constructor.ts.
 *
 * Public API:
 *   initCardCraftApp(root)  — boot the app, returns cleanup function
 *   THEME_GROUPS            — re-export for page.tsx static rendering
 *
 * Architecture:
 *   User event → renderer callback → orchestrator dispatches action / mutates card
 *   → StateManager notifies subscribers → UI controls synced
 *   → PreviewRenderer / EditorRenderer / WordEditorManager update DOM
 *   → StorageManager.save (debounced) + HistoryManager.schedulePush (debounced)
 */
'use client';

import { StateManager } from '@/state/StateManager';
import type { AppState } from '@/state/StateManager';
import { HistoryManager } from '@/history/HistoryManager';
import * as Storage from '@/storage/StorageManager';
import { PreviewRenderer, type PreviewSettings } from '@/preview/PreviewRenderer';
import { EditorRenderer } from '@/editor/EditorRenderer';
import { WordEditorManager } from '@/word-editor/WordEditorManager';
import * as Theme from '@/themes/ThemeManager';
import * as Export from '@/export/ExportManager';
import { pruneOrphanWordStyles } from '@/styles/StyleHelpers';
import { SidebarAccordion, ModalAccordion } from '@/ui/Accordion';
import { Modal } from '@/ui/Modal';
import { Dropdown } from '@/ui/Dropdown';
import type { Card, Snapshot } from '@/core/types';
import { CONFIG, FORMAT_CHAR_LIMITS, MODAL_FIELDS, EDITOR_FIELDS, FIELD_LABELS } from '@/core/constants';
import { splitOnce } from '@/core/utils';
import { ToastQueue } from './toast';
import { VerticalResize, HorizontalResize } from './resizers';
import { withExportMode } from './export-mode';

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

  const editorSidebar = $<HTMLElement>('#editorSidebar');
  const toggleSidebarBtn = $<HTMLButtonElement>('#toggleSidebarBtn');
  const sidebarBackdrop = $<HTMLElement>('#sidebarBackdrop');
  const editorCardsList = $<HTMLElement>('#editorCardsList');
  const cardsArea = $<HTMLElement>('#cardsArea');
  const themeSelect = $<HTMLSelectElement>('#themeSelect');
  const formatSelect = $<HTMLSelectElement>('#formatSelect');
  const themeDropdown = $<HTMLElement>('#themeDropdown');
  const themeDropdownTrigger = $<HTMLButtonElement>('#themeDropdownTrigger');
  const themeDropdownLabel = $<HTMLElement>('#themeDropdownLabel');
  const gradientAngleSlider = $<HTMLInputElement>('#gradientAngleSlider');
  const gradientAngleValue = $<HTMLElement>('#gradientAngleValue');
  const numberingToggle = $<HTMLInputElement>('#numberingToggle');
  const progressBarToggle = $<HTMLInputElement>('#progressBarToggle');
  const progressBarStyleSelect = $<HTMLSelectElement>('#progressBarStyleSelect');
  const listStyleSelect = $<HTMLSelectElement>('#listStyleSelect');
  const charLimitToggle = $<HTMLInputElement>('#charLimitToggle');
  const charCounter = $<HTMLElement>('#charCounter');
  const charCounterText = $<HTMLElement>('#charCounterText');
  const listNumSizeSlider = $<HTMLInputElement>('#listNumSizeSlider');
  const listNumSizeValue = $<HTMLElement>('#listNumSizeValue');
  const resizeDividerH = $<HTMLElement>('#resizeDividerH');
  const resizeDividerV = $<HTMLElement>('#resizeDividerV');
  const previewWorkspace = $<HTMLElement>('#previewWorkspace');
  const toastEl = $<HTMLElement>('#toast');

  const colorModal = $<HTMLElement>('#colorModal');
  const resetCardColorsBtn = $<HTMLButtonElement>('#resetCardColorsBtn');
  const modalCardTitle = $<HTMLElement>('#modalCardTitle');
  const modalCardThemeDropdown = $<HTMLElement>('#modalCardThemeDropdown');
  const modalCardThemeLabel = $<HTMLElement>('#modalCardThemeLabel');

  const wordStylePopup = $<HTMLElement>('#wordStylePopup');
  const wordPopupHeader = $<HTMLElement>('#wordPopupHeader');
  const sizeSlider = $<HTMLInputElement>('#sizeSlider');
  const sizeValue = $<HTMLElement>('#sizeValue');
  const wordStyleList = $<HTMLElement>('#wordStyleList');

  const addCardBtn = $<HTMLButtonElement>('#addCardBtn');
  const saveAllBtn = $<HTMLButtonElement>('#saveAll');
  const deleteAllBtn = $<HTMLButtonElement>('#deleteAllBtn');
  const confirmOverlay = $<HTMLElement>('#confirmOverlay');
  const confirmOk = $<HTMLButtonElement>('#confirmOk');
  const confirmCancel = $<HTMLButtonElement>('#confirmCancel');
  const undoBtn = $<HTMLButtonElement>('#undoBtn');
  const redoBtn = $<HTMLButtonElement>('#redoBtn');
  const cardCountBadge = $<HTMLElement>('#cardCountBadge');

  /* ---------- 4. State variables (orchestrator-local) ---------- */
  let activeCardIndexForColors: number | null = null;
  let lastActiveField = 'title';
  let sidebarWasCollapsedBeforeModal = true;
  let activeCardIndexForWord: number | null = null;
  let activeFieldForWord: string | null = null;

  // Tracked listeners for cleanup
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const docListeners: Array<{ type: string; fn: EventListener }> = [];
  const elementListeners: Array<{
    el: EventTarget;
    type: string;
    fn: EventListener;
    opts?: boolean | AddEventListenerOptions;
  }> = [];

  /* ---------- 5. Module instantiation ---------- */
  const stateManager = new StateManager();
  const historyManager = new HistoryManager<Snapshot>();
  const previewRenderer = new PreviewRenderer(cardsArea!);
  const editorRenderer = new EditorRenderer(editorCardsList!);
  const wordEditorManager = new WordEditorManager(
    wordStylePopup!,
    wordPopupHeader!,
    sizeSlider!,
    sizeValue!,
    wordStyleList!,
  );
  const toastQueue = new ToastQueue(toastEl!);

  // Accordion controllers (defaults: initial='none' — matches old behavior)
  const sidebarAccordion = new SidebarAccordion(root, { initial: 'none' });
  const modalAccordion = new ModalAccordion(colorModal!, { initial: 'none' });

  // Modal controller — ESC handled centrally, so disable auto-ESC
  const colorModalController = new Modal(colorModal!, {
    closeOnEscape: false,
    closeOnBackdrop: true,
    closeSelector: '#closeModalBtn, #applyColorsBtn',
    initialFocusSelector: '#closeModalBtn',
  });

  // Theme dropdown controllers
  const themeDropdownController = new Dropdown(themeDropdown!, {
    triggerSelector: '.theme-dropdown-trigger',
    menuSelector: '.theme-dropdown-panel',
    itemSelector: '.theme-item',
    closeOnEscape: false,
    closeOnClickOutside: true,
  });
  const modalCardThemeDropdownController = new Dropdown(modalCardThemeDropdown!, {
    triggerSelector: '.theme-dropdown-trigger',
    menuSelector: '.theme-dropdown-panel',
    itemSelector: '.modal-card-theme-item',
    closeOnEscape: false,
    closeOnClickOutside: true,
  });

  // Resize handlers
  const verticalResize = new VerticalResize(resizeDividerH!, editorSidebar!);
  const horizontalResize = new HorizontalResize(resizeDividerV!, editorSidebar!);

  /* ---------- 6. Toast ---------- */
  function showToast(msg: string, duration = 2500): void {
    toastQueue.show(msg, duration);
  }

  /* ---------- 7. Save / Load ---------- */
  function scheduleSave(opts: { silent?: boolean } = {}): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCardsToLocalStorage(opts), CONFIG.SAVE_DEBOUNCE_MS);
  }

  function saveCardsToLocalStorage({ silent = false } = {}): void {
    try {
      const state = stateManager.get();
      Storage.save({
        cards: state.cards.list,
        theme: state.settings.theme,
        format: state.settings.format,
        showCardNumbers: state.settings.showCardNumbers,
        showProgressBar: state.settings.showProgressBar,
        progressBarStyle: state.settings.progressBarStyle,
        listStyleType: state.settings.listStyleType,
        gradientAngle: state.settings.gradientAngle,
        charLimitEnabled: state.settings.charLimitEnabled,
      });
      if (!silent) showToast('Карточки успешно сохранены!');
    } catch (e) {
      const err = e as Error;
      if (err.message === 'QuotaExceededError') {
        if (!silent) showToast('Недостаточно места. Удалите старые карточки.');
      } else if (!silent) {
        showToast('Ошибка при сохранении карточек');
      }
    }
  }

  function loadCardsFromLocalStorage(): void {
    const saved = Storage.load();
    if (saved.cards && saved.cards.length) {
      stateManager.setCards(saved.cards);
    }
    if (saved.theme) stateManager.dispatch({ type: 'SET_GLOBAL_THEME', payload: saved.theme });
    if (saved.format) stateManager.dispatch({ type: 'SET_FORMAT', payload: saved.format });
    if (saved.showCardNumbers !== undefined)
      stateManager.dispatch({ type: 'SET_SHOW_CARD_NUMBERS', payload: saved.showCardNumbers });
    if (saved.showProgressBar !== undefined)
      stateManager.dispatch({ type: 'SET_SHOW_PROGRESS_BAR', payload: saved.showProgressBar });
    if (saved.progressBarStyle)
      stateManager.dispatch({ type: 'SET_PROGRESS_BAR_STYLE', payload: saved.progressBarStyle });
    if (saved.listStyleType)
      stateManager.dispatch({ type: 'SET_LIST_STYLE', payload: saved.listStyleType });
    if (saved.gradientAngle !== undefined)
      stateManager.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: saved.gradientAngle });
    if (saved.charLimitEnabled !== undefined)
      stateManager.dispatch({ type: 'SET_CHAR_LIMIT', payload: saved.charLimitEnabled });
  }

  /* ---------- 8. UI appliers ---------- */
  function applyThemeToWorkspace(): void {
    if (!previewWorkspace) return;
    Theme.applyThemeToElement(previewWorkspace, stateManager.getTheme());
    applyGradientAngle();
    syncThemeDropdown();
  }

  function applyGradientAngle(): void {
    if (!previewWorkspace) return;
    previewWorkspace.style.setProperty('--gradient-angle', `${stateManager.getGradientAngle()}deg`);
  }

  function applyNumberingVisibility(): void {
    root.classList.toggle('no-card-numbers', !stateManager.getSettings().showCardNumbers);
  }

  function applyProgressBarVisibility(): void {
    root.classList.toggle('no-progress-bar', !stateManager.getSettings().showProgressBar);
  }

  function applyProgressBarStyle(): void {
    root.setAttribute('data-progress-style', stateManager.getSettings().progressBarStyle);
  }

  function applyListStyle(): void {
    root.setAttribute('data-list-style', stateManager.getListStyle());
  }

  function applyCharLimit(): void {
    if (!editorCardsList) return;
    const settings = stateManager.getSettings();
    const limit = settings.charLimitEnabled ? FORMAT_CHAR_LIMITS[settings.format] || 0 : 0;
    editorCardsList
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[data-field], textarea[data-field]')
      .forEach((el) => {
        if (limit > 0) {
          el.setAttribute('maxlength', String(limit));
        } else {
          const field = el.dataset.field;
          const f = EDITOR_FIELDS.find((ef) => ef.key === field);
          if (f) el.setAttribute('maxlength', String(f.maxlength));
        }
      });
    if (charCounter) {
      charCounter.style.display = settings.charLimitEnabled && limit > 0 ? '' : 'none';
    }
  }

  function updateCharCounter(idx: number): void {
    const settings = stateManager.getSettings();
    if (!settings.charLimitEnabled || !charCounterText || !charCounter) return;
    const limit = FORMAT_CHAR_LIMITS[settings.format] || 0;
    if (limit <= 0) {
      charCounter.style.display = 'none';
      return;
    }
    const card = stateManager.getCard(idx);
    if (!card) return;
    const totalChars =
      (card.title?.length || 0) +
      (card.subtitle?.length || 0) +
      (card.text?.length || 0) +
      (card.listItems?.length || 0) +
      (card.footer?.length || 0) +
      (card.cta?.length || 0);
    charCounterText.textContent = `${totalChars} / ${limit}`;
    charCounter.classList.toggle('near-limit', totalChars >= limit * 0.9);
  }

  function syncThemeDropdown(): void {
    if (!themeDropdownLabel || !themeDropdown) return;
    const theme = stateManager.getTheme();
    themeDropdownLabel.textContent = Theme.getThemeLabel(theme);
    themeDropdown.querySelectorAll<HTMLElement>('.theme-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.value === theme);
    });
  }

  function selectRowField(field: string): void {
    lastActiveField = field;
    const label = $<HTMLElement>('#presetTargetLabel');
    if (label) label.textContent = FIELD_LABELS[field] || 'Заголовок';
    root.querySelectorAll<HTMLElement>('.color-picker-row').forEach((row) => {
      row.classList.toggle('selected', row.dataset.rowField === field);
    });
    syncPresetIndicator(field);
  }

  function syncPresetIndicator(field: string): void {
    const activeColor =
      activeCardIndexForColors !== null
        ? stateManager.getCard(activeCardIndexForColors)?.colors?.[field]
        : undefined;
    root.querySelectorAll<HTMLElement>('.color-swatch').forEach((sw) => {
      sw.classList.toggle('active', !!(activeColor && sw.dataset.preset === activeColor));
    });
  }

  function updateCardCountBadge(): void {
    if (!cardCountBadge) return;
    const n = stateManager.getCardCount();
    const word = n === 1 ? 'карточка' : n >= 2 && n <= 4 ? 'карточки' : 'карточек';
    cardCountBadge.textContent = `${n} ${word}`;
    cardCountBadge.style.display = n > 0 ? '' : 'none';
  }

  /* ---------- 9. Rendering wrappers ---------- */
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
      updateCardCountBadge();
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

  /* ---------- 10. State subscriber (sync UI controls, NO re-render) ---------- */
  const unsubscribeState = stateManager.subscribe((state: AppState) => {
    // Sync selects/toggles/sliders (idempotent — only update if differs)
    if (themeSelect && themeSelect.value !== state.settings.theme) {
      themeSelect.value = state.settings.theme;
    }
    if (formatSelect && formatSelect.value !== state.settings.format) {
      formatSelect.value = state.settings.format;
    }
    if (gradientAngleSlider && gradientAngleSlider.value !== String(state.settings.gradientAngle)) {
      gradientAngleSlider.value = String(state.settings.gradientAngle);
    }
    if (gradientAngleValue) gradientAngleValue.textContent = `${state.settings.gradientAngle}°`;
    if (numberingToggle && numberingToggle.checked !== state.settings.showCardNumbers) {
      numberingToggle.checked = state.settings.showCardNumbers;
    }
    if (progressBarToggle && progressBarToggle.checked !== state.settings.showProgressBar) {
      progressBarToggle.checked = state.settings.showProgressBar;
    }
    if (progressBarStyleSelect && progressBarStyleSelect.value !== state.settings.progressBarStyle) {
      progressBarStyleSelect.value = state.settings.progressBarStyle;
    }
    if (listStyleSelect && listStyleSelect.value !== state.settings.listStyleType) {
      listStyleSelect.value = state.settings.listStyleType;
    }
    if (charLimitToggle && charLimitToggle.checked !== state.settings.charLimitEnabled) {
      charLimitToggle.checked = state.settings.charLimitEnabled;
    }
    // Apply CSS state
    applyThemeToWorkspace();
    applyNumberingVisibility();
    applyProgressBarVisibility();
    applyProgressBarStyle();
    applyListStyle();
    applyCharLimit();
    updateUndoRedoButtons();
  });

  /* ---------- 11. Preview renderer callbacks ---------- */
  previewRenderer.onAction((action, data) => {
    if (action === 'download') {
      const node = document.getElementById(String(data.cardId));
      if (node) void generateAndDownloadPng(node, String(data.filename || 'card.png'));
    } else if (action === 'copy') {
      const node = document.getElementById(String(data.cardId));
      if (node) void copyCardToClipboard(node);
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

  /* ---------- 12. Editor renderer callbacks ---------- */
  editorRenderer.onAction((action, data) => {
    if (action === 'input' || action === 'paste') {
      const idx = Number(data.index);
      const field = String(data.field);
      const value = String(data.value);
      const card = stateManager.getCard(idx);
      if (!card) return;
      // Mutate card field directly (preserves O(1) update — no dispatch for typing)
      (card as unknown as Record<string, unknown>)[field] = value;
      const changed = pruneOrphanWordStyles(card);
      previewRenderer.updateCardField(card, field, idx);
      updateCharCounter(idx);
      if (changed && activeCardIndexForWord === idx && activeFieldForWord === field) {
        wordEditorManager.renderWordStyleList(card);
      }
      scheduleSave({ silent: true });
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
      updateCharCounter(Number(data.index));
    }
  });

  /* ---------- 13. Word editor callbacks ---------- */
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
    scheduleSave({ silent: true });
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
    scheduleSave({ silent: true });
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
    scheduleSave({ silent: true });
    showToast('Стиль слова сброшен');
  });

  /* ---------- 14. Modal dropdown callbacks ---------- */
  themeDropdownController.onOpen(() => themeDropdown?.classList.add('open'));
  themeDropdownController.onClose(() => {
    themeDropdown?.classList.remove('open');
    themeDropdownTrigger?.setAttribute('aria-expanded', 'false');
  });
  themeDropdownController.onSelect((value) => {
    if (themeSelect) {
      themeSelect.value = value;
      themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  modalCardThemeDropdownController.onOpen(() => modalCardThemeDropdown?.classList.add('open'));
  modalCardThemeDropdownController.onClose(() => modalCardThemeDropdown?.classList.remove('open'));
  modalCardThemeDropdownController.onSelect((value, item) => {
    if (activeCardIndexForColors === null) return;
    const label = item.dataset.label || 'По умолчанию';
    stateManager.dispatch({
      type: 'SET_CARD_THEME',
      payload: { idx: activeCardIndexForColors, theme: value === 'default' ? undefined : value },
    });
    if (modalCardThemeLabel) modalCardThemeLabel.textContent = label;
    // Manually toggle .selected (Dropdown.setValue uses data-value, our items use data-modal-card-theme)
    modalCardThemeDropdown?.querySelectorAll('.modal-card-theme-item').forEach((it) => {
      it.classList.toggle('selected', it === item);
    });
    const updated = stateManager.getCard(activeCardIndexForColors);
    if (updated) previewRenderer.updateCardTheme(updated, stateManager.getTheme());
    pushHistory();
    scheduleSave({ silent: true });
  });

  /* ---------- 15. Modal open/close with sidebar + focus preservation ---------- */
  colorModalController.onOpen(() => {
    previewWorkspace?.classList.add('modal-open');
  });
  colorModalController.onClose(() => {
    previewWorkspace?.classList.remove('modal-open');
    activeCardIndexForColors = null;
    // Restore sidebar state captured before modal opened
    if (editorSidebar) {
      if (sidebarWasCollapsedBeforeModal) {
        editorSidebar.classList.add('collapsed');
        root.classList.remove('sidebar-open');
      } else {
        editorSidebar.classList.remove('collapsed');
        root.classList.add('sidebar-open');
      }
    }
  });

  function openColorModal(index: number): void {
    activeCardIndexForColors = index;
    if (modalCardTitle) modalCardTitle.textContent = `Стили · Карточка ${index + 1}`;

    // Capture sidebar state before opening (don't change it)
    sidebarWasCollapsedBeforeModal = editorSidebar?.classList.contains('collapsed') ?? true;

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
    if (modalCardThemeLabel) {
      modalCardThemeLabel.textContent =
        cardThemeVal === 'default' ? 'По умолчанию' : Theme.getThemeLabel(cardThemeVal);
    }
    modalCardThemeDropdown?.querySelectorAll<HTMLElement>('.modal-card-theme-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.modalCardTheme === cardThemeVal);
    });

    // Sync listNumSize slider
    const savedNumSize = card.colors?.listNumSize;
    if (listNumSizeSlider) listNumSizeSlider.value = String(savedNumSize || 22);
    if (listNumSizeValue) listNumSizeValue.textContent = `${savedNumSize || 22}px`;

    colorModalController.open();
  }

  function closeColorModal(): void {
    colorModalController.close();
  }

  /* ---------- 16. Word popup ---------- */
  function openWordStylePopup(
    x: number,
    y: number,
    selectedText: string,
    field: string,
    cardIndex: number,
  ): void {
    activeFieldForWord = field;
    activeCardIndexForWord = cardIndex;
    const card = stateManager.getCard(cardIndex);
    if (!card) return;
    const key = `${field}::${selectedText}`;
    const existing = card.wordStyles?.[key];
    wordEditorManager.open(x, y, selectedText, field, cardIndex, existing);
  }

  function closeWordStylePopup(): void {
    wordEditorManager.close();
    activeFieldForWord = null;
    activeCardIndexForWord = null;
  }

  /* ---------- 17. Card operations ---------- */
  function addCard(): void {
    stateManager.dispatch({ type: 'ADD_CARD' });
    renderEditor();
    renderPreview();
    editorRenderer.collapseLastCard();
    pushHistory();
    scheduleSave({ silent: true });
    showToast('Карточка добавлена');
  }

  function deleteCard(idx: number): void {
    const cardCount = stateManager.getCardCount();
    if (cardCount <= 1) return;
    // Protect against NaN and invalid indices
    if (Number.isNaN(idx) || !Number.isFinite(idx)) return;
    if (idx < 0 || idx >= cardCount) return;
    stateManager.dispatch({ type: 'DELETE_CARD', payload: idx });
    renderEditor();
    renderPreview();
    pushHistory();
    scheduleSave({ silent: true });
    showToast('Карточка удалена');
  }

  function duplicateCard(idx: number): void {
    stateManager.dispatch({ type: 'DUPLICATE_CARD', payload: idx });
    renderEditor();
    renderPreview();
    pushHistory();
    scheduleSave({ silent: true });
    showToast('Карточка дублирована');
  }

  function moveCard(idx: number, dir: number): void {
    stateManager.dispatch({ type: 'MOVE_CARD', payload: { idx, dir } });
    renderEditor();
    renderPreview();
    pushHistory();
    scheduleSave({ silent: true });
  }

  /* ---------- 18. History ---------- */
  function pushHistory(): void {
    historyManager.push(stateManager.snapshot());
    updateUndoRedoButtons();
  }

  function scheduleHistoryPush(): void {
    historyManager.schedulePush(stateManager.snapshot());
  }

  function restore(s: Snapshot): void {
    stateManager.restore(s);
    renderEditor();
    renderPreview();
    scheduleSave({ silent: true });
    updateUndoRedoButtons();
    // Close modal and word popup, reset stale active indices
    closeColorModal();
    closeWordStylePopup();
    activeCardIndexForColors = null;
    activeCardIndexForWord = null;
    lastActiveField = 'title';
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

  function updateUndoRedoButtons(): void {
    if (undoBtn) undoBtn.disabled = !historyManager.canUndo;
    if (redoBtn) redoBtn.disabled = !historyManager.canRedo;
  }

  /* ---------- 19. Sidebar ---------- */
  function setSidebarOpen(open: boolean): void {
    if (!editorSidebar) return;
    if (open) {
      editorSidebar.classList.remove('collapsed');
      root.classList.add('sidebar-open');
    } else {
      editorSidebar.classList.add('collapsed');
      root.classList.remove('sidebar-open');
    }
  }

  /* ---------- 20. Export ---------- */
  async function generateAndDownloadPng(node: HTMLElement, filename: string): Promise<void> {
    try {
      await withExportMode(root, node, (n) => Export.downloadPng(n, filename, root));
      showToast('Карточка успешно скачана!');
    } catch {
      showToast('Ошибка при скачивании');
    }
  }

  async function copyCardToClipboard(node: HTMLElement): Promise<void> {
    try {
      if (!window.isSecureContext) {
        showToast('Копирование требует HTTPS. Скачиваю PNG вместо копирования…');
        await generateAndDownloadPng(node, 'card-copy.png');
        return;
      }
      const result = await withExportMode(root, node, (n) => Export.copyToClipboard(n, root));
      if (result.success) {
        showToast('Карточка скопирована в буфер!');
        return;
      }
      if (result.fallback) {
        showToast('Буфер обмена недоступен. Скачиваю PNG…');
        await generateAndDownloadPng(node, 'card-copy.png');
      }
    } catch {
      showToast('Копирование не удалось. Скачиваю PNG…');
      try {
        await generateAndDownloadPng(node, 'card-copy.png');
      } catch {
        /* already toasted */
      }
    }
  }

  async function downloadAllPng(): Promise<void> {
    const cards = stateManager.getCards();
    const total = cards.length;
    showToast(`Генерация PNG: 0 из ${total}...`, 60000);
    for (let i = 0; i < total; i++) {
      const node = document.getElementById(`card-node-${cards[i].id}`);
      if (node) {
        try {
          await withExportMode(root, node, (n) => Export.downloadPng(n, `card-${i + 1}.png`, root));
        } catch {
          /* ignore — continue batch */
        }
        showToast(`Скачано ${i + 1} из ${total}...`, 60000);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    showToast(`Готово! Скачано ${total} из ${total} карточек.`);
  }

  /* ---------- 21. Helper: add tracked element listener ---------- */
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

  /* ---------- 22. Static event bindings ---------- */
  function bindStatic(): void {
    // Theme select change (hidden native select — driven by custom dropdown)
    addEl(themeSelect, 'change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      stateManager.dispatch({ type: 'SET_GLOBAL_THEME', payload: value });
      renderPreview();
      scheduleSave({ silent: true });
    });

    // Format select change
    addEl(formatSelect, 'change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      stateManager.dispatch({ type: 'SET_FORMAT', payload: value });
      applyCharLimit();
      renderPreview();
      scheduleSave({ silent: true });
    });

    // Char limit toggle
    addEl(charLimitToggle, 'change', (e) => {
      stateManager.dispatch({ type: 'SET_CHAR_LIMIT', payload: (e.target as HTMLInputElement).checked });
      applyCharLimit();
      updateCharCounter(0);
      scheduleSave({ silent: true });
    });

    // Gradient angle slider — NO save, NO history (preserve old behavior)
    addEl(gradientAngleSlider, 'input', (e) => {
      const angle = Number((e.target as HTMLInputElement).value);
      stateManager.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: angle });
    });

    // Numbering toggle
    addEl(numberingToggle, 'change', (e) => {
      stateManager.dispatch({ type: 'SET_SHOW_CARD_NUMBERS', payload: (e.target as HTMLInputElement).checked });
      scheduleSave({ silent: true });
    });

    // Progress bar toggle
    addEl(progressBarToggle, 'change', (e) => {
      stateManager.dispatch({ type: 'SET_SHOW_PROGRESS_BAR', payload: (e.target as HTMLInputElement).checked });
      scheduleSave({ silent: true });
    });

    // Progress bar style select
    addEl(progressBarStyleSelect, 'change', (e) => {
      stateManager.dispatch({ type: 'SET_PROGRESS_BAR_STYLE', payload: (e.target as HTMLSelectElement).value });
      renderPreview();
      scheduleSave({ silent: true });
    });

    // List style select
    addEl(listStyleSelect, 'change', (e) => {
      stateManager.dispatch({ type: 'SET_LIST_STYLE', payload: (e.target as HTMLSelectElement).value });
      scheduleSave({ silent: true });
    });

    // List num size slider — DO push history
    addEl(listNumSizeSlider, 'input', (e) => {
      const size = Number((e.target as HTMLInputElement).value);
      if (listNumSizeValue) listNumSizeValue.textContent = `${size}px`;
      if (activeCardIndexForColors !== null) {
        const card = stateManager.getCard(activeCardIndexForColors);
        if (!card) return;
        if (!card.colors) card.colors = {};
        card.colors.listNumSize = String(size);
        previewRenderer.updateCardField(card, 'listNumSize', activeCardIndexForColors);
        scheduleHistoryPush();
        scheduleSave({ silent: true });
      }
    });

    // Sidebar buttons
    addEl(addCardBtn, 'click', () => addCard());
    addEl(saveAllBtn, 'click', () => void downloadAllPng());

    // Delete all — with confirm flow
    addEl(deleteAllBtn, 'click', () => {
      if (stateManager.getCardCount() <= 1) {
        showToast('Нельзя удалить единственную карточку');
        return;
      }
      confirmOverlay?.classList.add('active');
    });
    addEl(confirmCancel, 'click', () => confirmOverlay?.classList.remove('active'));
    addEl(confirmOverlay, 'click', (e) => {
      if (e.target === confirmOverlay) confirmOverlay?.classList.remove('active');
    });
    addEl(confirmOk, 'click', () => {
      confirmOverlay?.classList.remove('active');
      stateManager.dispatch({ type: 'CLEAR_ALL' });
      renderEditor();
      renderPreview();
      pushHistory();
      scheduleSave({ silent: true });
      showToast('Все карточки удалены');
    });

    // Undo / Redo
    addEl(undoBtn, 'click', () => undo());
    addEl(redoBtn, 'click', () => redo());

    // Sidebar toggle
    addEl(toggleSidebarBtn, 'click', () => {
      const open = editorSidebar?.classList.contains('collapsed');
      setSidebarOpen(!!open);
    });
    addEl(sidebarBackdrop, 'click', () => setSidebarOpen(false));

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
        if (activeCardIndexForColors === null) return;
        const card = stateManager.getCard(activeCardIndexForColors);
        if (!card) return;
        if (!card.colors) card.colors = {};
        const value = (e.target as HTMLInputElement).value;
        card.colors[f.key] = value;
        if (hexText) {
          hexText.textContent = value;
          hexText.classList.remove('is-auto');
        }
        selectRowField(f.key);
        previewRenderer.updateCardStyle(card, f.key, activeCardIndexForColors);
        scheduleHistoryPush();
        scheduleSave({ silent: true });
      });
    });

    // Reset single color
    root.querySelectorAll<HTMLElement>('[data-reset]').forEach((btn) => {
      addEl(btn, 'click', (e) => {
        e.stopPropagation();
        const f = btn.dataset.reset || '';
        if (activeCardIndexForColors === null) return;
        const card = stateManager.getCard(activeCardIndexForColors);
        if (!card) return;
        delete card.colors?.[f];
        const hexText = $<HTMLElement>(`#hex-${f}`);
        const input = $<HTMLInputElement>(`#col-${f}`);
        if (input) input.value = '';
        if (hexText) {
          hexText.textContent = '';
          hexText.classList.add('is-auto');
        }
        selectRowField(f);
        previewRenderer.updateCardStyle(card, f, activeCardIndexForColors);
        scheduleHistoryPush();
        scheduleSave({ silent: true });
      });
    });

    // Color swatches + presets (non-popup)
    root.querySelectorAll<HTMLElement>('.color-swatch, .color-preset[data-color]').forEach((sw) => {
      if (sw.classList.contains('color-preset') && wordStylePopup?.contains(sw)) return;
      addEl(sw, 'click', () => {
        if (activeCardIndexForColors === null) return;
        const hex = sw.dataset.preset || sw.dataset.color || '';
        const f = lastActiveField || 'title';
        const card = stateManager.getCard(activeCardIndexForColors);
        if (!card) return;
        if (!card.colors) card.colors = {};
        card.colors[f] = hex;
        const input = $<HTMLInputElement>(`#col-${f}`);
        const hexText = $<HTMLElement>(`#hex-${f}`);
        if (input) input.value = hex;
        if (hexText) {
          hexText.textContent = hex;
          hexText.classList.remove('is-auto');
        }
        selectRowField(f);
        previewRenderer.updateCardStyle(card, f, activeCardIndexForColors);
        scheduleHistoryPush();
        scheduleSave({ silent: true });
      });
    });

    // Section format buttons — DO push history
    root.querySelectorAll<HTMLElement>('.format-btn-section').forEach((btn) => {
      addEl(btn, 'click', (e) => {
        e.stopPropagation();
        const field = btn.dataset.field || '';
        const fmt = btn.dataset.format || '';
        if (activeCardIndexForColors === null) return;
        const card = stateManager.getCard(activeCardIndexForColors);
        if (!card) return;
        if (!card.sectionStyles) card.sectionStyles = {};
        if (!card.sectionStyles[field]) card.sectionStyles[field] = {};
        const styles = card.sectionStyles[field]!;
        if (fmt === 'bold') {
          if (styles.fontWeight === 'bold') {
            delete styles.fontWeight;
            btn.classList.remove('active');
          } else {
            styles.fontWeight = 'bold';
            btn.classList.add('active');
          }
        } else if (fmt === 'italic') {
          if (styles.fontStyle === 'italic') {
            delete styles.fontStyle;
            btn.classList.remove('active');
          } else {
            styles.fontStyle = 'italic';
            btn.classList.add('active');
          }
        } else if (fmt === 'underline') {
          const d = styles.textDecoration || '';
          if (d.includes('underline')) {
            styles.textDecoration = d.replace('underline', '').trim();
            btn.classList.remove('active');
          } else {
            styles.textDecoration = (d + ' underline').trim();
            btn.classList.add('active');
          }
        } else if (fmt === 'strikethrough') {
          const d = styles.textDecoration || '';
          if (d.includes('line-through')) {
            styles.textDecoration = d.replace('line-through', '').trim();
            btn.classList.remove('active');
          } else {
            styles.textDecoration = (d + ' line-through').trim();
            btn.classList.add('active');
          }
        }
        previewRenderer.updateCardStyle(card, field, activeCardIndexForColors);
        scheduleSave({ silent: true });
        scheduleHistoryPush();
      });
    });

    // Section size sliders — DO push history
    root.querySelectorAll<HTMLInputElement>('.size-slider-section').forEach((sl) => {
      addEl(sl, 'input', (e) => {
        e.stopPropagation();
        const field = sl.dataset.field || '';
        const size = Number(sl.value);
        if (activeCardIndexForColors === null) return;
        const card = stateManager.getCard(activeCardIndexForColors);
        if (!card) return;
        if (!card.sectionStyles) card.sectionStyles = {};
        if (!card.sectionStyles[field]) card.sectionStyles[field] = {};
        card.sectionStyles[field]!.fontSize = size;
        const sv = $<HTMLElement>(`.size-value-section[data-field="${field}"]`);
        if (sv) sv.textContent = `${size}px`;
        previewRenderer.updateCardStyle(card, field, activeCardIndexForColors);
        scheduleHistoryPush();
        scheduleSave({ silent: true });
      });
    });

    // Reset all card colors + section styles
    addEl(resetCardColorsBtn, 'click', () => {
      if (activeCardIndexForColors === null) return;
      const card = stateManager.getCard(activeCardIndexForColors);
      if (!card) return;
      card.colors = {};
      card.sectionStyles = {};
      stateManager.dispatch({
        type: 'SET_CARD_COLORS',
        payload: { idx: activeCardIndexForColors, colors: {} },
      });
      stateManager.dispatch({
        type: 'SET_CARD_SECTION_STYLES',
        payload: { idx: activeCardIndexForColors, sectionStyles: {} },
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
      const updated = stateManager.getCard(activeCardIndexForColors);
      if (updated) {
        MODAL_FIELDS.forEach((f) =>
          previewRenderer.updateCardStyle(updated, f.key, activeCardIndexForColors!),
        );
      }
      pushHistory();
      scheduleSave({ silent: true });
      showToast('Все кастомные цвета и стили карточки сброшены');
    });

    // Document-level click: close word popup (5-condition check)
    // Note: theme dropdown click-outside handled by Dropdown class
    addDoc('click', (e) => {
      const t = e.target as HTMLElement;
      if (!wordStylePopup?.classList.contains('active')) return;
      if (wordStylePopup.contains(t)) return;
      if (editorSidebar?.contains(t)) return;
      if (colorModal?.contains(t)) return;
      if (t.closest('.cc-styled-word')) return;
      if (t.closest('input, textarea, select, button')) return;
      closeWordStylePopup();
    });

    // Document-level keydown: Escape priority + Ctrl shortcuts
    addDoc('keydown', (e) => {
      if (e.key === 'Escape') {
        // Priority: themeDropdown → modalCardThemeDropdown → wordStylePopup → colorModal
        if (themeDropdown?.classList.contains('open')) {
          themeDropdownController.close();
        } else if (modalCardThemeDropdown?.classList.contains('open')) {
          modalCardThemeDropdownController.close();
        } else if (wordStylePopup?.classList.contains('active')) {
          closeWordStylePopup();
        } else if (colorModal?.classList.contains('active')) {
          closeColorModal();
        }
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveCardsToLocalStorage({ silent: false });
      } else if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      } else if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        redo();
      }
    });

    // Save on unload (synchronous, no debounce)
    window.addEventListener('beforeunload', saveOnUnload);
  }

  function saveOnUnload(): void {
    saveCardsToLocalStorage({ silent: true });
  }

  /* ---------- 23. Init sequence ---------- */
  guard('loadCardsFromLocalStorage', loadCardsFromLocalStorage);
  guard('bindStatic', bindStatic);
  guard('renderEditor', renderEditor);
  guard('renderPreview', renderPreview);
  guard('applyCharLimit', applyCharLimit);
  // Initial history snapshot
  historyManager.init(stateManager.snapshot());
  updateUndoRedoButtons();
  // Sidebar: open on desktop, closed on mobile
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    setSidebarOpen(true);
  } else {
    setSidebarOpen(false);
  }
  console.log('[Cardcraft] Initialized successfully:', stateManager.getCardCount(), 'cards loaded');

  /* ---------- 24. Cleanup ---------- */
  return () => {
    // Remove document listeners
    docListeners.forEach(({ type, fn }) => document.removeEventListener(type, fn));
    docListeners.length = 0;
    // Remove element listeners
    elementListeners.forEach(({ el, type, fn, opts }) => el.removeEventListener(type, fn, opts));
    elementListeners.length = 0;
    // Window listeners
    window.removeEventListener('beforeunload', saveOnUnload);
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', unhandledRejection);
    // Destroy modules
    sidebarAccordion.destroy();
    modalAccordion.destroy();
    colorModalController.destroy();
    themeDropdownController.destroy();
    modalCardThemeDropdownController.destroy();
    wordEditorManager.destroy();
    verticalResize.destroy();
    horizontalResize.destroy();
    toastQueue.destroy();
    // Unsubscribe from state changes (prevents leak on React remount)
    unsubscribeState();
    // Clear timers
    if (saveTimer) clearTimeout(saveTimer);
    historyManager.clear();
  };
}
