/** Resolve a word under a tap, including words split across styled spans. */
export function wordAtPoint(field: HTMLElement, x: number, y: number): string | null {
  const doc = field.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const caret = doc.caretPositionFromPoint?.(x, y);
  const legacy = !caret ? doc.caretRangeFromPoint?.(x, y) : null;
  const node = caret?.offsetNode ?? legacy?.startContainer;
  const offset = caret?.offset ?? legacy?.startOffset;
  if (!node || offset == null || !field.contains(node)) return null;
  const prefix = doc.createRange(); prefix.selectNodeContents(field); prefix.setEnd(node, offset);
  const position = prefix.toString().length;
  const text = field.textContent || '';
  const segments = [...new Intl.Segmenter('ru', { granularity: 'word' }).segment(text)];
  const word = segments.find((item) => item.isWordLike && item.index <= position && position < item.index + item.segment.length)
    ?? segments.find((item) => item.isWordLike && position === item.index + item.segment.length);
  if (!word) return null;
  const range = doc.createRange();
  const walker = doc.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let current: Node | null; let seen = 0; let started = false;
  while ((current = walker.nextNode())) {
    const length = current.textContent?.length ?? 0;
    if (!started && seen + length > word.index) { range.setStart(current, word.index - seen); started = true; }
    const end = word.index + word.segment.length;
    if (started && seen + length >= end) { range.setEnd(current, end - seen); break; }
    seen += length;
  }
  // Caret APIs also return the nearest character when tapping empty padding.
  if (![...range.getClientRects()].some((rect) => x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2)) return null;
  return word.segment;
}
