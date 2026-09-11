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

  get isOpen(): boolean {
    return this.modal.classList.contains('active') || this.modal.getAttribute('aria-hidden') === 'false';
  }

  open(): void {
    if (this.isOpen) return;
    this.previouslyFocused = document.activeElement as HTMLElement | null;

    this.modal.classList.add('active');
    this.modal.setAttribute('aria-hidden', 'false');
    this.modal.style.display = '';

    if (this.closeOnEscape) {
      document.addEventListener('keydown', this.keydownHandler);
    }

    // Focus management
    requestAnimationFrame(() => {
      const focusTarget = this.initialFocusSelector
        ? this.modal.querySelector<HTMLElement>(this.initialFocusSelector)
        : this.getFirstFocusable();
      focusTarget?.focus();
    });

    this.openHandlers.forEach((fn) => fn());
  }

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

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  onOpen(cb: () => void): void {
    this.openHandlers.push(cb);
  }

  onClose(cb: () => void): void {
    this.closeHandlers.push(cb);
  }

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
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
    // Basic focus trap: Tab cycles within modal
    if (e.key === 'Tab') {
      const focusables = this.getFocusables();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
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
      (el) => el.offsetParent !== null || el.getClientRects().length > 0,
    );
  }
}
