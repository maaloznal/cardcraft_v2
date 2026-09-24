import type { Card } from '@/core/types';
import { generateId } from '@/core/utils';

export const AI_TEXT_MAX_LENGTH = 10_000;
export const AI_MAX_CARDS = 30;

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

export function parseAiCardsResponse(value: unknown): AiCardsResponse {
  if (!value || typeof value !== 'object') throw new Error('Некорректный ответ сервера.');
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !isAiTextMode(input.mode) || !Array.isArray(input.cards)) {
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
    return card;
  });
  return { version: 1, mode: input.mode, cards };
}

export function aiDraftToCard(draft: AiCardDraft): Card {
  return {
    id: generateId(),
    ...draft,
    colors: {},
    wordStyles: {},
    sectionStyles: {},
  };
}
