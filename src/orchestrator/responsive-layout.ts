/**
 * Shared responsive thresholds for the imperative UI controllers.
 * Keep these values aligned with the media queries in mobile.css.
 */
export const COMPACT_LAYOUT_BREAKPOINT = 768;
export const TOUCH_LAYOUT_BREAKPOINT = 1024;

export function isCompactLayout(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < COMPACT_LAYOUT_BREAKPOINT;
}

export function isTouchLayout(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < TOUCH_LAYOUT_BREAKPOINT;
}
