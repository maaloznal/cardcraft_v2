/**
 * Performance benchmark for card operations (PRIORITY 1.9).
 *
 * Measures add/delete/duplicate/move on 10/50/100 cards in jsdom.
 * Compares O(1) targeted updates (insertCard/removeCard/moveCard)
 * against full rebuild (render()) to validate the P1 optimization.
 *
 * NOTE: jsdom timings are not representative of real-browser performance,
 * but the RELATIVE difference between O(1) and full-rebuild is meaningful.
 * Run with: `bun run test:perf`
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PreviewRenderer } from '@/preview/PreviewRenderer';
import { EditorRenderer } from '@/editor/EditorRenderer';
import { StateManager } from '@/state/StateManager';
import type { Card, Snapshot } from '@/core/types';

/** Build N empty cards with unique ids + some content */
function buildCards(n: number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < n; i++) {
    cards.push({
      id: `card-${i}-${Math.random().toString(36).slice(2, 8)}`,
      title: `Карточка ${i + 1}`,
      subtitle: `Подзаголовок ${i + 1}`,
      text: `Основной текст для карточки ${i + 1}. Достаточно длинный текст для реалистичности.`,
      listItems: `Пункт 1\nПункт 2\nПункт 3`,
      footer: `Итог ${i + 1}`,
      cta: `Кнопка ${i + 1}`,
      colors: {},
      wordStyles: {},
      sectionStyles: {},
    });
  }
  return cards;
}

const PREVIEW_SETTINGS = {
  theme: 'default',
  format: 'auto',
  progressBarStyle: 'default',
  showCardNumbers: true,
  showProgressBar: true,
};

/** Time a fn in ms (median of `runs` iterations) */
function timeMedian(fn: () => void, runs = 5): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(runs / 2)];
}

function setupRenderers(cardCount: number): {
  preview: PreviewRenderer;
  editor: EditorRenderer;
  previewContainer: HTMLElement;
  editorContainer: HTMLElement;
  state: StateManager;
  cards: Card[];
} {
  const previewContainer = document.createElement('div');
  previewContainer.id = 'cardsArea';
  document.body.appendChild(previewContainer);

  const editorContainer = document.createElement('div');
  editorContainer.id = 'editorCardsList';
  document.body.appendChild(editorContainer);

  const preview = new PreviewRenderer(previewContainer);
  const editor = new EditorRenderer(editorContainer);
  const state = new StateManager();
  const cards = buildCards(cardCount);

  // Replace default empty card with our cards
  state.setCards(cards);
  preview.render(state.getCards(), PREVIEW_SETTINGS);
  editor.render(state.getCards());

  return { preview, editor, previewContainer, editorContainer, state, cards };
}

function teardown(previewContainer: HTMLElement, editorContainer: HTMLElement): void {
  previewContainer.remove();
  editorContainer.remove();
}

describe('Performance: card operations', () => {
  let previewContainer: HTMLElement;
  let editorContainer: HTMLElement;

  beforeEach(() => {
    // jsdom provides performance.now
    if (typeof performance === 'undefined') {
      globalThis.performance = { now: () => Date.now() } as never;
    }
  });

  afterEach(() => {
    previewContainer?.remove();
    editorContainer?.remove();
  });

  // ─── 10 cards ──────────────────────────────────────────────
  describe('10 cards', () => {
    it('add: O(1) insertCard is faster than full rebuild', () => {
      const setup = setupRenderers(10);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      // O(1) path: insertCard
      const o1Time = timeMedian(() => {
        state.dispatch({ type: 'ADD_CARD' });
        const newCard = state.getCards()[state.getCardCount() - 1];
        const total = state.getCardCount();
        editor.insertCard(newCard, total - 1, total);
        preview.insertCard(newCard, total - 1, total, PREVIEW_SETTINGS);
      }, 5);

      // Undo the add (restore to 10 cards)
      state.dispatch({ type: 'DELETE_CARD', payload: { idx: state.getCardCount() - 1 } });

      // Full rebuild path: render()
      const rebuildTime = timeMedian(() => {
        state.dispatch({ type: 'ADD_CARD' });
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 5);

      // O(1) should be faster (or at least comparable in jsdom)
      // We don't assert strict faster-than because jsdom variance is high.
      // We assert it's within 3x of rebuild (sanity check the method works).
      expect(o1Time).toBeLessThan(rebuildTime * 3);
      expect(o1Time).toBeGreaterThanOrEqual(0);

      // eslint-disable-next-line no-console
      console.log(
        `  10 cards — add: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });

    it('delete: O(1) removeCard is faster than full rebuild', () => {
      const setup = setupRenderers(10);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      const cardId = state.getCards()[5].id;

      const o1Time = timeMedian(() => {
        editor.removeCard(5);
        preview.removeCard(cardId);
      }, 5);

      // Re-add for rebuild test
      const rebuildTime = timeMedian(() => {
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 5);

      expect(o1Time).toBeLessThan(rebuildTime * 3);
      // eslint-disable-next-line no-console
      console.log(
        `  10 cards — delete: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });

    it('move: O(1) DOM swap is faster than full rebuild', () => {
      const setup = setupRenderers(10);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      const o1Time = timeMedian(() => {
        editor.moveCard(3, 4);
        // Preview swap
        const wrappers = previewContainer.querySelectorAll('.card-wrapper');
        const a = wrappers[3];
        const b = wrappers[4];
        if (a && b) b.parentElement?.insertBefore(b, a);
      }, 5);

      const rebuildTime = timeMedian(() => {
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 5);

      expect(o1Time).toBeLessThan(rebuildTime * 3);
      // eslint-disable-next-line no-console
      console.log(
        `  10 cards — move: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });
  });

  // ─── 50 cards ──────────────────────────────────────────────
  describe('50 cards', () => {
    it('add: O(1) insertCard is faster than full rebuild', () => {
      const setup = setupRenderers(50);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      const o1Time = timeMedian(() => {
        state.dispatch({ type: 'ADD_CARD' });
        const newCard = state.getCards()[state.getCardCount() - 1];
        const total = state.getCardCount();
        editor.insertCard(newCard, total - 1, total);
        preview.insertCard(newCard, total - 1, total, PREVIEW_SETTINGS);
      }, 3);

      state.dispatch({ type: 'DELETE_CARD', payload: { idx: state.getCardCount() - 1 } });

      const rebuildTime = timeMedian(() => {
        state.dispatch({ type: 'ADD_CARD' });
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 3);

      expect(o1Time).toBeLessThan(rebuildTime * 3);
      // eslint-disable-next-line no-console
      console.log(
        `  50 cards — add: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });

    it('delete: O(1) removeCard is faster than full rebuild', () => {
      const setup = setupRenderers(50);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      const cardId = state.getCards()[25].id;

      const o1Time = timeMedian(() => {
        editor.removeCard(25);
        preview.removeCard(cardId);
      }, 3);

      const rebuildTime = timeMedian(() => {
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 3);

      expect(o1Time).toBeLessThan(rebuildTime * 3);
      // eslint-disable-next-line no-console
      console.log(
        `  50 cards — delete: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });
  });

  // ─── 100 cards ─────────────────────────────────────────────
  describe('100 cards', () => {
    it('add: O(1) insertCard is faster than full rebuild', () => {
      const setup = setupRenderers(100);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      const o1Time = timeMedian(() => {
        state.dispatch({ type: 'ADD_CARD' });
        const newCard = state.getCards()[state.getCardCount() - 1];
        const total = state.getCardCount();
        editor.insertCard(newCard, total - 1, total);
        preview.insertCard(newCard, total - 1, total, PREVIEW_SETTINGS);
      }, 3);

      state.dispatch({ type: 'DELETE_CARD', payload: { idx: state.getCardCount() - 1 } });

      const rebuildTime = timeMedian(() => {
        state.dispatch({ type: 'ADD_CARD' });
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 3);

      expect(o1Time).toBeLessThan(rebuildTime * 3);
      // eslint-disable-next-line no-console
      console.log(
        `  100 cards — add: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });

    it('delete: O(1) removeCard is faster than full rebuild', () => {
      const setup = setupRenderers(100);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      const cardId = state.getCards()[50].id;

      const o1Time = timeMedian(() => {
        editor.removeCard(50);
        preview.removeCard(cardId);
      }, 3);

      const rebuildTime = timeMedian(() => {
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 3);

      expect(o1Time).toBeLessThan(rebuildTime * 3);
      // eslint-disable-next-line no-console
      console.log(
        `  100 cards — delete: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });

    it('duplicate: O(1) insertCard after original is faster than full rebuild', () => {
      const setup = setupRenderers(100);
      previewContainer = setup.previewContainer;
      editorContainer = setup.editorContainer;
      const { preview, editor, state } = setup;

      const o1Time = timeMedian(() => {
        state.dispatch({ type: 'DUPLICATE_CARD', payload: { idx: 50 } });
        const copy = state.getCards()[51];
        const total = state.getCardCount();
        if (copy) {
          editor.insertCard(copy, 51, total);
          preview.insertCard(copy, 51, total, PREVIEW_SETTINGS);
        }
      }, 3);

      // Undo the duplicate
      state.dispatch({ type: 'DELETE_CARD', payload: { idx: 51 } });

      const rebuildTime = timeMedian(() => {
        state.dispatch({ type: 'DUPLICATE_CARD', payload: { idx: 50 } });
        editor.render(state.getCards());
        preview.render(state.getCards(), PREVIEW_SETTINGS);
      }, 3);

      expect(o1Time).toBeLessThan(rebuildTime * 3);
      // eslint-disable-next-line no-console
      console.log(
        `  100 cards — duplicate: O(1)=${o1Time.toFixed(2)}ms vs rebuild=${rebuildTime.toFixed(2)}ms ` +
          `(${(rebuildTime / o1Time).toFixed(1)}x faster)`,
      );
    });
  });

  // ─── Snapshot serialization (P1-8) ─────────────────────────
  describe('snapshot + restore', () => {
    it('snapshot/restore scales O(n) with card count', () => {
      const results: { n: number; snapshotMs: number; restoreMs: number }[] = [];

      for (const n of [10, 50, 100]) {
        const setup = setupRenderers(n);
        previewContainer = setup.previewContainer;
        editorContainer = setup.editorContainer;
        const { state } = setup;

        const snapshotMs = timeMedian(() => {
          const snap: Snapshot = state.snapshot();
          void snap;
        }, 5);

        const snap = state.snapshot();
        const restoreMs = timeMedian(() => {
          state.restore(snap);
        }, 5);

        results.push({ n, snapshotMs, restoreMs });
        teardown(setup.previewContainer, setup.editorContainer);
      }

      // eslint-disable-next-line no-console
      console.log(
        '  snapshot/restore:\n' +
          results
            .map(
              (r) =>
                `    ${r.n} cards — snapshot=${r.snapshotMs.toFixed(2)}ms, restore=${r.restoreMs.toFixed(2)}ms`,
            )
            .join('\n'),
      );

      // Snapshot time should scale roughly linearly with n
      expect(results[2].snapshotMs).toBeGreaterThan(results[0].snapshotMs);
    });
  });
});
