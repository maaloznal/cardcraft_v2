/**
 * Application constants — single source of truth for magic numbers.
 */

export const CONFIG = {
  SAVE_DEBOUNCE_MS: 400,
  HISTORY_DEBOUNCE_MS: 700,
  MAX_HISTORY: 50,
} as const;

export const CARD_WIDTH = 380;
export const CARD_MIN_HEIGHT = 400;
export const CARD_PADDING = 32;
export const CARD_PADDING_MOBILE = 24;

// ─── Export quality ─────────────────────────────────────────────
// The card is rendered to PNG at a FIXED logical width (EXPORT_CARD_WIDTH,
// == CARD_WIDTH == 380 CSS px) regardless of the on-screen viewport, so the
// output resolution is deterministic. html-to-image applies this width to its
// internal clone (not the visible node) — no UI jumps. The output pixel
// width = EXPORT_CARD_WIDTH × quality.scale.
//
//   x2 → 760 px  (Standard, fast, small files)
//   x3 → 1140 px (High, default — best size/quality balance)
//   x4 → 1520 px (Maximum, memory-heavy on mobile — may fail on low-end devices)
//
// devicePixelRatio is intentionally NOT used as a quality source — the result
// must be identical across phones, tablets, and desktops.
export const EXPORT_CARD_WIDTH = CARD_WIDTH;

export const EXPORT_QUALITY_LEVELS: Record<ExportQuality, ExportQualityLevel> = {
  x2: {
    scale: 2,
    outputWidth: 760,
    label: 'Стандартное ×2',
    description: '760 px — быстро и компактно',
  },
  x3: {
    scale: 3,
    outputWidth: 1140,
    label: 'Высокое ×3',
    description: '1140 px — оптимальный размер и качество',
  },
  x4: {
    scale: 4,
    outputWidth: 1520,
    label: 'Максимальное ×4',
    description: '1520 px — максимальная чёткость, большой файл',
  },
};

export const EXPORT_QUALITY_VALUES = Object.keys(EXPORT_QUALITY_LEVELS) as ExportQuality[];

export const DEFAULT_EXPORT_QUALITY: ExportQuality = 'x3';

export const SIDEBAR_WIDTH = 300;
export const SIDEBAR_MIN_WIDTH = 260;
export const SIDEBAR_MAX_WIDTH = 520;
export const SIDEBAR_MIN_SECTION_HEIGHT = 60;

export const DEFAULT_THEME = 'default';
export const DEFAULT_FORMAT = 'auto';
export const DEFAULT_GRADIENT_ANGLE = 135;
export const DEFAULT_LIST_STYLE = 'numbers';
export const DEFAULT_PROGRESS_STYLE = 'default';
export const DEFAULT_LIST_NUM_SIZE = 22;
export const DEFAULT_CHAR_LIMIT = 350;
export const MIN_CHAR_LIMIT = 100;
export const MAX_CHAR_LIMIT = 2200;

export const ALLOWED_THEMES = [
  'default',
  'ocean',
  'forest',
  'sunset',
  'lavender',
  'midnight',
  'cherry',
  'slate',
] as const;

export const ALLOWED_FORMATS = [
  'auto',
  'aspect-4-5',
  'telegram',
  'whatsapp',
  'vk',
  'aspect-9-16',
] as const;

export const PRESET_COLORS = [
  '#0f172a',
  '#4f46e5',
  '#2563eb',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#ec4899',
  '#7c3aed',
] as const;

export const FIELD_LABELS: Record<string, string> = {
  title: 'Заголовок',
  subtitle: 'Подзаголовок',
  text: 'Основной текст',
  list: 'Список',
  listItems: 'Список',
  listNumber: 'Цвет цифры',
  listNumBg: 'Цвет фона фигуры',
  listNumBorder: 'Цвет рамки фигуры',
  footer: 'Итоговый вывод',
  cta: 'Кнопка / CTA',
};

export const EDITOR_FIELDS: EditorField[] = [
  { key: 'title', label: 'Заголовок', multiline: false, maxlength: 200 },
  { key: 'subtitle', label: 'Подзаголовок', multiline: true, maxlength: 500 },
  { key: 'text', label: 'Основной текст', multiline: true, maxlength: 1000 },
  { key: 'listItems', label: 'Список', multiline: true, maxlength: 1000 },
  { key: 'footer', label: 'Итоговый вывод', multiline: false, maxlength: 200 },
  { key: 'cta', label: 'Кнопка / CTA', multiline: false, maxlength: 100 },
];

export const MODAL_FIELDS: ModalField[] = [
  { key: 'title', label: 'Заголовок', defaultSize: 24, hasStyleControls: true },
  { key: 'subtitle', label: 'Подзаголовок', defaultSize: 18, hasStyleControls: true },
  { key: 'text', label: 'Основной текст', defaultSize: 16, hasStyleControls: true },
  { key: 'list', label: 'Список', defaultSize: 16, hasStyleControls: true },
  { key: 'listNumber', label: 'Цвет цифры', defaultSize: 16, hasStyleControls: false },
  { key: 'listNumBg', label: 'Цвет фона фигуры', defaultSize: 16, hasStyleControls: false },
  { key: 'listNumBorder', label: 'Цвет рамки фигуры', defaultSize: 16, hasStyleControls: false },
  { key: 'footer', label: 'Итоговый вывод', defaultSize: 14, hasStyleControls: true },
  { key: 'cta', label: 'Кнопка / CTA', defaultSize: 16, hasStyleControls: true },
];

export const FIELD_CONFIG: Record<string, FieldConfig> = {
  title: { tag: 'h2', cls: 'card-title', container: 'top', order: 0 },
  subtitle: { tag: 'p', cls: 'card-subtitle', container: 'top', order: 1 },
  text: { tag: 'p', cls: 'card-text', container: 'top', order: 2 },
  list: { tag: 'ul', cls: 'card-list', container: 'top', order: 3 },
  footer: { tag: 'div', cls: 'card-footer-text', container: 'bottom', order: 0 },
  cta: { tag: 'div', cls: 'accent-btn', container: 'bottom', order: 1 },
};

export const SHAPE_PROGRESS_STYLES = ['circles', 'squares', 'diamonds', 'hexagons', 'stars'];

export const MODAL_GROUPS = [
  { label: 'Заголовок и подзаголовок', keys: ['title', 'subtitle'] },
  { label: 'Текст и список', keys: ['text', 'list'] },
  { label: 'Нумерация списка', keys: ['listNumber', 'listNumBg', 'listNumBorder'] },
  { label: 'Итог и кнопка', keys: ['footer', 'cta'] },
];

// Re-export types for convenience
import type { EditorField, ModalField, FieldConfig, ExportQuality, ExportQualityLevel } from './types';
