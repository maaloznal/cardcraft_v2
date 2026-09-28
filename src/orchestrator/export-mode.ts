/**
 * withExportMode — toggles the `.exporting` class on root around an export
 * operation. This is the SINGLE place that manages the `.exporting` class —
 * ExportManager no longer touches it (prevents the previous double add/remove).
 *
 * Why the class matters: html-to-image clones the card node and copies the
 * COMPUTED styles of every descendant. The `.cc-root.exporting` CSS rules
 * hide the empty-card placeholder (`.card-empty-hint`) and strip the
 * `.cc-styled-word` dashed-underline markers. For the clone to inherit these
 * overrides, `.exporting` MUST be on the root at clone time — i.e. before the
 * wrapped fn runs. `document.fonts.ready` is awaited inside ExportManager's
 * prepareForExport (single responsibility — fonts belong to the export primitive).
 *
 * The class is removed in `finally` so it never persists across success,
 * error, or AbortError.
 */
export async function withExportMode<T>(
  root: HTMLElement,
  fn: () => Promise<T>,
): Promise<T> {
  root.classList.add('exporting');
  try {
    return await fn();
  } finally {
    root.classList.remove('exporting');
  }
}
