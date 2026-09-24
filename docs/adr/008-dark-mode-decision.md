# ADR-008: Dark Mode — Removed (Not Implemented)

**Date**: 2025-09-11
**Status**: Accepted
**Decision**: Remove dead `.dark` CSS tokens; do NOT implement dark mode.

## Context

The Cardcraft project was scaffolded from a Next.js + shadcn/ui template. The template's `src/app/globals.css` included a `.dark` block with ~31 dark-mode CSS custom properties (oklch color values for `--background`, `--card`, `--primary`, etc.) — the standard shadcn dark theme.

However, the Cardcraft application does NOT use shadcn tokens. The app has its own design system in `src/app/styles/tokens.css` with `--ui-*` custom properties (`--ui-bg`, `--ui-surface`, `--ui-text`, etc.). The shadcn `.dark` tokens were never referenced by any application CSS — verified via `rg "var\(--background\)|var\(--card\)" src/app/styles/` returning zero matches.

MasterTask.md PRIORITY 6 required: audit dark mode, then either (A) implement it fully, or (B) remove the dead tokens. "Не оставлять фантомную функциональность."

## Decision

**Option B — remove the dead `.dark` tokens.**

### Rationale

1. **No existing dark mode to preserve.** The `.dark` block was scaffold boilerplate, never wired up. There was no toggle, no `next-themes` integration (removed earlier), no `.dark` class application anywhere in the codebase.

2. **App design system is incompatible.** The app uses `--ui-*` tokens (zinc palette, near-black accent). A real dark mode would require:
   - Dark variants for ALL `--ui-*` tokens (8 colors + surfaces + borders)
   - Dark variants for 48 card themes (`[data-theme="..."]` blocks — each would need a dark counterpart)
   - Toggle UI + persistence + `prefers-color-scheme` detection
   - Contrast audit for all 48 themes in dark mode
   - This is a multi-week effort with unclear product value.

3. **Card themes are inherently light-mode.** The 48 card themes (editorial-paper, pastel-gradient, warm-peach, etc.) are designed for light backgrounds with light card surfaces. Forcing them into dark mode would break their visual design.

4. **MasterTask guidance**: "Не оставлять фантомную функциональность." Dead code is worse than no code — it misleads developers into thinking a feature exists.

## Consequences

- **Removed**: `.dark` block (~31 tokens) from `src/app/globals.css`; `@custom-variant dark` directive.
- **Kept**: `:root` shadcn tokens (still used by Tailwind base layer for `body { @apply bg-background text-foreground }`).
- **Not added**: dark mode toggle, `next-themes` dependency, dark theme variants.
- **Future**: if dark mode becomes a product requirement, create a new ADR documenting the full implementation plan (including the 48-theme dark variants question).

## Verification

- `rg "\.dark\b" src/app/` → only the ADR reference comment in globals.css
- `rg "var\(--background\)" src/app/styles/` → 0 (app CSS uses `--ui-*`, not shadcn tokens)
- App compiles + all 253 unit + 28 E2E tests pass after removal
- No visual regression (dark tokens were never applied)
