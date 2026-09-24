# RULES.md — CardCraft v2

> Агент читает этот файл при старте. Кратко и по делу.

## Стек

- **Веб:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Стили:** Tailwind CSS v4 + кастомный CSS (`card-constructor.css`, 4877 строк)
- **Backend:** Supabase (Auth + PostgreSQL) — client-side only, PKCE flow
- **Runtime:** Bun (запуск), npm (CI/CD)
- **Экспорт:** html-to-image (dynamic import, PNG + clipboard)
- **Шрифты:** @fontsource (Golos, Lora, Manrope, Plus Jakarta Sans) + Geist
- **Деплой:** GitHub Pages (static export, `output: "export"`, basePath `/cardcraft_v2`)

## Архитектура

```
src/
├── app/              # Next.js App Router: layout.tsx, page.tsx, auth pages
├── auth/             # AuthContext.tsx, AuthButton.tsx — Supabase auth
├── components/       # ErrorBoundary, ServiceWorkerRegister, DesktopToggle
├── core/             # types.ts, constants.ts, utils.ts, validation.ts
├── state/            # StateManager.ts — 23 actions, sanitize-on-write
├── history/          # HistoryManager.ts — generic <T>, 50 snapshots
├── storage/          # StorageManager.ts — единственный модуль для localStorage
├── preview/          # PreviewRenderer.ts — рендер карточки
├── editor/           # EditorRenderer.ts — рендер полей редактора
├── word-editor/      # WordEditorManager.ts — стилизация слов
├── themes/           # ThemeManager.ts + themeData.ts — 90 тем
├── export/           # ExportManager.ts — PNG/clipboard (dynamic import)
├── styles/           # StyleHelpers.ts — утилиты стилей
├── ui/               # Accordion, Modal, Dropdown, Switch (vanilla TS)
├── orchestrator/     # CardCraftApp.ts + 8 helper модулей
├── lib/              # supabase.ts, paths.ts, projectRepository.ts, useCloudSync.ts
└── types/            # global.d.ts — Window типы для cloud sync bridge
```

**Поток данных:** пользовательское событие → renderer callback → orchestrator dispatch → StateManager (sanitize-on-write) → подписчики → Preview/Editor DOM → StorageManager.save (debounce 400ms) + HistoryManager.schedulePush (debounce 700ms) + cloud sync (debounce 2s).

## Жёсткие правила

### TypeScript
- `strict: true` в tsconfig — соблюдать
- `noImplicitAny: false` — `any` допустим, но не злоупотреблять
- Импорты типов через `import type {}`
- Путь `@/*` → `src/*` — всегда использовать

### Модульность
- **Один модуль = одна ответственность.** StorageManager — единственный, кто трогает `localStorage`. ExportManager — единственный, кто трогает `html-to-image`. Не дублировать.
- **Все типы — в `src/core/types.ts`.**
- **Все константы — в `src/core/constants.ts`.**
- **Все валидаторы — в `src/core/validation.ts`.**
- **Состояние — через `dispatch()`.** Прямая мутация состояния запрещена.

### React / Next.js
- `'use client'` директива обязательна для компонентов с хуками/событиями
- `output: "export"` — static export для GitHub Pages, НЕ менять на standalone
- `basePath: "/cardcraft_v2"` — только в production
- `reactStrictMode: true` — включён
- `appPath()` для raw `<a href>`, `router.push()` без `appPath()` (Next.js сам добавляет basePath)

### Auth / Cloud
- Supabase client: `src/lib/supabase.ts` — singleton, PKCE flow
- Auth context: `src/auth/AuthContext.tsx` — единственный источник auth state
- Cloud sync: `src/lib/useCloudSync.ts` — React hook, `window.__cardcraft*` bridge
- `cloudReady` флаг — блокирует cloud saves во время load (race condition prevention)
- Service role key — НИКОГДА не использовать в клиенте

### Стили
- Tailwind v4 + кастомный CSS в `card-constructor.css`
- CSS-переменные в `:root` и `[data-theme="..."]` блоках
- 6 responsive брейкпоинтов: ≤360, 361-414, 415-480, 481-600, 601-768, 769-1023
- Dark/Light/Auto UI theme через `data-ui-theme` на `.cc-root`

### Безопасность
- CSP через `<meta>` тег в `layout.tsx` (headers() не работает при static export)
- `.env` в `.gitignore` — не коммитить
- sanitize-on-write в StateManager reducer (colors, themes, formats, text, styles)
- sanitize-on-load в StorageManager (все localStorage данные валидируются)
- RLS на всех таблицах Supabase

### Команды
- `bun run dev` — дев-сервер на :3000
- `npm run build` — продакшн-сборка (static export → `out/`)
- `npm run lint` — ESLint
- `npm test` — Vitest (237 unit tests)
- `npx tsc --noEmit` — проверка типов
