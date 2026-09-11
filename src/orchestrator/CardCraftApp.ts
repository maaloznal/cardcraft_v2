/**
 * CardCraftApp — thin orchestrator entry point (P2-1 + P2-2).
 *
 * Public API:
 *   initCardCraftApp(root)  — boot the app, returns cleanup function
 *   THEME_GROUPS            — re-export for page.tsx static rendering
 *
 * Architecture (post-decomposition):
 *   This file is the COMPOSITION ROOT — it instantiates core modules +
 *   controllers, wires their relationships, runs the init sequence, and
 *   returns a cleanup function. All logic lives in focused modules:
 *
 *     dom-refs.ts              — DOM element cache
 *     ui-state.ts              — typed getter/setter proxy over StateManager UI state
 *     helpers.ts               — ListenerTracker + guard + perfMark
 *     storage-controller.ts    — save/load + toast
 *     ui-appliers.ts           — pure UI sync functions + render wrappers
 *     modal-controller.ts      — color modal + per-card theme dropdown
 *     word-popup-controller.ts — word style popup
 *     export-controller.ts     — PNG export + copy + batch
 *     theme-controller.ts      — top-bar theme dropdown wiring
 *     char-limit-controller.ts — char limit enforcement + counter
 *     keyboard-controller.ts   — Escape priority + Ctrl shortcuts
 *     history-controller.ts    — undo/redo + push scheduling
 *     card-ops.ts              — add/delete/duplicate/move
 *     sidebar-controller.ts    — sidebar open/close
 *     state-subscriber.ts      — state subscriber (sync UI on changes)
 *     callbacks.ts             — wires renderer callbacks to controllers
 *     events.ts                — bindAll + 9 bind* functions (P2-2)
 *     resizers.ts              — sidebar resize dividers (unchanged)
 *     toast.ts                 — ToastQueue (unchanged)
 *     export-mode.ts           — withExportMode helper (unchanged)
 *
 *   User event → renderer callback (callbacks.ts) or bind* handler (events.ts)
 *   → controller method → dispatch action / mutate UI state
 *   → StateManager notifies subscribers (state-subscriber.ts syncs UI controls)
 *   → PreviewRenderer / EditorRenderer / WordEditorManager update DOM
 *   → StorageManager.save (debounced) + HistoryManager.schedulePush (debounced)
 */

'use client';

import { StateManager } from '@/state/StateManager';
import { HistoryManager } from '@/history/HistoryManager';
import { PreviewRenderer } from '@/preview/PreviewRenderer';
import { EditorRenderer } from '@/editor/EditorRenderer';
import { WordEditorManager } from '@/word-editor/WordEditorManager';
import { SidebarAccordion, ModalAccordion } from '@/ui/Accordion';
import { Modal } from '@/ui/Modal';
import { Dropdown } from '@/ui/Dropdown';
import type { Snapshot } from '@/core/types';

import { ToastQueue } from './toast';
import { VerticalResize, HorizontalResize } from './resizers';
import { collectDOMRefs } from './dom-refs';
import { createUIStateProxy } from './ui-state';
import { ListenerTracker, guard } from './helpers';
import { createStorageController } from './storage-controller';
import { createUIAppliers } from './ui-appliers';
import { createModalController } from './modal-controller';
import { createWordPopupController } from './word-popup-controller';
import { createExportController } from './export-controller';
import { createThemeController } from './theme-controller';
import { createCharLimitController } from './char-limit-controller';
import { createKeyboardController } from './keyboard-controller';
import { createHistoryController } from './history-controller';
import { createCardOpsController } from './card-ops';
import { createSidebarController } from './sidebar-controller';
import { createStateSubscriber } from './state-subscriber';
import { wireRendererCallbacks } from './callbacks';
import { bindAll } from './events';
import type { OrchestratorContext } from './types';

// Re-export theme data for page.tsx static rendering
export { THEME_GROUPS } from '@/themes/themeData';

// ─── Main entry point ──────────────────────────────────────────

export function initCardCraftApp(root: HTMLElement): () => void {
  /* ---------- 1. Error traps (boot-level) ---------- */
  const errorHandler = (e: ErrorEvent): void => {
    console.error('[Cardcraft] Runtime error:', e.message, e.filename + ':' + e.lineno);
  };
  const unhandledRejection = (e: PromiseRejectionEvent): void => {
    console.error('[Cardcraft] Unhandled promise rejection:', e.reason);
  };
  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', unhandledRejection);

  /* ---------- 2. DOM refs ---------- */
  const refs = collectDOMRefs(root);

  /* ---------- 3. Core module instantiation ---------- */
  const stateManager = new StateManager();
  const historyManager = new HistoryManager<Snapshot>();
  const previewRenderer = new PreviewRenderer(refs.cardsArea!);
  const editorRenderer = new EditorRenderer(refs.editorCardsList!);
  const wordEditorManager = new WordEditorManager(
    refs.wordStylePopup!,
    refs.wordPopupHeader!,
    refs.sizeSlider!,
    refs.sizeValue!,
    refs.wordStyleList!,
  );
  const toastQueue = new ToastQueue(refs.toastEl!);

  // Accordion controllers (defaults: initial='none' — matches old behavior)
  const sidebarAccordion = new SidebarAccordion(root, { initial: 'none' });
  const modalAccordion = new ModalAccordion(refs.colorModal!, { initial: 'none' });

  // Modal controller — ESC handled centrally (keyboard-controller), so disable auto-ESC
  const colorModalController = new Modal(refs.colorModal!, {
    closeOnEscape: false,
    closeOnBackdrop: true,
    closeSelector: '#closeModalBtn, #applyColorsBtn',
    initialFocusSelector: '#closeModalBtn',
  });

  // Theme dropdown controllers
  const themeDropdownController = new Dropdown(refs.themeDropdown!, {
    triggerSelector: '.theme-dropdown-trigger',
    menuSelector: '.theme-dropdown-panel',
    itemSelector: '.theme-item',
    closeOnEscape: false,
    closeOnClickOutside: true,
  });
  const modalCardThemeDropdownController = new Dropdown(refs.modalCardThemeDropdown!, {
    triggerSelector: '.theme-dropdown-trigger',
    menuSelector: '.theme-dropdown-panel',
    itemSelector: '.modal-card-theme-item',
    closeOnEscape: false,
    closeOnClickOutside: true,
  });

  // Resize handlers
  const verticalResize = new VerticalResize(refs.resizeDividerH!, refs.editorSidebar!);
  const horizontalResize = new HorizontalResize(refs.resizeDividerV!, refs.editorSidebar!);

  /* ---------- 4. UI-state proxy + listener tracker ---------- */
  const uiState = createUIStateProxy(stateManager);
  const listeners = new ListenerTracker();

  /* ---------- 5. Build context (two-phase — see types.ts) ---------- */
  // Cast pattern: build {} as OrchestratorContext, assign core fields first,
  // then assign controller instances. Controllers' factories receive `ctx`
  // and may register callbacks that reference ctx.siblingController — these
  // callbacks fire LAZILY (after all controllers are populated), so the
  // partial-population during construction is safe.
  const ctx = {} as OrchestratorContext;
  ctx.root = root;
  ctx.refs = refs;
  ctx.stateManager = stateManager;
  ctx.historyManager = historyManager;
  ctx.previewRenderer = previewRenderer;
  ctx.editorRenderer = editorRenderer;
  ctx.wordEditorManager = wordEditorManager;
  ctx.toastQueue = toastQueue;
  ctx.uiState = uiState;
  ctx.listeners = listeners;
  ctx.colorModalController = colorModalController;
  ctx.themeDropdownController = themeDropdownController;
  ctx.modalCardThemeDropdownController = modalCardThemeDropdownController;
  ctx.sidebarAccordion = sidebarAccordion;
  ctx.modalAccordion = modalAccordion;

  /* ---------- 6. Instantiate controllers ---------- */
  // Order matters only in that a controller must not SYNCHRONOUSLY call
  // a sibling controller method (factories may only register callbacks
  // that fire later). All controllers below satisfy this constraint.
  ctx.storage = createStorageController(ctx);
  ctx.uiAppliers = createUIAppliers(ctx);
  ctx.modal = createModalController(ctx);
  ctx.wordPopup = createWordPopupController(ctx);
  ctx.exporter = createExportController(ctx);
  ctx.theme = createThemeController(ctx);
  ctx.charLimit = createCharLimitController(ctx);
  ctx.keyboard = createKeyboardController(ctx);
  ctx.history = createHistoryController(ctx);
  ctx.cardOps = createCardOpsController(ctx);
  ctx.sidebar = createSidebarController(ctx);

  /* ---------- 7. Wire renderer callbacks (composition root) ---------- */
  // Routes PreviewRenderer/EditorRenderer/WordEditorManager action
  // callbacks to controller methods. Modal/Dropdown primitive onOpen/onClose
  // /onSelect callbacks are wired inside their respective controllers.
  wireRendererCallbacks(ctx);

  /* ---------- 8. Bind static events (P2-2: 9 bind* functions) ---------- */
  const cleanupEvents = bindAll(ctx);

  /* ---------- 9. State subscriber ---------- */
  const unsubscribeState = createStateSubscriber(ctx);

  /* ---------- 10. Init sequence ---------- */
  guard('loadCardsFromLocalStorage', () => ctx.storage.loadCardsFromLocalStorage());
  guard('renderEditor', () => ctx.uiAppliers.renderEditor());
  guard('renderPreview', () => ctx.uiAppliers.renderPreview());
  guard('applyCharLimit', () => ctx.charLimit.applyCharLimit());
  // Initial history snapshot
  historyManager.init(stateManager.snapshot());
  ctx.history.updateUndoRedoButtons();
  // Sidebar: open on desktop, closed on mobile
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    ctx.sidebar.setSidebarOpen(true);
  } else {
    ctx.sidebar.setSidebarOpen(false);
  }
  console.log('[Cardcraft] Initialized successfully:', stateManager.getCardCount(), 'cards loaded');

  /* ---------- 11. Cleanup ---------- */
  return () => {
    // Remove all tracked event listeners + beforeunload
    cleanupEvents();
    // Destroy controllers (most are no-ops; storage clears its saveTimer)
    ctx.storage.destroy();
    ctx.uiAppliers.destroy();
    ctx.modal.destroy();
    ctx.wordPopup.destroy();
    ctx.exporter.destroy();
    ctx.theme.destroy();
    ctx.charLimit.destroy();
    ctx.keyboard.destroy();
    ctx.history.destroy();
    ctx.cardOps.destroy();
    ctx.sidebar.destroy();
    // Destroy UI primitives
    sidebarAccordion.destroy();
    modalAccordion.destroy();
    colorModalController.destroy();
    themeDropdownController.destroy();
    modalCardThemeDropdownController.destroy();
    wordEditorManager.destroy();
    verticalResize.destroy();
    horizontalResize.destroy();
    toastQueue.destroy();
    // P1: destroy renderers (cleans up event delegation listeners — StrictMode safe)
    previewRenderer.destroy();
    editorRenderer.destroy();
    // Unsubscribe from state changes (prevents leak on React remount)
    unsubscribeState();
    // Clear history
    historyManager.clear();
    // Window listeners (boot-level)
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', unhandledRejection);
  };
}
