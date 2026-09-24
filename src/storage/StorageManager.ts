/**
 * StorageManager — single module that owns all localStorage access.
 * No other code in the project should call localStorage directly.
 */

import type { Card, ExportQuality } from '../core/types';
import { sanitizeCardId, isValidHexColor, clampFontSize, isValidTheme, isValidFormat, isValidExportQuality } from '../core/utils';
import {
  ALLOWED_FORMATS,
  ALLOWED_THEMES,
  EXPORT_QUALITY_VALUES,
  DEFAULT_EXPORT_QUALITY,
  DEFAULT_CHAR_LIMIT,
  MIN_CHAR_LIMIT,
  MAX_CHAR_LIMIT,
} from '../core/constants';
import { THEME_GROUPS } from '../themes/themeData';

const VALID_THEME_VALUES = [
  ...new Set([
    ...ALLOWED_THEMES,
    ...THEME_GROUPS.flatMap((group) => group.themes.map((theme) => theme.value)),
  ]),
];

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
  CHAR_LIMIT_VALUE: 'flashcard-char-limit-value',
  SIDEBAR_WIDTH: 'flashcard-sidebar-width',
  HEADER_HEIGHT: 'flashcard-header-height',
  EXPORT_QUALITY: 'flashcard-export-quality',
  AI_IMPORT_PREFS: 'flashcard-ai-import-prefs',
} as const;

export interface AiImportPreferences {
  role?: string;
  theme?: string;
  targetChars?: number;
}

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
  charLimit: number;
  sidebarWidth: number | null;
  headerHeight: number | null;
  exportQuality: ExportQuality;
}

/**
 * Persist a partial SavedState to localStorage. Strips empty `wordStyles` /
 * `sectionStyles` / `colors` / `theme` from each card to save space. Re-throws
 * QuotaExceededError as a string-tagged Error so the caller can fall back to
 * IndexedDB.
 */
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
    if (state.charLimit !== undefined) localStorage.setItem(KEYS.CHAR_LIMIT_VALUE, String(state.charLimit));
    if (state.sidebarWidth !== undefined && state.sidebarWidth !== null) localStorage.setItem(KEYS.SIDEBAR_WIDTH, String(state.sidebarWidth));
    if (state.headerHeight !== undefined && state.headerHeight !== null) localStorage.setItem(KEYS.HEADER_HEIGHT, String(state.headerHeight));
    if (state.exportQuality !== undefined) localStorage.setItem(KEYS.EXPORT_QUALITY, state.exportQuality);
  } catch (e) {
    const err = e as Error;
    if (err.name === 'QuotaExceededError') {
      // Re-throw with context so caller can show toast
      throw new Error(`QuotaExceededError`);
    }
    throw e;
  }
}

/**
 * Load + validate every SavedState field from localStorage. Runs each saved
 * card through migrateCard (sanitize id / colors / theme / wordStyles /
 * sectionStyles). Clears corrupted cards + theme + format keys on JSON parse
 * failure. Returns a Partial<SavedState> with only the keys actually present.
 */
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
  if (theme && isValidTheme(theme, VALID_THEME_VALUES)) {
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

  const charLimitValue = Number(localStorage.getItem(KEYS.CHAR_LIMIT_VALUE));
  result.charLimit = Number.isFinite(charLimitValue) && charLimitValue >= MIN_CHAR_LIMIT
    ? Math.min(MAX_CHAR_LIMIT, Math.round(charLimitValue))
    : DEFAULT_CHAR_LIMIT;

  const sidebarWidth = localStorage.getItem(KEYS.SIDEBAR_WIDTH);
  if (sidebarWidth) result.sidebarWidth = Number(sidebarWidth);

  const headerHeight = localStorage.getItem(KEYS.HEADER_HEIGHT);
  if (headerHeight) result.headerHeight = Number(headerHeight);

  const exportQuality = localStorage.getItem(KEYS.EXPORT_QUALITY);
  // P-EXPORT-Q: sanitize-on-load — a corrupted/garbage value falls back to the
  // default (x3) instead of producing a wrong-resolution PNG. Existing users
  // without the key get the default too (no migration breakage).
  if (isValidExportQuality(exportQuality, EXPORT_QUALITY_VALUES)) {
    result.exportQuality = exportQuality;
  } else {
    result.exportQuality = DEFAULT_EXPORT_QUALITY;
  }

  return result;
}

/** Remove every cardcraft-related key from localStorage (used by 'delete all' + reset flows). */
export function clear(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

export function saveAiImportPreferences(preferences: AiImportPreferences): void {
  localStorage.setItem(KEYS.AI_IMPORT_PREFS, JSON.stringify(preferences));
}

export function loadAiImportPreferences(): AiImportPreferences {
  const raw = localStorage.getItem(KEYS.AI_IMPORT_PREFS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as AiImportPreferences : {};
  } catch {
    localStorage.removeItem(KEYS.AI_IMPORT_PREFS);
    return {};
  }
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
  if (migrated.theme && !isValidTheme(migrated.theme, VALID_THEME_VALUES)) {
    delete migrated.theme;
  }

  return migrated;
}
