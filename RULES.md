# RULES.md — CardCraft v2

> Агент читает этот файл при старте. Кратко и по делу.

## Стек

- **Веб:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Стили:** Tailwind CSS v4 + shadcn/ui (style: new-york, baseColor: neutral)
- **БД:** Prisma 6 + SQLite (`db/custom.db`)
- **Runtime:** Bun (запуск, сборка, lock-файл — `bun.lock`)
- **Экспорт:** html-to-image (PNG), буфер обмена
- **Иконки:** lucide-react
- **Шрифты:** @fontsource (Golos, Lora, Manrope, Plus Jakarta Sans) + Geist

## Архитектура

```
src/
├── app/              # Next.js App Router: layout.tsx, page.tsx, api/, globals.css
├── core/             # types.ts, constants.ts, utils.ts — единый источник правды
├── state/            # StateManager.ts — централизованное состояние, dispatch()
├── history/          # HistoryManager.ts — undo/redo (generic <T>)
├── storage/          # StorageManager.ts — единственный модуль для localStorage
├── preview/          # PreviewRenderer.ts — рендер карточки
├── editor/           # EditorRenderer.ts — рендер полей редактора
├── word-editor/      # WordEditorManager.ts — стилизация отдельных слов
├── themes/           # ThemeManager.ts + themeData.ts — 48 тем
├── export/           # ExportManager.ts — PNG/clipboard
├── styles/           # StyleHelpers.ts — утилиты стилей
├── ui/               # Accordion, Modal, Dropdown, Switch (vanilla TS, не React)
├── orchestrator/     # CardCraftApp.ts — связывает все модули, + resizers/toast/export-mode
├── components/ui/    # shadcn/ui компоненты (React, не трогать без необходимости)
├── hooks/            # use-mobile, use-toast
└── lib/              # db.ts (Prisma singleton), utils.ts (cn())
```

**Поток данных:** пользовательское событие → renderer callback → orchestrator dispatch → StateManager → подписчики → Preview/Editor/WordEditor DOM → StorageManager.save (debounce) + HistoryManager.push (debounce).

## Жёсткие правила

### TypeScript
- `strict: true` в tsconfig — соблюдать
- `noImplicitAny: false` — `any` допустим, но не злоупотреблять
- Импорты типов через `import type {}` (см. существующий код)
- Путь `@/*` → `src/*` — всегда использовать, не относительные пути

### Модульность
- **Один модуль = одна ответственность.** StorageManager — единственный, кто трогает `localStorage`. ExportManager — единственный, кто трогает `html-to-image`. Не дублировать.
- **Все типы — в `src/core/types.ts`.** Не объявлять интерфейсы в модулях, кроме внутренних.
- **Все константы — в `src/core/constants.ts`.** Никаких магических чисел в коде.
- **Состояние — через `dispatch()`.** Прямая мутация состояния запрещена (см. StateManager).

### React / Next.js
- `'use client'` директива обязательна для компонентов с хуками/событиями
- `output: "standalone"` — не ломать конфигурацию сборки
- `reactStrictMode: false` — намеренно, не включать
- shadcn/ui компоненты в `src/components/ui/` — не редактировать вручную, только через CLI

### Стили
- Tailwind v4, `darkMode: "class"`
- CSS-переменные в `globals.css` (HSL-формат: `hsl(var(--primary))`)
- Утилита `cn()` из `@/lib/utils` для слияния классов
- Не использовать inline-стили, кроме динамических значений (цвета, размеры из состояния)

### БД
- Prisma-клиент — синглтон через `src/lib/db.ts`
- Схема в `prisma/schema.prisma`
- Миграции: `bun run db:migrate` (dev), `bun run db:push` (быстро)

### Безопасность
- CSP заголовки настроены в `next.config.ts` — не ослаблять
- `.env` в `.gitignore` и `.zcodeignore` — не коммитить, не логировать
- `X-Frame-Options: DENY`, `frame-ancestors 'none'` — не менять

### Команды
- `bun run dev` — дев-сервер на :3000
- `bun run build` — продакшн-сборка (standalone)
- `bun run lint` — ESLint
- `bun run db:push` — применить схему к БД
