/**
 * OrchestratorContext — the shared "service bag" passed to every controller
 * and bind* function. Holds references to:
 *   - the root DOM element + cached DOM refs
 *   - core modules (StateManager, HistoryManager, renderers, toastQueue, etc.)
 *   - the uiState proxy (typed getter/setter over StateManager UI state)
 *   - shared ListenerTracker (for event cleanup)
 *   - all controller instances (sibling controllers — referenced lazily via
 *     closures so they can be constructed in any order)
 *   - UI primitives (Modal, Dropdown, Accordion instances — these have their
 *     own destroy() methods called separately by CardCraftApp.cleanup)
 *
 * Construction order:
 *   1. Build core context (root, refs, stateManager, renderers, uiState,
 *      listeners, UI primitives) — these are constructed directly.
 *   2. Construct each controller factory passing the (partially-filled) ctx.
 *      Controllers may register callbacks during construction that reference
 *      ctx.siblingController — this is safe because the callbacks fire LATER
 *      (after all controllers are constructed).
 *   3. After all controllers are set on ctx, call wireRendererCallbacks(ctx)
 *      and bindAll(ctx) to set up event listeners + renderer wiring.
 */

import type { StateManager } from '@/state/StateManager';
import type { HistoryManager } from '@/history/HistoryManager';
import type { PreviewRenderer } from '@/preview/PreviewRenderer';
import type { EditorRenderer } from '@/editor/EditorRenderer';
import type { WordEditorManager } from '@/word-editor/WordEditorManager';
import type { ToastQueue } from './toast';
import type { Modal } from '@/ui/Modal';
import type { Dropdown } from '@/ui/Dropdown';
import type { SidebarAccordion, ModalAccordion } from '@/ui/Accordion';
import type { Snapshot } from '@/core/types';

import type { DOMRefs } from './dom-refs';
import type { UIStateProxy } from './ui-state';
import type { ListenerTracker } from './helpers';
import type { createStorageController } from './storage-controller';
import type { createUIAppliers } from './ui-appliers';
import type { createModalController } from './modal-controller';
import type { createWordPopupController } from './word-popup-controller';
import type { createExportController } from './export-controller';
import type { createThemeController } from './theme-controller';
import type { createCharLimitController } from './char-limit-controller';
import type { createKeyboardController } from './keyboard-controller';
import type { createHistoryController } from './history-controller';
import type { createCardOpsController } from './card-ops';
import type { createSidebarController } from './sidebar-controller';

export interface OrchestratorContext {
  // ── Core DOM + state ──
  root: HTMLElement;
  refs: DOMRefs;
  stateManager: StateManager;
  historyManager: HistoryManager<Snapshot>;
  previewRenderer: PreviewRenderer;
  editorRenderer: EditorRenderer;
  wordEditorManager: WordEditorManager;
  toastQueue: ToastQueue;
  uiState: UIStateProxy;
  listeners: ListenerTracker;

  // ── UI primitives (Modal/Dropdown/Accordion) ──
  colorModalController: Modal;
  themeDropdownController: Dropdown;
  modalCardThemeDropdownController: Dropdown;
  sidebarAccordion: SidebarAccordion;
  modalAccordion: ModalAccordion;

  // ── Controllers (sibling refs — read lazily) ──
  storage: ReturnType<typeof createStorageController>;
  uiAppliers: ReturnType<typeof createUIAppliers>;
  modal: ReturnType<typeof createModalController>;
  wordPopup: ReturnType<typeof createWordPopupController>;
  exporter: ReturnType<typeof createExportController>;
  theme: ReturnType<typeof createThemeController>;
  charLimit: ReturnType<typeof createCharLimitController>;
  keyboard: ReturnType<typeof createKeyboardController>;
  history: ReturnType<typeof createHistoryController>;
  cardOps: ReturnType<typeof createCardOpsController>;
  sidebar: ReturnType<typeof createSidebarController>;
}
