/**
 * Dropdown — vanilla JS imperative dropdown menu controller.
 *
 * Replaces the ad-hoc dropdown open/close logic for theme selectors,
 * modal-card-theme dropdowns, etc.
 *
 * Handles: open/close, click-outside, ESC, trigger button toggle.
 *
 * DOM contract:
 *   <div class="dropdown" data-dropdown>
 *     <button class="dropdown-trigger" data-dropdown-trigger>…</button>
 *     <div class="dropdown-menu" data-dropdown-menu>
 *       <button data-dropdown-item data-value="x">X</button>
 *       <button data-dropdown-item data-value="y">Y</button>
 *     </div>
 *   </div>
 *
 * Public API:
 *   new Dropdown(dropdownEl, opts?)           — wire up dropdown
 *   open() / close() / toggle()               — control visibility
 *   isOpen                                    — boolean
 *   onOpen(cb) / onClose(cb)                  — visibility callbacks
 *   onSelect(cb)                              — selection callback: (value, item)
 *   setValue(value)                           — programmatically select
 *   getValue()                                — current selected value
 *   destroy()                                 — cleanup
 */

export interface DropdownOptions {
  /** Selector for the trigger element */
  triggerSelector?: string;
  /** Selector for the menu element */
  menuSelector?: string;
  /** Selector for selectable items inside the menu */
  itemSelector?: string;
  /** Close menu after selecting an item (default: true) */
  closeOnSelect?: boolean;
  /** Close menu when clicking outside (default: true) */
  closeOnClickOutside?: boolean;
  /** Close menu on ESC (default: true) */
  closeOnEscape?: boolean;
  /** Selector for group headers that expand/collapse (for nested theme groups) */
  groupHeaderSelector?: string;
  /** Initial value */
  initialValue?: string;
}

export class Dropdown {
  private dropdown: HTMLElement;
  private trigger: HTMLElement | null;
  private menu: HTMLElement | null;
  private triggerSelector: string;
  private menuSelector: string;
  private itemSelector: string;
  private groupHeaderSelector: string;
  private closeOnSelect: boolean;
  private closeOnClickOutside: boolean;
  private closeOnEscape: boolean;

  private value: string | undefined;
  private openHandlers: Array<() => void> = [];
  private closeHandlers: Array<() => void> = [];
  private selectHandlers: Array<(value: string, item: HTMLElement) => void> = [];

  /** Pending requestAnimationFrame ID for the deferred doc-click listener.
   *  Tracked so destroy()/close() can cancel it before it fires. */
  private rafId: number | null = null;
  /** Once destroyed, the rAF callback refuses to attach the doc listener. */
  private destroyed = false;

  private clickHandler: (e: Event) => void;
  private docClickHandler: (e: Event) => void;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor(dropdown: HTMLElement, opts: DropdownOptions = {}) {
    this.dropdown = dropdown;
    this.triggerSelector = opts.triggerSelector ?? '[data-dropdown-trigger]';
    this.menuSelector = opts.menuSelector ?? '[data-dropdown-menu]';
    this.itemSelector = opts.itemSelector ?? '[data-dropdown-item]';
    this.groupHeaderSelector = opts.groupHeaderSelector ?? '.theme-group-header';
    this.closeOnSelect = opts.closeOnSelect ?? true;
    this.closeOnClickOutside = opts.closeOnClickOutside ?? true;
    this.closeOnEscape = opts.closeOnEscape ?? true;
    this.value = opts.initialValue;

    this.trigger = dropdown.querySelector<HTMLElement>(this.triggerSelector);
    this.menu = dropdown.querySelector<HTMLElement>(this.menuSelector);

    this.clickHandler = (e: Event) => this.handleClick(e);
    this.docClickHandler = (e: Event) => this.handleDocClick(e);
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);

    this.dropdown.addEventListener('click', this.clickHandler);

    if (this.value !== undefined) {
      this.setValue(this.value, /* fireCallback */ false);
    }
  }

  /** Whether the dropdown menu is currently open (.open class on the menu). */
  get isOpen(): boolean {
    return this.menu?.classList.contains('open') ?? false;
  }

  /**
   * Open the dropdown menu: add .open to the menu, set aria-expanded=true on
   * the trigger, defer-attach the document click listener (rAF so it doesn't
   * catch the opening click) + Escape listener. Fires all onOpen callbacks.
   */
  open(): void {
    if (!this.menu || this.isOpen) return;
    this.menu.classList.add('open');
    this.trigger?.setAttribute('aria-expanded', 'true');
    if (this.closeOnClickOutside) {
      // Defer to avoid catching the click that opened the menu.
      // Track the rAF so destroy()/close() can cancel it before it fires —
      // otherwise the doc-click listener could be attached AFTER teardown,
      // leaking forever.
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.destroyed) return;
        document.addEventListener('click', this.docClickHandler);
      });
    }
    if (this.closeOnEscape) {
      document.addEventListener('keydown', this.keydownHandler);
    }
    this.openHandlers.forEach((fn) => fn());
  }

  /**
   * Close the menu: remove .open, set aria-expanded=false, cancel any pending
   * rAF that would have attached the doc-click listener, detach doc-click +
   * Escape listeners, fire all onClose callbacks. No-op if already closed.
   */
  close(): void {
    if (!this.menu || !this.isOpen) return;
    this.menu.classList.remove('open');
    this.trigger?.setAttribute('aria-expanded', 'false');
    // Cancel a pending rAF so the doc-click listener is not attached
    // after we've already started closing (rapid open→close).
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    document.removeEventListener('click', this.docClickHandler);
    document.removeEventListener('keydown', this.keydownHandler);
    this.closeHandlers.forEach((fn) => fn());
  }

  /** Toggle the dropdown open/closed based on its current state. */
  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /**
   * Programmatically select an item by value: mark it .selected (and clear
   * .selected on siblings), update the stored value. If fireCallback is true
   * (default), also fire all onSelect callbacks with the value + item element.
   */
  setValue(value: string, fireCallback = true): void {
    this.value = value;
    if (!this.menu) return;
    const item = this.menu.querySelector<HTMLElement>(`${this.itemSelector}[data-value="${value}"]`);
    if (item) {
      this.menu.querySelectorAll(this.itemSelector).forEach((el) => {
        el.classList.toggle('selected', el === item);
      });
      if (fireCallback) {
        this.selectHandlers.forEach((fn) => fn(value, item));
      }
    }
  }

  /** Get the currently selected value (or undefined if none). */
  getValue(): string | undefined {
    return this.value;
  }

  /** Register a callback fired after the menu opens. */
  onOpen(cb: () => void): void {
    this.openHandlers.push(cb);
  }

  /** Register a callback fired after the menu closes. */
  onClose(cb: () => void): void {
    this.closeHandlers.push(cb);
  }

  /** Register a callback fired when an item is selected (receives value + the item element). */
  onSelect(cb: (value: string, item: HTMLElement) => void): void {
    this.selectHandlers.push(cb);
  }

  /**
   * Mark instance destroyed, cancel any pending rAF, remove all listeners
   * (dropdown click + doc click + Escape), and clear all handler arrays —
   * safe to call multiple times.
   */
  destroy(): void {
    this.destroyed = true;
    // Cancel any pending rAF so its callback can't attach the doc-click
    // listener AFTER we've torn everything down (React StrictMode remount).
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.dropdown.removeEventListener('click', this.clickHandler);
    document.removeEventListener('click', this.docClickHandler);
    document.removeEventListener('keydown', this.keydownHandler);
    this.openHandlers = [];
    this.closeHandlers = [];
    this.selectHandlers = [];
  }

  // ─── Private ────────────────────────────────────────────────

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;

    // Group header click → expand/collapse nested group
    const groupHeader = target.closest<HTMLElement>(this.groupHeaderSelector);
    if (groupHeader) {
      e.stopPropagation();
      groupHeader.closest('.theme-group')?.classList.toggle('expanded');
      return;
    }

    // Item click → select
    const item = target.closest<HTMLElement>(this.itemSelector);
    if (item) {
      e.stopPropagation();
      const value = item.dataset.value || item.dataset.modalCardTheme || '';
      this.setValue(value);
      if (this.closeOnSelect) this.close();
      this.selectHandlers.forEach((fn) => fn(value, item));
      return;
    }

    // Trigger click → toggle
    const trigger = target.closest<HTMLElement>(this.triggerSelector);
    if (trigger) {
      e.stopPropagation();
      this.toggle();
    }
  }

  private handleDocClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (!this.dropdown.contains(target)) {
      this.close();
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      this.trigger?.focus();
    }
  }
}
