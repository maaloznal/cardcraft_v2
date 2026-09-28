'use client';

/**
 * WelcomeCarousel — accessible scroll-snap card carousel for the hero.
 *
 * Design decisions (per approved architecture):
 *   - Native CSS scroll-snap (no JS transform-based slide track)
 *   - NO transform: rotate(), NO perspective, NO decorative stacked cards
 *   - Cards sit flat with a stable aspect ratio
 *   - A peek of the next card (~10–15% width) is visible to signal swipeability
 *   - Prev/Next arrow buttons (desktop, ≥44px targets, disabled at bounds)
 *   - Pagination dots (clickable, labelled, roving tabindex)
 *   - Keyboard: ← → on the carousel region
 *   - Touch + mouse wheel via native scroll
 *   - prefers-reduced-motion: scrolling still works, transition is instant
 *
 * Accessibility:
 *   - role="region" aria-roledescription="carousel"
 *   - each slide: aria-roledescription="slide", aria-label="N of M"
 *   - non-active slides: aria-hidden only affects AT, not scrolling
 *   - sr-only live region announces the active slide
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CarouselCard {
  index: string;
  title: string;
  description: string;
}

interface WelcomeCarouselProps {
  cards: CarouselCard[];
}

export default function WelcomeCarousel({ cards }: WelcomeCarouselProps) {
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, cards.length - 1));
      const scroller = scrollerRef.current;
      if (!scroller) {
        setActive(clamped);
        return;
      }
      const slide = scroller.children[clamped] as HTMLElement | undefined;
      if (slide) {
        // scrollIntoView respects prefers-reduced-motion (instant vs smooth).
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        slide.scrollIntoView({
          behavior: prefersReduced ? 'auto' : 'smooth',
          inline: 'start',
          block: 'nearest',
        });
      }
      setActive(clamped);
    },
    [cards.length],
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Track the active slide by observing scroll position (IntersectionObserver).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const slides = Array.from(scroller.children) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        // The slide most-visible in the scroller becomes active.
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          const idx = slides.indexOf(entry.target as HTMLElement);
          if (idx === -1) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0.5) {
          setActive(best.idx);
        }
      },
      { root: scroller, threshold: [0.5, 0.75, 1] },
    );

    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [cards.length]);

  // Keyboard navigation on the carousel region.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    }
  };

  const atStart = active === 0;
  const atEnd = active === cards.length - 1;

  return (
    <div
      className="wc-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Преимущества Cardcraft"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {/* Scroll-snap track — native scroll, peek of next card via gap + padding-right */}
      <div className="wc-scroller" ref={scrollerRef}>
        {cards.map((card, i) => (
          <article
            key={i}
            className="wc-slide"
            aria-roledescription="slide"
            aria-label={`Карточка ${i + 1} из ${cards.length}: ${card.title}`}
          >
            <span className="wc-index">{card.index}</span>
            <h2 className="wc-title">{card.title}</h2>
            <p className="wc-desc">{card.description}</p>
          </article>
        ))}
      </div>

      {/* Controls: prev/next arrows (desktop) + pagination dots (all viewports) */}
      <div className="wc-controls">
        <button
          type="button"
          className="wc-arrow"
          aria-label="Предыдущая карточка"
          onClick={prev}
          disabled={atStart}
          tabIndex={atStart ? -1 : 0}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="wc-dots" role="tablist" aria-label="Выбор карточки">
          {cards.map((_, di) => (
            <button
              key={di}
              type="button"
              className={di === active ? 'wc-dot wc-dot-active' : 'wc-dot'}
              role="tab"
              aria-selected={di === active}
              aria-label={`Карточка ${di + 1}`}
              onClick={() => goTo(di)}
              tabIndex={di === active ? 0 : -1}
            />
          ))}
        </div>

        <button
          type="button"
          className="wc-arrow"
          aria-label="Следующая карточка"
          onClick={next}
          disabled={atEnd}
          tabIndex={atEnd ? -1 : 0}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* sr-only live region announces the active slide for screen readers */}
      <span className="sr-only" aria-live="polite">
        Карточка {active + 1} из {cards.length}
      </span>
    </div>
  );
}
