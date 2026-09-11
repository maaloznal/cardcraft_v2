/**
 * ui-state.ts — typed getter/setter proxy over StateManager UI state.
 *
 * P1-3 introduced this proxy so call sites read naturally
 *   (uiState.activeCardIndexForColors)
 * and assign naturally
 *   (uiState.activeCardIndexForColors = null)
 * while StateManager remains the single source of truth — every read
 * delegates to stateManager.getUI(), every write dispatches SET_UI.
 *
 * Extracted from CardCraftApp.ts closure into a factory function so it
 * can be unit-tested in isolation and shared across controllers.
 */

import type { StateManager } from '@/state/StateManager';

export interface UIStateProxy {
  /** Color modal: which card index is being edited */
  activeCardIndexForColors: number | null;
  /** Color modal: which field row is currently selected (e.g. 'title') */
  lastActiveField: string;
  /** Sidebar: captured state before modal opened, restored on close */
  sidebarWasCollapsedBeforeModal: boolean;
  /** Word popup: which card index is being edited */
  activeCardIndexForWord: number | null;
  /** Word popup: which field is being edited */
  activeFieldForWord: string | null;
}

/**
 * Build the UI-state proxy. Reads delegate to stateManager.getUI();
 * writes dispatch SET_UI via stateManager.setUI().
 */
export function createUIStateProxy(stateManager: StateManager): UIStateProxy {
  return {
    get activeCardIndexForColors(): number | null {
      return stateManager.getUI().activeCardIndexForColors;
    },
    set activeCardIndexForColors(v: number | null) {
      stateManager.setUI({ activeCardIndexForColors: v });
    },
    get lastActiveField(): string {
      return stateManager.getUI().lastActiveField;
    },
    set lastActiveField(v: string) {
      stateManager.setUI({ lastActiveField: v });
    },
    get sidebarWasCollapsedBeforeModal(): boolean {
      return stateManager.getUI().sidebarWasCollapsedBeforeModal;
    },
    set sidebarWasCollapsedBeforeModal(v: boolean) {
      stateManager.setUI({ sidebarWasCollapsedBeforeModal: v });
    },
    get activeCardIndexForWord(): number | null {
      return stateManager.getUI().activeCardIndexForWord;
    },
    set activeCardIndexForWord(v: number | null) {
      stateManager.setUI({ activeCardIndexForWord: v });
    },
    get activeFieldForWord(): string | null {
      return stateManager.getUI().activeFieldForWord;
    },
    set activeFieldForWord(v: string | null) {
      stateManager.setUI({ activeFieldForWord: v });
    },
  };
}
