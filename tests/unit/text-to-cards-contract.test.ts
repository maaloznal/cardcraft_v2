import { describe, expect, it } from 'vitest';
import {
  AI_TEXT_MAX_LENGTH,
  AI_DEFAULT_TARGET_CHARS,
  aiDraftToCard,
  countAiCardCharacters,
  isAiRole,
  isAiTextMode,
  normalizeAiTargetChars,
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

  it('validates roles and the user-defined card limit', () => {
    expect(isAiRole('smm-editor')).toBe(true);
    expect(isAiRole('invent-facts')).toBe(false);
    expect(normalizeAiTargetChars('420')).toBe(420);
    expect(normalizeAiTargetChars(179)).toBeNull();
    expect(AI_DEFAULT_TARGET_CHARS).toBe(350);
  });

  it('validates a server response', () => {
    expect(parseAiCardsResponse({
      version: 1,
      mode: 'preserve',
      role: 'content-strategist',
      targetChars: 350,
      cards: [draft],
    }).cards).toEqual([draft]);
  });

  it('rejects oversized and malformed fields', () => {
    const response = { version: 1, mode: 'preserve', role: 'content-strategist', targetChars: 350 };
    expect(() => parseAiCardsResponse({ ...response, cards: [{ ...draft, title: 'x'.repeat(201) }] })).toThrow();
    expect(() => parseAiCardsResponse({ ...response, mode: 'unknown', cards: [draft] })).toThrow();
    expect(() => parseAiCardsResponse({ ...response, targetChars: 180, cards: [{ ...draft, text: 'x'.repeat(181) }] })).toThrow();
  });

  it('creates a safe application card with a new id and empty styles', () => {
    const card = aiDraftToCard(draft, 'spearmint-fresh');
    expect(card.id).toBeTruthy();
    expect(card.title).toBe(draft.title);
    expect(card.colors).toEqual({});
    expect(card.wordStyles).toEqual({});
    expect(card.theme).toBe('spearmint-fresh');
    expect(countAiCardCharacters(draft)).toBe(14);
  });
});
