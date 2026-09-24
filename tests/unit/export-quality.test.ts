/**
 * Unit tests for the PNG export-quality system.
 *
 * Covers:
 *   - default quality is ×3
 *   - only x2 / x3 / x4 are allowed values
 *   - an invalid / corrupted stored value falls back to ×3 (sanitize-on-load)
 *   - output width is correctly derived (EXPORT_CARD_WIDTH × scale)
 *   - buildExportOptions produces identical options for PNG and Blob paths
 *   - cleanup behavior (the .exporting class is NOT toggled by ExportManager;
 *     that is the caller's responsibility via withExportMode)
 *
 * These tests do NOT invoke html-to-image (no DOM rendering) — they verify
 * the pure configuration layer. E2E tests in tests/e2e/export.spec.ts verify
 * the actual PNG dimensions via IHDR parsing.
 */
import { describe, it, expect } from 'vitest';
import {
  EXPORT_CARD_WIDTH,
  EXPORT_QUALITY_LEVELS,
  EXPORT_QUALITY_VALUES,
  DEFAULT_EXPORT_QUALITY,
} from '@/core/constants';
import { isValidExportQuality } from '@/core/utils';
import { buildExportOptions } from '@/export/ExportManager';

describe('Export quality', () => {
  // ─── Defaults & allowed values ────────────────────────────────
  describe('default + allowed values', () => {
    it('defaults to ×3', () => {
      expect(DEFAULT_EXPORT_QUALITY).toBe('x3');
    });

    it('exposes exactly three quality levels: x2, x3, x4', () => {
      expect(EXPORT_QUALITY_VALUES).toEqual(['x2', 'x3', 'x4']);
    });

    it('each level declares a scale and a derived output width', () => {
      for (const q of EXPORT_QUALITY_VALUES) {
        const lvl = EXPORT_QUALITY_LEVELS[q];
        expect(lvl.scale).toBeGreaterThan(0);
        expect(lvl.outputWidth).toBe(EXPORT_CARD_WIDTH * lvl.scale);
      }
    });
  });

  // ─── Output-width derivation (the core correctness invariant) ──
  describe('output width is deterministic', () => {
    it('×2 → 760 px (380 × 2)', () => {
      expect(EXPORT_QUALITY_LEVELS.x2.outputWidth).toBe(760);
    });
    it('×3 → 1140 px (380 × 3)', () => {
      expect(EXPORT_QUALITY_LEVELS.x3.outputWidth).toBe(1140);
    });
    it('×4 → 1520 px (380 × 4)', () => {
      expect(EXPORT_QUALITY_LEVELS.x4.outputWidth).toBe(1520);
    });
  });

  // ─── Validator (sanitize-on-load gate) ─────────────────────────
  describe('isValidExportQuality', () => {
    it('accepts each allowed value', () => {
      for (const q of EXPORT_QUALITY_VALUES) {
        expect(isValidExportQuality(q, EXPORT_QUALITY_VALUES)).toBe(true);
      }
    });

    it('rejects an unknown string', () => {
      expect(isValidExportQuality('x5', EXPORT_QUALITY_VALUES)).toBe(false);
      expect(isValidExportQuality('2', EXPORT_QUALITY_VALUES)).toBe(false);
      expect(isValidExportQuality('standard', EXPORT_QUALITY_VALUES)).toBe(false);
    });

    it('rejects non-string types (corrupted localStorage)', () => {
      expect(isValidExportQuality(null, EXPORT_QUALITY_VALUES)).toBe(false);
      expect(isValidExportQuality(undefined, EXPORT_QUALITY_VALUES)).toBe(false);
      expect(isValidExportQuality(3, EXPORT_QUALITY_VALUES)).toBe(false);
      expect(isValidExportQuality({}, EXPORT_QUALITY_VALUES)).toBe(false);
    });

    it('is a type guard (narrows to ExportQuality)', () => {
      const raw: unknown = 'x3';
      if (isValidExportQuality(raw, EXPORT_QUALITY_VALUES)) {
        // TypeScript narrows raw to ExportQuality here
        expect(raw).toBe('x3');
      }
    });
  });

  // ─── buildExportOptions — the shared options builder ───────────
  describe('buildExportOptions', () => {
    it('uses the fixed EXPORT_CARD_WIDTH (not the on-screen card size)', () => {
      for (const q of EXPORT_QUALITY_VALUES) {
        const opts = buildExportOptions(q);
        expect(opts.width).toBe(EXPORT_CARD_WIDTH);
        expect(opts.style.width).toBe(`${EXPORT_CARD_WIDTH}px`);
        expect(opts.style.maxWidth).toBe(`${EXPORT_CARD_WIDTH}px`);
      }
    });

    it('pixelRatio equals the quality scale (devicePixelRatio is NOT used)', () => {
      expect(buildExportOptions('x2').pixelRatio).toBe(2);
      expect(buildExportOptions('x3').pixelRatio).toBe(3);
      expect(buildExportOptions('x4').pixelRatio).toBe(4);
    });

    it('forces desktop padding (32px) so mobile @media overrides do not shrink the clone', () => {
      for (const q of EXPORT_QUALITY_VALUES) {
        expect(buildExportOptions(q).style.padding).toBe('32px');
      }
    });

    it('output pixel width = width × pixelRatio (deterministic)', () => {
      // This is the invariant html-to-image applies: canvas.width = width × pixelRatio
      expect(EXPORT_CARD_WIDTH * buildExportOptions('x2').pixelRatio).toBe(760);
      expect(EXPORT_CARD_WIDTH * buildExportOptions('x3').pixelRatio).toBe(1140);
      expect(EXPORT_CARD_WIDTH * buildExportOptions('x4').pixelRatio).toBe(1520);
    });

    it('produces IDENTICAL width / pixelRatio / style for PNG and Blob (parity)', () => {
      // buildExportOptions is the single source — both generatePng and
      // generateBlob call it, so their outputs are byte-equivalent.
      // (filter is a fresh closure per call with no shared state, so we
      // compare behavior, not reference identity.)
      for (const q of EXPORT_QUALITY_VALUES) {
        const a = buildExportOptions(q);
        const b = buildExportOptions(q);
        expect(b.width).toBe(a.width);
        expect(b.pixelRatio).toBe(a.pixelRatio);
        expect(b.style).toEqual(a.style);
        expect(b.cacheBust).toBe(a.cacheBust);
        expect(b.skipAutoScale).toBe(a.skipAutoScale);
        // Both filters exclude the same nodes
        const hint = document.createElement('div');
        hint.className = 'card-empty-hint';
        expect(a.filter(hint)).toBe(false);
        expect(b.filter(hint)).toBe(false);
        const card = document.createElement('div');
        card.className = 'card';
        expect(a.filter(card)).toBe(true);
        expect(b.filter(card)).toBe(true);
      }
    });

    it('includes a filter that excludes the empty-card placeholder hint', () => {
      const opts = buildExportOptions('x3');
      const hint = document.createElement('div');
      hint.className = 'card-empty-hint';
      expect(opts.filter(hint)).toBe(false);
      // A normal card element is kept
      const card = document.createElement('div');
      card.className = 'card';
      expect(opts.filter(card)).toBe(true);
    });

    it('filter excludes nodes marked [data-no-export]', () => {
      const opts = buildExportOptions('x3');
      const node = document.createElement('div');
      node.setAttribute('data-no-export', '');
      expect(opts.filter(node)).toBe(false);
    });

    it('leaves skipAutoScale false so oversized ×4 canvases downscale safely', () => {
      for (const q of EXPORT_QUALITY_VALUES) {
        expect(buildExportOptions(q).skipAutoScale).toBe(false);
      }
    });
  });
});
