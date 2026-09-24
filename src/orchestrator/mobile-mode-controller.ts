/**
 * mobile-mode-controller.ts — single source of truth for sidebar/mode state.
 *
 * P0-SYNC-V2: This controller is the ONLY place that changes sidebar state.
 * It keeps all of these in sync:
 *   - data-mobile-mode on .cc-root ("editor" | "preview")
 *   - .collapsed on #editorSidebar
 *   - .sidebar-open on .cc-root
 *   - aria-expanded on #toggleSidebarBtn
 *   - aria-selected on #modeEditorTab / #modePreviewTab
 *
 * On compact screens (< 768px: phones + small tablets):
 *   - "editor" mode → sidebar open (drawer slides in)
 *   - "preview" mode → sidebar closed (drawer slides out)
 *
 * On split-view tablet/desktop (≥ 768px):
 *   - sidebar is part of split-view layout, mode concept doesn't apply
 *   - sidebar can still be toggled open/closed independently
 *   - data-mobile-mode is set to "preview" but has no visual effect (CSS
 *     hides the switcher and ignores the attribute)
 *
 * Breakpoint sync: on orientation/resize crossing 768px boundary, state
 * is reconciled via matchMedia listener.
 *
 * Public API:
 *   setMobileMode(mode)
 *   toggleSidebar()
 *   getMobileMode()
 *   destroy()
 */

import type { OrchestratorContext } from './types';
import { createLogger } from '@/lib/logger';
import { COMPACT_LAYOUT_BREAKPOINT, isCompactLayout } from './responsive-layout';

const log = createLogger('MobileMode');

export type MobileMode = 'editor' | 'preview';

export interface MobileModeController {
  setMobileMode(mode: MobileMode): void;
  toggleSidebar(): void;
  getMobileMode(): MobileMode;
  destroy(): void;
}

export function createMobileModeController(ctx: OrchestratorContext): MobileModeController {
  const { root, refs } = ctx;

  let currentMode: MobileMode = 'preview';
  let isCompact = false;
  let lastFocusedBeforeEditor: HTMLElement | null = null;
  // P2-FIX: explicit flag for first editor open — don't use scrollTop===0
  let hasOpenedEditor = false;
  // P6-LEAK: store handler reference for cleanup
  let matchMediaHandler: ((e: MediaQueryListEvent) => void) | null = null;
  let mql: MediaQueryList | null = null;
  // P3-SCROLL: per-session scroll positions for editor and preview
  let editorScrollTop = 0;
  let previewScrollTop = 0;

  /**
   * THE single source of truth — syncs ALL state attributes/classes to match
   * the given mode. Called whenever mode or sidebar open state changes.
   */
  function syncState(mode: MobileMode, sidebarOpen: boolean): void {
    currentMode = mode;
    isCompact = isCompactLayout();

    // 1. data-mobile-mode on .cc-root
    root.setAttribute('data-mobile-mode', mode);

    // 2. .sidebar-open on .cc-root (controls backdrop visibility on phone).
    // P0-SYNC-V2: only set .sidebar-open on phone — on tablet/desktop the
    // backdrop is hidden via CSS and .sidebar-open would wrongly show it.
    if (isCompact) {
      root.classList.toggle('sidebar-open', sidebarOpen);
    } else {
      root.classList.remove('sidebar-open');
    }

    // 3. .collapsed on #editor-sidebar (controls drawer slide)
    if (refs.editorSidebar) {
      if (sidebarOpen) {
        refs.editorSidebar.classList.remove('collapsed');
      } else {
        refs.editorSidebar.classList.add('collapsed');
      }
    }

    // 4. aria-expanded on #toggleSidebarBtn
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(sidebarOpen));
    }

    // 5. aria-selected on mode tabs (only relevant on phone)
    const editorTab = document.getElementById('modeEditorTab');
    const previewTab = document.getElementById('modePreviewTab');
    if (editorTab) {
      editorTab.setAttribute('aria-selected', mode === 'editor' ? 'true' : 'false');
      editorTab.classList.toggle('active', mode === 'editor');
      // Roving tabindex: only the active tab is in tab order
      editorTab.setAttribute('tabindex', mode === 'editor' ? '0' : '-1');
    }
    if (previewTab) {
      previewTab.setAttribute('aria-selected', mode === 'preview' ? 'true' : 'false');
      previewTab.classList.toggle('active', mode === 'preview');
      previewTab.setAttribute('tabindex', mode === 'preview' ? '0' : '-1');
    }

    // Keep the inactive compact-layout region out of both the accessibility
    // tree and sequential focus navigation. In split-view both regions stay
    // available at the same time.
    const editorHidden = isCompact && mode === 'preview';
    const previewHidden = isCompact && mode === 'editor';
    if (refs.editorSidebar) {
      refs.editorSidebar.toggleAttribute('inert', editorHidden);
      refs.editorSidebar.setAttribute('aria-hidden', String(editorHidden));
    }
    if (refs.previewWorkspace) {
      refs.previewWorkspace.toggleAttribute('inert', previewHidden);
      refs.previewWorkspace.setAttribute('aria-hidden', String(previewHidden));
    }

    log.debug('syncState', { mode, sidebarOpen, isCompact });
  }

  /**
   * Switch to a specific mobile mode. Only effective on phone — on
   * tablet/desktop this is a no-op (mode concept doesn't apply).
   * P1-FIX: saves #editorSidebar.scrollTop (NOT .sidebar-scroll-area which
   * has overflow:visible on mobile and is not a scroll container).
   * P2-FIX: uses hasOpenedEditor flag for first-open focus, not scrollTop===0.
   */
  function setMobileMode(mode: MobileMode): void {
    if (!isCompactLayout()) {
      return;
    }
    // P1-FIX: save current scroll position BEFORE syncState
    const prevMode = currentMode;
    saveScrollPosition(prevMode);
    const sidebarOpen = mode === 'editor';
    syncState(mode, sidebarOpen);

    // P1-FIX: restore scroll position of target mode after DOM updates
    requestAnimationFrame(() => {
      restoreScrollPosition(mode);
    });

    // P2-FIX: focus management using explicit hasOpenedEditor flag
    if (mode === 'editor') {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) {
        lastFocusedBeforeEditor = active;
      }
      // Only focus first input on FIRST editor open
      if (!hasOpenedEditor) {
        hasOpenedEditor = true;
        setTimeout(() => {
          const firstInput = document.querySelector<HTMLElement>(
            '#editorCardsList input[data-field="title"], #editorCardsList textarea[data-field="text"]',
          );
          if (firstInput && document.activeElement !== firstInput) {
            firstInput.focus();
          }
        }, 50);
      }
    } else {
      // Closing editor — restore focus to opener
      if (lastFocusedBeforeEditor) {
        setTimeout(() => {
          try {
            lastFocusedBeforeEditor?.focus();
          } catch {
            // ignore
          }
        }, 50);
      }
    }
  }

  /** P1-FIX: save scroll position of the given mode's container.
   *  Editor: #editorSidebar (NOT .sidebar-scroll-area — it has overflow:visible on mobile)
   *  Preview: find the actual scrollable element inside #previewWorkspace */
  function saveScrollPosition(mode: MobileMode): void {
    if (mode === 'editor') {
      const sidebar = document.getElementById('editorSidebar');
      if (sidebar) {
        editorScrollTop = sidebar.scrollTop;
      }
    } else {
      // P1-FIX: find the actual scroll container in preview
      const scrollEl = findPreviewScrollContainer();
      if (scrollEl) {
        previewScrollTop = scrollEl.scrollTop;
      }
    }
  }

  /** P1-FIX: restore scroll position of the given mode's container. */
  function restoreScrollPosition(mode: MobileMode): void {
    if (mode === 'editor') {
      const sidebar = document.getElementById('editorSidebar');
      if (sidebar) {
        const maxScroll = sidebar.scrollHeight - sidebar.clientHeight;
        sidebar.scrollTop = Math.min(editorScrollTop, Math.max(0, maxScroll));
      }
    } else {
      const scrollEl = findPreviewScrollContainer();
      if (scrollEl) {
        const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
        scrollEl.scrollTop = Math.min(previewScrollTop, Math.max(0, maxScroll));
      }
    }
  }

  /** P1-FIX: find the actual scrollable element in the preview area.
   *  On phone, #previewWorkspace may have overflow:hidden, and the actual
   *  scroll container is a child element (like .cards-container or #cardsArea). */
  function findPreviewScrollContainer(): HTMLElement | null {
    const ws = document.getElementById('previewWorkspace');
    if (!ws) return null;
    // Check if ws itself is scrollable
    if (ws.scrollHeight > ws.clientHeight + 1) return ws;
    // Check #cardsArea
    const cards = document.getElementById('cardsArea');
    if (cards && cards.scrollHeight > cards.clientHeight + 1) return cards;
    // Search direct children
    for (const child of Array.from(ws.children)) {
      const el = child as HTMLElement;
      if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 50) return el;
    }
    // Fallback: return ws (even if not scrollable — restore will be no-op)
    return ws;
  }

  /**
   * Toggle sidebar open/closed. Called by #toggleSidebarBtn click handler
   * (events.ts delegates here) and by backdrop click.
   *
   * On phone: toggles between editor/preview modes.
   * On tablet/desktop: toggles .collapsed (sidebar open/close).
   */
  function toggleSidebar(): void {
    const willBeOpen = refs.editorSidebar?.classList.contains('collapsed') ?? false;
    if (isCompactLayout()) {
      // Phone: mode-driven
      setMobileMode(willBeOpen ? 'editor' : 'preview');
    } else {
      // Tablet/desktop: just toggle .collapsed, keep mode as 'preview'
      syncState('preview', willBeOpen);
    }
  }

  function getMobileMode(): MobileMode {
    return currentMode;
  }

  // ─── Event handlers ──────────────────────────────────────────────

  function handleSwitcherClick(e: Event): void {
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
      setMobileMode('preview');
      return;
    }
  }

  function handleToggleKeydown(e: KeyboardEvent): void {
    // Arrow keys on mode tabs → roving tabindex
    const target = e.target as HTMLElement;
    if (!target.matches('.mobile-mode-tab')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const editorTab = document.getElementById('modeEditorTab');
      const previewTab = document.getElementById('modePreviewTab');
      const isEditor = target.id === 'modeEditorTab';
      const otherTab = isEditor ? previewTab : editorTab;
      if (otherTab) {
        // Move focus + activate the other tab
        otherTab.focus();
        const newMode = otherTab.dataset.mode as MobileMode;
        if (newMode) setMobileMode(newMode);
      }
    }
  }

  /**
   * Breakpoint change handler — reconciles state when crossing 768px.
   * - Compact→split: reveal editor and preview together
   * - Split→compact: derive the focused mode from sidebar visibility
   */
  function handleBreakpointChange(e: MediaQueryListEvent): void {
    const wasCompact = isCompact;
    const nowCompact = !e.matches;
    if (wasCompact === nowCompact) return;

    log.info('Breakpoint crossed', { wasCompact, nowCompact });
    if (nowCompact) {
      // Split→compact: if sidebar is open, keep the user in the editor.
      const sidebarOpen = !refs.editorSidebar?.classList.contains('collapsed');
      if (sidebarOpen) {
        syncState('editor', true);
      } else {
        syncState('preview', false);
      }
    } else {
      // Compact→split: reveal both panes. The wider layout has enough room
      // for simultaneous editing and preview, regardless of the focused tab
      // that was active before rotation/resize.
      syncState('preview', true);
    }
  }

  // ─── Wire up ─────────────────────────────────────────────────────

  const switcher = document.getElementById('mobileModeSwitcher');
  if (switcher) {
    switcher.addEventListener('click', handleSwitcherClick);
    switcher.addEventListener('keydown', handleToggleKeydown);
  }

  // matchMedia for breakpoint sync (orientation/resize)
  if (typeof window !== 'undefined' && window.matchMedia) {
    mql = window.matchMedia(`(min-width: ${COMPACT_LAYOUT_BREAKPOINT}px)`);
    matchMediaHandler = handleBreakpointChange;
    // Modern API (Safari 14+)
    if (mql.addEventListener) {
      mql.addEventListener('change', matchMediaHandler);
    } else if (mql.addListener) {
      // Legacy API (older Safari)
      mql.addListener(matchMediaHandler);
    }
  }

  // Initialize state: compact layouts start in preview; split-view layouts
  // expose editor and preview together. CardCraftApp mirrors this into the
  // persisted UI state immediately after controller creation.
  isCompact = isCompactLayout();
  syncState('preview', !isCompact);

  const cleanup = (): void => {
    if (switcher) {
      switcher.removeEventListener('click', handleSwitcherClick);
      switcher.removeEventListener('keydown', handleToggleKeydown);
    }
    if (mql && matchMediaHandler) {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', matchMediaHandler);
      } else if (mql.removeListener) {
        mql.removeListener(matchMediaHandler);
      }
    }
  };

  return {
    setMobileMode,
    toggleSidebar,
    getMobileMode,
    destroy() {
      cleanup();
    },
  };
}
