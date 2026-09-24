/**
 * UI Kit — vanilla JS imperative UI controllers.
 *
 * These mirror shadcn/ui patterns but operate on the imperative
 * DOM architecture (the card-constructor app is HTML-based, not
 * React state-driven for the editor/preview).
 *
 * Each class:
 * - Is instantiated with a root element
 * - Manages its own event listeners (with delegation)
 * - Provides imperative API (open/close/toggle/setValue/etc.)
 * - Has destroy() for cleanup
 * - Communicates via callbacks (onToggle, onSelect, onOpen, onClose)
 *
 * Usage example:
 *   import { ModalAccordion, Modal, Dropdown } from '@/ui';
 *   const acc = new ModalAccordion(modalRoot);
 *   const modal = new Modal(modalEl);
 *   modal.onOpen(() => console.log('opened'));
 */

export { Accordion, SidebarAccordion, ModalAccordion } from './Accordion';
export type { AccordionOptions } from './Accordion';

export { Modal } from './Modal';
export type { ModalOptions } from './Modal';

export { Switch } from './Switch';
export type { SwitchOptions } from './Switch';

export { Dropdown } from './Dropdown';
export type { DropdownOptions } from './Dropdown';
