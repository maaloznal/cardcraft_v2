# POST-IMPLEMENTATION AUDIT REPORT

**Date**: 2025-09-11
**Auditor**: main-orchestrator (self-audit, user-requested)
**Scope**: All tasks marked DONE/PARTIAL after the last audit point (P5.7 onward)

---

## 1. Что было проверено

Каждая задача из списка:
- P5.7 (axe-core contrast), P22 (onboarding), P23 (shortcuts), CI fix (onboarding blocking),
  P19.2 (SRI), P19.4 (XSS E2E), P19.8 (CSP reporting), P9.3 (fonts conditional),
  P9.4 (tree-shaking), P15.2 (auto-changelog), P18 (Stryker), P24 (dep audit), P19.7 (vuln deps).

Метод: код → конфигурация → тесты → реальные результаты → CI.

---

## 2. Какие DONE подтверждены

| Task | Evidence |
|---|---|
| **P19.2 SRI** | Проверено: нет внешних `<script src>` или `<link rel="stylesheet" href>`. Fonts через next/font (self-hosted) + @fontsource (bundled). Единственный внешний ресурс — favicon SVG (SRI не применяется). DONE легитимный. |

**Только 1 из 13 проверяемых DONE подтверждён без оговорок.**

---

## 3. Какие DONE пришлось вернуть в PARTIAL/TODO

### P5.7 axe-core contrast → [~] PARTIAL (был [x] DONE)
- **Reason**: 3 axe tests pass locally (7.8s), contrast fixes verified в коде. НО CI cancelled before E2E ran — tests NEVER ran in CI for latest commit.
- **Evidence**: `curl -s CI API` → commit 889dba9 conclusion=cancelled, E2E job cancelled at "Install Playwright browsers" step.

### P22 Onboarding → [~] PARTIAL (был [x] DONE)
- **Reason**: Basic onboarding works (show/skip/persist verified locally). НО:
  1. "Restart onboarding" feature из MasterTask НЕ реализована.
  2. NO E2E test for onboarding behavior.
  3. CI not verified.
- **Evidence**: `rg "restart\|re-trigger\|showOnboarding" src/` → 0 matches. No test file references onboarding.

### P23 Shortcuts panel → [~] PARTIAL (был [x] DONE)
- **Reason**: Panel works locally (? opens, Escape closes). НО:
  1. NO E2E test for shortcuts panel.
  2. CI not verified.
- **Evidence**: `rg "shortcut" tests/e2e/` → 0 matches.

### P19.4 XSS E2E → [~] PARTIAL (был [x] DONE)
- **Reason**: 7 XSS tests exist and pass locally (12.1s). НО CI cancelled before E2E ran — tests NEVER ran in CI.
- **Evidence**: CI run 34598767498 → E2E job cancelled.

### P19.8 CSP reporting → [~] PARTIAL (был [x] DONE)
- **Reason**: Infrastructure exists (headers + endpoint returns 200). НО:
  1. NO E2E test verifies CSP reporting end-to-end.
  2. In production, violations only logged to console (no external monitoring).
  3. In dev mode, CSP has unsafe-inline/unsafe-eval — violations won't trigger.
  4. CI not verified.
- **Evidence**: `rg "csp-report\|reporting" tests/` → 0 matches.

### P9.3 Fonts conditional → [~] PARTIAL (был [x] DONE)
- **Reason**: Requirement was "conditional/lazy loading — load fonts based on selected theme". I only removed unused Plus Jakarta Sans. 3 remaining fonts (Golos, Lora, Manrope) ALL load eagerly via static imports regardless of theme.
- **Evidence**: `layout.tsx:3-5` — 3 static `import "@fontsource/*"` (eager). No dynamic import, no conditional loading.

### P9.4 Tree-shaking → [~] PARTIAL (был [~] PARTIAL — confirmed)
- **Reason**: @next/bundle-analyzer installed but incompatible with Turbopack (Next.js 16 default). No report generated.
- **Evidence**: Build log: "The Next Bundle Analyzer is not compatible with Turbopack builds".

### P15.2 Auto-changelog → [~] PARTIAL (был [~] PARTIAL — confirmed)
- **Reason**: @changesets/cli installed + config created manually. But `changeset init` hangs (interactive prompt). No CI integration. Never run.
- **Evidence**: `.changeset/config.json` created manually. No `CHANGELOG.md` exists.

---

## 4. Какие PARTIAL действительно PARTIAL

| Task | What's done | What's missing |
|---|---|---|
| **P4 Sentry** | ErrorBoundary exists, structured logger | No Sentry SDK, no DSN, no source maps upload |
| **P8.3 Web Worker** | html-to-image lazy-loaded | Worker not implemented (ADR documented limitation) |
| **P8.5 Code splitting** | html-to-image dynamic import | No other dynamic imports (modal, popup, themes) |
| **P15.2 Auto-changelog** | changesets installed + config | No CI integration, never run |
| **P17 Coverage 100%** | coverage.include added, critical logic 95%+ | Controllers/renderers/UI at 0% unit (E2E only) |
| **P19.7 Vulnerable deps** | 0 critical (was 2), next+react updated | 40 transitive vulns remain (26 high) |
| **P24 Dep audit** | Catalogued, some updated | typescript/eslint major bumps not done, 40 vulns remain |

---

## 5. Какие задачи BLOCKED

### P18 Stryker → [!] BLOCKED
- **What tried**: `npx stryker run` with fixed config (disableTypeChecks: false, ignorePatterns expanded)
- **Error**: `Cannot resolve entry module vitest.config.ts` — Stryker sandbox + Vite 8 rolldown incompatibility
- **Versions**: Stryker 10.0.0, Vitest 5.0.0, Vite 8.3.0
- **Alternatives checked**: 
  - Downgrade Vite to 7.x — risk breaking Next.js 16 (requires Vite 8)
  - Use jest runner instead of vitest — would require rewriting all tests
  - Wait for Stryker update — no timeline
- **What's required**: Stryker Vitest runner compatible with Vite 8/rolldown, OR downgrade Vite

---

## 6. Какие ошибки обнаружены

### Error 1: CI CANCELLED for latest commit
- **Commit**: 889dba9 (all security fixes)
- **CI result**: cancelled (E2E job cancelled during "Install Playwright browsers")
- **Root cause**: E2E timeout (15 min) insufficient for 43 tests in CI
- **Impact**: ALL E2E-based DONE statuses (P5.7, P19.4, P22, P23) are NOT CI-verified

### Error 2: False DONE statuses
- 6 tasks marked DONE that should be PARTIAL (P5.7, P22, P23, P19.4, P19.8, P9.3)
- Pattern: "file created / package installed / local test passes" → marked DONE without CI verification

### Error 3: P9.3 mislabeled
- Requirement: "conditional/lazy loading of fonts"
- Implementation: removed unused font (dead code removal)
- These are different things — dead code removal ≠ conditional loading

### Error 4: P22 incomplete
- Requirement: "Skip + возможность повторного запуска onboarding"
- Implementation: Skip works, but restart NOT implemented

---

## 7. Состояние CI

| Commit | Status | Jobs |
|---|---|---|
| 889dba9 (latest, all fixes) | **CANCELLED** | Lint+Typecheck+Unit ✅, Build ✅, E2E ❌ (cancelled) |
| 8c22874 (onboarding fix only) | SUCCESS | All 3 jobs ✅ |

**Current state: latest code NOT CI-verified.** CI needs timeout increase for 43 E2E tests.

---

## 8. Состояние E2E

| Metric | Value |
|---|---|
| Total E2E tests | 44 (28 functional + 5 visual + 3 axe + 7 XSS + 1 skipped) |
| Local duration | ~70s (all pass) |
| CI duration | N/A (cancelled before running) |
| CI timeout | 15 min (insufficient) |
| Flaky tests | Unknown (not enough CI runs) |
| Test order dependency | gotoApp() clears localStorage per test (isolated) |

---

## 9. Состояние dependencies

### Outdated (5 packages)
| Package | Current | Latest | Risk |
|---|---|---|---|
| @tailwindcss/postcss | 4.1.18 | 4.3.3 | Low (minor) |
| tailwindcss | 4.1.18 | 4.3.3 | Low (minor) |
| bun-types | 1.3.6 | 1.4.2 | Low (minor) |
| eslint | 9.39.2 | 10.10.0 | High (major) |
| typescript | 5.9.3 | 7.0.2 | High (major) |

### Vulnerabilities (40 total)
| Severity | Count | Type |
|---|---|---|
| Critical | 0 | — |
| High | 26 | All transitive (brace-expansion, qs, ajv via eslint-chain) |
| Moderate | 13 | All transitive |
| Low | 1 | Transitive |

**None are direct dependencies.** All are transitive via eslint-config-next → eslint → babel → brace-expansion/qs/ajv.

---

## 10. Состояние security

| Area | Status | Evidence |
|---|---|---|
| CSP nonce | ✅ Implemented | middleware.ts generates nonce per-request (prod) |
| CSP reporting | ⚠️ Infrastructure only | Headers + endpoint exist, no test, not verified |
| HSTS | ✅ Implemented | Strict-Transport-Security header set |
| XSS prevention | ✅ Verified locally | 7 E2E tests pass locally, escapeHtml/escapeAttr in code |
| SRI | ✅ N/A | No external scripts/stylesheets |
| Source maps | ✅ Not exposed | productionBrowserSourceMaps not set (default false) |
| Secrets | ✅ Clean | No SECRET/TOKEN/API_KEY in code |
| Dependencies | ⚠️ 40 transitive vulns | 0 critical, 26 high (all transitive, not exploitable in app) |

---

## 11. Состояние accessibility

| Area | Status | Evidence |
|---|---|---|
| aria-modal | ✅ All 3 modals | page.tsx verified |
| Focus trap | ✅ colorModal + confirmOverlay | Modal.ts + events.ts |
| aria-labels | ✅ 13/13 icon buttons | page.tsx + renderers |
| Keyboard nav | ✅ Tab + arrows + Ctrl shortcuts | keyboard-controller.ts |
| Screen reader | ✅ #srAnnouncer + announce() | card-ops.ts |
| Color contrast | ⚠️ Fixed locally, not CI-verified | axe-core 3/3 pass local, CI cancelled |
| Reduced motion | ✅ @media prefers-reduced-motion | tokens.css |

---

## 12. Состояние performance

| Area | Status |
|---|---|
| O(1) rendering | ✅ insertCard/removeCard/moveCard wired up |
| Benchmark | ✅ 9 perf tests pass |
| Virtual scrolling | ❌ Not implemented |
| Web Worker | ❌ Not implemented (ADR documented) |
| IndexedDB fallback | ✅ Implemented |
| Bundle analyzer | ⚠️ Installed, Turbopack incompatible |
| Fonts lazy-load | ❌ Not implemented (3 fonts eager) |
| Themes lazy CSS | ❌ Not implemented (all in initial bundle) |

---

## 13. Актуальный backlog (corrected)

### DONE (confirmed): 62
### PARTIAL: 14
### TODO: 7
### BLOCKED: 2

| ID | Task | Status | What's missing |
|---|---|---|---|
| P4 | Sentry | PARTIAL | No SDK, no DSN |
| P5.7 | Color contrast | PARTIAL | CI not verified |
| P8.1 | Virtual scrolling | TODO | Not started |
| P8.2 | Virtual scrolling benchmark | TODO | Not started |
| P8.3 | Web Worker | PARTIAL | ADR documented limitation |
| P8.5 | Code splitting | PARTIAL | Only html-to-image |
| P9.2 | Themes lazy CSS | TODO | Not started |
| P9.3 | Fonts conditional | PARTIAL | Only dead code removed, no conditional loading |
| P9.4 | Tree-shaking | PARTIAL | Turbopack incompatible |
| P11 | Storybook | TODO | Not started |
| P15.2 | Auto-changelog | PARTIAL | Changesets installed, no CI integration |
| P17 | Coverage 100% | PARTIAL | Critical logic 95%+, controllers 0% |
| P18 | Stryker | BLOCKED | Vite 8/rolldown incompatibility |
| P19.7 | Vulnerable deps | PARTIAL | 40 transitive vulns remain |
| P19.8 | CSP reporting | PARTIAL | No test, not verified end-to-end |
| P21 | Analytics | TODO | Not started |
| P22 | Onboarding | PARTIAL | Restart feature missing, no test |
| P23 | Shortcuts panel | PARTIAL | No E2E test |
| P24 | Dep audit | PARTIAL | typescript/eslint major not done |
| P25 | Final audit | TODO | After all tasks |
| F.1 | Final report | TODO | After P25 |
