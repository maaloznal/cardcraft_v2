/**
 * ExportManager — handles PNG export and clipboard copy.
 * The ONLY module that interacts with html-to-image.
 *
 * P-EXPORT-Q: export resolution is now detached from the on-screen card size.
 *   The card is rendered at a FIXED logical width (EXPORT_CARD_WIDTH == 380
 *   CSS px) via html-to-image's `width` + `style` options, which are applied
 *   to the library's INTERNAL CLONE (not the visible node) — so the UI never
 *   jumps. The output pixel width = EXPORT_CARD_WIDTH × quality.scale
 *   (760 / 1140 / 1520), fully deterministic and independent of
 *   devicePixelRatio / viewport. See constants.ts for the quality table.
 *
 * P-EXPORT-CLEANUP: `.exporting` class is toggled by the caller (export-mode
 *   wrapper), NOT here — avoids the previous double add/remove. These
 *   functions only build options + call html-to-image + honor AbortSignal.
 *
 * P-EXPORT-FONTS: document.fonts.ready is awaited inside buildExportOptions
 *   consumers so webfonts are embedded (no fallback metrics in the PNG).
 *
 * P-EXPORT-MEM: no manual offscreen clone is created — html-to-image clones
 *   internally and is given the fixed width via options, so there are no
 *   temporary DOM nodes for us to clean up. Object URLs / data URLs are
 *   released by the caller (download link / clipboard write) — see
 *   export-controller for the finally cleanup of `exporting-busy`.
 */

import type { ExportQuality } from '../core/types';
import {
  EXPORT_CARD_WIDTH,
  EXPORT_QUALITY_LEVELS,
  CARD_PADDING,
} from '../core/constants';

/** html-to-image options shape (kept loose to avoid importing the lib type). */
export interface ExportOptions {
  width: number;
  pixelRatio: number;
  cacheBust: boolean;
  style: { width: string; maxWidth: string; padding: string; visibility: string };
  filter: (domNode: HTMLElement) => boolean;
  skipAutoScale: boolean;
}

/** Cached dynamic import — loaded on first export call, reused after. */
let htmlToImagePromise: Promise<typeof import('html-to-image')> | null = null;

function loadHtmlToImage(): Promise<typeof import('html-to-image')> {
  if (!htmlToImagePromise) {
    htmlToImagePromise = import('html-to-image');
  }
  return htmlToImagePromise;
}

/**
 * Build a SINGLE, shared html-to-image options object for a given quality.
 * Used by BOTH generatePng (data URL) and generateBlob (clipboard) so the
 * output is byte-for-byte consistent between download and copy.
 *
 *  - `width: EXPORT_CARD_WIDTH` → the clone is rendered at exactly 380 CSS px
 *    regardless of the on-screen card width (which may be 100% / shrunk on a
 *    390 px phone). html-to-image applies this to its internal clone, NOT the
 *    visible node — no UI jump.
 *  - `style.width/maxWidth/padding` → overrides mobile CSS (@media ≤480px sets
 *    width:100% + padding:24px) so the clone always uses desktop metrics.
 *  - `pixelRatio: scale` → the ONLY canvas multiplier (devicePixelRatio is NOT
 *    consulted because we always pass a value). Output width = 380 × scale.
 *  - `filter` → excludes the empty-card placeholder hint so it never leaks
 *    into the PNG even if the `.exporting` CSS override somehow doesn't apply
 *    to the clone. (`.card-actions` are siblings of `.card`, not descendants,
 *    so they're never cloned — no filter needed for them.)
 *  - `skipAutoScale: false` (default) → lets html-to-image downscale a canvas
 *    that exceeds the browser's max canvas size instead of throwing silently;
 *    we surface a friendly error in export-controller when ×4 is too big.
 */
export function buildExportOptions(quality: ExportQuality): ExportOptions {
  const level = EXPORT_QUALITY_LEVELS[quality];
  return {
    width: EXPORT_CARD_WIDTH,
    pixelRatio: level.scale,
    cacheBust: true,
    style: {
      width: `${EXPORT_CARD_WIDTH}px`,
      maxWidth: `${EXPORT_CARD_WIDTH}px`,
      padding: `${CARD_PADDING}px`,
      // On phones, "Скачать все" is launched from editor mode while the
      // preview workspace has visibility:hidden. Visibility is inherited, so
      // html-to-image otherwise clones a hidden card and produces a blank or
      // black PNG. Apply this only to the internal clone (no visible UI flash).
      visibility: 'visible',
    },
    // Exclude editor-only chrome from the PNG. `.card-actions` is a sibling
    // of `.card` so it's never part of the cloned subtree; this filter is a
    // belt-and-suspenders guard for the empty-card hint and any node the
    // editor may inject inside the card marked [data-no-export].
    filter: (domNode: HTMLElement): boolean => {
      if (!domNode || !domNode.classList) return true;
      return (
        !domNode.classList.contains('card-empty-hint') &&
        !domNode.hasAttribute('data-no-export')
      );
    },
    skipAutoScale: false,
  };
}

/** Await fonts + honor an abort signal — shared pre-flight check. */
async function prepareForExport(signal?: AbortSignal): Promise<void> {
  await document.fonts.ready;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

/**
 * Generate a PNG data URL from a DOM node at the given quality.
 * Resolution is deterministic: width = EXPORT_CARD_WIDTH × quality.scale.
 * The `.exporting` root class (which hides editor hints via CSS) is toggled
 * by the caller — NOT here.
 */
export async function generatePng(
  node: HTMLElement,
  quality: ExportQuality,
  signal?: AbortSignal,
): Promise<string> {
  await prepareForExport(signal);
  const { toPng } = await loadHtmlToImage();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return await toPng(node, buildExportOptions(quality));
}

/**
 * Generate a PNG blob from a DOM node at the given quality (for clipboard).
 * Uses the SAME buildExportOptions as generatePng so the output is identical.
 */
export async function generateBlob(
  node: HTMLElement,
  quality: ExportQuality,
  signal?: AbortSignal,
): Promise<Blob | null> {
  await prepareForExport(signal);
  const { toBlob } = await loadHtmlToImage();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return await toBlob(node, buildExportOptions(quality));
}

/**
 * Download a node as a PNG file at the given quality. Downloads use a Blob
 * URL instead of a large data URL. Android/MIUI browsers can save a data URL
 * before its canvas payload is fully committed, producing a small black PNG.
 * A Blob is binary and its object URL remains alive briefly after click so the
 * mobile download manager can finish reading it.
 */
export async function downloadPng(
  node: HTMLElement,
  filename: string,
  quality: ExportQuality,
  signal?: AbortSignal,
): Promise<void> {
  const blob = await generateBlob(node, quality, signal);
  if (!blob) throw new Error('PNG blob generation failed');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  downloadBlob(blob, filename, 2_000);
}

/** Trigger a browser download while keeping the object URL alive long enough
 * for asynchronous Android/MIUI download managers to consume it. */
export function downloadBlob(blob: Blob, filename: string, revokeDelay = 30_000): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Android's download manager may consume the URL asynchronously. Revoking
  // immediately after click is racy on Xiaomi/MIUI, so keep it briefly alive.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), revokeDelay);
}

/** Copy a node as PNG to the clipboard (with fallback to download) at the
 *  given quality. The blob is consumed by the Clipboard API and not retained. */
export async function copyToClipboard(
  node: HTMLElement,
  quality: ExportQuality,
  signal?: AbortSignal,
): Promise<{ success: boolean; fallback: boolean }> {
  if (!window.isSecureContext) {
    return { success: false, fallback: true };
  }
  const blob = await generateBlob(node, quality, signal);
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
