/**
 * Shared context for orchestrator controllers.
 *
 * This interface defines the shared dependencies that controller modules
 * need from the main orchestrator. Instead of passing 20+ parameters,
 * controllers receive this context object.
 */

import type { StateManager } from '@/state/StateManager';
import type { HistoryManager } from '@/history/HistoryManager';
import type { PreviewRenderer } from '@/preview/PreviewRenderer';
import type { EditorRenderer } from '@/editor/EditorRenderer';
import type { WordEditorManager } from '@/word-editor/WordEditorManager';
import type { ToastQueue } from './toast';
import type { Snapshot } from '@/core/types';

/** DOM element references cached at boot. */
export interface DomRefs {
  root: HTMLElement;
  editorSidebar: HTMLElement | null;
  toggleSidebarBtn: HTMLButtonElement | null;
  sidebarBackdrop: HTMLElement | null;
  editorCardsList: HTMLElement | null;
  cardsArea: HTMLElement | null;
  themeSelect: HTMLSelectElement | null;
  formatSelect: HTMLSelectElement | null;
  themeDropdown: HTMLElement | null;
  themeDropdownTrigger: HTMLButtonElement | null;
  themeDropdownLabel: HTMLElement | null;
  gradientAngleSlider: HTMLInputElement | null;
  gradientAngleValue: HTMLElement | null;
  numberingToggle: HTMLInputElement | null;
  progressBarToggle: HTMLInputElement | null;
  progressBarStyleSelect: HTMLSelectElement | null;
  listStyleSelect: HTMLSelectElement | null;
  charLimitToggle: HTMLInputElement | null;
  charCounter: HTMLElement | null;
  charCounterText: HTMLElement | null;
  listNumSizeSlider: HTMLInputElement | null;
  listNumSizeValue: HTMLElement | null;
  resizeDividerH: HTMLElement | null;
  resizeDividerV: HTMLElement | null;
  previewWorkspace: HTMLElement | null;
  toastEl: HTMLElement | null;
  colorModal: HTMLElement | null;
  resetCardColorsBtn: HTMLButtonElement | null;
  modalCardTitle: HTMLElement | null;
  modalCardThemeDropdown: HTMLElement | null;
  modalCardThemeLabel: HTMLElement | null;
  wordStylePopup: HTMLElement | null;
  wordPopupHeader: HTMLElement | null;
  sizeSlider: HTMLInputElement | null;
  sizeValue: HTMLElement | null;
  wordStyleList: HTMLElement | null;
  addCardBtn: HTMLButtonElement | null;
  saveAllBtn: HTMLButtonElement | null;
  deleteAllBtn: HTMLButtonElement | null;
  confirmOverlay: HTMLElement | null;
  confirmOk: HTMLButtonElement | null;
  confirmCancel: HTMLButtonElement | null;
  undoBtn: HTMLButtonElement | null;
  redoBtn: HTMLButtonElement | null;
  themeToggleBtn: HTMLButtonElement | null;
  cardCountBadge: HTMLElement | null;
}

/** Shared orchestrator state (mutable — controllers can read/write). */
export interface OrchestratorState {
  activeCardIndexForColors: number | null;
  lastActiveField: string;
  sidebarWasCollapsedBeforeModal: boolean;
  activeCardIndexForWord: number | null;
  activeFieldForWord: string | null;
}

/** Listener tracking arrays for cleanup. */
export interface ListenerTracker {
  docListeners: Array<{ type: string; fn: EventListener }>;
  elementListeners: Array<{
    el: EventTarget;
    type: string;
    fn: EventListener;
    opts?: boolean | AddEventListenerOptions;
  }>;
  addEl: <K extends keyof HTMLElementEventMap>(
    el: EventTarget | null | undefined,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    opts?: boolean | AddEventListenerOptions,
  ) => void;
  addDoc: <K extends keyof DocumentEventMap>(
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
  ) => void;
}

/** Full context passed to controller modules. */
export interface OrchestratorContext {
  dom: DomRefs;
  state: OrchestratorState;
  stateManager: StateManager;
  historyManager: HistoryManager<Snapshot>;
  previewRenderer: PreviewRenderer;
  editorRenderer: EditorRenderer;
  wordEditorManager: WordEditorManager;
  toastQueue: ToastQueue;
  listeners: ListenerTracker;
  /** Show a toast notification */
  showToast: (msg: string, duration?: number) => void;
  /** Schedule a debounced save */
  scheduleSave: (opts?: { silent?: boolean }) => void;
  /** Save immediately (synchronous) */
  saveNow: (opts?: { silent?: boolean }) => void;
  /** Push to history immediately */
  pushHistory: () => void;
  /** Schedule a debounced history push */
  scheduleHistoryPush: () => void;
  /** Render preview (full rebuild) */
  renderPreview: () => void;
  /** Render editor (full rebuild) */
  renderEditor: () => void;
  /** Close color modal */
  closeColorModal: () => void;
  /** Close word popup */
  closeWordStylePopup: () => void;
  /** Close all overlays + reset stale indices */
  closeAllOverlaysOnCardMutation: () => void;
  /** Undo */
  undo: () => void;
  /** Redo */
  redo: () => void;
  /** Update undo/redo button disabled state */
  updateUndoRedoButtons: () => void;
  /** Set sidebar open/closed */
  setSidebarOpen: (open: boolean) => void;
}
