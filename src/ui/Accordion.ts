/**
 * Accordion — vanilla JS imperative accordion controller.
 *
 * Replaces the repetitive `[data-accordion-toggle]` / `[data-sidebar-toggle]`
 * forEach loops scattered across the old orchestrator. ONE controller manages
 * N accordion groups via event delegation.
 *
 * DOM contract:
 *   <div class="accordion" data-accordion>
 *     <button class="accordion-header" data-accordion-toggle>…</button>
 *     <div class="accordion-body">…</div>
 *   </div>
 *
 * The container gets `.expanded` class toggled. CSS controls visibility.
 *
 * Public API:
 *   new Accordion(root, opts?)        — initialize all accordions under root
 *   toggle(groupEl)                   — toggle a specific group
 *   expand(groupEl)                   — expand a specific group
 *   collapse(groupEl)                 — collapse a specific group
 *   expandAll() / collapseAll()       — bulk operations
 *   setExclusive(boolean)             — when true, expanding one collapses siblings
 *   destroy()                         — cleanup listeners
 */

export interface AccordionOptions {
  /** Selector for the accordion group container */
  groupSelector?: string;
  /** Selector for the toggle trigger inside the group */
  toggleSelector?: string;
  /** When true, only one group can be expanded at a time (within a shared parent) */
  exclusive?: boolean;
  /** Initial expanded state — 'first' expands the first group, 'all' expands all, 'none' (default) */
  initial?: 'none' | 'first' | 'all';
  /** Callback fired after toggle — receives the group element and new state */
  onChange?: (group: HTMLElement, expanded: boolean) => void;
}

export class Accordion {
  private root: HTMLElement;
  private groupSelector: string;
  private toggleSelector: string;
  private exclusive: boolean;
  private onChange?: (group: HTMLElement, expanded: boolean) => void;
  private clickHandler: (e: Event) => void;

  constructor(root: HTMLElement, opts: AccordionOptions = {}) {
    this.root = root;
    this.groupSelector = opts.groupSelector ?? '[data-accordion]';
    this.toggleSelector = opts.toggleSelector ?? '[data-accordion-toggle]';
    this.exclusive = opts.exclusive ?? false;
    this.onChange = opts.onChange;

    this.clickHandler = (e: Event) => this.handleClick(e);
    this.root.addEventListener('click', this.clickHandler, true);

    // Apply initial state
    const initial = opts.initial ?? 'none';
    if (initial === 'first') {
      const first = this.root.querySelector<HTMLElement>(this.groupSelector);
      if (first) this.expand(first);
    } else if (initial === 'all') {
      this.expandAll();
    }
  }

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    const toggle = target.closest<HTMLElement>(this.toggleSelector);
    if (!toggle) return;
    const group = toggle.closest<HTMLElement>(this.groupSelector);
    if (!group) return;
    e.preventDefault();
    e.stopPropagation();
    this.toggle(group);
  }

  toggle(group: HTMLElement): void {
    if (group.classList.contains('expanded')) this.collapse(group);
    else this.expand(group);
  }

  expand(group: HTMLElement): void {
    if (this.exclusive) {
      // Collapse siblings sharing the same parent
      const parent = group.parentElement;
      if (parent) {
        parent.querySelectorAll<HTMLElement>(this.groupSelector).forEach((sib) => {
          if (sib !== group) sib.classList.remove('expanded');
        });
      }
    }
    group.classList.add('expanded');
    this.onChange?.(group, true);
  }

  collapse(group: HTMLElement): void {
    group.classList.remove('expanded');
    this.onChange?.(group, false);
  }

  expandAll(): void {
    this.root.querySelectorAll<HTMLElement>(this.groupSelector).forEach((g) => {
      g.classList.add('expanded');
      this.onChange?.(g, true);
    });
  }

  collapseAll(): void {
    this.root.querySelectorAll<HTMLElement>(this.groupSelector).forEach((g) => {
      g.classList.remove('expanded');
      this.onChange?.(g, false);
    });
  }

  setExclusive(exclusive: boolean): void {
    this.exclusive = exclusive;
  }

  destroy(): void {
    this.root.removeEventListener('click', this.clickHandler, true);
  }
}

/**
 * SidebarAccordion — convenience subclass for sidebar sections.
 * Same behavior as Accordion, but scoped to sidebar-accordion / data-sidebar-toggle.
 * Defaults to 'none' expanded (matches old card-constructor.ts behavior — all collapsed initially).
 */
export class SidebarAccordion extends Accordion {
  constructor(root: HTMLElement, opts: AccordionOptions = {}) {
    super(root, {
      groupSelector: '.sidebar-accordion',
      toggleSelector: '[data-sidebar-toggle]',
      initial: 'none',
      ...opts,
    });
  }
}

/**
 * ModalAccordion — convenience subclass for modal groups.
 * Same behavior as Accordion, but scoped to modal-accordion-group / data-accordion-toggle.
 * Defaults to 'none' expanded (matches old card-constructor.ts behavior — all collapsed initially).
 */
export class ModalAccordion extends Accordion {
  constructor(root: HTMLElement, opts: AccordionOptions = {}) {
    super(root, {
      groupSelector: '.modal-accordion-group',
      toggleSelector: '[data-accordion-toggle]',
      initial: 'none',
      ...opts,
    });
  }
}
