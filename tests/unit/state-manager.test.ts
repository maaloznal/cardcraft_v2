/**
 * Unit tests for src/state/StateManager.ts
 *
 * Covers reducer behavior for every action type, immutability of state,
 * subscribe/unsubscribe semantics, and the boundary conditions where
 * the reducer's own guards engage (out-of-range index, single-card delete).
 *
 * P1-2: all dispatches use the type-safe discriminated Action union directly
 *       (no `as Action` casts, no `payload?: unknown` helper).
 * P1-1: includes tests for the new granular card-mutation actions
 *       (SET_CARD_COLOR_FIELD, DELETE_CARD_COLOR_FIELD, SET_SECTION_STYLE_FIELD,
 *        SET_SECTION_FONT_SIZE, RESET_CARD_STYLES).
 * P1-3: includes tests for SET_UI (UI state now lives in StateManager).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '@/state/StateManager';
import type { Snapshot } from '@/core/types';
import { DEFAULT_THEME, DEFAULT_FORMAT, DEFAULT_GRADIENT_ANGLE } from '@/core/constants';

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
    it('starts with default UI state', () => {
      const ui = sm.getUI();
      expect(ui.colorModalOpen).toBe(false);
      expect(ui.activeCardIndexForColors).toBeNull();
      expect(ui.lastActiveField).toBe('title');
      expect(ui.wordPopupOpen).toBe(false);
      expect(ui.activeCardIndexForWord).toBeNull();
      expect(ui.activeFieldForWord).toBeNull();
      expect(ui.sidebarOpen).toBe(false);
      expect(ui.sidebarWasCollapsedBeforeModal).toBe(true);
      expect(ui.confirmDialogOpen).toBe(false);
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
      sm.dispatch({ type: 'ADD_CARD' });
      expect(sm.getCardCount()).toBe(before + 1);
    });
    it('the new card has a valid (non-empty) id', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      const newCard = sm.getCards()[sm.getCardCount() - 1];
      expect(typeof newCard.id).toBe('string');
      expect(newCard.id.length).toBeGreaterThan(0);
    });
    it('the new card is empty (no title/text/etc.)', () => {
      sm.dispatch({ type: 'ADD_CARD' });
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
      sm.dispatch({ type: 'ADD_CARD' }); // 2 cards
      sm.dispatch({ type: 'ADD_CARD' }); // 3 cards
      const firstId = sm.getCards()[0].id;
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: 0 } });
      expect(sm.getCardCount()).toBe(2);
      expect(sm.getCards()[0].id).not.toBe(firstId);
    });
    it('refuses to delete the last remaining card (returns same state)', () => {
      expect(sm.getCardCount()).toBe(1);
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: 0 } });
      expect(sm.getCardCount()).toBe(1);
      expect(sm.get()).toBe(before); // same reference — no state change
    });
    it('does nothing for negative index (returns same state)', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: -1 } });
      expect(sm.get()).toBe(before);
    });
    it('does nothing for out-of-range index (returns same state)', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: 999 } });
      expect(sm.get()).toBe(before);
    });
    it('with NaN index and >1 cards: documents actual behavior (removes first card via splice(NaN,1) → splice(0,1))', () => {
      // NOTE: The reducer guard `idx < 0 || idx >= length` does NOT catch NaN
      // (NaN comparisons always return false). The guard at the orchestrator
      // level (CardCraftApp.deleteCard) is what prevents NaN from reaching
      // the reducer. Documenting the reducer's actual (unguarded) behavior
      // so a future tightening of the reducer is intentional, not silent.
      sm.dispatch({ type: 'ADD_CARD' }); // 2 cards
      sm.dispatch({ type: 'ADD_CARD' }); // 3 cards
      const firstId = sm.getCards()[0].id;
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: NaN } });
      // splice(NaN, 1) is treated as splice(0, 1) → first card removed.
      expect(sm.getCardCount()).toBe(2);
      expect(sm.getCards()[0].id).not.toBe(firstId);
    });
    it('with NaN index and only 1 card: guard `length <= 1` triggers, no change', () => {
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: NaN } });
      expect(sm.get()).toBe(before);
      expect(sm.getCardCount()).toBe(1);
    });
  });

  // ─── DUPLICATE_CARD ─────────────────────────────────────────
  describe('DUPLICATE_CARD', () => {
    it('increases card count', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      const before = sm.getCardCount();
      sm.dispatch({ type: 'DUPLICATE_CARD', payload: { idx: 0 } });
      expect(sm.getCardCount()).toBe(before + 1);
    });
    it('the duplicated card has a NEW id (different from the source)', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      const sourceId = sm.getCards()[0].id;
      sm.dispatch({ type: 'DUPLICATE_CARD', payload: { idx: 0 } });
      const copy = sm.getCards()[1];
      expect(copy.id).not.toBe(sourceId);
    });
    it('the duplicated card is inserted immediately after the source', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 0, field: 'title', value: 'original' } });
      sm.dispatch({ type: 'DUPLICATE_CARD', payload: { idx: 0 } });
      // Index 0 is original, index 1 is the copy (with same content but new id)
      expect(sm.getCards()[0].title).toBe('original');
      expect(sm.getCards()[1].title).toBe('original');
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      sm.dispatch({ type: 'DUPLICATE_CARD', payload: { idx: 999 } });
      expect(sm.get()).toBe(before);
    });
  });

  // ─── MOVE_CARD ──────────────────────────────────────────────
  describe('MOVE_CARD', () => {
    beforeEach(() => {
      sm.dispatch({ type: 'ADD_CARD' });
      sm.dispatch({ type: 'ADD_CARD' });
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 0, field: 'title', value: 'A' } });
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 1, field: 'title', value: 'B' } });
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 2, field: 'title', value: 'C' } });
    });
    it('moves a card down (dir = +1)', () => {
      sm.dispatch({ type: 'MOVE_CARD', payload: { idx: 0, dir: 1 } });
      expect(sm.getCards()[0].title).toBe('B');
      expect(sm.getCards()[1].title).toBe('A');
    });
    it('moves a card up (dir = -1)', () => {
      sm.dispatch({ type: 'MOVE_CARD', payload: { idx: 2, dir: -1 } });
      expect(sm.getCards()[1].title).toBe('C');
      expect(sm.getCards()[2].title).toBe('B');
    });
    it('refuses to move the first card up (no-op)', () => {
      const before = sm.get();
      sm.dispatch({ type: 'MOVE_CARD', payload: { idx: 0, dir: -1 } });
      expect(sm.get()).toBe(before);
    });
    it('refuses to move the last card down (no-op)', () => {
      const before = sm.get();
      sm.dispatch({ type: 'MOVE_CARD', payload: { idx: 2, dir: 1 } });
      expect(sm.get()).toBe(before);
    });
  });

  // ─── Settings actions ───────────────────────────────────────
  describe('SET_GLOBAL_THEME', () => {
    it('changes the theme', () => {
      sm.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: 'ocean' } });
      expect(sm.getTheme()).toBe('ocean');
    });
  });
  describe('SET_FORMAT', () => {
    it('changes the format', () => {
      sm.dispatch({ type: 'SET_FORMAT', payload: { format: 'telegram' } });
      expect(sm.getFormat()).toBe('telegram');
    });
  });
  describe('SET_GRADIENT_ANGLE', () => {
    it('changes the gradient angle', () => {
      sm.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: { angle: 45 } });
      expect(sm.getGradientAngle()).toBe(45);
    });
  });
  describe('SET_SHOW_CARD_NUMBERS', () => {
    it('toggles the flag', () => {
      sm.dispatch({ type: 'SET_SHOW_CARD_NUMBERS', payload: { show: false } });
      expect(sm.getSettings().showCardNumbers).toBe(false);
    });
  });
  describe('SET_SHOW_PROGRESS_BAR', () => {
    it('toggles the flag', () => {
      sm.dispatch({ type: 'SET_SHOW_PROGRESS_BAR', payload: { show: false } });
      expect(sm.getSettings().showProgressBar).toBe(false);
    });
  });
  describe('SET_PROGRESS_BAR_STYLE', () => {
    it('changes the style', () => {
      sm.dispatch({ type: 'SET_PROGRESS_BAR_STYLE', payload: { style: 'circles' } });
      const pc = sm.getProgressConfig();
      expect(pc.style).toBe('circles');
    });
  });
  describe('SET_LIST_STYLE', () => {
    it('changes the list style', () => {
      sm.dispatch({ type: 'SET_LIST_STYLE', payload: { style: 'dash' } });
      expect(sm.getListStyle()).toBe('dash');
    });
  });
  describe('SET_CHAR_LIMIT', () => {
    it('toggles the flag', () => {
      sm.dispatch({ type: 'SET_CHAR_LIMIT', payload: { enabled: true } });
      expect(sm.getSettings().charLimitEnabled).toBe(true);
    });
  });

  // ─── SET_PROGRESS_CONFIG (composite: show + style) ──────────
  describe('progress config (show + style combined)', () => {
    it('can be read as a single object', () => {
      sm.dispatch({ type: 'SET_SHOW_PROGRESS_BAR', payload: { show: false } });
      sm.dispatch({ type: 'SET_PROGRESS_BAR_STYLE', payload: { style: 'circles' } });
      const pc = sm.getProgressConfig();
      expect(pc).toEqual({ show: false, style: 'circles' });
    });
  });

  // ─── Card-level mutations ───────────────────────────────────
  describe('UPDATE_CARD_FIELD', () => {
    it('updates the specified field on the specified card', () => {
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 0, field: 'title', value: 'New Title' } });
      expect(sm.getCards()[0].title).toBe('New Title');
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 999, field: 'title', value: 'X' } });
      expect(sm.get()).toBe(before);
    });
  });
  describe('SET_CARD_THEME', () => {
    it('sets the card-level theme override', () => {
      sm.dispatch({ type: 'SET_CARD_THEME', payload: { idx: 0, theme: 'forest' } });
      expect(sm.getCards()[0].theme).toBe('forest');
    });
    it('can clear the override by passing undefined', () => {
      sm.dispatch({ type: 'SET_CARD_THEME', payload: { idx: 0, theme: 'forest' } });
      sm.dispatch({ type: 'SET_CARD_THEME', payload: { idx: 0, theme: undefined } });
      expect(sm.getCards()[0].theme).toBeUndefined();
    });
  });
  describe('SET_CARD_COLORS', () => {
    it('replaces the colors object on the card', () => {
      sm.dispatch({ type: 'SET_CARD_COLORS', payload: { idx: 0, colors: { title: '#fff' } } });
      expect(sm.getCards()[0].colors).toEqual({ title: '#fff' });
    });
  });
  describe('SET_CARD_SECTION_STYLES', () => {
    it('replaces the sectionStyles object on the card', () => {
      sm.dispatch({
        type: 'SET_CARD_SECTION_STYLES',
        payload: { idx: 0, sectionStyles: { title: { fontWeight: 'bold' } } },
      });
      expect(sm.getCards()[0].sectionStyles.title).toEqual({ fontWeight: 'bold' });
    });
  });
  describe('SET_CARD_WORD_STYLES', () => {
    it('replaces the wordStyles object on the card', () => {
      sm.dispatch({
        type: 'SET_CARD_WORD_STYLES',
        payload: { idx: 0, wordStyles: { 'title::hi': { fontWeight: 'bold' } } },
      });
      expect(sm.getCards()[0].wordStyles['title::hi']).toEqual({ fontWeight: 'bold' });
    });
  });
  describe('DELETE_CARD_WORD_STYLE', () => {
    it('removes the specified word-style key', () => {
      sm.dispatch({
        type: 'SET_CARD_WORD_STYLES',
        payload: {
          idx: 0,
          wordStyles: { 'title::a': { fontWeight: 'bold' }, 'title::b': { fontStyle: 'italic' } },
        },
      });
      sm.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx: 0, key: 'title::a' } });
      expect(sm.getCards()[0].wordStyles).toEqual({ 'title::b': { fontStyle: 'italic' } });
    });
    it('is a no-op when the key does not exist', () => {
      sm.dispatch({
        type: 'SET_CARD_WORD_STYLES',
        payload: { idx: 0, wordStyles: { 'title::a': { fontWeight: 'bold' } } },
      });
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD_WORD_STYLE', payload: { idx: 0, key: 'title::nonexistent' } });
      expect(sm.get()).toBe(before);
    });
  });
  describe('CLEAR_ALL', () => {
    it('resets cards to a single empty card', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      sm.dispatch({ type: 'ADD_CARD' });
      sm.dispatch({ type: 'CLEAR_ALL' });
      expect(sm.getCardCount()).toBe(1);
      expect(sm.getCards()[0].title).toBe('');
    });
  });

  // ─── Granular card mutations (P1-1) ─────────────────────────
  describe('SET_CARD_COLOR_FIELD', () => {
    it('sets a single color field on the card without touching other colors', () => {
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#ff0000' } });
      expect(sm.getCards()[0].colors.title).toBe('#ff0000');
      expect(sm.getCards()[0].colors.subtitle).toBeUndefined();
    });
    it('preserves existing colors when setting a new field', () => {
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#ff0000' } });
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'subtitle', value: '#00ff00' } });
      expect(sm.getCards()[0].colors).toEqual({ title: '#ff0000', subtitle: '#00ff00' });
    });
    it('overwrites the same field on repeat', () => {
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#aaa' } });
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#bbb' } });
      expect(sm.getCards()[0].colors.title).toBe('#bbb');
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 999, field: 'title', value: '#fff' } });
      expect(sm.get()).toBe(before);
    });
    it('returns a new card reference (immutable update)', () => {
      const cardBefore = sm.getCards()[0];
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#fff' } });
      expect(sm.getCards()[0]).not.toBe(cardBefore);
    });
  });

  describe('DELETE_CARD_COLOR_FIELD', () => {
    it('removes a single color field, preserving others', () => {
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#ff0000' } });
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'subtitle', value: '#00ff00' } });
      sm.dispatch({ type: 'DELETE_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title' } });
      expect(sm.getCards()[0].colors).toEqual({ subtitle: '#00ff00' });
    });
    it('is a no-op when the field does not exist', () => {
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#ff0000' } });
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD_COLOR_FIELD', payload: { idx: 0, field: 'nonexistent' } });
      expect(sm.get()).toBe(before);
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD_COLOR_FIELD', payload: { idx: 999, field: 'title' } });
      expect(sm.get()).toBe(before);
    });
  });

  describe('SET_SECTION_STYLE_FIELD', () => {
    it('sets fontWeight on a section style', () => {
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontWeight', value: 'bold' },
      });
      expect(sm.getCards()[0].sectionStyles.title?.fontWeight).toBe('bold');
    });
    it('sets fontStyle without affecting fontWeight', () => {
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontWeight', value: 'bold' },
      });
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontStyle', value: 'italic' },
      });
      expect(sm.getCards()[0].sectionStyles.title).toEqual({ fontWeight: 'bold', fontStyle: 'italic' });
    });
    it('passing undefined removes the property', () => {
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontWeight', value: 'bold' },
      });
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontWeight', value: undefined },
      });
      expect(sm.getCards()[0].sectionStyles.title?.fontWeight).toBeUndefined();
    });
    it('sets textDecoration with combined values', () => {
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'textDecoration', value: 'underline line-through' },
      });
      expect(sm.getCards()[0].sectionStyles.title?.textDecoration).toBe('underline line-through');
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 999, field: 'title', property: 'fontWeight', value: 'bold' },
      });
      expect(sm.get()).toBe(before);
    });
  });

  describe('SET_SECTION_FONT_SIZE', () => {
    it('sets fontSize on a section style, preserving other properties', () => {
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontWeight', value: 'bold' },
      });
      sm.dispatch({ type: 'SET_SECTION_FONT_SIZE', payload: { idx: 0, field: 'title', size: 32 } });
      expect(sm.getCards()[0].sectionStyles.title).toEqual({ fontWeight: 'bold', fontSize: 32 });
    });
    it('creates the section style entry if it does not exist', () => {
      sm.dispatch({ type: 'SET_SECTION_FONT_SIZE', payload: { idx: 0, field: 'subtitle', size: 18 } });
      expect(sm.getCards()[0].sectionStyles.subtitle).toEqual({ fontSize: 18 });
    });
    it('overwrites the previous fontSize', () => {
      sm.dispatch({ type: 'SET_SECTION_FONT_SIZE', payload: { idx: 0, field: 'title', size: 24 } });
      sm.dispatch({ type: 'SET_SECTION_FONT_SIZE', payload: { idx: 0, field: 'title', size: 36 } });
      expect(sm.getCards()[0].sectionStyles.title?.fontSize).toBe(36);
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      sm.dispatch({ type: 'SET_SECTION_FONT_SIZE', payload: { idx: 999, field: 'title', size: 24 } });
      expect(sm.get()).toBe(before);
    });
  });

  describe('RESET_CARD_STYLES', () => {
    it('clears both colors and sectionStyles atomically', () => {
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#ff0000' } });
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontWeight', value: 'bold' },
      });
      sm.dispatch({ type: 'SET_SECTION_FONT_SIZE', payload: { idx: 0, field: 'title', size: 32 } });
      expect(sm.getCards()[0].colors.title).toBe('#ff0000');
      expect(sm.getCards()[0].sectionStyles.title).toBeDefined();
      sm.dispatch({ type: 'RESET_CARD_STYLES', payload: { idx: 0 } });
      expect(sm.getCards()[0].colors).toEqual({});
      expect(sm.getCards()[0].sectionStyles).toEqual({});
    });
    it('preserves wordStyles and text fields', () => {
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 0, field: 'title', value: 'keep me' } });
      sm.dispatch({
        type: 'SET_CARD_WORD_STYLES',
        payload: { idx: 0, wordStyles: { 'title::keep': { fontWeight: 'bold' } } },
      });
      sm.dispatch({ type: 'RESET_CARD_STYLES', payload: { idx: 0 } });
      expect(sm.getCards()[0].title).toBe('keep me');
      expect(sm.getCards()[0].wordStyles).toEqual({ 'title::keep': { fontWeight: 'bold' } });
    });
    it('does nothing for out-of-range index', () => {
      const before = sm.get();
      sm.dispatch({ type: 'RESET_CARD_STYLES', payload: { idx: 999 } });
      expect(sm.get()).toBe(before);
    });
  });

  // ─── RESTORE_SNAPSHOT ───────────────────────────────────────
  describe('RESTORE_SNAPSHOT', () => {
    it('restores cards, theme, and format from a snapshot', () => {
      // Set up a different state first
      sm.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: 'ocean' } });
      sm.dispatch({ type: 'SET_FORMAT', payload: { format: 'telegram' } });
      sm.dispatch({ type: 'ADD_CARD' });
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 0, field: 'title', value: 'modified' } });

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
      sm.dispatch({ type: 'RESTORE_SNAPSHOT', payload: { snapshot: snap } });
      expect(sm.getCardCount()).toBe(1);
      expect(sm.getCards()[0].id).toBe('restored-1');
      expect(sm.getCards()[0].title).toBe('Restored');
      expect(sm.getTheme()).toBe('forest');
      expect(sm.getFormat()).toBe('whatsapp');
    });
    it('does NOT touch other settings (gradientAngle preserved)', () => {
      sm.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: { angle: 45 } });
      sm.dispatch({
        type: 'RESTORE_SNAPSHOT',
        payload: { snapshot: { cards: sm.getCards(), theme: 'forest', format: 'telegram' } },
      });
      expect(sm.getGradientAngle()).toBe(45);
    });
    it('snapshot() round-trips through RESTORE_SNAPSHOT', () => {
      sm.dispatch({ type: 'ADD_CARD' });
      sm.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: 'ocean' } });
      const snap = sm.snapshot();
      // Mutate state further
      sm.dispatch({ type: 'CLEAR_ALL' });
      sm.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: 'default' } });
      // Restore
      sm.dispatch({ type: 'RESTORE_SNAPSHOT', payload: { snapshot: snap } });
      expect(sm.getCardCount()).toBe(2);
      expect(sm.getTheme()).toBe('ocean');
    });
  });

  // ─── SET_UI (P1-3) ──────────────────────────────────────────
  describe('SET_UI', () => {
    it('updates a single UI field, preserving others', () => {
      sm.dispatch({ type: 'SET_UI', payload: { colorModalOpen: true } });
      expect(sm.getUI().colorModalOpen).toBe(true);
      expect(sm.getUI().wordPopupOpen).toBe(false); // unchanged
    });
    it('updates multiple UI fields at once', () => {
      sm.dispatch({
        type: 'SET_UI',
        payload: { activeCardIndexForColors: 2, lastActiveField: 'text', colorModalOpen: true },
      });
      const ui = sm.getUI();
      expect(ui.activeCardIndexForColors).toBe(2);
      expect(ui.lastActiveField).toBe('text');
      expect(ui.colorModalOpen).toBe(true);
    });
    it('can clear nullable fields back to null', () => {
      sm.dispatch({ type: 'SET_UI', payload: { activeCardIndexForColors: 1 } });
      expect(sm.getUI().activeCardIndexForColors).toBe(1);
      sm.dispatch({ type: 'SET_UI', payload: { activeCardIndexForColors: null } });
      expect(sm.getUI().activeCardIndexForColors).toBeNull();
    });
    it('setUI() convenience method works the same as dispatch', () => {
      sm.setUI({ sidebarOpen: true, confirmDialogOpen: true });
      expect(sm.getUI().sidebarOpen).toBe(true);
      expect(sm.getUI().confirmDialogOpen).toBe(true);
    });
    it('returns a new state reference (triggers subscribers)', () => {
      const cb = vi.fn();
      sm.subscribe(cb);
      sm.dispatch({ type: 'SET_UI', payload: { colorModalOpen: true } });
      expect(cb).toHaveBeenCalledTimes(1);
    });
    it('preserves cards and settings references (only ui changes)', () => {
      const beforeCards = sm.getCards();
      const beforeSettings = sm.getSettings();
      sm.dispatch({ type: 'SET_UI', payload: { colorModalOpen: true } });
      expect(sm.getCards()).toBe(beforeCards); // same ref
      expect(sm.getSettings()).toBe(beforeSettings); // same ref
    });
  });

  // ─── Immutability ───────────────────────────────────────────
  describe('immutability', () => {
    it('dispatching ADD_CARD returns a NEW state object (not the same reference)', () => {
      const before = sm.get();
      sm.dispatch({ type: 'ADD_CARD' });
      const after = sm.get();
      expect(after).not.toBe(before);
    });
    it('dispatching SET_GLOBAL_THEME returns a NEW state object', () => {
      const before = sm.get();
      sm.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: 'ocean' } });
      expect(sm.get()).not.toBe(before);
    });
    it('a no-op dispatch (e.g. invalid delete) returns the SAME reference (no notification fired)', () => {
      const before = sm.get();
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: 999 } });
      expect(sm.get()).toBe(before);
    });
    it('the cards array reference changes when ADD_CARD fires (not mutated in place)', () => {
      const beforeCards = sm.getCards();
      sm.dispatch({ type: 'ADD_CARD' });
      expect(sm.getCards()).not.toBe(beforeCards);
    });
    it('an individual card object reference changes when its field is updated', () => {
      const cardBefore = sm.getCards()[0];
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 0, field: 'title', value: 'X' } });
      expect(sm.getCards()[0]).not.toBe(cardBefore);
    });
    it('SET_CARD_COLOR_FIELD produces a new card reference (not in-place mutation)', () => {
      const cardBefore = sm.getCards()[0];
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#fff' } });
      expect(sm.getCards()[0]).not.toBe(cardBefore);
    });
    it('SET_SECTION_STYLE_FIELD produces a new card reference (not in-place mutation)', () => {
      const cardBefore = sm.getCards()[0];
      sm.dispatch({
        type: 'SET_SECTION_STYLE_FIELD',
        payload: { idx: 0, field: 'title', property: 'fontWeight', value: 'bold' },
      });
      expect(sm.getCards()[0]).not.toBe(cardBefore);
    });
    it('RESET_CARD_STYLES produces a new card reference (not in-place mutation)', () => {
      sm.dispatch({ type: 'SET_CARD_COLOR_FIELD', payload: { idx: 0, field: 'title', value: '#fff' } });
      const cardBefore = sm.getCards()[0];
      sm.dispatch({ type: 'RESET_CARD_STYLES', payload: { idx: 0 } });
      expect(sm.getCards()[0]).not.toBe(cardBefore);
    });
  });

  // ─── Subscriptions ──────────────────────────────────────────
  describe('subscribe / unsubscribe', () => {
    it('subscribe(cb) is called when an action changes state', () => {
      const cb = vi.fn();
      sm.subscribe(cb);
      sm.dispatch({ type: 'ADD_CARD' });
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(sm.get());
    });
    it('subscribe(cb) is NOT called when an action is a no-op', () => {
      const cb = vi.fn();
      sm.subscribe(cb);
      sm.dispatch({ type: 'DELETE_CARD', payload: { idx: 999 } }); // no-op
      expect(cb).not.toHaveBeenCalled();
    });
    it('unsubscribe(cb) stops further notifications', () => {
      const cb = vi.fn();
      const unsub = sm.subscribe(cb);
      sm.dispatch({ type: 'ADD_CARD' });
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
      sm.dispatch({ type: 'ADD_CARD' });
      expect(cb).toHaveBeenCalledTimes(1); // not called again
    });
    it('multiple subscribers are all called', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      sm.subscribe(cb1);
      sm.subscribe(cb2);
      sm.dispatch({ type: 'ADD_CARD' });
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
      sm.dispatch({ type: 'UPDATE_CARD_FIELD', payload: { idx: 0, field: 'title', value: 'orig' } });
      const snap = sm.snapshot();
      snap.cards[0].title = 'mutated';
      expect(sm.getCards()[0].title).toBe('orig');
    });
    it('contains cards, theme, and format', () => {
      sm.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: 'ocean' } });
      sm.dispatch({ type: 'SET_FORMAT', payload: { format: 'telegram' } });
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
