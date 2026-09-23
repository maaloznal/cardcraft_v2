/**
 * mobile-mode-controller.ts — phone mode switching (Editor / Preview).
 *
 * On screens < 600px the layout doesn't have room for both editor and
 * preview simultaneously. This controller wires the .mobile-mode-tab
 * buttons to switch the visible area via data-mobile-mode on .cc-root.
 *
 * Behavior:
 *   - Click "Редактор" tab → data-mobile-mode="editor" + open sidebar
 *   - Click "Просмотр" tab → data-mobile-mode="preview" + close sidebar
 *   - Click "×" close button → close sidebar + switch to preview
 *   - When sidebar opens via #toggleSidebarBtn on phone, auto-switch to
 *     editor mode (so opening the sidebar shows the editor, not preview)
 *
 * On desktop / tablet (≥ 600px), the switcher is hidden via CSS and this
 * controller's clicks are no-ops (the elements aren't visible/clickable).
 *
 * State persistence: the active mode is NOT persisted to localStorage —
 * on every page load the app starts in preview mode (matches the default
 * sidebar.collapsed state). The user's in-progress card content is always
 * preserved (it lives in StateManager + StorageManager, independent of mode).
 *
 * Public API:
 *   setMobileMode(mode: 'editor' | 'preview')
 *   getMobileMode(): 'editor' | 'preview'
 *   destroy()
 */

import type { OrchestratorContext } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('MobileMode');

export type MobileMode = 'editor' | 'preview';

export interface MobileModeController {
  setMobileMode(mode: MobileMode): void;
  getMobileMode(): MobileMode;
  destroy(): void;
}

export function createMobileModeController(ctx: OrchestratorContext): MobileModeController {
  const { root, sidebar } = ctx;

  let currentMode: MobileMode = 'preview';

  function setMobileMode(mode: MobileMode): void {
    if (mode === currentMode) return;
    currentMode = mode;
    root.setAttribute('data-mobile-mode', mode);
    log.debug('Mode set', { mode });

    // Sync sidebar open state with mode:
    // - editor mode → sidebar must be open (so user sees the editor)
    // - preview mode → sidebar closes (so user sees the preview)
    if (mode === 'editor') {
      sidebar.setSidebarOpen(true);
    } else {
      sidebar.setSidebarOpen(false);
    }

    // Update aria-selected on tabs (role="tab" supports aria-selected, not aria-pressed)
    const editorTab = document.getElementById('modeEditorTab');
    const previewTab = document.getElementById('modePreviewTab');
    if (editorTab) {
      editorTab.setAttribute('aria-selected', mode === 'editor' ? 'true' : 'false');
      editorTab.classList.toggle('active', mode === 'editor');
    }
    if (previewTab) {
      previewTab.setAttribute('aria-selected', mode === 'preview' ? 'true' : 'false');
      previewTab.classList.toggle('active', mode === 'preview');
    }
  }

  function getMobileMode(): MobileMode {
    return currentMode;
  }

  // Wire up event listeners on the tabs + close button
  // Use event delegation on the switcher container so we don't need to
  // re-bind when DOM changes.
  function handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    const tab = target.closest<HTMLElement>('.mobile-mode-tab');
    const closeBtn = target.closest<HTMLElement>('#closeSidebarBtn');

    if (tab) {
      const mode = tab.dataset.mode as MobileMode | undefined;
      if (mode === 'editor' || mode === 'preview') {
        setMobileMode(mode);
      }
      return;
    }

    if (closeBtn) {
      // Close button: switch to preview (which closes sidebar via setMobileMode)
      setMobileMode('preview');
      return;
    }
  }

  // Listen on the switcher container
  const switcher = document.getElementById('mobileModeSwitcher');
  if (switcher) {
    switcher.addEventListener('click', handleClick);
  }

  // NOTE: We deliberately do NOT add a click listener on #toggleSidebarBtn
  // here — events.ts already has one that toggles .collapsed on the sidebar.
  // Adding another listener here would race with the events.ts one:
  //   1. mobile-mode-controller reads collapsed=true, calls setMobileMode('editor')
  //      → setSidebarOpen(true) removes .collapsed
  //   2. events.ts listener reads collapsed (now false), calls setSidebarOpen(false)
  //      → adds .collapsed back
  // The sidebar would appear stuck. The switcher tabs alone are sufficient
  // for mode switching — the sidebar toggle button handles open/close.

  // Initialize: start in preview mode (matches sidebar.collapsed default)
  root.setAttribute('data-mobile-mode', 'preview');

  // Cleanup function stored for destroy()
  const cleanup = (): void => {
    if (switcher) switcher.removeEventListener('click', handleClick);
  };

  return {
    setMobileMode,
    getMobileMode,
    destroy() {
      cleanup();
    },
  };
}
