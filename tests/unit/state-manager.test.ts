/**
 * Unit tests for src/state/StateManager.ts
 *
 * Covers reducer behavior for every action type, immutability of state,
 * subscribe/unsubscribe semantics, and the boundary conditions where
 * the reducer's own guards engage (out-of-range index, single-card delete).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '@/state/StateManager';
import type { Action, Snapshot } from '@/core/types';
import { DEFAULT_THEME, DEFAULT_FORMAT, DEFAULT_GRADIENT_ANGLE } from '@/core/constants';

function dispatch(sm: StateManager, type: Action['type'], payload?: unknown): void {
  sm.dispatch({ type, payload } as Action);
}

describe('StateManager', () => {
  let sm: StateManager;

  beforeEach(() => {
    sm = new StateManager();
  });

  // ─── Initial state ──────────────────────────────────────────
  describe('initial state', () => {
    it('starts with exactly one empty card', () => {
      expect(sm.getCardCount()).toBe(1);
      expect(sm.getCards()[0]).toBeDefined();
      expect(sm.getCards()[0].id).toBeTruthy();
    });
    it('starts with default theme and format', () => {
      expect(sm.getTheme()).toBe(DEFAULT_THEME);
      expect(sm.getFormat()).toBe(DEFAULT_FORMAT);
    });
    it('starts with default settings', () => {
      const s = sm.getSettings();
      expect(s.gradientAngle).toBe(DEFAULT_GRADIENT_ANGLE);
      expect(s.showCardNumbers).toBe(true);
      expect(s.showProgressBar).toBe(true);
      expect(s.progressBarStyle).toBe('default');
      expect(s.listStyleType).toBe('numbers');
      expect(s.charLimitEnabled).toBe(false);
    });
    it('accepts a partial initial state override', () => {
      const custom = new StateManager({
        settings: { theme: 'ocean', format: 'telegram' } as never,
      });
      // Spread merge — nested objects are NOT deep-merged, so the override
      // fully replaces `settings`. Documenting the actual behavior.
      expect(custom.getTheme()).toBe('ocean');
      expect(custom.getFormat()).toBe('telegram');
    });
  });

  // ─── ADD_CARD ───────────────────────────────────────────────
  describe('ADD_CARD', () => {
    it('increases the card count by 1', () => {
      const before = sm.getCardCount();
      dispatch(sm, 'ADD_CARD');
      expect(sm.getCardCount()).toBe(before + 1);
    });
    it('the new card has a valid (non-empty) id', () => {
      dispatch(sm, 'ADD_CARD');
      const newCard = sm.getCards()[sm.getCardCount() - 1];
      expect(typeof newCard.id).toBe('string');
      expect(newCard.id.length).toBeGreaterThan(0);
    });
    it('the new card is empty (no title/text/etc.)', () => {
      dispatch(sm, 'ADD_CARD');
      const newCard = sm.getCards()[sm.getCardCount() - 1];
      expect(newCard.title).toBe('');
      expect(newCard.text).toBe('');
      expect(newCard.colors).toEqual({});
      expect(newCard.wordStyles).toEqual({});
      expect(newCard.sectionStyles).toEqual({});
    });
  });

  // ─── DELETE_CARD ────────────────────────────────────────────
  describe('DELETE_CARD', () => {
    it('removes the card at the given index', () => {
      dispatch(sm, 'ADD_CARD'); // 2 cards
      dispatch(sm, 'ADD_CARD'); // 3 cards
      const firstId = sm.getCards()[0].id;
      dispatch(sm, 'DELETE_CARD', 0);
      expect(sm.getCardCount()).toBe(2);
      expect(sm.getCards()[0].id).not.toBe(firstId);
    });
    it('refuses to delete the last remaining card (returns same state)', () => {
      expect(sm.getCardCount()).toBe(1);
      const before = sm.get();
      dispatch(sm, 'DELETE_CARD', 0);
      expect(sm.getCardCount()).toBe(1);
      expect(sm.get()).toBe(before); // same reference — no state change
    });
    it('does nothing for negative index (returns same state)', () => {
      dispatch(sm, 'ADD_CARD');
      const before = sm.get();
      dispatch(sm, 'DELETE_CARD', -1);
      expect(sm.get()).toBe(before);
    });
    it('does nothing for out-of-range index (returns same state)', () => {
      dispatch(sm, 'ADD_CARD');
      const before = sm.get();
      dispatch(sm, 'DELETE_CARD', 999);
      expect(sm.get()).toBe(before);
    });
    it('with NaN index and >1 cards: documents actual behavior (removes first card via splice(NaN,1) → splice(0,1))', () => {
      // NOTE: The reducer guard `idx < 0 || idx >= length` does NOT catch NaN
      // (NaN comparisons always return false). The guard at the orchestrator
      // level (CardCraftApp.deleteCard) is what prevents NaN from reaching
      // the reducer. Documenting the reducer's actual (unguarded) behavior
      // so a future tightening of the reducer is intentional, not silent.
      dispatch(sm, 'ADD_CARD'); // 2 cards
      dispatch(sm, 'ADD_CARD'); // 3 cards
      const firstId = sm.getCards()[0].id;
      dispatch(sm, 'DELETE_CARD', NaN);
      // splice(NaN, 1) is treated as splice(0, 1) → first card removed.
      expect(sm.getCardCount()).toBe(2);
      expect(sm.getCards()[0].id).not.toBe(firstId);
    });
    it('with NaN index and only 1 card: guard `length <= 1` triggers, no change', () => {
      const before = sm.get();
      dispatch(sm, 'DELETE_CARD', NaN);
      expect(sm.get()).toBe(before);
      expect(sm.getCardCount()).toBe(1);
    });
  });

  // ─── DUPLICATE_CARD ─────────────────────────────────────────
  describe('DUPLICATE_CARD', () => {
    it('increases card count', () => {
      dispatch(sm, 'ADD_CARD');
      const before = sm.getCardCount();
      dispatch(sm, 'DUPLICATE_CARD', 0);
      expect(sm.getCardCount()).toBe(before + 1);
    });
    it('the duplicated card has a NEW id (different from the source)', () => {
      dispatch(sm, 'ADD_CARD');
      const sourceId = sm.getCards()[0].id;
      dispatch(sm, 'DUPLICATE_CARD', 0);
      const copy = sm.getCards()[1];
      expect(copy.id).not.toBe(sourceId);
    });
    it('the duplicated card is inserted immediately after the source', () => {
      dispatch(sm, 'ADD_CARD');
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 0, field: 'title', value: 'original' });
      dispatch(sm, 'DUPLICATE_CARD', 0);
      // Index 0 is original, index 1 is the copy (with same content but new id)
      expect(sm.getCards()[0].title).toBe('original');
      expect(sm.getCards()[1].title).toBe('original');
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      dispatch(sm, 'DUPLICATE_CARD', 999);
      expect(sm.get()).toBe(before);
    });
  });

  // ─── MOVE_CARD ──────────────────────────────────────────────
  describe('MOVE_CARD', () => {
    beforeEach(() => {
      dispatch(sm, 'ADD_CARD');
      dispatch(sm, 'ADD_CARD');
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 0, field: 'title', value: 'A' });
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 1, field: 'title', value: 'B' });
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 2, field: 'title', value: 'C' });
    });
    it('moves a card down (dir = +1)', () => {
      dispatch(sm, 'MOVE_CARD', { idx: 0, dir: 1 });
      expect(sm.getCards()[0].title).toBe('B');
      expect(sm.getCards()[1].title).toBe('A');
    });
    it('moves a card up (dir = -1)', () => {
      dispatch(sm, 'MOVE_CARD', { idx: 2, dir: -1 });
      expect(sm.getCards()[1].title).toBe('C');
      expect(sm.getCards()[2].title).toBe('B');
    });
    it('refuses to move the first card up (no-op)', () => {
      const before = sm.get();
      dispatch(sm, 'MOVE_CARD', { idx: 0, dir: -1 });
      expect(sm.get()).toBe(before);
    });
    it('refuses to move the last card down (no-op)', () => {
      const before = sm.get();
      dispatch(sm, 'MOVE_CARD', { idx: 2, dir: 1 });
      expect(sm.get()).toBe(before);
    });
  });

  // ─── Settings actions ───────────────────────────────────────
  describe('SET_GLOBAL_THEME', () => {
    it('changes the theme', () => {
      dispatch(sm, 'SET_GLOBAL_THEME', 'ocean');
      expect(sm.getTheme()).toBe('ocean');
    });
  });
  describe('SET_FORMAT', () => {
    it('changes the format', () => {
      dispatch(sm, 'SET_FORMAT', 'telegram');
      expect(sm.getFormat()).toBe('telegram');
    });
  });
  describe('SET_GRADIENT_ANGLE', () => {
    it('changes the gradient angle', () => {
      dispatch(sm, 'SET_GRADIENT_ANGLE', 45);
      expect(sm.getGradientAngle()).toBe(45);
    });
  });
  describe('SET_SHOW_CARD_NUMBERS', () => {
    it('toggles the flag', () => {
      dispatch(sm, 'SET_SHOW_CARD_NUMBERS', false);
      expect(sm.getSettings().showCardNumbers).toBe(false);
    });
  });
  describe('SET_SHOW_PROGRESS_BAR', () => {
    it('toggles the flag', () => {
      dispatch(sm, 'SET_SHOW_PROGRESS_BAR', false);
      expect(sm.getSettings().showProgressBar).toBe(false);
    });
  });
  describe('SET_PROGRESS_BAR_STYLE', () => {
    it('changes the style', () => {
      dispatch(sm, 'SET_PROGRESS_BAR_STYLE', 'circles');
      const pc = sm.getProgressConfig();
      expect(pc.style).toBe('circles');
    });
  });
  describe('SET_LIST_STYLE', () => {
    it('changes the list style', () => {
      dispatch(sm, 'SET_LIST_STYLE', 'dash');
      expect(sm.getListStyle()).toBe('dash');
    });
  });
  describe('SET_CHAR_LIMIT', () => {
    it('toggles the flag', () => {
      dispatch(sm, 'SET_CHAR_LIMIT', true);
      expect(sm.getSettings().charLimitEnabled).toBe(true);
    });
  });

  // ─── SET_PROGRESS_CONFIG (composite: show + style) ──────────
  describe('progress config (show + style combined)', () => {
    it('can be read as a single object', () => {
      dispatch(sm, 'SET_SHOW_PROGRESS_BAR', false);
      dispatch(sm, 'SET_PROGRESS_BAR_STYLE', 'circles');
      const pc = sm.getProgressConfig();
      expect(pc).toEqual({ show: false, style: 'circles' });
    });
  });

  // ─── Card-level mutations ───────────────────────────────────
  describe('UPDATE_CARD_FIELD', () => {
    it('updates the specified field on the specified card', () => {
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 0, field: 'title', value: 'New Title' });
      expect(sm.getCards()[0].title).toBe('New Title');
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 999, field: 'title', value: 'X' });
      expect(sm.get()).toBe(before);
    });
  });
  describe('SET_CARD_THEME', () => {
    it('sets the card-level theme override', () => {
      dispatch(sm, 'SET_CARD_THEME', { idx: 0, theme: 'forest' });
      expect(sm.getCards()[0].theme).toBe('forest');
    });
    it('can clear the override by passing undefined', () => {
      dispatch(sm, 'SET_CARD_THEME', { idx: 0, theme: 'forest' });
      dispatch(sm, 'SET_CARD_THEME', { idx: 0, theme: undefined });
      expect(sm.getCards()[0].theme).toBeUndefined();
    });
  });
  describe('SET_CARD_COLORS', () => {
    it('replaces the colors object on the card', () => {
      dispatch(sm, 'SET_CARD_COLORS', { idx: 0, colors: { title: '#fff' } });
      expect(sm.getCards()[0].colors).toEqual({ title: '#fff' });
    });
  });
  describe('SET_CARD_SECTION_STYLES', () => {
    it('replaces the sectionStyles object on the card', () => {
      dispatch(sm, 'SET_CARD_SECTION_STYLES', {
        idx: 0,
        sectionStyles: { title: { fontWeight: 'bold' } },
      });
      expect(sm.getCards()[0].sectionStyles.title).toEqual({ fontWeight: 'bold' });
    });
  });
  describe('SET_CARD_WORD_STYLES', () => {
    it('replaces the wordStyles object on the card', () => {
      dispatch(sm, 'SET_CARD_WORD_STYLES', {
        idx: 0,
        wordStyles: { 'title::hi': { fontWeight: 'bold' } },
      });
      expect(sm.getCards()[0].wordStyles['title::hi']).toEqual({ fontWeight: 'bold' });
    });
  });
  describe('DELETE_CARD_WORD_STYLE', () => {
    it('removes the specified word-style key', () => {
      dispatch(sm, 'SET_CARD_WORD_STYLES', {
        idx: 0,
        wordStyles: { 'title::a': { fontWeight: 'bold' }, 'title::b': { fontStyle: 'italic' } },
      });
      dispatch(sm, 'DELETE_CARD_WORD_STYLE', { idx: 0, key: 'title::a' });
      expect(sm.getCards()[0].wordStyles).toEqual({ 'title::b': { fontStyle: 'italic' } });
    });
    it('is a no-op when the key does not exist', () => {
      dispatch(sm, 'SET_CARD_WORD_STYLES', {
        idx: 0,
        wordStyles: { 'title::a': { fontWeight: 'bold' } },
      });
      const before = sm.get();
      dispatch(sm, 'DELETE_CARD_WORD_STYLE', { idx: 0, key: 'title::nonexistent' });
      expect(sm.get()).toBe(before);
    });
  });
  describe('CLEAR_ALL', () => {
    it('resets cards to a single empty card', () => {
      dispatch(sm, 'ADD_CARD');
      dispatch(sm, 'ADD_CARD');
      dispatch(sm, 'CLEAR_ALL');
      expect(sm.getCardCount()).toBe(1);
      expect(sm.getCards()[0].title).toBe('');
    });
  });

  // ─── RESTORE_SNAPSHOT ───────────────────────────────────────
  describe('RESTORE_SNAPSHOT', () => {
    it('restores cards, theme, and format from a snapshot', () => {
      // Set up a different state first
      dispatch(sm, 'SET_GLOBAL_THEME', 'ocean');
      dispatch(sm, 'SET_FORMAT', 'telegram');
      dispatch(sm, 'ADD_CARD');
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 0, field: 'title', value: 'modified' });

      const snap: Snapshot = {
        cards: [
          {
            id: 'restored-1',
            title: 'Restored',
            subtitle: '',
            text: '',
            listItems: '',
            footer: '',
            cta: '',
            colors: {},
            wordStyles: {},
            sectionStyles: {},
          },
        ],
        theme: 'forest',
        format: 'whatsapp',
      };
      dispatch(sm, 'RESTORE_SNAPSHOT', snap);
      expect(sm.getCardCount()).toBe(1);
      expect(sm.getCards()[0].id).toBe('restored-1');
      expect(sm.getCards()[0].title).toBe('Restored');
      expect(sm.getTheme()).toBe('forest');
      expect(sm.getFormat()).toBe('whatsapp');
    });
    it('does NOT touch other settings (gradientAngle preserved)', () => {
      dispatch(sm, 'SET_GRADIENT_ANGLE', 45);
      dispatch(sm, 'RESTORE_SNAPSHOT', {
        cards: sm.getCards(),
        theme: 'forest',
        format: 'telegram',
      });
      expect(sm.getGradientAngle()).toBe(45);
    });
    it('snapshot() round-trips through RESTORE_SNAPSHOT', () => {
      dispatch(sm, 'ADD_CARD');
      dispatch(sm, 'SET_GLOBAL_THEME', 'ocean');
      const snap = sm.snapshot();
      // Mutate state further
      dispatch(sm, 'CLEAR_ALL');
      dispatch(sm, 'SET_GLOBAL_THEME', 'default');
      // Restore
      dispatch(sm, 'RESTORE_SNAPSHOT', snap);
      expect(sm.getCardCount()).toBe(2);
      expect(sm.getTheme()).toBe('ocean');
    });
  });

  // ─── Immutability ───────────────────────────────────────────
  describe('immutability', () => {
    it('dispatching ADD_CARD returns a NEW state object (not the same reference)', () => {
      const before = sm.get();
      dispatch(sm, 'ADD_CARD');
      const after = sm.get();
      expect(after).not.toBe(before);
    });
    it('dispatching SET_GLOBAL_THEME returns a NEW state object', () => {
      const before = sm.get();
      dispatch(sm, 'SET_GLOBAL_THEME', 'ocean');
      expect(sm.get()).not.toBe(before);
    });
    it('a no-op dispatch (e.g. invalid delete) returns the SAME reference (no notification fired)', () => {
      const before = sm.get();
      dispatch(sm, 'DELETE_CARD', 999);
      expect(sm.get()).toBe(before);
    });
    it('the cards array reference changes when ADD_CARD fires (not mutated in place)', () => {
      const beforeCards = sm.getCards();
      dispatch(sm, 'ADD_CARD');
      expect(sm.getCards()).not.toBe(beforeCards);
    });
    it('an individual card object reference changes when its field is updated', () => {
      const cardBefore = sm.getCards()[0];
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 0, field: 'title', value: 'X' });
      expect(sm.getCards()[0]).not.toBe(cardBefore);
    });
  });

  // ─── Subscriptions ──────────────────────────────────────────
  describe('subscribe / unsubscribe', () => {
    it('subscribe(cb) is called when an action changes state', () => {
      const cb = vi.fn();
      sm.subscribe(cb);
      dispatch(sm, 'ADD_CARD');
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(sm.get());
    });
    it('subscribe(cb) is NOT called when an action is a no-op', () => {
      const cb = vi.fn();
      sm.subscribe(cb);
      dispatch(sm, 'DELETE_CARD', 999); // no-op
      expect(cb).not.toHaveBeenCalled();
    });
    it('unsubscribe(cb) stops further notifications', () => {
      const cb = vi.fn();
      const unsub = sm.subscribe(cb);
      dispatch(sm, 'ADD_CARD');
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
      dispatch(sm, 'ADD_CARD');
      expect(cb).toHaveBeenCalledTimes(1); // not called again
    });
    it('multiple subscribers are all called', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      sm.subscribe(cb1);
      sm.subscribe(cb2);
      dispatch(sm, 'ADD_CARD');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
    it('subscribe returns a function', () => {
      const unsub = sm.subscribe(() => {});
      expect(typeof unsub).toBe('function');
    });
    it('restore() notifies subscribers', () => {
      const cb = vi.fn();
      sm.subscribe(cb);
      sm.restore({ cards: sm.getCards(), theme: 'ocean', format: 'telegram' });
      expect(cb).toHaveBeenCalledTimes(1);
    });
    it('setCards() notifies subscribers', () => {
      const cb = vi.fn();
      sm.subscribe(cb);
      sm.setCards([...sm.getCards(), sm.getCards()[0]]);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // ─── snapshot() ─────────────────────────────────────────────
  describe('snapshot()', () => {
    it('returns a deep clone (mutating it does not affect state)', () => {
      dispatch(sm, 'UPDATE_CARD_FIELD', { idx: 0, field: 'title', value: 'orig' });
      const snap = sm.snapshot();
      snap.cards[0].title = 'mutated';
      expect(sm.getCards()[0].title).toBe('orig');
    });
    it('contains cards, theme, and format', () => {
      dispatch(sm, 'SET_GLOBAL_THEME', 'ocean');
      dispatch(sm, 'SET_FORMAT', 'telegram');
      const snap = sm.snapshot();
      expect(Array.isArray(snap.cards)).toBe(true);
      expect(snap.theme).toBe('ocean');
      expect(snap.format).toBe('telegram');
    });
  });

  // ─── Unknown action ─────────────────────────────────────────
  describe('unknown action', () => {
    it('an action with an unrecognized type returns the same state (default case)', () => {
      const before = sm.get();
      // @ts-expect-error testing runtime with an invalid type
      sm.dispatch({ type: 'NONEXISTENT_ACTION', payload: null });
      expect(sm.get()).toBe(before);
    });
  });
});
