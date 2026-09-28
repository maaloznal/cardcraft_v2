# ADR-004: Theme System — `[data-theme="..."]` CSS Attribute Selectors

**Date**: 2025-09-11
**Status**: Accepted

## Context

Cardcraft ships ~90 card themes organized in 4 groups (Светлые, Тёмные, Градиентные, Без фона) — see `src/themes/themeData.ts` (119 lines). Each theme defines 13 CSS custom properties on the card element: `--card-bg`, `--card-border`, `--card-shadow`, `--text-primary`, `--text-secondary`, `--accent-color`, `--accent-glow`, `--progress-bg`, `--btn-accent-bg`, `--btn-accent-border`, `--font-family`, `--preview-bg`, `--cta-text-color`. A theme is selected either globally (sidebar dropdown → `SET_GLOBAL_THEME`) or per-card (modal dropdown → `SET_CARD_THEME` on a single card, overriding the global).

The port had three options for the theme implementation:

1. **CSS attribute selectors** — `[data-theme="editorial-paper"] { --card-bg: …; }` blocks in `themes.css`. Per-card override = setting `data-theme` attribute on the `.card` element. Browser cascade does the work.
2. **CSS-in-JS** (styled-components, emotion) — generate the style string at runtime from a JS theme map.
3. **Tailwind variants** — `data-[theme=editorial-paper]:bg-[#faf7f2]` etc., one utility per CSS property per theme.

The original `index.html` shipped as plain CSS with `[data-theme]` blocks — the entire themes.css (1344 lines today) was ported verbatim. Switching to CSS-in-JS or Tailwind variants would have meant rewriting every theme block (90 × 13 properties = ~1170 declarations) and re-introducing a runtime cost that didn't previously exist.

## Decision

**Keep themes as plain CSS `[data-theme="..."]` attribute-selector blocks in `src/app/styles/themes.css`.**

Implementation:

- `themes.css` (1344 lines, imported last in `card-constructor.css` line 27) contains 90 `[data-theme="..."]` blocks plus the `:root` defaults in `tokens.css`. The default theme (Clean Minimal) is the `:root` baseline; setting `data-theme="editorial-paper"` on a card overrides the root tokens for that element's subtree.
- The renderer applies the theme via a single attribute mutation: `PreviewRenderer.updateCardTheme(card, globalTheme)` (`src/preview/PreviewRenderer.ts` lines 154–160) does `cardNode.setAttribute('data-theme', theme)` or `removeAttribute('data-theme')` for `default`. No style string is built, no class list is toggled — the CSS cascade resolves everything.
- The global theme lives in `stateManager.settings.theme` and is applied to cards that don't have a per-card override (`card.theme === 'default' || !card.theme`).
- The `:root` default + `[data-theme]` cascade ordering is preserved by the `@import` order in `card-constructor.css` (lines 20–28): themes come after `tokens.css` so attribute selectors win over the root defaults; `export.css` comes last so `.cc-root.exporting` overrides win during PNG export.
- `THEME_GROUPS` in `src/themes/themeData.ts` is the single source of truth for the dropdown UI — the same array drives both the global sidebar dropdown and the per-card modal dropdown in `page.tsx`.

## Consequences

- **Positive**:
  - Zero runtime cost: applying a theme is one `setAttribute` call; the browser does the cascade natively. No JS object walking, no style string building.
  - Adding a new theme = appending one `[data-theme="X"] { … }` block to `themes.css` and one entry to `THEME_GROUPS`. No JS, no type changes.
  - Themes are pure CSS — designers can iterate on them without touching TS. The 1344-line file is large but trivially greppable.
  - Per-card override is free: setting `data-theme` on a child element shadows the parent's tokens by CSS cascade rules. No special "merge themes" code.
  - The themes.css file is cacheable forever — themes change only on deploy.

- **Negative**:
  - All 90 theme blocks (~1344 lines, ~30 KB raw) ship in the initial CSS bundle. Every visitor downloads every theme whether they use it or not. (TODO P9.2: lazy-load theme groups via `fetch` + injected `<style>`.)
  - No dead-theme elimination: an unused theme is just dead bytes in the bundle, not detectable by tree-shaking (CSS doesn't tree-shake attribute selectors).
  - `ALLOWED_THEMES` in `src/core/constants.ts` (lines 29–38) currently lists only 8 themes — out of sync with the 90 themes in `themes.css` and `themeData.ts`. This means `StorageManager.load()` rejects saved projects whose theme isn't in the 8-entry whitelist (known issue, separate from this ADR).
  - Renaming a theme = coordinated edits across `themes.css`, `themeData.ts`, and any saved localStorage payloads (the `migrateCard` path in `StorageManager` doesn't rename).

- **Neutral**:
  - The cascade order in `card-constructor.css` is load-bearing — `themes.css` must come before `export.css` and after `tokens.css`. A reordering would silently break the visual output.

## Verification

- `src/app/styles/themes.css` lines 4–18 (first `[data-theme]` block — editorial-paper), file total 1344 lines / 90 `[data-theme=...]` blocks.
- `src/app/card-constructor.css` lines 20–28 (`@import` order: tokens → … → themes → export).
- `src/preview/PreviewRenderer.ts` lines 154–160 (`updateCardTheme` — single attribute mutation), 250–252 (theme whitelist + `data-theme` attribute on card wrapper).
- `src/themes/themeData.ts` lines 7–end (`THEME_GROUPS` array — 4 groups, ~90 entries).
- `src/core/constants.ts` lines 29–38 (`ALLOWED_THEMES` — note the 8-entry whitelist mismatch, to be addressed separately).
