# Cardcraft v2 — Agent Encyclopedia

**Единый источник истины для любого агента, работающего над этим проектом.** Прочитай этот документ полностью перед тем, как трогать код. Он заменяет необходимость читать `docs/FINAL_*`, `worklog.md` и другие устаревшие отчёты.

## 1. Что это за проект

Визуальный конструктор текстовых карточек (флеш-карты) с экспортом в PNG. Next.js 16 / React 19, но **вся логика приложения — императивный TypeScript вне React-реконсилятора**. React — только тонкая JSX-оболочка: `page.tsx` рендерит статический DOM и монтирует приложение через `useLayoutEffect` → `initCardCraftApp(root)`.

- **Репозиторий:** `https://github.com/maaloznal/cardcraft_v2` (branch `main`)
- **Локальная папка:** `C:\Users\baga0\Downloads\cardcraftv2`
- **Прод (GitHub Pages):** `https://maaloznal.github.io/cardcraft_v2/`
- **UI на русском.** ~8,150 строк TS / 57 файлов.

## 2. Быстрый старт (30 секунд)

```bash
bun install            # или npm install
cp .env.example .env.local   # вписать NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
bun run dev            # http://localhost:3000
```

> Прим.: этот агент не имеет `bun` на ПК, использует `npx`. Порт 3000 может держать застрявший `node.exe` — `taskkill /PID <pid> /F` перед `npm run dev`.

## 3. Стек

- Next.js 16 (App Router, `src/app/`), `output: "export"` для GitHub Pages, `basePath: '/cardcraft_v2'`
- React 19, TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Supabase (auth email/password + Google OAuth + cloud sync)
- Sentry (`@sentry/nextjs`)
- Bun (первичный; есть и `bun.lock`, и `package-lock.json` — не трогать оба одновременно)
- Caddy reverse proxy, mini-services (`.zscripts/mini-services-*.sh`), опциональный Python runtime

## 4. Архитектура (6 слоёв)

```
Core (pure)          src/core/        types.ts, constants.ts, utils.ts
Infrastructure       src/state, history, storage, export
Renderers (DOM)      src/preview, editor, word-editor, styles, themes
UI Primitives        src/ui/          Modal, Dropdown, Accordion, Switch
Orchestrator         src/orchestrator/  composition root + 11 controllers
React Shell          src/app, auth, components
```

**Composition root:** `src/orchestrator/CardCraftApp.ts:initCardCraftApp(root)` — 11-фазный init, возвращает cleanup-функцию (StrictMode-safe).

**11 controllers** (фабрики `create*Controller(ctx)`, каждый — одна ответственность):
`storage, uiAppliers, modal, wordPopup, exporter, theme, charLimit, keyboard, history, cardOps, sidebar`

**Паттерны:**
- Фабрики-контроллеры + общий `OrchestratorContext` (service bag)
- Event delegation (PreviewRenderer/EditorRenderer — по одному handler на контейнер)
- Unidirectional data flow: `dispatch(action)` → `StateManager` → subscriber → renderers (O(1) targeted vs O(n) full)
- Debounce: save 400ms, history 700ms
- StrictMode-safe (всё через `destroy()`)
- Lazy loading: `html-to-image` (при первом экспорте), IndexedDB (при переполнении localStorage)

## 5. Модель данных

**`AppState { cards: {list: Card[]}, settings: {...}, ui: {...} }`** (в `src/state/StateManager.ts`)

**`Card`:** 6 текстовых полей (`title, subtitle, text, listItems, footer, cta`) + `colors` + `wordStyles` + `sectionStyles` + per-card `theme`.

**25 Action-вариантов** — discriminated union с exhaustive `never`-проверкой в редьюсере.

**Схемная миграция:** `StorageManager.migrateCard()` — старые wordStyle-ключи без `::` → `field::word`; bool `bold`/`italic` → `fontWeight`/`fontStyle` строки; валидация id/цветов/тем. Все мутации — только через `dispatch`.

## 6. Подводные камни (GOTCHAS) — читай перед деплоем

| Проблема | Решение |
|---|---|
| `basePath` должен быть `/cardcraft_v2` (не `/cardcraft`) | `next.config.ts`, иначе CSS/JS 404 и пустая страница |
| `headers()` НЕ работает с `output: "export"` | CSP `report-uri`+`report-to` добавлены вручную; `Reporting-Endpoints` должен быть **валидным JSON** `{"csp-endpoint":{"url":"/api/csp-report","max_age":86400}}` |
| GitHub Actions: `NEXT_PUBLIC_SUPABASE_URL` — это **VARIABLE** (`vars.`), `ANON_KEY` — **SECRET** (`secrets.`) | Если URL только secret → `supabase=null` → AuthButton `null` |
| Supabase миграция — версия `0001` (не `001`) | флаг: `Supabase Preview` падает при mismatch |
| `test-results/`, `tool-results/`, `verification*.png`, `worklog.md`, `.zscripts/dev.pid` | должны быть в `.gitignore`, НЕ коммитить |
| `.env.local` не коммитить (в `.gitignore`) | в CI берётся из `vars`/`secrets` |

## 7. Деплой

`.github/workflows/deploy.yml` (push на main / workflow_dispatch):
`bun install --frozen-lockfile → bun run build (NODE_ENV=production + NEXT_PUBLIC_* vars/secrets) → upload ./out → deploy-pages`

Продакшен URL: `https://maaloznal.github.io/cardcraft_v2/`. Прод подключён к Supabase-проекту `rbvokjedmyndntojvekn` (West EU).

## 8. Тестирование и контроль качества

- **Lint:** `npm run lint` (eslint). `react-hooks/set-state-in-effect` — **error** (React 19).
- **Typecheck:** `npm run typecheck` = `tsc --noEmit`.
- **Unit:** `npm run test` (vitest, jsdom, `tests/unit/**`).
- **E2E:** `npm run test:e2e` (Playwright, Chromium, 1 worker, `tests/e2e/`).
- **DB:** `supabase migration list` должен показывать Local/Remote совпадение.
- **CI:** все 6 чеков зелёные: CI (Lint+Typecheck+Unit, E2E, Production build), Changesets, Deploy, Supabase Preview.
- A11y, mutation (`stryker`), perf-бенчмарки (`vitest.perf.config.ts`).

## 9. Что делать новому агенту (чеклист)

1. Прочитай этот файл + корневой `RULES.md`.
2. Проверь `git status` чистый, `git pull`.
3. `npm run typecheck` + `npm run lint` — до любых изменений.
4. Изменяй код только **сам** (не через субагентов; субагенты — толькоread-only Explore, максимум 3 параллельно).
5. Сделай изменение → `tsc` → `lint` → commit → push → дождись CI зелёного.
6. НЕ трогай `docs/FINAL_*` (устаревшие снимки), `worklog.md`, `tool-results/`, `verification*.png`.

## 10. История (кратко)

> **Главная энциклопедия:** `docs/AGENT_ENCYCLOPEDIA.md` — **этот файл**. Не читай `docs/FINAL_*` (устаревшие, перемещены в `docs/archive/`), `worklog.md`, `tool-results/` — они в `.gitignore` и не коммитятся.

Все баги и фиксы видны в `git log` (`f874194`, `8d53afc`, `e1efbbb`, `6ed7a62`, `7f13fe6`, и др.). `RULES.md` — доп. справочник по контрактам архитектуры. `docs/MASTER_TASK.md` — чеклист production-ready (зелёные `[x]`). Старые отчёты (`docs/FINAL_*`, `POST_*`, `PRODUCTION_DIVERGENCE_REPORT`) — только справочные заметки в `docs/archive/`.