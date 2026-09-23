/**
 * Resizers — pointer-based resize handlers for sidebar dividers.
 *
 * VerticalResize — resizes the .sidebar-fixed-header height (drag horizontally? no, vertically).
 *   Divider: #resizeDividerH (horizontal divider, drag vertically).
 *   Affects: .sidebar-fixed-header height.
 *   Constraint: min 60px, max (sidebarHeight - 60).
 *   Persists: 'flashcard-header-height' in localStorage.
 *
 * HorizontalResize — resizes the #editorSidebar width (drag horizontally).
 *   Divider: #resizeDividerV (vertical divider, drag horizontally).
 *   Affects: #editorSidebar width.
 *   Constraint: min 260px, max 520px.
 *   Persists: 'flashcard-sidebar-width' in localStorage.
 *   Disabled when sidebar is collapsed.
 *
 * Public API:
 *   new VerticalResize(divider, sidebar)   — wire up vertical resize
 *   new HorizontalResize(divider, sidebar)  — wire up horizontal resize
 *   destroy()                               — cleanup listeners
 */

const MIN_SECTION_HEIGHT = 60;
// P1-RESIZE-V2: aligned with CSS (mobile.css tablet sets max-width: 400px
// via clamp(280px, 38vw, 340px) + max-width: 400px). Previously TS allowed
// up to 520px but CSS clamped to 400 — drag appeared to do nothing beyond 400.
// Now both agree: 260-400px.
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 400;

export class VerticalResize {
  private cleanup: (() => void) | null = null;

  constructor(divider: HTMLElement, sidebar: HTMLElement) {
    const fixedHeader = sidebar.querySelector<HTMLElement>('.sidebar-fixed-header');
    if (!fixedHeader) return;

    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    const onPointerMove = (e: PointerEvent): void => {
      if (!isDragging) return;
      const dy = e.clientY - startY;
      const sidebarHeight = sidebar.getBoundingClientRect().height;
      const newHeight = Math.min(
        Math.max(MIN_SECTION_HEIGHT, startHeight + dy),
        sidebarHeight - MIN_SECTION_HEIGHT,
      );
      fixedHeader.style.height = `${newHeight}px`;
      fixedHeader.style.flex = 'none';
    };

    const endDrag = (): void => {
      isDragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
      try {
        localStorage.setItem(
          'flashcard-header-height',
          String(fixedHeader.getBoundingClientRect().height),
        );
      } catch {
        /* ignore */
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      isDragging = true;
      startY = e.clientY;
      startHeight = fixedHeader.getBoundingClientRect().height;
      divider.classList.add('dragging');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      // Prevent the touch from also scrolling the page (touch-action: none
      // on the divider handles the divider element itself, but once the pointer
      // is captured by document, we also need preventDefault on the move events).
      e.preventDefault();
      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', endDrag);
      // pointercancel fires on mobile when the OS interrupts the gesture
      // (incoming notification, screen rotation, multi-touch, etc.). Without
      // this, the drag would "stick" — divider stays in dragging state.
      document.addEventListener('pointercancel', endDrag);
    };

    // Restore saved height
    try {
      const saved = localStorage.getItem('flashcard-header-height');
      if (saved) {
        const h = Number(saved);
        if (h >= 80) {
          fixedHeader.style.height = `${h}px`;
          fixedHeader.style.flex = 'none';
        }
      }
    } catch {
      /* ignore */
    }

    divider.addEventListener('pointerdown', onPointerDown);
    this.cleanup = (): void => {
      divider.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
    };
  }

  destroy(): void {
    if (this.cleanup) this.cleanup();
    this.cleanup = null;
  }
}

export class HorizontalResize {
  private cleanup: (() => void) | null = null;

  constructor(divider: HTMLElement, sidebar: HTMLElement) {
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    // Track which event system started the drag to avoid double-processing
    // when both pointerdown and mousedown fire for the same interaction.
    let dragSource: 'pointer' | 'mouse' | null = null;

    // ─── Pointer Events (primary mechanism) ──────────────────────
    const onPointerMove = (e: PointerEvent): void => {
      if (!isDragging || dragSource !== 'pointer') return;
      const dx = e.clientX - startX;
      const newWidth = Math.min(Math.max(MIN_SIDEBAR_WIDTH, startWidth + dx), MAX_SIDEBAR_WIDTH);
      sidebar.style.width = `${newWidth}px`;
      sidebar.style.transition = 'none';
      updateAriaValue(newWidth);
    };

    const onPointerUp = (): void => {
      if (!isDragging || dragSource !== 'pointer') return;
      endDrag();
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (sidebar.classList.contains('collapsed')) return;
      if (isDragging) return; // already dragging via another event system
      isDragging = true;
      dragSource = 'pointer';
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      divider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    };

    // ─── Mouse Events (fallback for environments without pointer events) ──
    // Only fires if pointer events didn't start the drag (dragSource !== 'pointer').
    const onMouseMove = (e: MouseEvent): void => {
      if (!isDragging || dragSource !== 'mouse') return;
      const dx = e.clientX - startX;
      const newWidth = Math.min(Math.max(MIN_SIDEBAR_WIDTH, startWidth + dx), MAX_SIDEBAR_WIDTH);
      sidebar.style.width = `${newWidth}px`;
      sidebar.style.transition = 'none';
      updateAriaValue(newWidth);
    };

    const onMouseUp = (): void => {
      if (!isDragging || dragSource !== 'mouse') return;
      endDrag();
    };

    const onMouseDown = (e: MouseEvent): void => {
      if (sidebar.classList.contains('collapsed')) return;
      if (isDragging) return; // pointer events already started drag
      isDragging = true;
      dragSource = 'mouse';
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      divider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    // ─── Shared cleanup ──────────────────────────────────────────
    function endDrag(): void {
      isDragging = false;
      dragSource = null;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      sidebar.style.transition = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem(
          'flashcard-sidebar-width',
          String(sidebar.getBoundingClientRect().width),
        );
      } catch {
        /* ignore */
      }
    }

    // Restore saved width
    try {
      const saved = localStorage.getItem('flashcard-sidebar-width');
      if (saved) {
        const w = Number(saved);
        if (w >= MIN_SIDEBAR_WIDTH && w <= MAX_SIDEBAR_WIDTH) {
          sidebar.style.width = `${w}px`;
        }
      }
    } catch {
      /* ignore */
    }

    // ─── Keyboard support ────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent): void => {
      if (sidebar.classList.contains('collapsed')) return;
      let delta = 0;
      if (e.key === 'ArrowLeft') delta = -10;
      else if (e.key === 'ArrowRight') delta = 10;
      else if (e.key === 'Home') {
        sidebar.style.width = `${MIN_SIDEBAR_WIDTH}px`;
        sidebar.style.transition = 'none';
        updateAriaValue(MIN_SIDEBAR_WIDTH);
        e.preventDefault();
        return;
      } else if (e.key === 'End') {
        sidebar.style.width = `${MAX_SIDEBAR_WIDTH}px`;
        sidebar.style.transition = 'none';
        updateAriaValue(MAX_SIDEBAR_WIDTH);
        e.preventDefault();
        return;
      } else return;
      e.preventDefault();
      const currentWidth = sidebar.getBoundingClientRect().width;
      const newWidth = Math.min(
        Math.max(MIN_SIDEBAR_WIDTH, currentWidth + delta),
        MAX_SIDEBAR_WIDTH,
      );
      sidebar.style.width = `${newWidth}px`;
      sidebar.style.transition = 'none';
      updateAriaValue(newWidth);
    };

    /** Update aria-valuenow on the divider to reflect current sidebar width. */
    function updateAriaValue(width: number): void {
      divider.setAttribute('aria-valuenow', String(Math.round(width)));
    }

    // ─── Register listeners ──────────────────────────────────────
    // Pointer events first (primary), then mouse events (fallback).
    // The isDragging + dragSource guard prevents double-drag.
    divider.addEventListener('pointerdown', onPointerDown);
    divider.addEventListener('mousedown', onMouseDown);
    divider.addEventListener('keydown', onKeyDown);
    updateAriaValue(sidebar.getBoundingClientRect().width);

    this.cleanup = (): void => {
      divider.removeEventListener('pointerdown', onPointerDown);
      divider.removeEventListener('mousedown', onMouseDown);
      divider.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  destroy(): void {
    if (this.cleanup) this.cleanup();
    this.cleanup = null;
  }
}
