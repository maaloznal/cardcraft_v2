/**
 * StorageManager — single module that owns all localStorage access.
 * No other code in the project should call localStorage directly.
 */

import type { Card } from '../core/types';
import { deepClone, sanitizeCardId, isValidHexColor, clampFontSize, isValidTheme, isValidFormat } from '../core/utils';
import { ALLOWED_THEMES, ALLOWED_FORMATS } from '../core/constants';

const KEYS = {
  CARDS: 'flashcard-cards',
  THEME: 'flashcard-theme',
  FORMAT: 'flashcard-format',
  SHOW_NUMBERS: 'flashcard-show-numbers',
  SHOW_PROGRESS: 'flashcard-show-progress',
  PROGRESS_STYLE: 'flashcard-progress-style',
  LIST_STYLE: 'flashcard-list-style',
  GRADIENT_ANGLE: 'flashcard-gradient-angle',
  CHAR_LIMIT: 'flashcard-char-limit',
  SIDEBAR_WIDTH: 'flashcard-sidebar-width',
  HEADER_HEIGHT: 'flashcard-header-height',
} as const;

export interface SavedState {
  cards: Card[];
  theme: string;
  format: string;
  showCardNumbers: boolean;
  showProgressBar: boolean;
  progressBarStyle: string;
  listStyleType: string;
  gradientAngle: number;
  charLimitEnabled: boolean;
  sidebarWidth: number | null;
  headerHeight: number | null;
}

export function save(state: Partial<SavedState>): void {
  try {
    if (state.cards !== undefined) {
      // Strip empty objects before saving to save space
      const cleaned = state.cards.map((c) => {
        const out: Record<string, unknown> = { ...c };
        if (out.wordStyles && Object.keys(out.wordStyles as object).length === 0) delete out.wordStyles;
        if (out.sectionStyles && Object.keys(out.sectionStyles as object).length === 0) delete out.sectionStyles;
        if (out.colors && Object.keys(out.colors as object).length === 0) delete out.colors;
        if (!out.theme) delete out.theme;
        return out;
      });
      localStorage.setItem(KEYS.CARDS, JSON.stringify(cleaned));
    }
    if (state.theme !== undefined) localStorage.setItem(KEYS.THEME, state.theme);
    if (state.format !== undefined) localStorage.setItem(KEYS.FORMAT, state.format);
    if (state.showCardNumbers !== undefined) localStorage.setItem(KEYS.SHOW_NUMBERS, String(state.showCardNumbers));
    if (state.showProgressBar !== undefined) localStorage.setItem(KEYS.SHOW_PROGRESS, String(state.showProgressBar));
    if (state.progressBarStyle !== undefined) localStorage.setItem(KEYS.PROGRESS_STYLE, state.progressBarStyle);
    if (state.listStyleType !== undefined) localStorage.setItem(KEYS.LIST_STYLE, state.listStyleType);
    if (state.gradientAngle !== undefined) localStorage.setItem(KEYS.GRADIENT_ANGLE, String(state.gradientAngle));
    if (state.charLimitEnabled !== undefined) localStorage.setItem(KEYS.CHAR_LIMIT, String(state.charLimitEnabled));
    if (state.sidebarWidth !== undefined && state.sidebarWidth !== null) localStorage.setItem(KEYS.SIDEBAR_WIDTH, String(state.sidebarWidth));
    if (state.headerHeight !== undefined && state.headerHeight !== null) localStorage.setItem(KEYS.HEADER_HEIGHT, String(state.headerHeight));
  } catch (e) {
    const err = e as Error;
    if (err.name === 'QuotaExceededError') {
      // Re-throw with context so caller can show toast
      throw new Error(`QuotaExceededError`);
    }
    throw e;
  }
}

export function load(): Partial<SavedState> {
  const result: Partial<SavedState> = {};

  const savedCards = localStorage.getItem(KEYS.CARDS);
  if (savedCards) {
    try {
      const parsed = JSON.parse(savedCards) as Card[];
      if (Array.isArray(parsed) && parsed.length) {
        result.cards = parsed.map(migrateCard);
      }
    } catch {
      // Corrupted — clear and continue
      localStorage.removeItem(KEYS.CARDS);
      localStorage.removeItem(KEYS.THEME);
      localStorage.removeItem(KEYS.FORMAT);
    }
  }

  const theme = localStorage.getItem(KEYS.THEME);
  if (theme && isValidTheme(theme, ALLOWED_THEMES)) {
    result.theme = theme;
  }

  const format = localStorage.getItem(KEYS.FORMAT);
  if (format && isValidFormat(format, ALLOWED_FORMATS)) {
    result.format = format;
  }

  const showNumbers = localStorage.getItem(KEYS.SHOW_NUMBERS);
  if (showNumbers !== null) result.showCardNumbers = showNumbers === 'true';

  const showProgress = localStorage.getItem(KEYS.SHOW_PROGRESS);
  if (showProgress !== null) result.showProgressBar = showProgress === 'true';

  const progressStyle = localStorage.getItem(KEYS.PROGRESS_STYLE);
  if (progressStyle) result.progressBarStyle = progressStyle;

  const listStyle = localStorage.getItem(KEYS.LIST_STYLE);
  if (listStyle) result.listStyleType = listStyle;

  const gradientAngle = localStorage.getItem(KEYS.GRADIENT_ANGLE);
  if (gradientAngle) result.gradientAngle = Number(gradientAngle) || 135;

  const charLimit = localStorage.getItem(KEYS.CHAR_LIMIT);
  if (charLimit !== null) result.charLimitEnabled = charLimit === 'true';

  const sidebarWidth = localStorage.getItem(KEYS.SIDEBAR_WIDTH);
  if (sidebarWidth) result.sidebarWidth = Number(sidebarWidth);

  const headerHeight = localStorage.getItem(KEYS.HEADER_HEIGHT);
  if (headerHeight) result.headerHeight = Number(headerHeight);

  return result;
}

export function clear(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

/** Migrate old card format to current structure */
function migrateCard(card: Partial<Card>): Card {
  const migrated: Card = {
    id: sanitizeCardId(card.id),
    title: card.title || '',
    subtitle: card.subtitle || '',
    text: card.text || '',
    listItems: card.listItems || '',
    footer: card.footer || '',
    cta: card.cta || '',
    colors: {},
    wordStyles: {},
    sectionStyles: {},
    theme: card.theme,
  };

  // Validate and sanitize colors - only keep valid hex colors
  if (card.colors && typeof card.colors === 'object') {
    Object.keys(card.colors).forEach((key) => {
      const value = card.colors![key];
      if (isValidHexColor(value)) {
        migrated.colors[key] = value;
      }
    });
  }

  // Migrate wordStyles: old keys (without ::) → new (with field::)
  if (card.wordStyles && typeof card.wordStyles === 'object') {
    Object.keys(card.wordStyles).forEach((key) => {
      if (key.includes('::')) {
        migrated.wordStyles[key] = card.wordStyles![key];
      } else {
        migrated.wordStyles[`title::${key}`] = card.wordStyles![key];
      }
    });
  }

  // Migrate sectionStyles: { bold: "bold" } → { fontWeight: "bold" }
  if (card.sectionStyles && typeof card.sectionStyles === 'object') {
    Object.keys(card.sectionStyles).forEach((field) => {
      const old = card.sectionStyles![field] as Record<string, unknown>;
      
      // Guard against null or non-object values
      if (!old || typeof old !== 'object') return;
      
      const ns: Record<string, string | number> = {};
      if (old.bold === 'bold' || old.fontWeight === 'bold') ns.fontWeight = 'bold';
      if (old.italic === 'italic' || old.fontStyle === 'italic') ns.fontStyle = 'italic';
      const deco = (old.textDecoration as string) || '';
      const parts: string[] = [];
      if (old.underline || deco.includes('underline')) parts.push('underline');
      if (old.strikethrough || deco.includes('line-through')) parts.push('line-through');
      if (parts.length) ns.textDecoration = parts.join(' ');
      if (old.fontSize) ns.fontSize = clampFontSize(old.fontSize);
      migrated.sectionStyles[field] = ns as Card['sectionStyles'][string];
    });
  }

  // Validate theme against whitelist
  if (migrated.theme && !isValidTheme(migrated.theme, ALLOWED_THEMES)) {
    delete migrated.theme;
  }

  return migrated;
}
