# Cardcraft — Architecture

## Layer Overview

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer                          │
│  src/app/page.tsx (React shell — static JSX)        │
│  src/components/ErrorBoundary.tsx                   │
└──────────────────────┬──────────────────────────────┘
                       │ calls initCardCraftApp(root)
┌──────────────────────▼──────────────────────────────┐
│                Orchestrator Layer                    │
│  src/orchestrator/CardCraftApp.ts (1226 lines)      │
│  src/orchestrator/toast.ts                          │
│  src/orchestrator/resizers.ts                       │
│  src/orchestrator/export-mode.ts                    │
└──────────────────────┬──────────────────────────────┘
                       │ uses
┌──────────────────────▼──────────────────────────────┐
│              UI Kit (vanilla JS classes)             │
│  src/ui/Accordion.ts (Accordion, SidebarAccordion,  │
│                       ModalAccordion)                │
│  src/ui/Modal.ts (focus trap + ESC + backdrop)      │
│  src/ui/Switch.ts (checkbox + button based)         │
│  src/ui/Dropdown.ts (click-outside + nested groups) │
└──────────────────────┬──────────────────────────────┘
                       │ dispatches actions to / calls
┌──────────────────────▼──────────────────────────────┐
│                 Rendering Layer                      │
│  src/preview/PreviewRenderer.ts (O(1) updates)      │
│  src/editor/EditorRenderer.ts (event delegation)    │
│  src/word-editor/WordEditorManager.ts               │
└──────────────────────┬──────────────────────────────┘
                       │ dispatches actions to
┌──────────────────────▼──────────────────────────────┐
│                  State Layer                         │
│  src/state/StateManager.ts (18 actions, selectors)  │
│  src/history/HistoryManager.ts (generic <T>)        │
└──────────────────────┬──────────────────────────────┘
                       │ persists via / applies via
┌──────────────────────▼──────────────────────────────┐
│              Infrastructure Layer                    │
│  src/storage/StorageManager.ts                      │
│  src/themes/ThemeManager.ts + themeData.ts          │
│  src/export/ExportManager.ts                        │
│  src/styles/StyleHelpers.ts                         │
└──────────────────────┬──────────────────────────────┘
                       │ uses
┌──────────────────────▼──────────────────────────────┐
│                   Core Layer                         │
│  src/core/types.ts    src/core/constants.ts         │
│  src/core/utils.ts                                  │
└─────────────────────────────────────────────────────┘
```

## Dependency Rules

**Critical rule: lower layers must NOT import from upper layers.**

| Layer | Can import from | Cannot import from |
|---|---|---|
| Core | (nothing — self-contained) | Everything above |
| Infrastructure | Core | State, Rendering, UI, Orchestrator |
| State | Core, Infrastructure | Rendering, UI, Orchestrator |
| Rendering | Core, State, Infrastructure | UI, Orchestrator |
| UI Kit | Core, Infrastructure | State, Rendering, Orchestrator |
| Orchestrator | All layers below | (nothing above) |
| UI Layer | Orchestrator | (none above — top layer) |

## Module Statistics

| Layer | Modules | Lines | Avg module |
|---|---:|---:|---:|
| Core | 3 | 268 | 89 |
| Infrastructure | 5 | 534 | 107 |
| State | 2 | 409 | 205 |
| Rendering | 3 | 972 | 324 |
| UI Kit | 5 | 701 | 140 |
| Orchestrator + helpers | 4 | 1475 | 369 |
| **Total** | **22** | **4359** | **198** |

For comparison: the old God Function was a single 2731-line file.

## Module Responsibilities

### Core Layer
- **types.ts** (102 lines) — All TypeScript interfaces: Card, WordStyle, SectionStyle, Snapshot, Action, ActionType, ThemeGroup, EditorField, ModalField, FieldConfig. No runtime code.
- **constants.ts** (101 lines) — All magic numbers: CONFIG, DEFAULT_THEME, PRESET_COLORS, FORMAT_CHAR_LIMITS, FIELD_LABELS, EDITOR_FIELDS, MODAL_FIELDS, FIELD_CONFIG, SHAPE_PROGRESS_STYLES, MODAL_GROUPS. No functions.
- **utils.ts** (65 lines) — Pure functions: `escapeHtml`, `generateId`, `deepClone`, `splitOnce`, `isWordChar`, `containsWholeWord`, `stripMeta`. No DOM, no state.

### Infrastructure Layer
- **StorageManager.ts** (171 lines) — Only module with localStorage access. `save()`, `load()`, `clear()`, `migrateCard()`. Handles quota errors, corrupted JSON recovery.
- **ThemeManager.ts** (41 lines) — Theme lookup, resolution, application. `getThemeLabel()`, `resolveCardTheme()`, `isNoBgTheme()`, `applyThemeToElement()`.
- **themeData.ts** (118 lines) — Static data: 90 themes in 4 groups (Светлые, Тёмные, Градиентные, Без фона). No functions.
- **ExportManager.ts** (77 lines) — Only module with html-to-image. `generatePng()`, `generateBlob()`, `downloadPng()`, `copyToClipboard()`. Handles HTTPS check, clipboard fallback.
- **StyleHelpers.ts** (127 lines) — Pure style building: `buildSectionStyle()`, `buildListNumStyle()`, `applyWordStylesToText()`, `pruneOrphanWordStyles()`. No DOM mutation.

### State Layer
- **StateManager.ts** (337 lines) — Centralized state with sub-structures (cards, settings, ui). Dispatch/action system with 18 action types. 10+ selectors for read access. `subscribe()` returns unsubscribe function. `snapshot()` for history. `restore()` for undo/redo.
- **HistoryManager.ts** (76 lines) — Generic `<T>` undo/redo stack. `push()`, `schedulePush()` (debounced), `undo()`, `redo()`, `init()`, `clear()`. Undo/redo/push all cancel pending debounced pushes to prevent race conditions.

### Rendering Layer
- **PreviewRenderer.ts** (441 lines) — Renders card preview to `#cardsArea`. Full `render()` O(n) + targeted updates: `updateCardField()` O(1), `updateCardStyle()` O(1), `updateCardTheme()` O(1), `removeCard()` O(1), `insertCard()` O(1), `updateProgressBars()` O(n). Event delegation: 2 listeners (click + dblclick) on container.
- **EditorRenderer.ts** (208 lines) — Renders editor blocks to `#editorCardsList`. `render()`, `onAction()`, `updateCardNumber()` O(1), `collapseLastCard()`. Event delegation: 4 listeners (click, input, focusin, paste) on container.
- **WordEditorManager.ts** (323 lines) — Word styling popup. `open()`, `close()`, `renderWordStyleList()`, `onStyleChange()`, `onRemoveWord()`, `onClear()`, `destroy()`. Self-contained drag, format buttons, color presets, size slider.

### UI Kit (vanilla JS imperative controllers)
- **Accordion.ts** (155 lines) — `Accordion` base class with event delegation. `SidebarAccordion` and `ModalAccordion` convenience subclasses. `toggle()`, `expand()`, `collapse()`, `expandAll()`, `collapseAll()`, `setExclusive()`, `destroy()`.
- **Modal.ts** (178 lines) — Modal controller with focus trap, ESC key, backdrop click. `open()`, `close()`, `toggle()`, `onOpen()`, `onClose()`, `destroy()`. Tab cycling within modal.
- **Switch.ts** (125 lines) — Toggle switch (checkbox or button based). `checked` getter/setter, `toggle()`, `onToggle()`, `destroy()`.
- **Dropdown.ts** (211 lines) — Dropdown menu with click-outside, ESC, nested theme groups. `open()`, `close()`, `toggle()`, `setValue()`, `getValue()`, `onSelect()`, `destroy()`.
- **index.ts** (32 lines) — Barrel export.

### Orchestrator Layer
- **CardCraftApp.ts** (1226 lines) — Main orchestrator. `initCardCraftApp(root)` boots the app, returns cleanup function. Wires up all modules: StateManager, HistoryManager, StorageManager, PreviewRenderer, EditorRenderer, WordEditorManager, UI Kit (Accordion, Modal, Dropdown), ToastQueue, VerticalResize, HorizontalResize. Handles all static event bindings, keyboard shortcuts (Ctrl+Z/Y/S, Escape), document-level click/keydown delegation. Re-exports `THEME_GROUPS` for page.tsx static rendering.
- **toast.ts** (49 lines) — `ToastQueue` class with queue, long-toast bypass (≥10s), auto-dismiss. `show()`, `destroy()`.
- **resizers.ts** (179 lines) — `VerticalResize` (sidebar fixed header height) and `HorizontalResize` (sidebar width) classes. Pointer-based drag, min/max clamping, localStorage persistence. `destroy()` for cleanup.
- **export-mode.ts** (21 lines) — `withExportMode(node, fn)` helper. Adds `.exporting` class, awaits `document.fonts.ready`, calls fn, removes class in finally.

### UI Layer
- **page.tsx** (548 lines) — React shell with static JSX. Renders all DOM elements with IDs/selectors. Calls `initCardCraftApp(root)` in `useEffect`, returns cleanup function.
- **layout.tsx** (56 lines) — Root layout. Wraps children in `<ErrorBoundary>`. Loads fonts (Geist, Golos Text, Lora, Manrope, Plus Jakarta Sans).
- **ErrorBoundary.tsx** (148 lines) — React error boundary. Catches render errors, shows friendly fallback with reload button. Persists last error to localStorage.

## State Structure

```typescript
interface AppState {
  cards: {
    list: Card[];           // Array of card data
  };
  settings: {
    theme: string;          // Global theme
    format: string;         // Card format (auto, instagram, etc.)
    gradientAngle: number;  // 0-360
    showCardNumbers: boolean;
    showProgressBar: boolean;
    progressBarStyle: string;
    listStyleType: string;
    charLimitEnabled: boolean;
  };
  ui: {
    sidebarOpen: boolean;
    activeCardIndex: number | null;
    colorModalOpen: boolean;
    wordPopupOpen: boolean;
    confirmDialogOpen: boolean;
  };
}
```

## Action Types (18 total)

```typescript
type ActionType =
  // Card operations
  | 'ADD_CARD' | 'DELETE_CARD' | 'DUPLICATE_CARD' | 'MOVE_CARD'
  | 'UPDATE_CARD_FIELD' | 'SET_CARD_THEME' | 'CLEAR_ALL'
  // Card style operations
  | 'SET_CARD_COLORS' | 'SET_CARD_SECTION_STYLES'
  | 'SET_CARD_WORD_STYLES' | 'DELETE_CARD_WORD_STYLE'
  // Settings
  | 'SET_GLOBAL_THEME' | 'SET_FORMAT' | 'SET_GRADIENT_ANGLE'
  | 'SET_SHOW_CARD_NUMBERS' | 'SET_SHOW_PROGRESS_BAR'
  | 'SET_PROGRESS_BAR_STYLE' | 'SET_LIST_STYLE' | 'SET_CHAR_LIMIT'
  // Restore
  | 'RESTORE_SNAPSHOT';
```

## Data Flow

```
User interaction (click, type, drag)
  ↓
Orchestrator (CardCraftApp.ts)
  ↓ dispatch(Action)
StateManager.reduce()
  ↓ new AppState
StateManager notifies subscribers
  ↓
Orchestrator subscriber syncs UI controls (selects, toggles, sliders)
  ↓
PreviewRenderer.updateCardField(card, field)  ← O(1) targeted update
EditorRenderer.updateCardNumber(index)        ← O(1) targeted update
  ↓
StorageManager.save(state)          ← debounced 400ms
HistoryManager.schedulePush(snapshot) ← debounced 700ms

Undo/Redo path:
  Ctrl+Z → historyManager.undo() (cancels pending push timer)
    → stateManager.restore(snapshot)
    → renderEditor() + renderPreview() (full rebuild)
    → scheduleSave({ silent: true })
```

## Race Condition Prevention

1. **HistoryManager.undo()/redo()/push()** all cancel pending `schedulePush` timer — prevents stale snapshots from being pushed after undo/redo.
2. **scheduleSave()** always clears existing `saveTimer` before setting new one — only the latest state is saved.
3. **Orchestrator cleanup** calls `unsubscribeState()` to prevent state subscriber leak on React remount.
4. **HistoryManager.clear()** cancels pending timer — prevents stale push after component unmount.

## Cleanup

The orchestrator's cleanup function (returned by `initCardCraftApp`):
- Removes all document-level listeners (tracked via `docListeners` array)
- Removes all element-level listeners (tracked via `elementListeners` array)
- Removes window listeners (beforeunload, error, unhandledrejection)
- Calls `destroy()` on: SidebarAccordion, ModalAccordion, Modal, 2× Dropdown, WordEditorManager, VerticalResize, HorizontalResize, ToastQueue
- Calls `unsubscribeState()` to remove StateManager subscriber
- Clears `saveTimer`
- Calls `historyManager.clear()` (clears history + pending timer)

PreviewRenderer and EditorRenderer don't need `destroy()` — their event listeners are on container elements (`#cardsArea`, `#editorCardsList`) which are removed from DOM by React, automatically garbage-collecting the listeners.

## Migration Status

**Migration complete.** The legacy `src/lib/card-constructor.ts` (2731 lines) has been removed. The app now runs exclusively on the new modular orchestrator (`src/orchestrator/CardCraftApp.ts`).

- `page.tsx` imports `initCardCraftApp` from `@/orchestrator/CardCraftApp`
- No feature flag, no fallback path
- 109/109 smoke tests pass consistently

## Verification

- **Lint**: 0 errors, 0 warnings
- **Smoke tests**: 109/109 passing (verified across multiple runs via Agent Browser)
- **Dependencies**: 17 unused production packages removed
- **Error Boundary**: wraps entire app, persists errors to localStorage
