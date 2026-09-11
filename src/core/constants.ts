/**
 * Application constants — single source of truth for magic numbers.
 */

export const CONFIG = {
  SAVE_DEBOUNCE_MS: 400,
  HISTORY_DEBOUNCE_MS: 700,
  EXPORT_PIXEL_RATIO: 2,
  MAX_HISTORY: 50,
} as const;

export const CARD_WIDTH = 380;
export const CARD_MIN_HEIGHT = 400;
export const CARD_PADDING = 32;
export const CARD_PADDING_MOBILE = 24;

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

export const FORMAT_CHAR_LIMITS: Record<string, number> = {
  'aspect-4-5': 2200,
  'telegram': 2048,
  'whatsapp': 700,
  'vk': 200,
  'aspect-9-16': 2200,
};

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
import type { EditorField, ModalField, FieldConfig } from './types';
