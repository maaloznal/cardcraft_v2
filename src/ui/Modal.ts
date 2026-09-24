/**
 * Modal — vanilla JS imperative modal controller with focus trap + escape + backdrop.
 *
 * Replaces the ad-hoc modal show/hide logic in card-constructor.ts.
 * Handles: open/close, backdrop click, ESC key, focus management.
 *
 * DOM contract:
 *   <div class="modal" id="myModal" aria-hidden="true">
 *     <div class="modal-backdrop" data-modal-close></div>
 *     <div class="modal-content" role="dialog" aria-modal="true">
 *       <button data-modal-close>✕</button>
 *       …content…
 *     </div>
 *   </div>
 *
 * Public API:
 *   new Modal(modalEl, opts?)            — wire up modal behavior
 *   open()                                — show modal (focus first input)
 *   close()                               — hide modal (restore focus)
 *   isOpen                                — boolean
 *   onOpen(cb) / onClose(cb)              — callbacks
 *   destroy()                             — cleanup
 */

export interface ModalOptions {
  /** Selector for elements that close the modal when clicked */
  closeSelector?: string;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether pressing ESC closes the modal (default: true) */
  closeOnEscape?: boolean;
  /** Selector for the element to focus when modal opens (default: first focusable) */
  initialFocusSelector?: string;
}

export class Modal {
  private modal: HTMLElement;
  private closeSelector: string;
  private closeOnBackdrop: boolean;
  private closeOnEscape: boolean;
  private initialFocusSelector?: string;

  private openHandlers: Array<() => void> = [];
  private closeHandlers: Array<() => void> = [];

  private previouslyFocused: HTMLElement | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;
  private clickHandler: (e: Event) => void;

  constructor(modal: HTMLElement, opts: ModalOptions = {}) {
    this.modal = modal;
    this.closeSelector = opts.closeSelector ?? '[data-modal-close]';
    this.closeOnBackdrop = opts.closeOnBackdrop ?? true;
    this.closeOnEscape = opts.closeOnEscape ?? true;
    this.initialFocusSelector = opts.initialFocusSelector;

    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    this.clickHandler = (e: Event) => this.handleClick(e);

    this.modal.addEventListener('click', this.clickHandler);
  }

  /** Whether the modal is currently open (.active class or aria-hidden=false). */
  get isOpen(): boolean {
    return this.modal.classList.contains('active') || this.modal.getAttribute('aria-hidden') === 'false';
  }

  /**
   * Open the modal: capture the previously-focused element, add .active,
   * set aria-hidden=false, attach the Escape key listener, then focus the
   * initial element (or first focusable). Fires all onOpen callbacks.
   */
  open(): void {
    if (this.isOpen) return;
    this.previouslyFocused = document.activeElement as HTMLElement | null;

    this.modal.classList.add('active');
    this.modal.setAttribute('aria-hidden', 'false');
    this.modal.style.display = '';

    // P3-FIX: always attach keydown handler for focus trap (Tab cycling).
    // Escape handling is conditional on closeOnEscape, but focus trap must
    // always be active when modal is open.
    document.addEventListener('keydown', this.keydownHandler);

    // Focus management
    // P3-FIX: force style recalculation via getComputedStyle.
    // This ensures visibility:visible is applied before focus().
    void getComputedStyle(this.modal).visibility;
    const focusTarget = this.initialFocusSelector
      ? this.modal.querySelector<HTMLElement>(this.initialFocusSelector)
      : this.getFirstFocusable();
    focusTarget?.focus();

    this.openHandlers.forEach((fn) => fn());
  }

  /**
   * Close the modal: remove .active, set aria-hidden=true, detach the Escape
   * listener, restore focus to the previously-focused element, then fire all
   * onClose callbacks. No-op if already closed.
   */
  close(): void {
    if (!this.isOpen) return;
    this.modal.classList.remove('active');
    this.modal.setAttribute('aria-hidden', 'true');

    document.removeEventListener('keydown', this.keydownHandler);

    // Restore focus
    this.previouslyFocused?.focus();
    this.previouslyFocused = null;

    this.closeHandlers.forEach((fn) => fn());
  }

  /** Toggle the modal open/closed based on its current state. */
  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Register a callback fired after the modal opens. */
  onOpen(cb: () => void): void {
    this.openHandlers.push(cb);
  }

  /** Register a callback fired after the modal closes. */
  onClose(cb: () => void): void {
    this.closeHandlers.push(cb);
  }

  /** Remove the click + keydown listeners + clear all open/close callbacks — call on app teardown. */
  destroy(): void {
    this.modal.removeEventListener('click', this.clickHandler);
    document.removeEventListener('keydown', this.keydownHandler);
    this.openHandlers = [];
    this.closeHandlers = [];
  }

  // ─── Private ────────────────────────────────────────────────

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.closest(this.closeSelector)) {
      e.stopPropagation();
      this.close();
      return;
    }
    // Backdrop click: target IS the modal (not its content)
    if (this.closeOnBackdrop && target === this.modal) {
      this.close();
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    // P3-FIX: Escape only closes if closeOnEscape is true
    if (e.key === 'Escape' && this.closeOnEscape) {
      e.preventDefault();
      this.close();
      return;
    }
    // Focus trap: Tab cycles within modal (always active when modal is open)
    // P3-FIX: always preventDefault to ensure focus stays within modal
    if (e.key === 'Tab') {
      const focusables = this.getFocusables();
      if (focusables.length === 0) return;
      e.preventDefault();
      const currentIndex = focusables.findIndex((el) => el === document.activeElement);
      if (e.shiftKey) {
        const prevIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
        focusables[prevIndex].focus();
      } else {
        const nextIndex = currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1;
        focusables[nextIndex].focus();
      }
    }
  }

  private getFirstFocusable(): HTMLElement | null {
    const focusables = this.getFocusables();
    return focusables[0] ?? null;
  }

  private getFocusables(): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    return Array.from(this.modal.querySelectorAll<HTMLElement>(selector)).filter(
      // P3-FIX: don't use offsetParent — it returns null for children of
      // position:fixed elements, which is what modal-overlay is.
      // Instead check computed visibility and display directly.
      (el) => {
        const style = getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
    );
  }
}
