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
 * On phone (< 600px):
 *   - "editor" mode → sidebar open (drawer slides in)
 *   - "preview" mode → sidebar closed (drawer slides out)
 *
 * On tablet/desktop (≥ 600px):
 *   - sidebar is part of split-view layout, mode concept doesn't apply
 *   - sidebar can still be toggled open/closed independently
 *   - data-mobile-mode is set to "preview" but has no visual effect (CSS
 *     hides the switcher and ignores the attribute)
 *
 * Breakpoint sync: on orientation/resize crossing 600px boundary, state
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

const log = createLogger('MobileMode');

export type MobileMode = 'editor' | 'preview';

const PHONE_BREAKPOINT = 600; // px — below = phone, above = tablet/desktop

export interface MobileModeController {
  setMobileMode(mode: MobileMode): void;
  toggleSidebar(): void;
  getMobileMode(): MobileMode;
  destroy(): void;
}

export function createMobileModeController(ctx: OrchestratorContext): MobileModeController {
  const { root, refs } = ctx;

  let currentMode: MobileMode = 'preview';
  let isPhone = false;
  let lastFocusedBeforeEditor: HTMLElement | null = null;
  let matchMediaListener: ((e: MediaQueryListEvent) => void) | null = null;
  let mql: MediaQueryList | null = null;
  // P3-SCROLL: per-session scroll positions for editor and preview
  let editorScrollTop = 0;
  let previewScrollTop = 0;

  /** Check if current viewport is phone (< 600px). */
  function checkIsPhone(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < PHONE_BREAKPOINT;
  }

  /**
   * THE single source of truth — syncs ALL state attributes/classes to match
   * the given mode. Called whenever mode or sidebar open state changes.
   */
  function syncState(mode: MobileMode, sidebarOpen: boolean): void {
    currentMode = mode;
    isPhone = checkIsPhone();

    // 1. data-mobile-mode on .cc-root
    root.setAttribute('data-mobile-mode', mode);

    // 2. .sidebar-open on .cc-root (controls backdrop visibility on phone).
    // P0-SYNC-V2: only set .sidebar-open on phone — on tablet/desktop the
    // backdrop is hidden via CSS and .sidebar-open would wrongly show it.
    if (isPhone) {
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

    log.debug('syncState', { mode, sidebarOpen, isPhone });
  }

  /**
   * Switch to a specific mobile mode. Only effective on phone — on
   * tablet/desktop this is a no-op (mode concept doesn't apply).
   * P3-SCROLL: saves scroll position of the current mode before switching,
   * then restores the scroll position of the target mode.
   */
  function setMobileMode(mode: MobileMode): void {
    if (!checkIsPhone()) {
      return;
    }
    // P3-SCROLL: save current scroll position before switching
    saveScrollPosition(currentMode);
    const sidebarOpen = mode === 'editor';
    syncState(mode, sidebarOpen);

    // P3-SCROLL: restore scroll position of target mode after DOM updates
    requestAnimationFrame(() => {
      restoreScrollPosition(mode);
    });

    // Focus management: when opening editor, save current focus + focus editor
    // When closing (preview), restore focus to opener
    if (mode === 'editor') {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) {
        lastFocusedBeforeEditor = active;
      }
      // Focus first input in editor (after a tick so DOM is ready)
      // P3-SCROLL: only focus if this is the first time opening editor
      // (no saved scroll = first open). On subsequent opens, preserve scroll
      // position instead of jumping to first input.
      const isFirstOpen = editorScrollTop === 0 && currentMode === 'preview';
      if (isFirstOpen) {
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

  /** P3-SCROLL: save scroll position of the given mode's container */
  function saveScrollPosition(mode: MobileMode): void {
    if (mode === 'editor') {
      const sidebar = document.getElementById('editorSidebar');
      const scrollArea = sidebar?.querySelector('.sidebar-scroll-area');
      if (scrollArea) {
        editorScrollTop = scrollArea.scrollTop;
      }
    } else {
      const preview = document.getElementById('previewWorkspace');
      if (preview) {
        previewScrollTop = preview.scrollTop;
      }
    }
  }

  /** P3-SCROLL: restore scroll position of the given mode's container */
  function restoreScrollPosition(mode: MobileMode): void {
    if (mode === 'editor') {
      const sidebar = document.getElementById('editorSidebar');
      const scrollArea = sidebar?.querySelector('.sidebar-scroll-area');
      if (scrollArea) {
        // Clamp to available scroll range (content may have changed)
        const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
        scrollArea.scrollTop = Math.min(editorScrollTop, Math.max(0, maxScroll));
      }
    } else {
      const preview = document.getElementById('previewWorkspace');
      if (preview) {
        const maxScroll = preview.scrollHeight - preview.clientHeight;
        preview.scrollTop = Math.min(previewScrollTop, Math.max(0, maxScroll));
      }
    }
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
    if (checkIsPhone()) {
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
   * Breakpoint change handler — reconciles state when crossing 600px.
   * - Phone→tablet: if editor mode was active, keep sidebar open (split-view)
   * - Tablet→phone: if sidebar was open, switch to editor mode; else preview
   */
  function handleBreakpointChange(e: MediaQueryListEvent): void {
    const wasPhone = isPhone;
    const nowPhone = !e.matches; // matches = ≥600px, so !matches = phone
    if (wasPhone === nowPhone) return; // no change

    log.info('Breakpoint crossed', { wasPhone, nowPhone });
    if (nowPhone) {
      // Tablet→phone: if sidebar currently open, switch to editor mode
      const sidebarOpen = !refs.editorSidebar?.classList.contains('collapsed');
      if (sidebarOpen) {
        syncState('editor', true);
      } else {
        syncState('preview', false);
      }
    } else {
      // Phone→tablet: keep sidebar state as-is, but mode becomes 'preview'
      const sidebarOpen = !refs.editorSidebar?.classList.contains('collapsed');
      syncState('preview', sidebarOpen);
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
    mql = window.matchMedia(`(min-width: ${PHONE_BREAKPOINT}px)`);
    matchMediaListener = handleBreakpointChange;
    // Modern API (Safari 14+)
    if (mql.addEventListener) {
      mql.addEventListener('change', matchMediaListener);
    } else if (mql.addListener) {
      // Legacy API (older Safari)
      mql.addListener(matchMediaListener);
    }
  }

  // Initialize state: start in preview mode with sidebar collapsed (phone)
  // or sidebar open (tablet/desktop — set by CardCraftApp after this controller)
  isPhone = checkIsPhone();
  syncState('preview', false);

  const cleanup = (): void => {
    if (switcher) {
      switcher.removeEventListener('click', handleSwitcherClick);
      switcher.removeEventListener('keydown', handleToggleKeydown);
    }
    if (mql && matchMediaListener) {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', matchMediaListener);
      } else if (mql.removeListener) {
        mql.removeListener(matchMediaListener);
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
