/**
 * ExportManager — handles PNG export and clipboard copy.
 * Only module that interacts with html-to-image.
 *
 * P3-2: html-to-image is lazy-loaded via dynamic import on first export call,
 *       so the ~100KB library stays out of the initial page bundle.
 * P3-3: export functions accept an AbortSignal so batch export can be cancelled.
 */

import { CONFIG } from '../core/constants';

const EXPORT_PIXEL_RATIO = CONFIG.EXPORT_PIXEL_RATIO;

/** Cached dynamic import — loaded on first export call, reused after. */
let htmlToImagePromise: Promise<typeof import('html-to-image')> | null = null;

function loadHtmlToImage(): Promise<typeof import('html-to-image')> {
  if (!htmlToImagePromise) {
    htmlToImagePromise = import('html-to-image');
  }
  return htmlToImagePromise;
}

/** Generate a PNG data URL from a DOM node */
export async function generatePng(
  node: HTMLElement,
  root: HTMLElement,
  signal?: AbortSignal,
): Promise<string> {
  root.classList.add('exporting');
  try {
    await document.fonts.ready;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const { toPng } = await loadHtmlToImage();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return await toPng(node, {
      pixelRatio: EXPORT_PIXEL_RATIO,
      cacheBust: true,
    });
  } finally {
    root.classList.remove('exporting');
  }
}

/** Generate a PNG blob from a DOM node (for clipboard) */
export async function generateBlob(
  node: HTMLElement,
  root: HTMLElement,
  signal?: AbortSignal,
): Promise<Blob | null> {
  root.classList.add('exporting');
  try {
    await document.fonts.ready;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const { toBlob } = await loadHtmlToImage();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return await toBlob(node, {
      pixelRatio: EXPORT_PIXEL_RATIO,
      cacheBust: true,
    });
  } finally {
    root.classList.remove('exporting');
  }
}

/** Download a node as PNG file */
export async function downloadPng(
  node: HTMLElement,
  filename: string,
  root: HTMLElement,
  signal?: AbortSignal,
): Promise<void> {
  const dataUrl = await generatePng(node, root, signal);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** Copy a node as PNG to clipboard (with fallback to download) */
export async function copyToClipboard(
  node: HTMLElement,
  root: HTMLElement,
  signal?: AbortSignal,
): Promise<{ success: boolean; fallback: boolean }> {
  if (!window.isSecureContext) {
    return { success: false, fallback: true };
  }
  const blob = await generateBlob(node, root, signal);
  if (!blob) return { success: false, fallback: true };
  if (!navigator.clipboard || !window.ClipboardItem) {
    return { success: false, fallback: true };
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return { success: true, fallback: false };
  } catch {
    return { success: false, fallback: true };
  }
}
