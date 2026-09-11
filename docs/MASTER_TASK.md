# MASTER TASK — Cardcraft Production-Ready Roadmap

> **Source of truth** for the Cardcraft production-readiness work.
> Derived from `upload/MasterTask.md` (1270 lines, 30KB).
> Status legend: `[ ]` TODO · `[~]` IN_PROGRESS · `[x]` DONE · `[!]` BLOCKED
>
> Each task lists: **Requirement** · **Current state** · **What's left** · **Verification**.
> A task is `[x]` only when implementation exists, is integrated, TS+lint+tests pass, and the result is factually verified.

---

## ETAP 0 — Полный аудит

- [x] **0.1 Изучить существующий проект** — выполнено в рамках 4 параллельных аудиторских субагентов (architecture/testing/security-a11y/dx-ux). Доказательства в `worklog.md` (Task IDs: audit-architecture, audit-testing-ci, audit-security-a11y, audit-dx-ux).
- [x] **0.2 Проверить package.json, структуру, Next.js config, тесты, CI, deployment, документацию** — выполнено.
- [x] **0.3 Определить, какие пункты уже реализованы** — выполнено (см. статусы ниже).
- [x] **0.4 Создать `docs/MASTER_TASK.md`** — этот файл.

---

## PRIORITY 1 — РЕНДЕРИНГ И O(1) ОПЕРАЦИИ

### 1.1 data-card-id
- [x] **Замена `data-index` на стабильный `data-card-id`**
  - **Done**: `PreviewRenderer.ts:262` — `id="card-node-${safeCardId}"` ✓; `:268-275` — все field elements используют `data-card-id="${safeCardId}"` ✓; `:281` — delete-preview использует `data-card-id` ✓; `:235,347` — list items используют `data-card-id` ✓; `callbacks.ts:37,44` — resolve index from cardId ✓; `:305` — createFieldElement использует `data-card-id` ✓.
  - **Verify**: grep `data-index` в PreviewRenderer → только в updateProgressBars (убрано). E2E — delete после reorder работает.

### 1.2 Add → insertCard()
- [x] **Add card использует `previewRenderer.insertCard()` вместо full rebuild**
  - **Done**: `card-ops.ts:48-51` — addCard вызывает `editorRenderer.insertCard()` + `previewRenderer.insertCard()` вместо full rebuild. Agent Browser verified: add → O(1) insertion.
  - **Verify**: E2E — add card не сбрасывает scroll/inputs других карточек.

### 1.3 Delete → removeCard()
- [x] **Delete card использует `previewRenderer.removeCard()` вместо full rebuild**
  - **Done**: `card-ops.ts:65-68` — deleteCard вызывает `editorRenderer.removeCard(idx)` + `previewRenderer.removeCard(cardId)`. Agent Browser verified.
  - **Verify**: E2E — delete правильной карточки после reorder.

### 1.4 Duplicate → локальное DOM-обновление
- [x] **Duplicate вставляет копию после оригинала через `insertCard()`**
  - **Done**: `card-ops.ts:80-85` — duplicateCard вызывает `editorRenderer.insertCard(copy, idx+1, total)` + `previewRenderer.insertCard(copy, idx+1, total, settings)`. Agent Browser verified: copy появляется сразу после оригинала.
  - **Verify**: E2E — после duplicate новая карточка сразу за оригиналом.

### 1.5 Move → локальная перестановка DOM
- [x] **Move делает DOM swap, а не full rebuild**
  - **Done**: `card-ops.ts:93-103` — moveCard вызывает `editorRenderer.moveCard(idx, newIdx)` (DOM swap) + preview wrapper swap. Agent Browser verified.
  - **Verify**: E2E — move не сбрасывает scroll/focus.

### 1.6 Progress → updateProgressBars()
- [x] **Изменение progress bar использует `updateProgressBars()`**
  - **Done**: toggle visibility — O(1) через CSS класс ✓; style change — `events.ts:128` вызывает `previewRenderer.updateProgressBars()` вместо full rebuild ✓. Agent Browser verified: 6 shape progress bars после смены style.
  - **Verify**: E2E — смена progress style не перерисовывает карточки.

### 1.7 Theme → updateCardTheme()
- [x] **Изменение темы карточки использует `updateCardTheme()`**
  - **Done**: per-card theme change — O(1) ✓ (`modal-controller.ts`); global theme change — `events.ts:52` O(n) loop `updateCardTheme()` по всем карточкам ✓ (вместо full rebuild). Agent Browser verified: 7 cards с ocean-breeze после global change.
  - **Verify**: E2E — global theme change не сбрасывает inputs.

### 1.8 Undo/Redo после локальных DOM-операций
- [x] **Undo/Redo работает для: add, delete, duplicate, move, text, theme, progress**
  - **Done**: card ops + per-card styles ✓; **global settings теперь в snapshot** ✓ — `Snapshot` расширен до полного SettingsState (theme, format, gradientAngle, showCardNumbers, showProgressBar, progressBarStyle, listStyleType, charLimitEnabled). Все 7 topbar handlers добавили `pushHistory()`. `restore()` восстанавливает все settings. Agent Browser verified: theme change → undo → theme restored; progress style → undo → restored.
  - **Verify**: E2E — undo после смены progress style возвращает стиль; unit-тест на snapshot/restore всех settings (253/253 pass).

### 1.9 Performance verification (10/50/100 cards benchmark)
- [ ] **Benchmark для structural операций на 10/50/100 карточках**
  - **Current**: `tests/smoke-test.js:177-190` — micro-benchmark "20 keystrokes <50ms" только для typing. Нет benchmark для add/delete/duplicate/move.
  - **Left**: создать `tests/perf/render-bench.test.ts` — измерить add/delete/duplicate/move на 10/50/100 карточках до/после O(1) рефакторинга.
  - **Verify**: отчёт с реальными цифрами (не подогнанными).

---

## PRIORITY 2 — E2E TESTING

- [ ] **2.0 Установить Playwright** — `bun add -d @playwright/test` + `playwright.config.ts`.
- [ ] **2.1 Приложение запускается** — E2E: `page.goto('/')` → 200 + title.
- [ ] **2.2 Пользователь видит интерфейс** — E2E: top-bar, sidebar, workspace visible.
- [ ] **2.3 Создание карточки** — E2E: click "Добавить" → card count +1.
- [ ] **2.4 Редактирование карточки** — E2E: type in title → preview updates.
- [ ] **2.5 Удаление** — E2E: click delete → card count -1.
- [ ] **2.6 Duplicate** — E2E: click duplicate → card count +1, copy after original.
- [ ] **2.7 Move** — E2E: move down/up → order changes.
- [ ] **2.8 Undo** — E2E: Ctrl+Z → reverts last action.
- [ ] **2.9 Redo** — E2E: Ctrl+Y → reapplies.
- [ ] **2.10 Изменение темы** — E2E: select theme → preview theme changes.
- [ ] **2.11 Изменение progress** — E2E: change progress style → preview updates.
- [ ] **2.12 Открытие color modal** — E2E: click "Стили" → modal visible.
- [ ] **2.13 Экспорт** — E2E: click "Скачать" → PNG downloaded (mock download).
- [ ] **2.14 Cancel** — E2E: start batch export → Escape → cancel toast.
- [ ] **2.15 Импорт JSON** — E2E: upload JSON file → cards loaded.
- [ ] **2.16 Повторная загрузка состояния** — E2E: reload page → state persisted.
- [ ] **2.17 Keyboard navigation** — E2E: Tab through cards, Enter to edit.
- [ ] **2.18 Modal behavior** — E2E: ESC closes, focus trap, backdrop click.
- [ ] **2.19 Отсутствие критических console errors** — E2E: `page.console` listener, 0 errors.
- [ ] **2.20 Базовый smoke test** — E2E: combined happy path.
  - **Current**: `tests/smoke-test.js` покрывает ~10/20 через agent-browser (НЕ Playwright). Playwright не установлен.
  - **Left**: установить Playwright, написать все 20 сценариев (минимум; можно больше если архитектура требует).
  - **Verify**: `bun run playwright test` — все тесты green.

---

## PRIORITY 3 — CI/CD

- [ ] **3.1 Создать `.github/workflows/ci.yml`**
  - **Current**: `.github/` не существует.
  - **Left**: workflow с шагами: `bun install`, `bun run lint`, `bun run tsc --noEmit` (нужно добавить script в package.json), `bun run test`, `bun run playwright test`.
- [ ] **3.2 CI падает при lint error / TS error / failed test / failed E2E**
  - **Left**: каждый шаг — отдельный job или `set -e`.
- [ ] **3.3 PR checks**
  - **Left**: workflow triggers on `pull_request`.
- [ ] **3.4 Preview deployment**
  - **Current**: нет Vercel/Netlify конфига.
  - **Left**: добавить `vercel.json` или интегрировать существующий deployment (не добавлять новую платформу).
- [ ] **3.5 Production deployment**
  - **Left**: workflow on `push: main` → deploy.
  - **Verify**: CI green на PR; preview URL в comment.

---

## PRIORITY 4 — MONITORING / ERROR REPORTING

- [~] **4.1 Production error monitoring (Sentry или аналог)**
  - **Current**: `ErrorBoundary.tsx:41-58` — `componentDidCatch` пишет в `console.error` + localStorage. `CardCraftApp.ts:81-88` — window error/unhandledrejection → console. Нет Sentry/другого SDK.
  - **Left**: установить `@sentry/nextjs`, настроить DSN через env, интегрировать в ErrorBoundary + boot error handlers, настроить source maps upload, release identification, breadcrumbs для dispatch-ей.
  - **Blocker**: требует Sentry DSN (нужен аккаунт). Если невозможно без секретов — сделать максимально возможную интеграцию + отметить блокер.
  - **Verify**: тестовая ошибка → видна в Sentry dashboard.

---

## PRIORITY 5 — ACCESSIBILITY

### Modals
- [~] **5.1 `aria-modal="true"` на всех модальных окнах**
  - **Current**: `colorModal` (`page.tsx:306`) — `aria-modal="true"` ✓; `wordStylePopup` (`:468`) — `aria-label` есть, `aria-modal` НЕТ ✗; `confirmOverlay` (`:531`) — НЕТ `role`/`aria-modal` ✗.
  - **Left**: добавить `aria-modal="true"` + `role="dialog"` на wordStylePopup + confirmOverlay.
- [~] **5.2 Focus trap (Tab/Shift+Tab cycles within modal)**
  - **Current**: `Modal.ts:144-157` — trap только для colorModal ✓. WordEditorManager — НЕТ ✗. ConfirmOverlay — НЕТ ✗.
  - **Left**: вынести focus trap в утилиту, применить ко всем 3 overlay.
- [ ] **5.3 Открытие/закрытие/ESC/возврат focus/Tab/Shift+Tab** — проверить все 3 модалки.

### Icon buttons
- [x] **5.4 `aria-label` на всех icon-only кнопках**
  - **Current**: 13/13 — toggleSidebarBtn, undoBtn, redoBtn, addCardBtn, closeModalBtn, color input, reset color, collapse, duplicate, move-up, move-down, delete, download, copy. Все с aria-label.
  - **Verify**: grep `aria-label` в page.tsx + EditorRenderer.ts + PreviewRenderer.ts.

### Keyboard navigation
- [ ] **5.5 Tab/Shift+Tab/Enter/Escape/Arrow keys**
  - **Current**: Tab работает нативно; Enter не открывает редактирование; Escape закрывает модалки (keyboard-controller.ts:28-60); Arrow keys НЕ используются для move.
  - **Left**: добавить arrow-key handlers для перемещения карточек (когда фокус на card header); Enter для открытия color modal.
  - **Verify**: E2E — переместить карточку только клавиатурой.

### Screen reader
- [~] **5.6 Announcements для: card added/deleted/moved, color changed**
  - **Current**: `aria-live="polite"` на `cardCountBadge` (`page.tsx:83`) + `toast` (`:541`); `role="alert"` на ErrorBoundary. НЕТ явных announcements "Карточка добавлена" и т.д.
  - **Left**: добавить `aria-live` region для явных сообщений; обновлять текст при card add/delete/move/color change.
  - **Verify**: screen reader тест (axe-core или VoiceOver).

### Color contrast
- [ ] **5.7 WCAG 2.1 AA contrast audit**
  - **Current**: нет tooling (Lighthouse/axe-core).
  - **Left**: добавить `@axe-core/playwright` в E2E; исправить реальные нарушения.
  - **Verify**: axe-core 0 violations на main flows.

### Reduced motion
- [ ] **5.8 `prefers-reduced-motion`**
  - **Current**: grep `prefers-reduced-motion` в `src/app/styles/*` → 0 совпадений.
  - **Left**: добавить media query во все CSS с анимациями (sidebar accordion, modal slide, toast, dropdown).
  - **Verify**: `matchMedia('(prefers-reduced-motion: reduce)')` — анимации отключены.

---

## PRIORITY 6 — DARK MODE

- [~] **6.1 Аудит dark mode + решение (реализовать ИЛИ удалить)**
  - **Current**: `src/app/globals.css:81-113` — 31 shadcn `.dark` token (dead, не используется app CSS); `src/app/styles/tokens.css` — только `:root`, НЕТ `.dark` вариантов. Toggle не существует. `next-themes` удалён.
  - **Left**: **решение** — (A) реализовать: добавить `.dark` варианты в tokens.css для всех `--ui-*`/`--text-*`, добавить toggle в top-bar, persistence, контраст; ИЛИ (B) удалить `.dark` блок из globals.css. Решение документировать в ADR.
  - **Verify**: если A — toggle работает, контраст AA; если B — `grep ".dark" src/app/` → 0.

---

## PRIORITY 7 — LIVE PREVIEW

- [~] **7.1 Color/style modal с split-screen (контролы | preview) на desktop**
  - **Current**: modal slides OVER preview (rgba backdrop + blur). Live updates РАБОТАЮТ (`events.ts:222-242` → `previewRenderer.updateCardStyle()`). НО split-screen НЕТ — preview перекрыт modal.
  - **Left**: на desktop (≥1024px) — layout `контролы | preview` side-by-side; на mobile — адаптированный UX. Real-time update уже есть.
  - **Verify**: E2E — открыть modal, видеть карточку, менять цвет — preview обновляется без закрытия modal.

---

## PRIORITY 8 — LARGE PROJECT PERFORMANCE

- [ ] **8.1 Исследовать производительность на 100/250/500 карточках**
  - **Left**: benchmark (если архитектура позволяет); решить нужен ли virtual scrolling.
- [ ] **8.2 Virtual scrolling (если нужно)**
  - **Current**: `EditorRenderer.ts:41-47` + `PreviewRenderer.ts:55-61` — full render, нет windowing.
  - **Left**: если benchmark покажет тормоза на 50+ — реализовать virtual scrolling (например, `@tanstack/react-virtual` или custom IntersectionObserver).
  - **Verify**: 500 карточек — smooth scroll, <100ms add/delete.
- [~] **8.3 Web Worker для html-to-image**
  - **Current**: `ExportManager.ts:14-22` — lazy-load через dynamic import ✓. Worker НЕТ.
  - **Left**: исследовать — html-to-image требует DOM (clones nodes), worker migration non-trivial (XMLSerializer → worker → OffscreenCanvas). Если технически невозможно — зафиксировать как ограничение в ADR.
  - **Verify**: если реализовано — export не блокирует main thread; если нет — ADR с обоснованием.
- [ ] **8.4 IndexedDB fallback при quota exceeded**
  - **Current**: `StorageManager.ts:38-70` — только localStorage; на QuotaExceededError throws. `storage-controller.ts:60-61` — toast "Недостаточно места".
  - **Left**: `src/storage/IndexedDBBackend.ts` с тем же `save/load/clear` interface; auto-migrate при quota exceeded.
  - **Verify**: unit-тест — mock quota exceeded → данные сохраняются в IndexedDB → load восстанавливает.
- [ ] **8.5 Code splitting (dynamic import где уменьшает initial bundle)**
  - **Current**: только `html-to-image` lazy-loaded. Modal/popup/theme data — статически.
  - **Left**: dynamic import для color modal, word popup, theme data — загружать при первом использовании.

---

## PRIORITY 9 — BUNDLE OPTIMIZATION

- [ ] **9.1 `@next/bundle-analyzer`**
  - **Current**: не установлен.
  - **Left**: `bun add -d @next/bundle-analyzer`, wrap `next.config.ts`, `"analyze": "ANALYZE=true next build"`.
- [ ] **9.2 48 тем в lazy-loaded CSS**
  - **Current**: `themes.css` (1344 строки, 47 `[data-theme]` блоков) — статически импортирован, грузится в initial bundle.
  - **Left**: вынести themes.css в отдельный chunk, lazy-load (или только нужные темы).
- [ ] **9.3 Fonts conditional loading**
  - **Current**: `layout.tsx:3-6` — 4 eager `@fontsource/*` import. 3 из 4 не используются пока тема не выбрана.
  - **Left**: lazy-load fonts по выбранной теме.
- [ ] **9.4 Tree-shaking audit + удалить dead code**
  - **Left**: после analyzer — найти неиспользуемые экспорты; удалить (не rare code, а реально мёртвый).
  - **Verify**: `bun run analyze` — отчет; сравнить размер initial bundle до/после.

---

## PRIORITY 10 — DESIGN SYSTEM

- [~] **10.1 Расширить design tokens до полного набора**
  - **Current**: `tokens.css` (63 строки) — есть: colors ✓, radii ✓, shadows ✓, transitions ✓, typography (частично — только `--font-family`). **НЕТ**: spacing, font sizes scale, line heights, z-index.
  - **Left**: добавить `--space-*` (4/8/12/16/24/32/48px scale), `--fs-*` (12/14/16/18/24/32px scale), `--lh-*` (1.2/1.4/1.6), `--z-*` (dropdown/modal/toast/tooltip); заменить хардкод в CSS на токены.
  - **Verify**: grep `padding: \d+px` в `src/app/styles/*` → 0 (всё через `var(--space-*)`).

---

## PRIORITY 11 — STORYBOOK

- [ ] **11.1 Установить Storybook (если оправдано)**
  - **Current**: не установлен.
  - **Left**: `bunx storybook@latest init`, настроить под vanilla TS modules (не React-компоненты — использовать Storybook MDX + CSF с DOM render).
- [ ] **11.2 Stories для: Card, CardEditor, Modal, ColorModal, Toast, Dropdown, Buttons, inputs, progress, theme selector**
  - **Left**: создать `*.stories.tsx` для каждого.
  - **Verify**: `bun run storybook` — все stories рендерятся.

---

## PRIORITY 12 — ADR

- [ ] **12.1 Создать `docs/adr/`**
  - **Current**: `docs/` содержит только `architecture.md`. `docs/adr/` не существует.
  - **Left**: создать ADR для реальных решений:
    - `001-rendering-strategy.md` (почему vanilla TS рендеринг, не React)
    - `002-state-management.md` (StateManager + typed Action union)
    - `003-card-identifiers.md` (data-card-id vs data-index)
    - `004-theme-system.md` (48 тем, per-card override)
    - `005-persistence.md` (localStorage + IndexedDB fallback)
    - `006-export-architecture.md` (lazy-load html-to-image, cancel, web worker ограничение)
    - `007-undo-redo-snapshot-scope.md` (что входит в snapshot)
    - `008-dark-mode-decision.md` (реализовать или удалить — P6)
  - **Verify**: 6-8 ADR с реальными решениями.

---

## PRIORITY 13 — JSDoc / PUBLIC API

- [~] **13.1 JSDoc на controllers, state manager, renderer, public utils, exported functions**
  - **Current**: file-level JSDoc на всех controllers ✓; per-method `/** */` на StateManager ✓ (100%); per-method на controllers — НЕТ ✗. Эффективно ~70%.
  - **Left**: добавить per-method JSDoc на public API всех controllers (`addCard`, `deleteCard`, `openColorModal`, `undo`, `generateAndDownloadPng` и т.д.) + PreviewRenderer/EditorRenderer public methods.
  - **Verify**: `grep -L "/**" src/orchestrator/*.ts` → только файлы без public API.

---

## PRIORITY 14 — HUSKY

- [ ] **14.1 Pre-commit checks (lint + typecheck + relevant tests)**
  - **Current**: husky не установлен, `.husky/` не существует.
  - **Left**: `bun add -d husky lint-staged`, `bun run prepare` → husky init, `.husky/pre-commit` запускает lint-staged (lint staged files + `tsc --noEmit` + relevant tests). Не тяжёлый — разработчики не будут обходить.
  - **Verify**: `git commit` с сломанным файлом → отклоняется.

---

## PRIORITY 15 — CONVENTIONAL COMMITS

- [ ] **15.1 Настроить commitlint + Conventional Commits**
  - **Current**: commitlint не установлен; recent commits — UUID (не conventional).
  - **Left**: `bun add -d @commitlint/cli @commitlint/config-conventional`, `.commitlintrc.json` с правилами feat/fix/refactor/perf/test/docs/chore, husky `commit-msg` hook.
- [ ] **15.2 Автоматический changelog (если соответствует workflow)**
  - **Left**: `semantic-release` или `@changesets/cli` — выбрать по workflow.
  - **Verify**: `git commit -m "bad message"` → отклоняется; `feat: add X` → проходит.

---

## PRIORITY 16 — VISUAL REGRESSION

- [ ] **16.1 Visual regression через Playwright screenshots**
  - **Current**: ничего нет.
  - **Left**: `toHaveScreenshot()` в Playwright; покрыть: основные темы (5-10), карточка, editor, preview, modal, dropdown, dark/light mode (если dark реализован), export preview.
  - **Verify**: `bun run playwright test --update-snapshots` → diff <5% на повторном запуске.

---

## PRIORITY 17 — TEST COVERAGE 100%

- [~] **17.1 100% meaningful logic coverage**
  - **Current**: 95.6% stmts / 94% branch / 96.5% funcs — **НО только по 5 файлам** (`core/`, `history/`, `state/`, `storage/`). `vitest.config.ts` — НЕТ `coverage.include`, поэтому ~40 файлов в `src/orchestrator/`, `src/preview/`, `src/editor/`, `src/word-editor/`, `src/ui/`, `src/styles/`, `src/themes/`, `src/export/` **не измеряются**.
  - **Left**: (a) добавить `coverage: { provider: 'v8', include: ['src/**/*.ts'], thresholds: { lines: 95 } }` в vitest.config.ts; (b) написать unit-тесты для PreviewRenderer, EditorRenderer, WordEditorManager, контроллеров, ExportManager; (c) не гнаться за 100% бессмысленными тестами — критические ветки + error paths.
  - **Verify**: `bun run test --coverage` — real coverage по всем src/ файлам.

---

## PRIORITY 18 — MUTATION TESTING

- [ ] **18.1 Stryker на критической бизнес-логике**
  - **Current**: Stryker не установлен.
  - **Left**: `bun add -d @stryker-mutator/core @stryker-mutator/vitest-runner`, `stryker.conf.json` таргет: `src/state/StateManager.ts`, `src/history/HistoryManager.ts`, `src/storage/StorageManager.ts`, `src/orchestrator/card-ops.ts`, `src/core/utils.ts`. Запустить, исправить слабые тесты.
  - **Verify**: mutation score >80% на критических модулях.

---

## PRIORITY 19 — SECURITY HARDENING

- [~] **19.1 CSP hardened (nonce-based, без unsafe-eval/unsafe-inline)**
  - **Current**: `next.config.ts:14-26` — `script-src 'self' 'unsafe-eval' 'unsafe-inline'`. НЕТ nonce.
  - **Left**: Next.js middleware для генерации nonce per-request, CSP с `'nonce-<random>'`; убрать `unsafe-eval` `unsafe-inline`.
  - **Verify**: CSP header в response — nonce-based; app работает (no CSP violations in console).
- [ ] **19.2 SRI (Subresource Integrity)**
  - **Current**: нет `integrity=` атрибутов. Внешний icon URL (`layout.tsx:34`) без integrity.
  - **Left**: добавить SRI на внешние ресурсы; для self-hosted — не требуется.
- [ ] **19.3 Security headers (HSTS, etc.)**
  - **Current**: X-Content-Type-Options ✓, Referrer-Policy ✓, X-Frame-Options:DENY ✓, X-XSS-Protection ✓. **НЕТ** Strict-Transport-Security.
  - **Left**: добавить HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).
- [ ] **19.4 XSS audit (HTML rendering, imported JSON, user content)**
  - **Current**: `escapeHtml`/`escapeAttr` на всех dynamic insertions ✓; `sanitizeCardId` ✓; localStorage validation ✓.
  - **Left**: E2E тест с XSS payload во всех полях; audit importJSON path.
- [x] **19.5 Source maps не exposed в production**
  - **Current**: `productionBrowserSourceMaps` не установлен в next.config.ts → default false в prod ✓.
- [x] **19.6 No exposed secrets**
  - **Current**: только `process.env.NODE_ENV` в ErrorBoundary. No SECRET/TOKEN/API_KEY ✗.
- [~] **19.7 Vulnerable dependencies**
  - **Current**: `bun audit` после обновления next до 16.3.4 — **37 уязвимостей** (0 critical, 26 high, 10 moderate, 1 low). Critical RCE закрыты. Оставшиеся — transitive (browserslist, picomatch) через eslint-chain — не runtime.
  - **Left**: обновить sharp, eslint-chain; проверить каждый major bump на совместимость.
  - **Verify**: `bun audit` — 0 critical (✓ done); цель 0 high.
- [ ] **19.8 CSP reporting**
  - **Current**: нет `report-to` / `report-uri`.
  - **Left**: добавить `report-to` directive + `Reporting-Endpoints` header + endpoint (если deployment позволяет).

---

## PRIORITY 20 — STRUCTURED LOGGING

- [~] **20.1 Заменить `console.*` на structured logger**
  - **Current**: 8 `console.*` вызовов — `console.log` (1, CardCraftApp.ts:208), `console.error` (6: ErrorBoundary:43, helpers:76, ui-appliers:108,118, CardCraftApp:82,85), `console.warn` (1, helpers:94). Нет structured logger (pino/winston/loglevel).
  - **Left**: ввести `src/lib/logger.ts` (loglevel или pino-browser), заменить все 8 вызовов, добавить levels (debug/info/warn/error), в production — только warn+error.
  - **Verify**: grep `console\.(log|error|warn)` в src/ → 0 (кроме logger.ts).

---

## PRIORITY 21 — PRIVACY-FRIENDLY ANALYTICS

- [ ] **21.1 Plausible/Umami/PostHog (privacy-friendly)**
  - **Current**: ничего нет.
  - **Left**: добавить script в `layout.tsx` (Plausible self-hosted или Umami); собирать только: `project_created`, `card_added`, `card_deleted`, `export_started`, `export_completed`, `theme_selected`. Не собирать лишние персональные данные.
  - **Blocker**: требует external infra (Plausible/Umami instance). Если невозможно — задокументировать.
  - **Verify**: events видны в analytics dashboard.

---

## PRIORITY 22 — ONBOARDING

- [ ] **22.1 Onboarding для нового пользователя**
  - **Current**: ничего нет.
  - **Left**: краткий tour (5 шагов: создать карточку, редактировать, сменить тему, переместить, экспортировать). Skip button. Возможность повторного запуска (localStorage flag).
  - **Verify**: E2E — новый пользователь (clear localStorage) → видит onboarding → skip → не видит снова; restart via menu.

---

## PRIORITY 23 — KEYBOARD SHORTCUTS PANEL

- [ ] **23.1 `?` открывает panel со списком shortcuts**
  - **Current**: `?` handler нет. Shortcuts разбросаны по `title` атрибутам.
  - **Left**: добавить `?` в keyboard-controller; modal/panel с реальными shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Escape, Tab, стрелки после 5.5). Не показывать несуществующие.
  - **Verify**: press `?` → panel visible; все shortcuts в panel работают.

---

## PRIORITY 24 — DEPENDENCY AUDIT

- [~] **24.1 Проверить outdated/deprecated/unused/vulnerable deps**
  - **Current**: `next` обновлён 16.1.3 → 16.3.4 (критичные RCE закрыты). `bun audit` — 37 vuln (0 critical, было 72/2critical). Осталось: 10 outdated (react 19.2.3→19.3.0, typescript 5.9.3→7.0.2 major, eslint 9.39.2→10.10.0 major, и др.).
  - **Left**: обновить `react`/`react-dom`/`@types/*` (minor, безопасно); `typescript`/`eslint` major — проверить совместимость; `sharp` transitive.
  - **Verify**: `bun outdated` — 0 критичных; `bun audit` — 0 critical (✓), цель 0 high.

---

## PRIORITY 25 — FINAL PRODUCT AUDIT

- [ ] **25.1 Повторный полный аудит по 12 параметрам** (после всех задач выше)
  - **Left**: для каждого (Security, Architecture, State, Performance, Rendering, UX, Design System, Testing, CI/CD, Monitoring, Accessibility, Documentation) — до/после/что сделано/как проверено/что осталось.

---

## FINAL DELIVERABLES

- [ ] **F.1 `docs/FINAL_IMPLEMENTATION_REPORT.md`** с 9 разделами:
  1. Итоговая оценка (честная, не автоматически 10/10)
  2. Что сделано (таблица ID | Задача | Статус | Что сделано | Проверка)
  3. Что не завершено (для каждого: задача/статус/что сделано/что осталось/почему/блокер/что требуется)
  4. Тестирование (unit/coverage/E2E/TS/lint/build/a11y/visual regression/mutation)
  5. Архитектурные изменения
  6. Performance (реальные измерения)
  7. Security (что проверено, ограничения)
  8. Known Issues
  9. Следующий шаг (для BLOCKED задач)

---

## СВОДКА СТАТУСОВ (на момент аудита)

| Priority | Статус | Кратко |
|---|---|---|
| **0. Аудит** | [x] DONE | 4 субагента завершили аудит |
| **1.1** data-card-id | [~] PARTIAL | stable id есть, field elements ещё data-index |
| **1.2** Add insertCard | [ ] TODO | full rebuild, insertCard dead code |
| **1.3** Delete removeCard | [ ] TODO | full rebuild, removeCard dead code |
| **1.4** Duplicate local DOM | [ ] TODO | full rebuild |
| **1.5** Move local swap | [ ] TODO | full rebuild |
| **1.6** Progress updateProgressBars | [~] PARTIAL | toggle O(1), style change full rebuild |
| **1.7** Theme updateCardTheme | [~] PARTIAL | per-card O(1), global full rebuild |
| **1.8** Undo/Redo | [~] PARTIAL | card ops ✓, global settings СЛОМАНО (не в snapshot) |
| **1.9** Benchmark | [ ] TODO | нет |
| **2.** E2E | [ ] TODO | Playwright не установлен |
| **3.** CI/CD | [ ] TODO | .github/ не существует |
| **4.** Monitoring | [~] PARTIAL | ErrorBoundary → console только; Sentry не установлен |
| **5.1** aria-modal | [~] PARTIAL | colorModal ✓, popup + confirm ✗ |
| **5.2** Focus trap | [~] PARTIAL | colorModal ✓, popup + confirm ✗ |
| **5.3** Modal behavior | [ ] TODO | проверить все 3 |
| **5.4** Icon aria-labels | [x] DONE | 13/13 |
| **5.5** Keyboard nav (arrows) | [ ] TODO | нет arrow handlers |
| **5.6** Screen reader | [~] PARTIAL | aria-live на badge/toast, нет явных announcements |
| **5.7** Color contrast | [ ] TODO | нет tooling |
| **5.8** Reduced motion | [ ] TODO | нет prefers-reduced-motion |
| **6.** Dark Mode | [~] PARTIAL | dead .dark block, решение нужно |
| **7.** Live Preview | [~] PARTIAL | live update ✓, split-screen ✗ |
| **8.1-8.2** Virtual scrolling | [ ] TODO | нет |
| **8.3** Web Worker | [~] PARTIAL | lazy-load ✓, worker нет |
| **8.4** IndexedDB | [ ] TODO | нет |
| **8.5** Code splitting | [~] PARTIAL | только html-to-image |
| **9.1** Bundle analyzer | [ ] TODO | нет |
| **9.2** Themes lazy CSS | [ ] TODO | все 47 тем в initial bundle |
| **9.3** Fonts conditional | [ ] TODO | 4 eager imports |
| **9.4** Tree-shaking | [ ] TODO | не аудитирован |
| **10.** Design tokens | [~] PARTIAL | 5/9 категорий (нет spacing/font-size/line-height/z-index) |
| **11.** Storybook | [ ] TODO | нет |
| **12.** ADR | [ ] TODO | docs/adr/ не существует |
| **13.** JSDoc | [~] PARTIAL | ~70%, file-level only на controllers |
| **14.** Husky | [ ] TODO | нет |
| **15.** Conventional Commits | [ ] TODO | нет |
| **16.** Visual Regression | [ ] TODO | нет |
| **17.** Coverage 100% | [~] PARTIAL | 95.6% по 5 файлам, ~40 файлов не измеряются |
| **18.** Mutation Testing | [ ] TODO | Stryker не установлен |
| **19.1** CSP nonce | [ ] TODO | unsafe-eval + unsafe-inline |
| **19.2** SRI | [ ] TODO | нет |
| **19.3** Security headers | [~] PARTIAL | нет HSTS |
| **19.4** XSS audit | [~] PARTIAL | escape есть, E2E теста нет |
| **19.5** Source maps | [x] DONE | не exposed |
| **19.6** No secrets | [x] DONE | чисто |
| **19.7** Vulnerable deps | [~] PARTIAL | 72 vuln, 2 critical Next.js RCE |
| **19.8** CSP reporting | [ ] TODO | нет |
| **20.** Structured Logging | [~] PARTIAL | 8 console.*, нет logger |
| **21.** Analytics | [ ] TODO | нет |
| **22.** Onboarding | [ ] TODO | нет |
| **23.** Shortcuts Panel | [ ] TODO | нет |
| **24.** Dependency Audit | [~] PARTIAL | каталогизировано, обновить нужно |
| **25.** Final Audit | [ ] TODO | после всех задач |
| **F.1** Final Report | [ ] TODO | после 25 |

---

## ПОРЯДОК ВЫПОЛНЕНИЯ (зависимости)

1. **PRIORITY 1** (O(1) rendering) — фундамент для всего остального; без него 8.x/perf benchmark не имеют смысла.
2. **1.8** (undo/redo snapshot scope) — критический correctness bug, делать вместе с 1.x.
3. **PRIORITY 24** (dep audit) + **19.7** (vuln) — СРОЧНО, 2 critical RCE в Next.js.
4. **PRIORITY 2** (E2E) — нужно для верификации всех последующих изменений.
5. **PRIORITY 3** (CI/CD) — чтобы E2E/тесты запускались автоматически.
6. **PRIORITY 5** (a11y) + **19** (security) — параллельно.
7. **PRIORITY 6** (dark mode) + **7** (live preview) + **22** (onboarding) + **23** (shortcuts) — UX параллельно.
8. **PRIORITY 8** (perf) + **9** (bundle) + **10** (design tokens) — параллельно.
9. **PRIORITY 4** (monitoring) + **20** (logging) + **21** (analytics) — инфра параллельно.
10. **PRIORITY 11** (storybook) + **12** (ADR) + **13** (JSDoc) + **14** (husky) + **15** (conventional) — DX.
11. **PRIORITY 16** (visual regression) + **17** (coverage 100%) + **18** (mutation) — quality gates.
12. **PRIORITY 25** (final audit) + **F.1** (final report) — последними.
