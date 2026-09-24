import type { Card } from '@/core/types';
import { generateId } from '@/core/utils';

export const AI_TEXT_MAX_LENGTH = 10_000;
export const AI_MAX_CARDS = 60;
export const AI_MIN_TARGET_CHARS = 180;
export const AI_MAX_TARGET_CHARS = 2_200;
export const AI_DEFAULT_TARGET_CHARS = 350;

export const AI_ROLE_OPTIONS = [
  { value: 'content-strategist', label: 'Контент-стратег', description: 'Выстраивает ясную последовательность мыслей' },
  { value: 'smm-editor', label: 'SMM-редактор', description: 'Адаптирует под чтение в сторис с телефона' },
  { value: 'marketer', label: 'Маркетолог', description: 'Подчёркивает ценность без новых обещаний' },
  { value: 'educator', label: 'Методист', description: 'Объясняет последовательно: от простого к сложному' },
  { value: 'storyteller', label: 'Сторителлер', description: 'Сохраняет сюжет и логичные переходы' },
] as const;

export type AiRole = typeof AI_ROLE_OPTIONS[number]['value'];

export type AiTextMode = 'preserve' | 'improve';

export interface AiCardDraft {
  title: string;
  subtitle: string;
  text: string;
  listItems: string;
  footer: string;
  cta: string;
}

export interface AiCardsResponse {
  version: 1;
  mode: AiTextMode;
  role: AiRole;
  targetChars: number;
  cards: AiCardDraft[];
}

const FIELD_LIMITS: Record<keyof AiCardDraft, number> = {
  title: 200,
  subtitle: 500,
  text: 1000,
  listItems: 1000,
  footer: 200,
  cta: 100,
};

export function isAiTextMode(value: unknown): value is AiTextMode {
  return value === 'preserve' || value === 'improve';
}

export function isAiRole(value: unknown): value is AiRole {
  return AI_ROLE_OPTIONS.some((role) => role.value === value);
}

export function normalizeAiTargetChars(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  return rounded >= AI_MIN_TARGET_CHARS && rounded <= AI_MAX_TARGET_CHARS ? rounded : null;
}

export function countAiCardCharacters(card: AiCardDraft): number {
  return Object.values(card).reduce((total, field) => total + field.length, 0);
}

export function parseAiCardsResponse(value: unknown): AiCardsResponse {
  if (!value || typeof value !== 'object') throw new Error('Некорректный ответ сервера.');
  const input = value as Record<string, unknown>;
  const targetChars = normalizeAiTargetChars(input.targetChars);
  if (input.version !== 1 || !isAiTextMode(input.mode) || !isAiRole(input.role) || !targetChars || !Array.isArray(input.cards)) {
    throw new Error('Сервер вернул неподдерживаемый формат карточек.');
  }
  if (input.cards.length < 1 || input.cards.length > AI_MAX_CARDS) {
    throw new Error(`Допустимо от 1 до ${AI_MAX_CARDS} карточек.`);
  }
  const cards = input.cards.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Карточка ${index + 1} повреждена.`);
    const source = raw as Record<string, unknown>;
    const card = {} as AiCardDraft;
    for (const [field, limit] of Object.entries(FIELD_LIMITS) as Array<[keyof AiCardDraft, number]>) {
      const fieldValue = source[field];
      if (typeof fieldValue !== 'string' || fieldValue.length > limit) {
        throw new Error(`Поле «${field}» в карточке ${index + 1} некорректно.`);
      }
      card[field] = fieldValue;
    }
    if (countAiCardCharacters(card) > targetChars) {
      throw new Error(`Карточка ${index + 1} превышает лимит ${targetChars} символов.`);
    }
    return card;
  });
  return { version: 1, mode: input.mode, role: input.role, targetChars, cards };
}

export function aiDraftToCard(draft: AiCardDraft, theme?: string): Card {
  return {
    id: generateId(),
    ...draft,
    colors: {},
    wordStyles: {},
    sectionStyles: {},
    ...(theme ? { theme } : {}),
  };
}
