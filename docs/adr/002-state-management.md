# ADR-002: State Management — Custom StateManager with Discriminated Action Union

**Date**: 2025-09-11
**Status**: Accepted

## Context

Cardcraft's state needs are unusual for a CRUD-shaped app. A single user action (e.g. picking a color in the palette modal) must:

1. Update one nested field on one card (`card.colors.title = "#ea580c"`) without mutating sibling data.
2. Notify the preview renderer to do an O(1) DOM patch (`updateCardStyle`).
3. Push a debounced history snapshot for undo/redo (`HistoryManager.schedulePush`, 700ms).
4. Schedule a debounced localStorage save (`scheduleSave`, 400ms).

The state shape has three sub-structures that change at different cadences: `cards.list` (per-keystroke), `settings` (per-control-change), `ui` (transient view state — modal open/closed, active card index, sidebar toggle). The previous orchestrator implementation kept UI state as 5 shadow `let` vars scattered across a 2731-line God Function; mutating them bypassed the dispatcher and silently broke undo/redo.

Audited alternatives:
- **Redux Toolkit**: heavyweight for ~28 actions, pulls in Immer + RTK Query (unused), adds boilerplate.
- **Zustand**: minimal but uses `set(state => …)` callbacks that hide the action → state mapping; harder to grep "what does `SET_CARD_COLOR_FIELD` do?"
- **Valtio**: proxy-based magic; harder to reason about referential identity for `HistoryManager.snapshot()` (deep clone required anyway).

Plus a hard constraint: `HistoryManager<T>` is generic and stores `Snapshot` (cards + settings, **not** UI state — UI state shouldn't be restored on undo). The state container must expose a clean seam between "snapshot-able" state and transient UI state.

## Decision

**Custom `StateManager` class with a discriminated `Action` union — no external state library.**

`src/state/StateManager.ts` (450 lines) holds:

- `AppState` with three sub-structures: `cards`, `settings`, `ui` (lines 24–43).
- A single private `reduce(state, action)` switch with one case per `Action` variant (lines 225–431).
- Read-only selectors: `getCard(idx)`, `getCards()`, `getTheme()`, `getSettings()`, `getUI()`, etc. — no field access leaks to callers.
- One mutation entry point: `dispatch(action: Action)`.
- Subscribe via `subscribe(fn): () => void` returning an unsubscribe handle.
- Snapshot/restore seam: `snapshot(): Snapshot` (cards + settings only) and `restore(snap: Snapshot)` for `HistoryManager`.

The `Action` union (`src/core/types.ts` lines 133–182) is a TypeScript discriminated union. Every dispatch site gets a typed payload; the reducer's case branches receive a typed action. The `default` branch uses `const _exhaustive: never = action` (lines 423–429) — adding a new `Action` variant without a reducer case is a **compile error**, not a runtime surprise.

P1-1 introduced granular mutations to replace direct `card.colors[f] = v` writes: `SET_CARD_COLOR_FIELD`, `DELETE_CARD_COLOR_FIELD`, `SET_SECTION_STYLE_FIELD`, `SET_SECTION_FONT_SIZE`, `RESET_CARD_STYLES` (lines 307–365). Each produces a shallow-cloned card with the patched sub-object — referential identity for unchanged cards is preserved, which keeps React-style equality checks cheap if/when they are introduced.

UI state lives in the same store (`UIState`, lines 96–121) but is never included in snapshots — undo/redo of "modal was open" would be hostile. The `setUI(patch)` convenience method wraps `dispatch({ type: 'SET_UI', payload: patch })`.

## Consequences

- **Positive**:
  - Zero dependencies; ~450 lines of code that anyone on the team can read end-to-end.
  - Full type safety: exhaustive reducer, typed payloads, no `as` casts at dispatch sites.
  - Clean snapshot seam: `HistoryManager<Snapshot>` works because `Snapshot` is a stable, well-defined shape (`src/core/types.ts` lines 47–57).
  - Granular actions mean `card-ops.ts`, `events.ts`, `callbacks.ts` all dispatch single typed intents — no intermediate "apply patch" layer.
  - UI state and persistent state share the same dispatcher but only persistent state is snapshotted, eliminating the shadow-var bug class.

- **Negative**:
  - More boilerplate than Zustand: every new action requires a union member + reducer case + selector (if read) + dispatch site.
  - No devtools integration out of the box (no Redux DevTools, no time-travel UI). Debugging state evolution requires `console.log` patches or hand-rolled instrumentation.
  - The reducer mutates arrays via spread (`[...state.cards.list]`) — fine for ≤100 cards, but a per-keystroke `UPDATE_CARD_FIELD` allocates a new array. Not currently a bottleneck, but worth noting if deck size grows.
  - Selectors are pass-through; no `reselect`-style memoization. Subscribers re-run on every dispatch even if their slice is unchanged.

- **Neutral**:
  - `restore()` deliberately does **not** go through `dispatch` — it bypasses the reducer to avoid firing `RESTORE_SNAPSHOT` recursively. This is the only mutation path outside `dispatch`/`reduce`.

## Verification

- `src/state/StateManager.ts` lines 83–93 (constructor), 156–171 (`dispatch` + listeners), 173–207 (`restore` + `snapshot`), 225–431 (reducer with exhaustive `never` default).
- `src/core/types.ts` lines 133–182 (Action discriminated union).
- `src/orchestrator/events.ts` lines 264–310 (modal color inputs dispatch `SET_CARD_COLOR_FIELD`).
- `src/orchestrator/callbacks.ts` lines 71–82 (input/paste dispatches `UPDATE_CARD_FIELD`).
- `tests/unit/state-manager.test.ts`: covers every action variant + snapshot/restore round-trip.
