# Cardcraft v2 — Agent Encyclopedia

**Единый источник истины для любого агента, работающего над этим проектом.** Прочитай этот документ полностью перед тем, как трогать код. Он заменяет необходимость читать `docs/FINAL_*`, `worklog.md` и другие устаревшие отчёты.

## 1. Что это за проект

### Актуализация 29.09.2026 (читать перед историческими разделами ниже)

- Рабочая копия: `C:\Users\baga0\Desktop\CARDCRAFTv2`. React теперь обслуживает отдельные `/`, `/login`, `/account`, `/docs`, `/admin`; императивный конструктор расположен на `/editor`.
- GitHub синхронизирован fast-forward с `7869a98` до `ca8e59c` (20 коммитов). Агент переработал лендинг, добавил `WelcomeCarousel`, `WelcomeNav`, `DocsToc`, sticky-навигацию, адаптивные секции и навигационные E2E. До этой записи документация этих изменений отсутствовала. Массовые изменения executable-bit в upstream не являются содержательными изменениями файлов.
- Аудит: исправлено закрытие мобильного меню по Escape изнутри drawer и перехват фокуса при первом рендере. Переход к началу страницы учитывает reduced motion. Навигационные E2E прошли. Не переписывать лендинг ради очередной смены визуального стиля.
- Auth: `src/auth/AuthProvider.tsx`; Supabase: `src/lib/supabase/client.ts`; cloud sync: `src/lib/sync/cloudSync.ts`; проекты: `src/projects/project-storage.ts`; кошелёк: `src/account/account-service.ts`. Старые пути ниже и в RULES могут описывать предыдущую архитектуру.
- Аккаунты уже имели стартовые 50 000 токенов и server-controlled `unlimited_tokens`. Миграции 0005–0007 управляют резервированием/списанием ИИ. Начисления не обходят эту систему.
- Добавлены заявки на пополнение в `/account`: 10 000 / 50 000 / 100 000 / 500 000, произвольное целое от 10 000 до 1 млрд, комментарий, история. Максимум одна pending-заявка на пользователя, пять новых за 24 часа. ID обеспечивает безопасный повтор после сетевой ошибки.
- `/admin` — Telegram Mini App; `token-request` и `telegram-admin` — Supabase Edge Functions. Next.js остаётся `output: export`; секретов и серверных POST API в Pages нет. Доступ владельца проверяется на сервере по HMAC Telegram initData (срок 1 час) и ID `7145160476`. Webhook проверяет отдельный секрет, отправителя и приватный чат.
- Одобрение означает ручную проверку оплаты и атомарно начисляет токены ровно один раз. Mini App также позволяет отдельное бесплатное начисление (`grant`). Начальные 50 000 не считаются покупкой; статистика покупок начинается с новой системы заявок. Автоматической проверки оплаты пока нет.
- USDT (0010): владелец установил временные 0,1 USDT / 10 000 токенов (50 000 → 0,5; 100 000 → 1; 500 000 → 5). `token_payment_settings` и `token_payment_networks` — серверные настройки тарифа и пяти кошельков (TON/Tron/Solana/Ethereum/BNB). Заявка сохраняет сеть, адрес, точную сумму в micro-USDT и необязательный TX hash. Хеш можно добавить после отправки заявки, пока она ожидает решения. Для изменения цен менять настройки, не исторические заявки.
- Миграции 0008/0009: `token_requests`, service-role-only RPC, RLS, pg_cron + pg_net + Vault для повторной доставки уведомлений. Ошибка Telegram не откатывает сохранённую заявку/начисление. Возможный повтор уведомления при сетевой неопределённости безопасен для баланса.
- Настройка, секреты, эксплуатация и ограничения: `docs/telegram-admin.md`. Никаких ключей, паролей VPS, подписанных initData в память/репозиторий.
- В исходной рабочей копии были НЕзакоммиченные `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `tests/e2e/csp-reporting.spec.ts`, `AGENTS.md`, `CLAUDE.md`, `playwright.production.config.ts`. Они сохранены при обновлении. CI-черновик ссылается на отсутствующие `test:e2e:production`, `scripts/serve-static.mjs`, `tests/production`; не коммитить его как завершённое изменение без реализации этих частей.
- `headers()` работают на dev/сервере, но не в статическом экспорте. Удалены неработающие объявления `report-uri`/`report-to` и некорректный Reporting-Endpoints. CSP `/admin` отдельно разрешает Telegram SDK/Telegram frame ancestors. На VPS заголовки нужно настроить в reverse proxy; GitHub Pages их из Next.js не применяет.
- Проверки реализации: 356 unit-тестов, 8 навигационных E2E, 4 новых E2E админки/аккаунта, CSP-проверка, typecheck, lint (только 3 прежних warning в PreviewRenderer), production static build. SQL rollback-тесты проверяют баланс/RLS/стоимость; live smoke на временных аккаунтах проверил чужой Telegram ID, webhook без секрета, cross-user RLS, минимальное количество, оплату и три конкурентных одобрения с одним начислением. Временные пользователи удалены.
- Git hooks теперь используют локальные `npx --no-install` lint-staged/commitlint, если Bun отсутствует; проверки не отключаются ради коммита на Windows.

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
