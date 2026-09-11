/**
 * Switch — vanilla JS imperative toggle switch controller.
 *
 * Replaces the ad-hoc `checked`/`unchecked` checkbox wiring scattered in
 * card-constructor.ts. Works on a checkbox input + label pair, or a
 * button-based toggle.
 *
 * DOM contract (checkbox-based):
 *   <label class="switch">
 *     <input type="checkbox" id="showNumbers" />
 *     <span class="switch-track"></span>
 *     <span class="switch-label">Показать номера</span>
 *   </label>
 *
 * DOM contract (button-based):
 *   <button class="switch" role="switch" aria-checked="false" data-switch>
 *     <span class="switch-track"></span>
 *     <span class="switch-label">Показать номера</span>
 *   </button>
 *
 * Public API:
 *   new Switch(element, opts?)            — wire up switch behavior
 *   get checked()                         — boolean
 *   set checked(value)                    — set state, fire onChange
 *   toggle()                              — flip state
 *   onToggle(cb)                          — register callback
 *   destroy()                             — cleanup
 */

export interface SwitchOptions {
  /** Initial checked state */
  initial?: boolean;
  /** Callback fired when state changes */
  onChange?: (checked: boolean, source: 'user' | 'program') => void;
}

export class Switch {
  private element: HTMLElement;
  private isCheckbox: boolean;
  private checkbox: HTMLInputElement | null = null;
  private checked_: boolean;
  private onChange?: (checked: boolean, source: 'user' | 'program') => void;

  private clickHandler: (e: Event) => void;

  constructor(element: HTMLElement, opts: SwitchOptions = {}) {
    this.element = element;
    this.checkbox = element instanceof HTMLInputElement
      ? element
      : element.querySelector<HTMLInputElement>('input[type="checkbox"]');

    this.isCheckbox = this.checkbox !== null;
    this.checked_ = opts.initial ?? (this.checkbox?.checked ?? false);
    this.onChange = opts.onChange;

    this.clickHandler = (e: Event) => this.handleClick(e);

    if (this.isCheckbox && this.checkbox) {
      this.checkbox.addEventListener('change', this.clickHandler);
    } else {
      // Button-based switch
      if (!(this.element instanceof HTMLButtonElement) && !this.element.hasAttribute('role')) {
        this.element.setAttribute('role', 'switch');
      }
      this.element.setAttribute('aria-checked', String(this.checked_));
      this.element.addEventListener('click', this.clickHandler);
    }

    // Sync initial visual state
    this.syncVisual();
  }

  get checked(): boolean {
    return this.checked_;
  }

  set checked(value: boolean) {
    if (value === this.checked_) return;
    this.checked_ = value;
    this.syncVisual();
    this.onChange?.(value, 'program');
  }

  toggle(): void {
    this.checked_ = !this.checked_;
    this.syncVisual();
    this.onChange?.(this.checked_, 'user');
  }

  onToggle(cb: (checked: boolean, source: 'user' | 'program') => void): void {
    this.onChange = cb;
  }

  destroy(): void {
    if (this.isCheckbox && this.checkbox) {
      this.checkbox.removeEventListener('change', this.clickHandler);
    } else {
      this.element.removeEventListener('click', this.clickHandler);
    }
  }

  // ─── Private ────────────────────────────────────────────────

  private handleClick(e: Event): void {
    if (this.isCheckbox && this.checkbox) {
      this.checked_ = this.checkbox.checked;
      this.syncVisual();
      this.onChange?.(this.checked_, 'user');
    } else {
      e.preventDefault();
      this.toggle();
    }
  }

  private syncVisual(): void {
    if (this.isCheckbox && this.checkbox) {
      this.checkbox.checked = this.checked_;
      const label = this.checkbox.closest('.switch');
      label?.classList.toggle('checked', this.checked_);
    } else {
      this.element.setAttribute('aria-checked', String(this.checked_));
      this.element.classList.toggle('checked', this.checked_);
    }
  }
}
