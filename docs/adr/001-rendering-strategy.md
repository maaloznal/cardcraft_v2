# ADR-001: Rendering Strategy — Vanilla TS Imperative Renderers

**Date**: 2025-09-11
**Status**: Accepted

## Context

Cardcraft was ported from a vanilla `index.html` (3262 lines: CSS, HTML body, JS in one file). The original application managed the entire DOM imperatively: it called `appendChild`, `insertBefore`, `setAttribute`, `innerHTML` directly against `#cardsArea` and `#editorCardsList`. Re-rendering on every keystroke would have walked + diffed every card node — visibly janky on a deck of 30+ cards.

The Next.js port wraps the original markup in a React shell (`src/app/page.tsx`, 548 lines), but the shell does **not** own the dynamic DOM. It only mounts the static skeleton (top bar, sidebar, modal, popup, empty `#cardsArea` / `#editorCardsList` containers) and calls `initCardCraftApp(root)` inside a single `useEffect`. Once the app boots, React never reconciles `#cardsArea` or `#editorCardsList` again — that work is delegated to two vanilla TS classes:

- `PreviewRenderer` (`src/preview/PreviewRenderer.ts`, 470 lines) — owns `#cardsArea`
- `EditorRenderer` (`src/editor/EditorRenderer.ts`, 311 lines) — owns `#editorCardsList`

The alternative — moving the card list into React state and letting React reconcile on every `input` event — was rejected during the P1 audit: a single keystroke would have triggered `setState` → reconcile → diff every card wrapper (~30+ elements with multiple children each) → patch DOM. Even with `useMemo` and `key`-stability, the diff cost is non-trivial and the existing O(1) path was already proven on the original codebase.

## Decision

**Keep vanilla TS renderers for the dynamic card DOM; React stays a thin shell.**

Each renderer exposes a small imperative API with two tiers:

- **Full rebuild (O(n))**: `render(cards, settings)` — wipes the container and rebuilds every card. Used on undo/redo restore, load, format change, clear-all.
- **Targeted updates (O(1))**:
  - `updateCardField(card, field, cardIndex)` — single text/style patch
  - `updateCardStyle(card, field, cardIndex)` — color/section-style patch
  - `updateCardTheme(card, globalTheme)` — `data-theme` attribute swap
  - `removeCard(cardId)` / `insertCard(card, index, …)` / `moveCard(from, to)` — DOM splice
  - `updateProgressBars(cards, settings)` — O(n) but only rebuilds the progress/tag spans, not the card body

Both renderers set up **event delegation** once on their container: PreviewRenderer registers 2 listeners (click + dblclick), EditorRenderer registers 4 (click, input, focusin, paste). No per-element `addEventListener` is ever called from a render loop — see `PreviewRenderer.setupDelegation()` (lines 405–452) and `EditorRenderer.setupDelegation()` (lines 236–310).

Typing flow (the hot path): `input` event on `<textarea>` → EditorRenderer's delegated handler → `dispatch(UPDATE_CARD_FIELD)` → `previewRenderer.updateCardField(card, field, idx)` (O(1) — one `querySelector` + one `innerHTML` assignment). React is never involved. The render benchmark in `tests/perf/render-bench.test.ts` locks this contract.

## Consequences

- **Positive**:
  - O(1) typing latency regardless of deck size; the React reconciliation tax is never paid on the hot path.
  - Event delegation keeps listener count constant (6 total) instead of growing with card count.
  - The original imperative renderer code survived the port almost verbatim — low rewrite risk, high fidelity to the proven implementation.
  - React StrictMode double-mount is handled cleanly via `destroy()` methods that remove the tracked delegation handlers (see `PreviewRenderer.destroy()` lines 57–63).

- **Negative**:
  - Two mental models in one codebase: React for the shell, vanilla TS for the workspace. New contributors must learn both.
  - No React DevTools insight into the card DOM — debugging requires inspecting the live DOM directly.
  - Manual DOM hygiene: the renderers must remember to clean up empty wrappers, reindex badges (`EditorRenderer.reindexBlocks()`), and update progress bars after structural changes (`card-ops.ts` lines 62–64).
  - `innerHTML` is used to build card markup; XSS is mitigated by `escapeHtml` / `escapeAttr` / `sanitizeCardId` (see `src/core/utils.ts`), but it is a real surface that needs continued vigilance.

- **Neutral**:
  - React's `useEffect` cleanup calls `initCardCraftApp`'s returned teardown, which in turn calls each renderer's `destroy()`. React and vanilla TS meet at exactly one seam — the boot/cleanup contract.

## Verification

- `src/app/page.tsx` lines 59–66: shell mounts once, calls `initCardCraftApp(rootRef.current)`, returns cleanup.
- `src/preview/PreviewRenderer.ts` lines 39–49 (constructor + delegation setup), 67–73 (`render`), 78–122 (`updateCardField` O(1)), 162–177 (`insertCard`/`removeCard` O(1)).
- `src/editor/EditorRenderer.ts` lines 59–65 (`render`), 73–115 (`insertCard`/`removeCard`/`moveCard` O(1) + reindex), 236–310 (delegation).
- `src/orchestrator/callbacks.ts` lines 60–89: input/paste callback dispatches the typed action and calls `previewRenderer.updateCardField` directly — no React state involved.
- `tests/perf/render-bench.test.ts`: typing-latency regression test.
