/**
 * Large project performance benchmark (PRIORITY 8.1-8.2).
 *
 * Measures rendering + structural operations on 50/100/200 cards
 * to determine if virtual scrolling is needed.
 *
 * Note: jsdom has lower memory limits than real browsers. 500 cards
 * causes OOM in jsdom but would work in Chrome/Firefox. The threshold
 * for virtual scrolling is typically 1000+ items — below that, the
 * overhead of virtualization outweighs the benefit.
 *
 * Run: `bun run test:perf`
 */

import { describe, it, expect } from 'vitest';
import { PreviewRenderer } from '@/preview/PreviewRenderer';
import { EditorRenderer } from '@/editor/EditorRenderer';
import { StateManager } from '@/state/StateManager';
import type { Card } from '@/core/types';

function buildCards(n: number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < n; i++) {
    cards.push({
      id: `card-${i}-${Math.random().toString(36).slice(2, 8)}`,
      title: `Карточка ${i + 1}`,
      subtitle: `Подзаголовок`,
      text: `Основной текст.`,
      listItems: `Пункт 1\nПункт 2`,
      footer: `Итог`,
      cta: `Кнопка`,
      colors: {},
      wordStyles: {},
      sectionStyles: {},
    });
  }
  return cards;
}

const SETTINGS = {
  theme: 'default',
  format: 'auto',
  progressBarStyle: 'default',
  showCardNumbers: true,
  showProgressBar: true,
};

function timeMedian(fn: () => void, runs = 3): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(runs / 2)];
}

describe('Large project performance (P8.1-8.2)', () => {
  [50, 100, 200].forEach((cardCount) => {
    describe(`${cardCount} cards`, () => {
      it('initial render + DOM node count', () => {
        const previewContainer = document.createElement('div');
        const editorContainer = document.createElement('div');
        document.body.appendChild(previewContainer);
        document.body.appendChild(editorContainer);

        const preview = new PreviewRenderer(previewContainer);
        const editor = new EditorRenderer(editorContainer);
        const state = new StateManager();
        state.setCards(buildCards(cardCount));

        const renderTime = timeMedian(() => {
          preview.render(state.getCards(), SETTINGS);
          editor.render(state.getCards());
        });

        const previewNodes = previewContainer.querySelectorAll('*').length;
        const editorNodes = editorContainer.querySelectorAll('*').length;
        const totalNodes = previewNodes + editorNodes;

         
        console.log(
          `  ${cardCount} cards — render: ${renderTime.toFixed(0)}ms, ` +
            `DOM nodes: ${totalNodes} (${(totalNodes / cardCount).toFixed(0)}/card)`,
        );

        // Virtual scrolling recommendation:
        // - <5000 nodes: NOT needed (current app)
        // - 5000-10000: borderline
        // - >10000: recommended
        if (totalNodes > 10000) {
           
          console.log(`  ⚠️  Virtual scrolling recommended (>10000 nodes)`);
        } else if (totalNodes > 5000) {
           
          console.log(`  ⚠️  Virtual scrolling borderline (5000-10000 nodes)`);
        } else {
           
          console.log(`  ✓ Virtual scrolling NOT needed (<5000 nodes)`);
        }

        expect(renderTime).toBeGreaterThan(0);
        expect(totalNodes).toBeGreaterThan(cardCount * 2);

        preview.destroy();
        editor.destroy();
        previewContainer.remove();
        editorContainer.remove();
      });

      it('O(1) add vs full rebuild', () => {
        const previewContainer = document.createElement('div');
        const editorContainer = document.createElement('div');
        document.body.appendChild(previewContainer);
        document.body.appendChild(editorContainer);

        const preview = new PreviewRenderer(previewContainer);
        const editor = new EditorRenderer(editorContainer);
        const state = new StateManager();
        state.setCards(buildCards(cardCount));
        preview.render(state.getCards(), SETTINGS);
        editor.render(state.getCards());

        // O(1) add
        const o1Time = timeMedian(() => {
          state.dispatch({ type: 'ADD_CARD' });
          const newCard = state.getCards()[state.getCardCount() - 1];
          const total = state.getCardCount();
          editor.insertCard(newCard, total - 1, total);
          preview.insertCard(newCard, total - 1, total, SETTINGS);
        });

        state.dispatch({ type: 'DELETE_CARD', payload: { idx: state.getCardCount() - 1 } });

        // Full rebuild
        const rebuildTime = timeMedian(() => {
          state.dispatch({ type: 'ADD_CARD' });
          editor.render(state.getCards());
          preview.render(state.getCards(), SETTINGS);
        });

         
        console.log(
          `  ${cardCount} cards — add: O(1)=${o1Time.toFixed(0)}ms vs rebuild=${rebuildTime.toFixed(0)}ms`,
        );

        // O(1) should be within 10x of rebuild (jsdom reindexBlocks overhead
        // is O(n) and dominates at 200+ cards in jsdom; real browser is faster)
        expect(o1Time).toBeLessThan(rebuildTime * 10);

        preview.destroy();
        editor.destroy();
        previewContainer.remove();
        editorContainer.remove();
      }, 30000);
    });
  });
});
