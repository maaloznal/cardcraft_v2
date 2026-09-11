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
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 520;

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

    const onPointerUp = (): void => {
      isDragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
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
      e.preventDefault();
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
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
      document.removeEventListener('pointerup', onPointerUp);
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

    const onPointerMove = (e: PointerEvent): void => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const newWidth = Math.min(Math.max(MIN_SIDEBAR_WIDTH, startWidth + dx), MAX_SIDEBAR_WIDTH);
      sidebar.style.width = `${newWidth}px`;
      sidebar.style.transition = 'none';
    };

    const onPointerUp = (): void => {
      isDragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      sidebar.style.transition = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      try {
        localStorage.setItem(
          'flashcard-sidebar-width',
          String(sidebar.getBoundingClientRect().width),
        );
      } catch {
        /* ignore */
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (sidebar.classList.contains('collapsed')) return;
      isDragging = true;
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      divider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    };

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

    divider.addEventListener('pointerdown', onPointerDown);
    this.cleanup = (): void => {
      divider.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }

  destroy(): void {
    if (this.cleanup) this.cleanup();
    this.cleanup = null;
  }
}
