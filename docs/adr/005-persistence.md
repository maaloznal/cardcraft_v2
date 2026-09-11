# ADR-005: Persistence — localStorage with Validation, IndexedDB Fallback TODO

**Date**: 2025-09-11
**Status**: Accepted

## Context

Cardcraft is a client-only Next.js app — there is no server-side persistence layer. The entire project state (cards, theme, format, settings, sidebar dimensions) must survive a page reload. The state shape is small per record (a card is ~6 short strings + 3 optional style objects), but a deck can have 50–100 cards and the user expects their work to still be there tomorrow.

Constraints:

- **Synchronous read on boot** — `loadCardsFromLocalStorage()` runs inside `initCardCraftApp` and must return data before the first render. An async store would force a loading state and delay first paint.
- **Untrusted input** — anything in localStorage could have been written by an older app version, a manually edited DevTools session, or a malicious browser extension. Theme names, color hex codes, card IDs, and format names must all be validated before reaching the renderer.
- **Graceful quota handling** — `QuotaExceededError` is a real failure mode (5–10 MB localStorage limit; ~100 cards with custom colors can approach it). The user must be told, not silently dropped.
- **Schema migration** — the codebase has been through two card-shape revisions: `wordStyles` keys used to omit the `field::` prefix, and `sectionStyles` used `{ bold: "bold" }` instead of `{ fontWeight: "bold" }`. Saved data from either older shape must load without data loss.

## Decision

**localStorage as the only persistence layer, owned exclusively by `StorageManager`. All values validated on read; quota errors surfaced as user-facing toasts. IndexedDB fallback is a tracked TODO (P8.4).**

Implementation:

- `StorageManager` (`src/storage/StorageManager.ts`, 196 lines) is the **only** module in the project that calls `localStorage`. The `KEYS` constant object (lines 10–22) defines 11 storage keys: cards, theme, format, 5 setting toggles, gradient angle, sidebar width, header height.
- `save(state)` writes each field as a separate localStorage key (not one big JSON blob) — toggling a switch doesn't re-serialize the card array. Empty `colors`/`sectionStyles`/`wordStyles` objects and missing `theme` are stripped before serialization to save bytes (lines 42–49).
- `load()` validates every field against whitelists:
  - `isValidTheme(theme, ALLOWED_THEMES)` (line 91) — rejects unknown themes.
  - `isValidFormat(format, ALLOWED_FORMATS)` (line 96) — rejects unknown formats.
  - `isValidHexColor(value)` per color entry (lines 149–154) — rejects malformed hex.
  - `sanitizeCardId(card.id)` (line 134) — rejects IDs that don't match `^[a-zA-Z0-9_-]{1,64}$`, regenerates a UUID if invalid (XSS defense).
- `migrateCard()` (lines 132–195) handles legacy schema: rewrites old `wordStyles` keys to include `field::`, converts `{ bold, italic, underline, strikethrough }` to `{ fontWeight, fontStyle, textDecoration }`, clamps font sizes via `clampFontSize` (8–96px range).
- Corrupted JSON in the cards key is caught, the key is removed, and load continues with defaults (lines 82–87) — one bad key doesn't kill the whole app.
- `QuotaExceededError` is re-thrown with a sentinel message (`'QuotaExceededError'`) and caught by `storage-controller.ts` (line 60), which shows the toast "Недостаточно места. Удалите старые карточки." (line 61). Silent saves (debounced auto-saves) suppress the toast — only explicit Ctrl+S or unload-save shows it.
- Save is **debounced 400ms** (`CONFIG.SAVE_DEBOUNCE_MS`) via `scheduleSave()` in `storage-controller.ts` (lines 68–71). A separate `saveOnUnload()` (lines 94–96) does a synchronous final save in the `beforeunload` handler — debounce would be cancelled by the page tear-down.
- No IndexedDB integration exists yet. The TODO (P8.4 in MasterTask) is to add an IndexedDB fallback path triggered when `QuotaExceededError` fires: serialize the card array to IDB, keep settings in localStorage, and surface a "data moved to long-term storage" toast.

## Consequences

- **Positive**:
  - Synchronous read → no loading state on boot; first paint has real data.
  - Per-field keys → small writes; toggling a switch doesn't re-serialize the card array.
  - Every field is validated on read; malicious or stale data is dropped silently to defaults rather than crashing the renderer.
  - Schema migration is centralized in `migrateCard` — adding a new migration case is a one-line edit.
  - The `beforeunload` save guarantees the last user action survives a tab close even if the 400ms debounce timer hasn't fired.

- **Negative**:
  - localStorage's 5–10 MB cap is real. A 100-card deck with custom colors + section styles + word styles can approach ~500 KB JSON; not a quota risk yet, but unbounded growth (e.g. future image embeds) would hit the cap.
  - No IndexedDB fallback means a quota error today is "lose unsaved data" — the toast tells the user to delete cards, but anything past the cap is gone.
  - localStorage is synchronous and runs on the main thread — a 500 KB `JSON.parse` blocks the boot path for tens of milliseconds. Acceptable now, will hurt if decks grow.
  - No multi-tab sync — two tabs editing the same project will overwrite each other on save (last writer wins). No `storage` event listener exists.

- **Neutral**:
  - The `QuotaExceededError` sentinel-string contract between `StorageManager` and `storage-controller` is fragile — refactoring the error message would silently break the toast. A typed error class would be safer but heavier.
  - The `ALLOWED_THEMES` whitelist mismatch (8 entries vs 90 actual themes — see ADR-004) means saved projects using themes outside the 8 are silently downgraded to default on load.

## Verification

- `src/storage/StorageManager.ts` lines 10–22 (KEYS), 38–70 (`save` with quota catch), 72–125 (`load` with per-field validation), 132–195 (`migrateCard`).
- `src/orchestrator/storage-controller.ts` lines 43–66 (`saveCardsToLocalStorage` with `QuotaExceededError` toast), 68–71 (`scheduleSave` debounce), 94–96 (`saveOnUnload`).
- `src/core/utils.ts` lines 81–110 (`sanitizeCardId`, `isValidHexColor`, `clampFontSize`, `isValidTheme`, `isValidFormat`).
- `src/orchestrator/keyboard-controller.ts` lines 82–84 (Ctrl+S → `saveCardsToLocalStorage({ silent: false })`).
- `src/orchestrator/events.ts` line 235 (`beforeunload` → `storage.saveOnUnload`).
- `tests/unit/storage-manager.test.ts`: validation + migration + quota-error path.
