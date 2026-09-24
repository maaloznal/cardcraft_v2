/**
 * withExportMode — helper that adds .exporting class to root, awaits
 * document.fonts.ready, runs the export function, and removes the class.
 *
 * The .exporting class triggers CSS rules that hide UI chrome (.card-empty-hint,
 * .cc-styled-word markers) so they don't appear in the exported PNG.
 */

export async function withExportMode<T>(
  root: HTMLElement,
  node: HTMLElement,
  fn: (node: HTMLElement) => Promise<T>,
): Promise<T> {
  root.classList.add('exporting');
  try {
    await document.fonts.ready;
    return await fn(node);
  } finally {
    root.classList.remove('exporting');
  }
}
