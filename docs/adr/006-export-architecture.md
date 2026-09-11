# ADR-006: Export Architecture — Lazy html-to-image on Main Thread with AbortController Cancel

**Date**: 2025-09-11
**Status**: Accepted

## Context

Cardcraft exports cards as PNG images. The original `index.html` loaded `html-to-image` (~100 KB minified) from a broken CDN with an `integrity` attribute that no longer matched the script — the very first bug fixed in the port was switching to the npm package (`bun add html-to-image`) and importing it as an ES module.

Two architectural questions surfaced during P3:

1. **Bundle cost** — `html-to-image` is ~100 KB and only used on the export path. Loading it eagerly in the initial bundle penalizes every visitor, including those who never export. The library must be lazy-loaded.
2. **Thread cost** — `html-to-image.toPng()` is synchronous from the caller's perspective and runs on the main thread. It clones the target node, inlines computed styles, awaits font readiness, and serializes to SVG → rasterizes via the browser's image decoder. For a 10-card batch, the main thread is blocked for ~1–2s per card (~10–20s total). Should this be moved to a Web Worker?

The Worker option was investigated and rejected as non-trivial: `html-to-image` needs DOM access (`node.cloneNode(true)`, `getComputedStyle`, `window.getComputedStyle` for `::before/::after`). A Worker cannot access the DOM. Migrating would require serializing the node tree + computed styles to plain data via `XMLSerializer` + a custom style collector, posting that to the Worker, then rasterizing with `OffscreenCanvas`. This is a from-scratch re-implementation of `html-to-image`, not a port. The cost was unjustified when the cancel path already exists.

## Decision

**Keep `html-to-image` on the main thread. Lazy-load it via dynamic `import()` on first export call. Provide cancel via `AbortController` + progress toasts. Accept the per-card main-thread block as a known trade-off.**

Implementation:

- **Lazy load** — `src/export/ExportManager.ts` lines 14–22: a module-level `htmlToImagePromise` variable caches the dynamic import. `loadHtmlToImage()` returns the cached promise or creates it on first call. The library stays out of the initial page bundle.
- **AbortSignal threading** — every export function (`generatePng`, `generateBlob`, `downloadPng`, `copyToClipboard`) accepts an optional `signal?: AbortSignal`. The signal is checked three times per call: before `document.fonts.ready` await, after the await, and after the `toPng`/`toBlob` call (lines 33, 35, 74). An aborted signal throws `new DOMException('Aborted', 'AbortError')` — the same exception type the browser uses natively.
- **Batch pipeline** — `src/orchestrator/export-controller.ts` `downloadAllPng()` (lines 77–129):
  - Creates a fresh `AbortController` per batch, stored in `batchAbort` (line 85). Overlapping batch attempts short-circuit with "Экспорт уже идёт…" (lines 79–82).
  - Sets `stateManager.setUI({ isExporting: true })` (line 88) and adds the `exporting-busy` class to root (line 89) — CSS disables editing during export.
  - Loops cards: `if (abort.signal.aborted) break;` (line 95). Catches `AbortError` separately (line 105) to break out cleanly; other errors are swallowed and the batch continues to the next card.
  - Shows a long-duration progress toast (`Скачано N из M...`, 60s timeout — `toast.ts` long-toast bypass keeps it visible). Completion + cancel use `priority: true` so they break through the progress toast queue (lines 113–122).
  - The `finally` block (lines 124–128) always clears `batchAbort`, removes `isExporting`, and removes the busy class — even on uncaught throw.
- **Escape to cancel** — `src/orchestrator/keyboard-controller.ts` lines 30–34: the Escape handler checks `stateManager.getUI().isExporting` first; if true, calls `exporter.cancelExport()` and returns (does not close any overlay). Escape cancels the export before closing modals.
- **Teardown** — `destroy()` (line 142) aborts any in-flight batch on React unmount / route change, preventing orphaned downloads.
- **Export mode wrapper** — `withExportMode(root, node, fn)` (`src/orchestrator/export-mode.ts`, 21 lines) adds the `exporting` class to root (CSS hides action buttons / chrome) and awaits `document.fonts.ready` before calling the export function — fonts must be ready or the PNG renders with fallback fonts.

## Consequences

- **Positive**:
  - Initial page bundle stays lean — `html-to-image` is fetched only on the first export click, then cached for the session.
  - Cancel is responsive: Escape aborts between cards (loop check) and inside `toPng` (signal check after the await). The user can stop a 50-card batch partway without waiting.
  - `isExporting` UI state + CSS blocking prevents the user from editing a card mid-rasterization (which would corrupt the PNG).
  - The implementation is ~150 lines total across `ExportManager` + `export-controller` + `export-mode` — far less than a Worker rewrite.
  - `html-to-image`'s DOM access works unmodified — `node.cloneNode(true)` + `getComputedStyle` work as designed.

- **Negative**:
  - Each `toPng` call blocks the main thread for ~1–2s. A 10-card batch visibly freezes the UI; the only feedback is the progress toast. Animations, hover states, and scroll are all paused during each raster.
  - Web Worker migration remains a TODO. If batch export of 50+ cards becomes a real use case, the freeze will be unacceptable.
  - `html-to-image`'s quality is bounded by the browser's SVG foreignObject rasterizer. Complex CSS (filters, backdrop-blend, exotic gradients) sometimes renders differently than the live preview. Not addressable by this ADR — it's a library limitation.
  - The `QuotaExceededError`-style sentinel-string pattern is repeated here with `err instanceof DOMException && err.name === 'AbortError'` (line 105) — a typed check, but the abort-vs-error distinction is brittle if `html-to-image` ever throws non-DOM exceptions.

- **Neutral**:
  - The `htmlToImagePromise` cache is module-level — once loaded, it stays loaded for the page lifetime even if the user never exports again. A `WeakRef`-based cleanup would be over-engineering.
  - `cacheBust: true` in the toPng options (line 38) ensures images re-fetch on every export — slower but correct. If export latency becomes a complaint, this is the first knob to tune.

## Verification

- `src/export/ExportManager.ts` lines 14–22 (`loadHtmlToImage` lazy import + cache), 25–43 (`generatePng` with 3× signal check), 67–79 (`downloadPng`).
- `src/orchestrator/export-controller.ts` lines 36–40 (`batchAbort` state), 77–129 (`downloadAllPng` loop with break-on-abort + priority toasts), 131–135 (`cancelExport`), 142–146 (`destroy` aborts in-flight).
- `src/orchestrator/keyboard-controller.ts` lines 30–34 (Escape → `cancelExport` before overlay close).
- `src/orchestrator/export-mode.ts` lines 1–21 (`withExportMode` adds `exporting` class + awaits `document.fonts.ready`).
- `tests/e2e/export.spec.ts`: single-card download + batch progress + Escape cancel paths.
