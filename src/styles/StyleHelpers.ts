/**
 * StyleHelpers — pure functions for building inline styles and word styling.
 * No DOM access, no side effects.
 */

import type { Card, WordStyle } from '../core/types';
import { escapeHtml, isWordChar, splitOnce } from '../core/utils';

/** Build inline style string for a section field (color, fontWeight, fontSize, etc.) */
export function buildSectionStyle(card: Card, field: string): string {
  const c = card.colors || {};
  const s = card.sectionStyles || {};
  let styleStr = '';
  if (c[field]) styleStr += `color:${escapeHtml(c[field])} !important;`;
  const ss = s[field];
  if (ss) {
    if (ss.fontSize) styleStr += `font-size:${ss.fontSize}px;`;
    if (ss.fontWeight) styleStr += `font-weight:${ss.fontWeight};`;
    if (ss.fontStyle) styleStr += `font-style:${ss.fontStyle};`;
    if (ss.textDecoration) styleStr += `text-decoration:${ss.textDecoration};`;
    if (ss.textAlign) styleStr += `text-align:${ss.textAlign};`;
  }
  return styleStr ? `style="${styleStr}"` : '';
}

/** Build inline style for list number elements (--num-color, --num-bg, etc.) */
export function buildListNumStyle(card: Card): string {
  const c = card.colors || {};
  const vars: string[] = [];
  if (c.listNumber) vars.push(`--num-color:${escapeHtml(c.listNumber)}`);
  if (c.listNumBg) vars.push(`--num-bg:${escapeHtml(c.listNumBg)}`);
  if (c.listNumBorder) vars.push(`--num-border:${escapeHtml(c.listNumBorder)}`);
  if (c.listNumSize) vars.push(`--num-size:${escapeHtml(c.listNumSize)}px`);
  return vars.length ? `style="${vars.join(';')}"` : '';
}

/** Apply word-level styles to text — finds word occurrences and wraps them in styled spans */
export function applyWordStylesToText(
  text: string,
  wordStyles: Record<string, WordStyle>,
  field: string,
): string {
  if (!text) return '';
  if (!wordStyles || Object.keys(wordStyles).length === 0) return escapeHtml(text);

  // Collect applicable styles
  const applicable: { word: string; styleStr: string }[] = [];
  Object.keys(wordStyles).forEach((key) => {
    const [kf, word] = splitOnce(key, '::');
    const keyField = key.includes('::') ? kf : '*';
    if (keyField !== field && keyField !== '*') return;
    const styles = wordStyles[key];
    let styleStr = '';
    if (styles.fontWeight) styleStr += `font-weight:${styles.fontWeight};`;
    if (styles.fontStyle) styleStr += `font-style:${styles.fontStyle};`;
    if (styles.textDecoration) styleStr += `text-decoration:${styles.textDecoration};`;
    if (styles.fontSize) styleStr += `font-size:${styles.fontSize}px;`;
    if (styles.color) styleStr += `color:${escapeHtml(styles.color)};`;
    if (styleStr && word) applicable.push({ word, styleStr });
  });

  if (applicable.length === 0) return escapeHtml(text);

  // A single word keeps word-boundary matching. A phrase or a selection that
  // contains punctuation/spacing is matched exactly, allowing users to style
  // any explicitly selected range instead of being limited to one word.
  const ranges: { start: number; end: number; styleStr: string }[] = [];
  applicable.forEach(({ word, styleStr }) => {
    const needsWordBoundaries = Array.from(word).every((char) => isWordChar(char));
    let idx = 0;
    while ((idx = text.indexOf(word, idx)) !== -1) {
      const before = text[idx - 1];
      const after = text[idx + word.length];
      if (!needsWordBoundaries || ((!before || !isWordChar(before)) && (!after || !isWordChar(after)))) {
        ranges.push({ start: idx, end: idx + word.length, styleStr });
      }
      idx += word.length;
    }
  });

  if (ranges.length === 0) return escapeHtml(text);

  // Broad selections form the base; a smaller word/phrase can override just
  // its own properties without removing the rest of the paragraph's style.
  type StyledRange = typeof ranges[number];
  const starts = new Map<number, StyledRange[]>();
  const ends = new Map<number, StyledRange[]>();
  for (const range of ranges) {
    starts.set(range.start, [...(starts.get(range.start) || []), range]);
    ends.set(range.end, [...(ends.get(range.end) || []), range]);
  }
  const boundaries = [...new Set([0, text.length, ...starts.keys(), ...ends.keys()])].sort((a, b) => a - b);
  const active = new Set<StyledRange>();
  let html = '';
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    for (const range of ends.get(start) || []) active.delete(range);
    for (const range of starts.get(start) || []) active.add(range);
    const styles = [...active].sort((a, b) => (b.end - b.start) - (a.end - a.start)).map((range) => range.styleStr).join('');
    const segment = escapeHtml(text.slice(start, end));
    html += styles ? `<span class="cc-styled-word" style="${styles}">${segment}</span>` : segment;
  }
  return html;
}

/** Check if a word exists as a whole word in the given text */
export function containsWholeWord(text: string, word: string): boolean {
  if (!word) return false;
  const needsWordBoundaries = Array.from(word).every((char) => isWordChar(char));
  let idx = 0;
  while ((idx = text.indexOf(word, idx)) !== -1) {
    const before = text[idx - 1];
    const after = text[idx + word.length];
    if (!needsWordBoundaries || ((!before || !isWordChar(before)) && (!after || !isWordChar(after)))) return true;
    idx += word.length;
  }
  return false;
}

/** Remove word styles that no longer match any text in the card */
export function pruneOrphanWordStyles(card: Card): boolean {
  if (!card.wordStyles) return false;
  const fieldTexts: Record<string, string> = {
    title: card.title,
    subtitle: card.subtitle,
    text: card.text,
    list: card.listItems,
    footer: card.footer,
    cta: card.cta,
  };
  let changed = false;
  Object.keys(card.wordStyles).forEach((key) => {
    const [kf, word] = splitOnce(key, '::');
    const fieldText = fieldTexts[kf] ?? '';
    if (!word || !containsWholeWord(fieldText, word)) {
      delete card.wordStyles[key];
      changed = true;
    }
  });
  return changed;
}
