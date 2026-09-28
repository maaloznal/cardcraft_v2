'use client';

/**
 * WelcomeCarousel — interactive swipeable card carousel for the landing hero.
 *
 * Features:
 *   - Drag-to-swipe via Pointer Events (mouse + touch unified)
 *   - Keyboard navigation (← →)
 *   - Clickable pagination dots
 *   - CSS transform transitions with momentum-ish feel
 *   - Accessible: aria-roledescription, aria-label, sr-only live region
 *
 * No external dependencies — vanilla TS + CSS transforms.
 * The carousel is desktop-first; on mobile it falls back to a simple
 * horizontal scroll snap (handled in CSS).
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface CarouselCard {
  index: string; // e.g. "01 / 03"
  title: string;
  description: string;
}

interface WelcomeCarouselProps {
  cards: CarouselCard[];
}

const SWIPE_THRESHOLD = 60; // px — minimum drag distance to advance

export default function WelcomeCarousel({ cards }: WelcomeCarouselProps) {
  const [active, setActive] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const goTo = useCallback(
    (idx: number) => {
      const next = (idx + cards.length) % cards.length;
      setActive(next);
    },
    [cards.length],
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Measure card width for drag math (stored in state — reading during render
  // is legal; the effect keeps it in sync on mount + resize).
  useEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        const first = trackRef.current.querySelector<HTMLElement>('.wc-slide');
        if (first) setCardWidth(first.offsetWidth);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    };
    const el = trackRef.current;
    el?.addEventListener('keydown', onKey);
    return () => el?.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // Pointer (mouse + touch) drag
  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragX(e.clientX - startX.current);
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      if (dragX < 0) next();
      else prev();
    }
    setDragX(0);
  };

  // The visual offset: base (-active * 100%) + live drag delta
  const baseOffset = -active * 100;
  const dragPercent = cardWidth > 0 ? (dragX / cardWidth) * 100 : 0;
  const offset = baseOffset + dragPercent;
  const transition = isDragging ? 'none' : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div
      className="wc-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Преимущества Cardcraft"
    >
      <div
        className="wc-track"
        ref={trackRef}
        tabIndex={0}
        style={{ transform: `translateX(${offset}%)`, transition }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            className="wc-slide"
            aria-hidden={i !== active}
            aria-roledescription="slide"
            aria-label={`${i + 1} из ${cards.length}`}
          >
            {/* Decorative stacked cards behind the front card */}
            <div className="wc-stack-back" />
            <div className="wc-stack-middle" />
            <article className="wc-stack-front">
              <span className="wc-index">{card.index}</span>
              <h2 className="wc-title">{card.title}</h2>
              <p className="wc-desc">{card.description}</p>
              <div className="wc-dots" role="tablist" aria-label="Выбор карточки">
                {cards.map((_, di) => (
                  <button
                    key={di}
                    className={di === active ? 'wc-dot wc-dot-active' : 'wc-dot'}
                    role="tab"
                    aria-selected={di === active}
                    aria-label={`Карточка ${di + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(di);
                    }}
                    tabIndex={di === active ? 0 : -1}
                  />
                ))}
              </div>
            </article>
          </div>
        ))}
      </div>
      {/* sr-only live region for screen readers */}
      <span className="sr-only" aria-live="polite">
        Карточка {active + 1} из {cards.length}
      </span>
    </div>
  );
}
