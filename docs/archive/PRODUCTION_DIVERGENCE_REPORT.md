# Production Divergence Report

## 1. Current repository

- **Branch:** `main`
- **HEAD:** `66d6980726cecc7c04c248747542b457e5d04376`
- **Remote:** `https://github.com/maaloznal/cardcraft_v2.git`
- **Branches:** `main` (local + remote), no other branches
- **Uncommitted changes:** Only `tool-results/` (staged, gitignored content)

## 2. Production

- **Production URL:** `https://maaloznal.github.io/cardcraft_v2/`
- **Deployment type:** `workflow` (GitHub Actions-based)
- **Source:** branch `main`, path `/`
- **Last Pages API build:** SHA `3763f9f02614`, created `2026-09-02`
- **Actual last deploy workflow run:** SHA `da39cc78952b`, created `2026-09-10T07:22:43Z`
- **Build SHA:** `da39cc78952b` (latest successful "Deploy to GitHub Pages" workflow run)
- **Artifact:** `./out` directory (Next.js static export), uploaded via `actions/upload-pages-artifact@v4`

## 3. SHA verification

### `3763f9f` (Pages API reported SHA)
- **Exists locally:** YES (dangling commit in object DB)
- **Exists on remote branch:** NO (not reachable from `origin/main`)
- **Is ancestor of HEAD:** NO
- **Branch containing it:** NONE (dangling — not on any branch)
- **Source code at this SHA:** Does NOT have theme-toggle, auth, supabase, data-ui-theme

### `da39cc7` (actual latest deploy workflow run SHA)
- **Exists locally:** NO (`fatal: Not a valid object name`)
- **Fetchable from remote:** NO (`fatal: couldn't find remote ref`)
- **Exists on remote at ref da39cc7:** YES (accessible via GitHub Contents API)
- **Is ancestor of HEAD:** NO (doesn't exist in our history at all)
- **Branch containing it:** NONE in local repo
- **Source code at this SHA:** HAS theme-toggle (`themeToggleBtn`), auth (`AuthButton`, `AuthContext`), supabase (`@supabase/supabase-js`), `data-ui-theme`, cloud sync (`useCloudSync`, `projectRepository`)

### Conclusion
**The remote `main` branch was force-pushed.** The commit `da39cc7` (and its entire history) was replaced by our current history (starting from `5c087f2` "Initial commit"). The `da39cc7` commits are no longer reachable from `origin/main` but GitHub still has the objects accessible via API.

## 4. Theme toggle origin

- **Found in Git history (local):** NO — `git log --all -S'themeToggleBtn'` returns 0 results for source files
- **Found at `da39cc7` (remote, via API):** YES — `src/app/page.tsx` line 5 contains `import { AuthButton } from '@/auth/AuthButton'` and the page renders `<button class="btn-icon top-bar-btn theme-toggle" id="themeToggleBtn">` with sun/moon SVG icons
- **Branch:** Was on `main` before force-push. Now only accessible via GitHub API at ref `da39cc7`.

### Theme toggle implementation at da39cc7:
- `data-ui-theme="auto"` attribute on `.cc-root` div
- `#themeToggleBtn` button with sun/moon icons
- CSS class `theme-toggle` on button
- Title changes: "Светлая тема" / "Тёмная тема"

## 5. Auth origin

- **Found in Git history (local):** NO — `git log --all -S'supabase' -- src/` returns 0 results
- **Found at `da39cc7` (remote, via API):** YES — full auth implementation exists:
  - `src/auth/AuthButton.tsx` (2,569 bytes)
  - `src/auth/AuthContext.tsx` (7,952 bytes)
  - `src/lib/supabase.ts` (1,626 bytes) — Supabase client singleton
  - `src/lib/projectRepository.ts` (3,137 bytes) — cloud project sync
  - `src/lib/useCloudSync.ts` (2,660 bytes) — React hook for cloud sync
  - `src/lib/paths.ts` (840 bytes)
  - `src/types/global.d.ts` (575 bytes) — Window types for cloud sync bridge
  - `@supabase/supabase-js` in package.json dependencies
  - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in .env.example
  - CSP includes `connect-src 'self' ${supabaseUrl} https://*.supabase.co`
- **Branch:** Was on `main` before force-push.

## 6. Deployment chain

```
da39cc7 (Sep 10, latest production code with auth + theme toggle)
  ↓
"Deploy to GitHub Pages" workflow (.github/workflows/deploy.yml)
  ↓ trigger: push to main
  ↓ checkout da39cc7
  ↓ npm ci
  ↓ npm run build (next build → output: "export" → ./out)
  ↓ actions/upload-pages-artifact@v4 (path: ./out)
  ↓ actions/deploy-pages@v4
  ↓ GitHub Pages serves the artifact
```

**Critical:** The `deploy.yml` workflow does NOT exist in our current HEAD. It existed at `da39cc7` but was removed when the history was force-pushed. The workflow is still registered on GitHub (visible in Actions UI) but since `deploy.yml` no longer exists in the current `main`, **the workflow will not trigger on future pushes**.

The last successful deploy was Sep 10 from `da39cc7`. Since then, our force-push replaced `main` with code that has no `deploy.yml`, no auth, no theme toggle. But the **old artifact from Sep 10 is still being served** by GitHub Pages.

## 7. Root cause

**The remote `main` branch was force-pushed, replacing the entire commit history.**

Timeline:
1. **Sep 2:** Commit `3763f9f` — "Configure for GitHub Pages static export" (has `deploy.yml`, `output: "export"`, but NO auth/theme-toggle yet)
2. **Sep 9-10:** Commits `e95e74de` → `da39cc7` — auth, theme toggle, Supabase, cloud sync added. "Deploy to GitHub Pages" workflow runs 4 times, all successful. Production deployed from `da39cc7`.
3. **Sep 10-11:** Our sandbox session started. The initial repo state had a **different history** starting from `5c087f2` "Initial commit". This history diverged from the `da39cc7` history. When we pushed our changes, **it was a force-push** that replaced the entire `main` branch.
4. **Sep 11:** Our code (without auth, theme-toggle, deploy.yml) is now on `main`. But GitHub Pages continues serving the **old artifact** from `da39cc7` because:
   - The `deploy.yml` workflow no longer exists in our code → no new deploys
   - GitHub Pages keeps the last successfully deployed artifact

**Evidence of force-push:**
- `da39cc7` exists on GitHub (accessible via API) but NOT in our local git history
- `da39cc7` is NOT reachable from `origin/main` (our current HEAD)
- `3763f9f` (Pages API SHA) is a dangling commit locally — was force-pushed away
- `git reflog show origin/main` doesn't go back far enough to show the force-push
- The merge base between `3763f9f` and HEAD is `5b30676` — they share NO recent common ancestor

## 8. Files at da39cc7 that don't exist in our HEAD

| Path | Size | Purpose |
|---|---|---|
| `.github/workflows/deploy.yml` | ~1KB | GitHub Pages deployment workflow |
| `src/auth/AuthButton.tsx` | 2,569B | Login/logout button component |
| `src/auth/AuthContext.tsx` | 7,952B | Auth state context provider |
| `src/lib/supabase.ts` | 1,626B | Supabase client singleton |
| `src/lib/projectRepository.ts` | 3,137B | Cloud project sync |
| `src/lib/useCloudSync.ts` | 2,660B | React hook for cloud sync |
| `src/lib/paths.ts` | 840B | Path utilities |
| `src/types/global.d.ts` | 575B | Window types for cloud sync |
| `@supabase/supabase-js` | — | NPM dependency (in package.json) |

## 9. Differences in page.tsx (da39cc7 vs our HEAD)

| Feature | da39cc7 (production) | Our HEAD |
|---|---|---|
| AuthButton import | `import { AuthButton } from '@/auth/AuthButton'` | None |
| Theme toggle button | `<button id="themeToggleBtn" class="theme-toggle">` with sun/moon icons | None |
| `data-ui-theme` | `data-ui-theme="auto"` on `.cc-root` | None |
| CSP | Includes `connect-src 'self' ${supabaseUrl} https://*.supabase.co` | No supabase in CSP |
| Output mode | `output: "export"` (static export for GitHub Pages) | `output: "standalone"` |
| Build tool | `npm ci` + `npm run build` | `bun install` + `bun run dev` |
| useEffect | `useEffect` | `useLayoutEffect` (our fix) |
| Onboarding | None | Onboarding overlay |
| Shortcuts panel | None | Shortcuts panel |
| Sentry | None | Sentry integration |
| E2E tests | None | 58 E2E tests |
| Accessibility | None | axe-core, focus trap, screen reader |

## 10. Recommended next action

**Option A: Merge da39cc7 code into our codebase**
1. Download all files from `da39cc7` that don't exist in our HEAD (auth, lib, deploy.yml, etc.)
2. Integrate theme-toggle + auth into our page.tsx
3. Restore `deploy.yml` workflow
4. Switch from `output: "standalone"` to `output: "export"` for GitHub Pages
5. Merge our improvements (Sentry, E2E tests, accessibility, O(1) rendering) with their features (auth, theme toggle, cloud sync)
6. Fix Bug #2 (theme toggle double-click) in the merged code
7. Fix Bug #4 (logout data leak) in the merged code
8. Push and trigger new deployment

**Option B: Start fresh from da39cc7**
1. Reset to `da39cc7` (losing all our work)
2. Re-apply our improvements as patches

**Recommendation: Option A** — preserve both codebases. Our code has significant improvements (tests, security, accessibility, performance) that da39cc7 lacks. da39cc7 has features (auth, theme toggle, cloud sync) that our code lacks.
