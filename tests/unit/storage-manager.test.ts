/**
 * Unit tests for src/storage/StorageManager.ts
 *
 * Covers save/load round-trip, JSON corruption recovery, and the
 * security remediation in migrateCard() (malicious id rejection,
 * invalid color stripping, theme/format whitelisting, null-safety
 * on sectionStyles, and QuotaExceededError propagation).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { save, load, clear, type SavedState } from '@/storage/StorageManager';
import type { Card } from '@/core/types';
import { ALLOWED_THEMES, ALLOWED_FORMATS } from '@/core/constants';

const STORAGE_KEYS = {
  CARDS: 'flashcard-cards',
  THEME: 'flashcard-theme',
  FORMAT: 'flashcard-format',
};

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/** Build a card with sensible defaults for tests. */
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-card-id',
    title: 'Test title',
    subtitle: 'Test subtitle',
    text: 'Test text',
    listItems: 'item1\nitem2',
    footer: 'Test footer',
    cta: 'Click me',
    colors: {},
    wordStyles: {},
    sectionStyles: {},
    ...overrides,
  };
}

describe('StorageManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── Round-trip ─────────────────────────────────────────────
  describe('save/load round-trip', () => {
    it('cards survive a save → load cycle', () => {
      const card = makeCard({ id: 'card-1', title: 'Hello', text: 'World' });
      save({ cards: [card] });
      const loaded = load();
      expect(loaded.cards).toBeDefined();
      expect(loaded.cards).toHaveLength(1);
      expect(loaded.cards![0].id).toBe('card-1');
      expect(loaded.cards![0].title).toBe('Hello');
      expect(loaded.cards![0].text).toBe('World');
    });

    it('multiple cards preserve order and content', () => {
      save({ cards: [makeCard({ id: 'a', title: 'A' }), makeCard({ id: 'b', title: 'B' })] });
      const loaded = load();
      expect(loaded.cards).toHaveLength(2);
      expect(loaded.cards![0].id).toBe('a');
      expect(loaded.cards![1].id).toBe('b');
    });

    it('card colors survive round-trip when valid hex', () => {
      save({
        cards: [
          makeCard({
            id: 'c1',
            colors: { title: '#ffffff', subtitle: '#000000' },
          }),
        ],
      });
      const loaded = load();
      expect(loaded.cards![0].colors).toEqual({ title: '#ffffff', subtitle: '#000000' });
    });

    it('card sectionStyles survive round-trip after migration', () => {
      save({
        cards: [
          makeCard({
            id: 'c1',
            sectionStyles: { title: { fontWeight: 'bold', fontSize: 24 } },
          }),
        ],
      });
      const loaded = load();
      expect(loaded.cards![0].sectionStyles.title).toEqual({
        fontWeight: 'bold',
        fontSize: 24,
      });
    });

    it('card wordStyles survive round-trip (keys with ::)', () => {
      save({
        cards: [
          makeCard({
            id: 'c1',
            wordStyles: { 'title::hello': { fontWeight: 'bold' } },
          }),
        ],
      });
      const loaded = load();
      expect(loaded.cards![0].wordStyles['title::hello']).toEqual({ fontWeight: 'bold' });
    });

    it('theme survives a save → load cycle when in the whitelist', () => {
      save({ theme: 'ocean' });
      const loaded = load();
      expect(loaded.theme).toBe('ocean');
    });

    it('format survives a save → load cycle when in the whitelist', () => {
      save({ format: 'telegram' });
      const loaded = load();
      expect(loaded.format).toBe('telegram');
    });

    it('empty cards array is treated as no cards (skipped on load)', () => {
      // The load path requires `parsed.length` to be truthy — an empty array is ignored.
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify([]));
      const loaded = load();
      expect(loaded.cards).toBeUndefined();
    });

    it('saving only one key does not wipe other keys', () => {
      save({ theme: 'ocean' });
      save({ format: 'telegram' });
      const loaded = load();
      expect(loaded.theme).toBe('ocean');
      expect(loaded.format).toBe('telegram');
    });

    it('saving a card with empty objects strips them on disk (storage size optimization)', () => {
      save({ cards: [makeCard({ id: 'c1' })] });
      const raw = localStorage.getItem(STORAGE_KEYS.CARDS)!;
      // Stripped fields are not present in the serialized form
      expect(raw).not.toContain('wordStyles');
      expect(raw).not.toContain('sectionStyles');
      expect(raw).not.toContain('colors');
      expect(raw).not.toContain('theme');
    });
  });

  // ─── Corrupted JSON ─────────────────────────────────────────
  describe('corrupted JSON recovery', () => {
    it('does not throw on corrupted cards JSON — clears and continues', () => {
      localStorage.setItem(STORAGE_KEYS.CARDS, '{invalid json');
      expect(() => load()).not.toThrow();
      // The bad data should be removed
      expect(localStorage.getItem(STORAGE_KEYS.CARDS)).toBeNull();
      const loaded = load();
      expect(loaded.cards).toBeUndefined();
    });

    it('clears theme and format alongside cards on corruption', () => {
      localStorage.setItem(STORAGE_KEYS.CARDS, '{invalid');
      localStorage.setItem(STORAGE_KEYS.THEME, 'ocean');
      localStorage.setItem(STORAGE_KEYS.FORMAT, 'telegram');
      load();
      expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.FORMAT)).toBeNull();
    });

    it('does not throw when cards JSON parses to a non-array', () => {
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify({ not: 'an array' }));
      expect(() => load()).not.toThrow();
      const loaded = load();
      expect(loaded.cards).toBeUndefined();
    });

    it('does not throw when cards JSON parses to a non-object', () => {
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(42));
      expect(() => load()).not.toThrow();
    });
  });

  // ─── Malicious card.id (XSS prevention) ─────────────────────
  describe('malicious card.id rejection', () => {
    it('replaces a script-injecting id with a valid sanitized UUID', () => {
      const malicious = '"><script>alert(1)</script>';
      save({ cards: [makeCard({ id: malicious })] });
      const loaded = load();
      const id = loaded.cards![0].id;
      expect(id).not.toBe(malicious);
      expect(id).not.toContain('<');
      expect(id).not.toContain('>');
      expect(id).not.toContain('"');
      expect(VALID_ID_REGEX.test(id)).toBe(true);
    });

    it('rejects id with shell-style metacharacters', () => {
      save({ cards: [makeCard({ id: 'card;rm -rf /' })] });
      const loaded = load();
      const id = loaded.cards![0].id;
      expect(id).not.toBe('card;rm -rf /');
      expect(VALID_ID_REGEX.test(id)).toBe(true);
    });

    it('rejects a numeric id and replaces with a valid one', () => {
      // save() serializes whatever is passed; load() migrateCard() will sanitize.
      // Force a numeric id by directly writing to localStorage.
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([{ id: 12345, title: 'x' }])
      );
      const loaded = load();
      const id = loaded.cards![0].id;
      expect(typeof id).toBe('string');
      expect(VALID_ID_REGEX.test(id)).toBe(true);
    });

    it('preserves a valid id exactly', () => {
      save({ cards: [makeCard({ id: 'valid_id-1' })] });
      const loaded = load();
      expect(loaded.cards![0].id).toBe('valid_id-1');
    });
  });

  // ─── Invalid colors ─────────────────────────────────────────
  describe('invalid colors are stripped', () => {
    it('strips non-hex color values, keeps valid hex', () => {
      save({
        cards: [
          makeCard({
            id: 'c1',
            colors: {
              title: '<script>',
              subtitle: 'not-a-color',
              valid: '#fff',
              validLong: '#aabbccff',
            },
          }),
        ],
      });
      const loaded = load();
      expect(loaded.cards![0].colors).toEqual({
        valid: '#fff',
        validLong: '#aabbccff',
      });
    });

    it('strips hex-without-hash', () => {
      save({
        cards: [makeCard({ id: 'c1', colors: { bad: 'ffffff' } })],
      });
      const loaded = load();
      expect(loaded.cards![0].colors).toEqual({});
    });

    it('strips null color values', () => {
      // Direct write to bypass save() coercion
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([{ id: 'c1', colors: { title: null, valid: '#abc' } }])
      );
      const loaded = load();
      expect(loaded.cards![0].colors).toEqual({ valid: '#abc' });
    });

    it('handles a card with no colors field gracefully (defaults to {})', () => {
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([{ id: 'c1', title: 'hi' }])
      );
      const loaded = load();
      expect(loaded.cards![0].colors).toEqual({});
    });
    it('handles a card with non-object colors gracefully', () => {
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([{ id: 'c1', colors: 'not-an-object' }])
      );
      const loaded = load();
      expect(loaded.cards![0].colors).toEqual({});
    });
  });

  // ─── Invalid theme ──────────────────────────────────────────
  describe('invalid theme rejection', () => {
    it('rejects a theme not in the whitelist', () => {
      // save() does NOT validate theme — it stores as-is. load() validates.
      save({ theme: 'evil-theme' });
      const loaded = load();
      expect(loaded.theme).toBeUndefined();
    });

    it('rejects a script-injecting theme', () => {
      save({ theme: '"><script>alert(1)</script>' });
      const loaded = load();
      expect(loaded.theme).toBeUndefined();
    });

    it('accepts every theme in ALLOWED_THEMES', () => {
      for (const theme of ALLOWED_THEMES) {
        localStorage.clear();
        save({ theme });
        const loaded = load();
        expect(loaded.theme).toBe(theme);
      }
    });

    it('is case-sensitive (does not accept "Ocean" when only "ocean" is allowed)', () => {
      save({ theme: 'Ocean' });
      const loaded = load();
      expect(loaded.theme).toBeUndefined();
    });
  });

  // ─── Invalid format ─────────────────────────────────────────
  describe('invalid format rejection', () => {
    it('rejects a format not in the whitelist', () => {
      save({ format: 'evil-format' });
      const loaded = load();
      expect(loaded.format).toBeUndefined();
    });

    it('accepts every format in ALLOWED_FORMATS', () => {
      for (const fmt of ALLOWED_FORMATS) {
        localStorage.clear();
        save({ format: fmt });
        const loaded = load();
        expect(loaded.format).toBe(fmt);
      }
    });
  });

  // ─── Null sectionStyles field ───────────────────────────────
  describe('null sectionStyles field', () => {
    it('does not crash when sectionStyles[field] is null', () => {
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([
          {
            id: 'c1',
            title: 'hi',
            sectionStyles: { title: null, subtitle: null },
          },
        ])
      );
      expect(() => load()).not.toThrow();
      const loaded = load();
      // The null fields should be skipped — sectionStyles ends up empty
      expect(loaded.cards![0].sectionStyles).toEqual({});
    });

    it('does not crash when sectionStyles[field] is a primitive (non-object)', () => {
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([
          { id: 'c1', title: 'hi', sectionStyles: { title: 'oops' } },
        ])
      );
      expect(() => load()).not.toThrow();
      const loaded = load();
      // Primitive is not an object → guard skips it
      expect(loaded.cards![0].sectionStyles).toEqual({});
    });

    it('preserves valid sectionStyles alongside null fields', () => {
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([
          {
            id: 'c1',
            title: 'hi',
            sectionStyles: {
              title: null,
              text: { fontWeight: 'bold' },
            },
          },
        ])
      );
      const loaded = load();
      expect(loaded.cards![0].sectionStyles.text).toEqual({ fontWeight: 'bold' });
      expect(loaded.cards![0].sectionStyles.title).toBeUndefined();
    });

    it('migrates legacy {bold:"bold"} → {fontWeight:"bold"}', () => {
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([
          {
            id: 'c1',
            title: 'hi',
            sectionStyles: { title: { bold: 'bold', italic: 'italic' } },
          },
        ])
      );
      const loaded = load();
      expect(loaded.cards![0].sectionStyles.title).toEqual({
        fontWeight: 'bold',
        fontStyle: 'italic',
      });
    });

    it('clamps oversized fontSize in sectionStyles', () => {
      localStorage.setItem(
        STORAGE_KEYS.CARDS,
        JSON.stringify([
          {
            id: 'c1',
            title: 'hi',
            sectionStyles: { title: { fontSize: 9999 } },
          },
        ])
      );
      const loaded = load();
      expect(loaded.cards![0].sectionStyles.title!.fontSize).toBe(96);
    });
  });

  // ─── Quota exceeded ─────────────────────────────────────────
  describe('QuotaExceededError propagation', () => {
    it('re-throws a contextual Error when localStorage.setItem throws QuotaExceededError', () => {
      const quotaErr = new DOMException('quota exceeded', 'QuotaExceededError');
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaErr;
      });
      try {
        expect(() => save({ cards: [makeCard()] })).toThrowError(/QuotaExceededError/);
      } finally {
        spy.mockRestore();
      }
    });

    it('non-quota errors are re-thrown as-is (not wrapped)', () => {
      const otherErr = new Error('something else');
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw otherErr;
      });
      try {
        expect(() => save({ theme: 'ocean' })).toThrow(otherErr);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ─── clear() ────────────────────────────────────────────────
  describe('clear()', () => {
    it('removes all storage entries owned by StorageManager', () => {
      save({
        cards: [makeCard()],
        theme: 'ocean',
        format: 'telegram',
      });
      // Verify populated
      expect(localStorage.getItem(STORAGE_KEYS.CARDS)).not.toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.THEME)).not.toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.FORMAT)).not.toBeNull();
      clear();
      expect(localStorage.getItem(STORAGE_KEYS.CARDS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.FORMAT)).toBeNull();
    });
    it('clear() then load() returns an empty result', () => {
      save({ cards: [makeCard()], theme: 'ocean' });
      clear();
      const loaded = load();
      expect(loaded.cards).toBeUndefined();
      expect(loaded.theme).toBeUndefined();
      expect(loaded.format).toBeUndefined();
    });
  });

  // ─── Other saved fields round-trip ─────────────────────────
  describe('other SavedState fields round-trip', () => {
    it('boolean fields round-trip as "true"/"false" strings', () => {
      const state: Partial<SavedState> = {
        showCardNumbers: false,
        showProgressBar: true,
        charLimitEnabled: true,
      };
      save(state);
      const loaded = load();
      expect(loaded.showCardNumbers).toBe(false);
      expect(loaded.showProgressBar).toBe(true);
      expect(loaded.charLimitEnabled).toBe(true);
    });

    it('progressBarStyle and listStyleType round-trip', () => {
      save({ progressBarStyle: 'circles', listStyleType: 'dash' });
      const loaded = load();
      expect(loaded.progressBarStyle).toBe('circles');
      expect(loaded.listStyleType).toBe('dash');
    });

    it('gradientAngle round-trips as a number', () => {
      save({ gradientAngle: 90 });
      const loaded = load();
      expect(loaded.gradientAngle).toBe(90);
    });

    it('gradientAngle falls back to 135 when stored value is non-numeric', () => {
      localStorage.setItem('flashcard-gradient-angle', 'not-a-number');
      const loaded = load();
      expect(loaded.gradientAngle).toBe(135);
    });

    it('sidebarWidth and headerHeight round-trip', () => {
      save({ sidebarWidth: 320, headerHeight: 80 });
      const loaded = load();
      expect(loaded.sidebarWidth).toBe(320);
      expect(loaded.headerHeight).toBe(80);
    });

    it('null sidebarWidth / headerHeight are not persisted', () => {
      save({ sidebarWidth: null, headerHeight: null });
      expect(localStorage.getItem('flashcard-sidebar-width')).toBeNull();
      expect(localStorage.getItem('flashcard-header-height')).toBeNull();
    });
  });
});
