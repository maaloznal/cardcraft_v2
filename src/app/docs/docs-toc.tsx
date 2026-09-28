'use client';

/**
 * DocsToc — sticky table-of-contents with scrollspy.
 *
 * Observes the section headings via IntersectionObserver and marks the
 * currently-visible section as active in the TOC, so the reader always
 * knows where they are in the documentation.
 *
 * Keyboard: each TOC link is a normal anchor (<a href="#id">) so the
 * browser handles smooth-scroll + focus. aria-current="location" is set
 * on the active link for screen readers.
 */

import { useEffect, useState } from 'react';

interface DocsTocProps {
  sections: [string, string][];
}

export default function DocsToc({ sections }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.[0] ?? '');

  useEffect(() => {
    const headings = sections
      .map(([id]) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top that is intersecting.
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { id: entry.target.id, ratio: entry.intersectionRatio };
          }
        }
        if (best) {
          setActiveId(best.id);
        }
      },
      {
        // Trigger when a section's top crosses ~1/3 from the viewport top,
        // accounting for the sticky nav height.
        rootMargin: '-120px 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 1],
      },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <aside aria-label="Содержание" className="docs-toc">
      <span>Содержание</span>
      <ul className="docs-toc-list">
        {sections.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={id === activeId ? 'docs-toc-link docs-toc-link-active' : 'docs-toc-link'}
              aria-current={id === activeId ? 'location' : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
