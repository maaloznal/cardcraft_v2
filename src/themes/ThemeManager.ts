/**
 * ThemeManager — manages global and per-card theme application.
 * Only module that knows about theme CSS variables and data-theme attributes.
 */

import type { Card } from '../core/types';
import { THEME_GROUPS } from './themeData';

/** Find a theme's display label by its value */
export function getThemeLabel(value: string): string {
  for (const g of THEME_GROUPS) {
    for (const t of g.themes) {
      if (t.value === value) return t.label;
    }
  }
  return 'По умолчанию';
}

/** Check if a theme value is a "no background" theme */
export function isNoBgTheme(theme: string | undefined): boolean {
  return !!theme && theme.startsWith('nobg-');
}

/** Resolve the effective theme for a card (card-specific overrides global) */
export function resolveCardTheme(card: Card, globalTheme: string): string {
  return card.theme && card.theme !== 'default' ? card.theme : globalTheme;
}

/** Apply a theme attribute to a DOM element (workspace or card node) */
export function applyThemeToElement(el: HTMLElement, theme: string): void {
  if (theme === 'default') {
    el.removeAttribute('data-theme');
  } else {
    el.setAttribute('data-theme', theme);
  }
}

/** Get all theme groups for dropdown rendering */
export function getThemeGroups() {
  return THEME_GROUPS;
}
