/**
 * Unit tests for src/history/HistoryManager.ts
 *
 * Covers: push, undo, redo, canUndo/canRedo, init, schedulePush (debounce),
 * the MAX_HISTORY boundary (50), clear(), and the race-condition fix
 * where undo/redo must cancel any pending debounced push.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryManager } from '@/history/HistoryManager';
import { CONFIG } from '@/core/constants';

type Snap = { label: string };

const snap = (label: string): Snap => ({ label });

describe('HistoryManager', () => {
  let h: HistoryManager<Snap>;

  beforeEach(() => {
    h = new HistoryManager<Snap>();
  });

  // ─── init ───────────────────────────────────────────────────
  describe('init', () => {
    it('initializes with one entry and no undo/redo', () => {
      h.init(snap('initial'));
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
    });
    it('undo returns null immediately after init', () => {
      h.init(snap('initial'));
      expect(h.undo()).toBeNull();
    });
    it('redo returns null immediately after init', () => {
      h.init(snap('initial'));
      expect(h.redo()).toBeNull();
    });
    it('init replaces previous history when called twice', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.init(snap('fresh'));
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
    });
  });

  // ─── push / undo / redo basics ──────────────────────────────
  describe('push', () => {
    it('makes canUndo true after the first push post-init', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      expect(h.canUndo).toBe(true);
      expect(h.canRedo).toBe(false);
    });
    it('push without init also works (creates first entry)', () => {
      h.push(snap('a'));
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
      h.push(snap('b'));
      expect(h.canUndo).toBe(true);
    });
    it('push truncates any redo tail (cannot redo after a new push)', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.push(snap('c'));
      // Undo back to b, then push a new snapshot — redo path should be discarded
      expect(h.undo()).toEqual(snap('b'));
      expect(h.canRedo).toBe(true);
      h.push(snap('d'));
      expect(h.canRedo).toBe(false);
      // Redoing now should not return the old 'c'
      expect(h.redo()).toBeNull();
    });
    it('push returns a deep-clone (mutating returned snapshot is safe)', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      const got = h.undo();
      expect(got).not.toBeNull();
      got!.label = 'mutated';
      // Re-undo/redo should not see the mutation
      // (we are at index 0 after undo; redo returns index 1, which is 'b')
      expect(h.redo()).toEqual(snap('b'));
    });
  });

  describe('undo', () => {
    it('returns the previous snapshot', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      expect(h.undo()).toEqual(snap('a'));
    });
    it('returns null at the bottom of the stack', () => {
      h.init(snap('a'));
      expect(h.undo()).toBeNull();
    });
    it('after undo, canRedo becomes true', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.undo();
      expect(h.canRedo).toBe(true);
    });
    it('undo twice traverses two entries', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.push(snap('c'));
      expect(h.undo()).toEqual(snap('b'));
      expect(h.undo()).toEqual(snap('a'));
      expect(h.undo()).toBeNull();
    });
  });

  describe('redo', () => {
    it('returns the next snapshot after undo', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.undo();
      expect(h.redo()).toEqual(snap('b'));
    });
    it('returns null at the top of the stack', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      expect(h.redo()).toBeNull();
    });
    it('redo twice traverses two entries', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.push(snap('c'));
      h.undo();
      h.undo();
      expect(h.redo()).toEqual(snap('b'));
      expect(h.redo()).toEqual(snap('c'));
      expect(h.redo()).toBeNull();
    });
  });

  describe('canUndo / canRedo', () => {
    it('both false after init', () => {
      h.init(snap('a'));
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
    });
    it('canUndo true, canRedo false after one push', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      expect(h.canUndo).toBe(true);
      expect(h.canRedo).toBe(false);
    });
    it('canUndo false, canRedo true after undo to bottom', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.undo();
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(true);
    });
  });

  // ─── schedulePush (debounce) ────────────────────────────────
  describe('schedulePush', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rapid schedulePush calls merge into one push (debounce)', () => {
      h.init(snap('a'));
      h.schedulePush(snap('b1'));
      h.schedulePush(snap('b2'));
      h.schedulePush(snap('b3'));
      // Before the debounce window elapses, no push has happened
      expect(h.canUndo).toBe(false);
      vi.advanceTimersByTime(CONFIG.HISTORY_DEBOUNCE_MS);
      // Only the last scheduled snapshot was pushed
      expect(h.canUndo).toBe(true);
      expect(h.undo()).toEqual(snap('a'));
      // The snapshot pushed was the latest one (b3)
      expect(h.redo()).toEqual(snap('b3'));
    });

    it('does not push if a push() happens first (immediate push cancels pending timer)', () => {
      h.init(snap('a'));
      h.schedulePush(snap('scheduled'));
      // An immediate push supersedes the scheduled one
      h.push(snap('immediate'));
      expect(h.canUndo).toBe(true);
      // Advance timers — no scheduled push should fire
      vi.advanceTimersByTime(CONFIG.HISTORY_DEBOUNCE_MS * 2);
      // The redo stack should not have the scheduled snapshot
      expect(h.redo()).toBeNull();
    });

    it('uses a custom delay when provided', () => {
      h.init(snap('a'));
      h.schedulePush(snap('b'), 5000);
      vi.advanceTimersByTime(CONFIG.HISTORY_DEBOUNCE_MS);
      expect(h.canUndo).toBe(false);
      vi.advanceTimersByTime(5000 - CONFIG.HISTORY_DEBOUNCE_MS);
      expect(h.canUndo).toBe(true);
    });
  });

  // ─── MAX_HISTORY boundary (the critical fixed bug) ──────────
  describe('MAX_HISTORY boundary (default 50)', () => {
    it('CONFIG.MAX_HISTORY is 50', () => {
      expect(CONFIG.MAX_HISTORY).toBe(50);
    });

    it('history.length never exceeds 50 after 60 pushes', () => {
      h.init(snap('seed'));
      for (let i = 0; i < 60; i++) {
        h.push(snap(`p${i}`));
      }
      // Access private field for boundary verification
      const internal = (h as unknown as { history: Snap[]; histIndex: number });
      expect(internal.history.length).toBeLessThanOrEqual(50);
      expect(internal.history.length).toBe(50);
    });

    it('canRedo is false after 60 pushes (no corruption)', () => {
      h.init(snap('seed'));
      for (let i = 0; i < 60; i++) {
        h.push(snap(`p${i}`));
      }
      expect(h.canRedo).toBe(false);
    });

    it('canUndo is true after 60 pushes', () => {
      h.init(snap('seed'));
      for (let i = 0; i < 60; i++) {
        h.push(snap(`p${i}`));
      }
      expect(h.canUndo).toBe(true);
    });

    it('undo() still works after 60 pushes (returns the most recent snapshot)', () => {
      h.init(snap('seed'));
      for (let i = 0; i < 60; i++) {
        h.push(snap(`p${i}`));
      }
      // The most recent push was p59
      expect(h.undo()).toEqual(snap('p58'));
      expect(h.canRedo).toBe(true);
    });

    it('histIndex stays within valid bounds [0, history.length-1] after 60 pushes', () => {
      h.init(snap('seed'));
      for (let i = 0; i < 60; i++) {
        h.push(snap(`p${i}`));
      }
      const internal = (h as unknown as { history: Snap[]; histIndex: number });
      expect(internal.histIndex).toBeGreaterThanOrEqual(0);
      expect(internal.histIndex).toBeLessThan(internal.history.length);
    });

    it('after 60 pushes, undoing down to the oldest entry never throws and stops at the boundary', () => {
      h.init(snap('seed'));
      for (let i = 0; i < 60; i++) {
        h.push(snap(`p${i}`));
      }
      // Undo until we hit the bottom. After 60 pushes (max=50), the oldest
      // entry remaining is the (60-50+1)=11th-pushed snapshot, i.e. 'p10'
      // ('seed' through 'p9' were shifted out as the history rolled over).
      let last: Snap | null = null;
      let guard = 0;
      while (h.canUndo && guard < 1000) {
        last = h.undo();
        guard++;
      }
      expect(guard).toBeLessThan(1000); // did not spin out
      expect(last).not.toBeNull();
      // Oldest surviving snapshot is 'p10' (the 11th push, since seed was the 0th)
      expect(last).toEqual(snap('p10'));
      // Further undo returns null (boundary respected)
      expect(h.undo()).toBeNull();
      expect(h.canUndo).toBe(false);
    });

    it('works correctly with a custom maxHistory (e.g. 5)', () => {
      const small = new HistoryManager<Snap>(5);
      small.init(snap('s'));
      for (let i = 0; i < 20; i++) small.push(snap(`p${i}`));
      const internal = (small as unknown as { history: Snap[]; histIndex: number });
      expect(internal.history.length).toBeLessThanOrEqual(5);
      expect(internal.histIndex).toBeLessThan(internal.history.length);
      expect(small.canRedo).toBe(false);
    });
  });

  // ─── clear ──────────────────────────────────────────────────
  describe('clear', () => {
    it('empties the stack and resets canUndo/canRedo', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.push(snap('c'));
      h.clear();
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
      expect(h.undo()).toBeNull();
      expect(h.redo()).toBeNull();
    });
    it('after clear, push works as if starting fresh', () => {
      h.init(snap('a'));
      h.push(snap('b'));
      h.clear();
      h.push(snap('fresh'));
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
    });
  });

  // ─── Race condition: undo/redo cancels pending schedulePush ─
  describe('race condition — undo/redo cancels pending schedulePush', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('undo cancels pending schedulePush (no corruption of redo stack)', () => {
      // Setup: history = [a, b], histIndex = 1 (current = b)
      h.init(snap('a'));
      h.push(snap('b'));
      expect(h.canUndo).toBe(true);

      // User schedules a debounced push of a NEW snapshot (e.g. after typing)
      h.schedulePush(snap('c'));
      // User hits undo BEFORE the debounce fires.
      // The pre-undo state (b) should NOT be re-pushed onto the stack
      // (otherwise redo would be corrupted).
      expect(h.undo()).toEqual(snap('a'));

      // Advance past the debounce window — the scheduled push must NOT fire.
      vi.advanceTimersByTime(CONFIG.HISTORY_DEBOUNCE_MS * 2);

      // We should still be at index 0, and redo should land on b (not c or b-twice).
      expect(h.canRedo).toBe(true);
      expect(h.redo()).toEqual(snap('b'));
      expect(h.canRedo).toBe(false);
    });

    it('redo cancels pending schedulePush', () => {
      // Setup: history = [a, b, c], histIndex = 1 (current = b)
      h.init(snap('a'));
      h.push(snap('b'));
      h.push(snap('c'));
      h.undo(); // → histIndex 1 (b)
      expect(h.canRedo).toBe(true);

      // User schedules a debounced push of a new snapshot
      h.schedulePush(snap('d'));
      // User hits redo BEFORE the debounce fires.
      expect(h.redo()).toEqual(snap('c'));

      // Advance past the debounce window — the scheduled push must NOT fire.
      vi.advanceTimersByTime(CONFIG.HISTORY_DEBOUNCE_MS * 2);

      // We should be at index 2 (c), and redo should be unavailable.
      expect(h.canRedo).toBe(false);
      // Undo should land on b, not on d.
      expect(h.undo()).toEqual(snap('b'));
    });

    it('push cancels pending schedulePush', () => {
      h.init(snap('a'));
      h.schedulePush(snap('scheduled'));
      // Immediate push supersedes the scheduled one
      h.push(snap('immediate'));
      // Advance — scheduled push must NOT fire
      vi.advanceTimersByTime(CONFIG.HISTORY_DEBOUNCE_MS * 2);
      // Only the immediate push landed; redo is empty.
      expect(h.redo()).toBeNull();
      expect(h.undo()).toEqual(snap('a'));
      expect(h.redo()).toEqual(snap('immediate'));
    });

    it('clear cancels pending schedulePush', () => {
      h.init(snap('a'));
      h.schedulePush(snap('b'));
      h.clear();
      // Advance — scheduled push must NOT fire
      vi.advanceTimersByTime(CONFIG.HISTORY_DEBOUNCE_MS * 2);
      expect(h.canUndo).toBe(false);
      expect(h.canRedo).toBe(false);
    });
  });
});
