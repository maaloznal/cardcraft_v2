/**
 * sidebar-controller.ts — sidebar open/close + UI state sync.
 *
 * Owns:
 *   - setSidebarOpen(open) — toggle .collapsed on sidebar + .sidebar-open
 *     on root + sync logical sidebarOpen flag into StateManager UI state.
 *
 * Extracted from CardCraftApp.ts section 19 (lines 816-828).
 *
 * Public API:
 *   setSidebarOpen(open)
 *   destroy() — no-op (stateless)
 */

import type { OrchestratorContext } from './types';

export interface SidebarController {
  setSidebarOpen(open: boolean): void;
  destroy(): void;
}

export function createSidebarController(ctx: OrchestratorContext): SidebarController {
  const { root, refs, stateManager } = ctx;

  /**
   * Toggle sidebar open/closed: add/remove .collapsed on #editorSidebar +
   * .sidebar-open on root, and sync the logical sidebarOpen flag into
   * StateManager UI state (P1-3).
   */
  function setSidebarOpen(open: boolean): void {
    if (!refs.editorSidebar) return;
    if (open) {
      refs.editorSidebar.classList.remove('collapsed');
      root.classList.add('sidebar-open');
    } else {
      refs.editorSidebar.classList.add('collapsed');
      root.classList.remove('sidebar-open');
    }
    // P1-3: sync logical sidebar state into StateManager
    stateManager.setUI({ sidebarOpen: open });
  }

  return {
    setSidebarOpen,
    /** No-op — the controller is stateless (open/closed state lives in StateManager). */
    destroy() {
      /* stateless */
    },
  };
}
