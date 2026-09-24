import { describe, expect, it } from 'vitest';
import {
  AI_TEXT_MAX_LENGTH,
  aiDraftToCard,
  isAiTextMode,
  parseAiCardsResponse,
} from '@/ai/text-to-cards-contract';

const draft = {
  title: 'Заголовок', subtitle: '', text: 'Текст', listItems: '', footer: '', cta: '',
};

describe('text-to-cards contract', () => {
  it('limits source text to 10,000 characters', () => {
    expect(AI_TEXT_MAX_LENGTH).toBe(10_000);
  });

  it('accepts only supported modes', () => {
    expect(isAiTextMode('preserve')).toBe(true);
    expect(isAiTextMode('improve')).toBe(true);
    expect(isAiTextMode('ignore-rules')).toBe(false);
  });

  it('validates a server response', () => {
    expect(parseAiCardsResponse({ version: 1, mode: 'preserve', cards: [draft] }).cards).toEqual([draft]);
  });

  it('rejects oversized and malformed fields', () => {
    expect(() => parseAiCardsResponse({ version: 1, mode: 'preserve', cards: [{ ...draft, title: 'x'.repeat(201) }] })).toThrow();
    expect(() => parseAiCardsResponse({ version: 1, mode: 'unknown', cards: [draft] })).toThrow();
  });

  it('creates a safe application card with a new id and empty styles', () => {
    const card = aiDraftToCard(draft);
    expect(card.id).toBeTruthy();
    expect(card.title).toBe(draft.title);
    expect(card.colors).toEqual({});
    expect(card.wordStyles).toEqual({});
  });
});
