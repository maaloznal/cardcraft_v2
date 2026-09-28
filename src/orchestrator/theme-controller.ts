/**
 * theme-controller.ts — top-bar theme dropdown wiring.
 *
 * Owns:
 *   - themeDropdownController.onOpen / onClose / onSelect callbacks —
 *     .open class toggle on the dropdown wrapper + dispatch the native
 *     themeSelect change event (which the topbar-events handler picks up
 *     to dispatch SET_GLOBAL_THEME)
 *
 * Note: syncThemeDropdown() (label + .selected sync) lives in ui-appliers.ts
 * because it's a pure state-driven UI sync called by the state subscriber.
 *
 * Extracted from CardCraftApp.ts section 14 (lines 575-586).
 *
 * Public API:
 *   destroy() — no-op (themeDropdownController.destroy() called separately)
 */

import type { OrchestratorContext } from './types';

export interface ThemeController {
  destroy(): void;
}

export function createThemeController(ctx: OrchestratorContext): ThemeController {
  const { refs, themeDropdownController } = ctx;

  themeDropdownController.onOpen(() => refs.themeDropdown?.classList.add('open'));

  themeDropdownController.onClose(() => {
    refs.themeDropdown?.classList.remove('open');
    refs.themeDropdownTrigger?.setAttribute('aria-expanded', 'false');
  });

  themeDropdownController.onSelect((value) => {
    if (refs.themeSelect) {
      refs.themeSelect.value = value;
      refs.themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  return {
    /** No-op — the underlying themeDropdownController is destroyed separately by CardCraftApp.cleanup (it owns its own listeners). */
    destroy() {
      /* themeDropdownController.destroy() is called separately by CardCraftApp.cleanup. */
    },
  };
}
