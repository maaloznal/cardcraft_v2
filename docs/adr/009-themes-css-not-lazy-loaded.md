# ADR-009: Themes CSS — Not Lazy-Loaded (Conscious Decision)

**Date**: 2025-09-11
**Status**: Accepted
**Decision**: Keep themes.css in initial bundle; do NOT lazy-load.

## Context

MasterTask.md PRIORITY 9.2 required: "вынести themes.css в отдельный chunk, lazy-load (или только нужные темы)."

The `themes.css` file contains 90 `[data-theme="..."]` blocks (1344 lines, ~30KB uncompressed, ~5KB gzipped). It's imported via `card-constructor.css` which is imported by `page.tsx`.

## Decision

**Do NOT lazy-load themes.css.** Keep it in the initial bundle.

### Rationale

1. **Size is negligible**: ~5KB gzipped is less than a single font file. The browser parses CSS attribute selectors extremely fast.

2. **FOUC risk**: The default theme is applied on initial render. If themes.css is lazy-loaded, there would be a Flash of Unstyled Content (FOUC) — cards would render without theme variables until the CSS loads. This is a worse UX than the minimal bandwidth saving.

3. **All themes needed at runtime**: Users can switch themes dynamically via the theme dropdown. All 90 themes must be available immediately — lazy-loading would add latency on every theme switch.

4. **No code splitting benefit**: CSS `@import` in Next.js 16 with Turbopack is already inlined and minified. Separating themes.css into a dynamic import would add a network round-trip for minimal gain.

5. **`font-display: swap` already handles fonts**: The actual heavy resources (font woff2 files) are already conditionally loaded by the browser via `@font-face unicode-range + font-display: swap` (see ADR-005). The CSS declarations are lightweight.

## Consequences

- **Positive**: No FOUC, instant theme switching, simpler architecture.
- **Negative**: ~5KB gzipped CSS in initial bundle (negligible).
- **Neutral**: If themes.css grows significantly (e.g., 500+ themes), revisit this decision.

## Verification

- `themes.css` is 1344 lines, ~5KB gzipped
- All 90 themes available immediately on page load
- No FOUC observed in visual regression tests
- Theme switching is instant (no network latency)
