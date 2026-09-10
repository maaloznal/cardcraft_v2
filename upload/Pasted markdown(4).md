Проведу полный технический аудит проекта. Начну со сбора всей необходимой информации.
Теперь у меня есть вся информация. Вот полная техническая документация.

---

# ТЕХНИЧЕСКАЯ ДОКУМЕНТАЦИЯ ПРОЕКТА

## 1. Структура проекта

```
/home/z/my-project/
├── .env                          # Переменные окружения (DATABASE_URL)
├── .gitignore                    # Исключения Git
├── .zscripts/                    # Скрипты автоматизации sandbox
│   ├── build.sh
│   ├── dev.sh
│   ├── start.sh
│   └── ...
├── Caddyfile                     # Конфигурация Caddy reverse proxy (порт 81)
├── bun.lock                      # Lockfile пакетного менеджера Bun
├── components.json               # Конфигурация shadcn/ui
├── db/
│   └── custom.db                 # SQLite база данных Prisma
├── dev.log                       # Лог dev-сервера Next.js
├── eslint.config.mjs             # Конфигурация ESLint
├── next-env.d.ts                 # Типы Next.js (автогенерируется)
├── next.config.ts                # Конфигурация Next.js
├── package.json                  # Зависимости и скрипты
├── postcss.config.mjs            # Конфигурация PostCSS
├── prisma/
│   └── schema.prisma             # Схема БД (модели User, Post)
├── public/
│   ├── logo.svg                  # Логотип
│   └── robots.txt                # robots.txt
├── src/                          # ★ ИСХОДНЫЙ КОД ПРИЛОЖЕНИЯ
│   ├── app/                      # App Router Next.js
│   │   ├── api/
│   │   │   └── route.ts          # API маршрут (hello world, не используется)
│   │   ├── card-constructor.css  # ★ ВСЯ СТИЛИЗАЦИЯ (3698 строк, 90 тем)
│   │   ├── globals.css           # Глобальные стили Tailwind + shadcn переменные
│   │   ├── layout.tsx            # Root layout (шрифты, метаданные, Toaster)
│   │   └── page.tsx              # ★ ЕДИНСТВЕННАЯ СТРАНИЦА (542 строки, JSX-оболочка)
│   ├── components/
│   │   └── ui/                   # 48 shadcn/ui компонентов (не используются в приложении)
│   ├── hooks/
│   │   ├── use-mobile.ts         # Хук определения мобильного устройства
│   │   └── use-toast.ts          # Хук toast-уведомлений
│   └── lib/
│       ├── card-constructor.ts   # ★ ВСЯ ЛОГИКА ПРИЛОЖЕНИЯ (2795 строк)
│       ├── db.ts                 # Prisma клиент (не используется в приложении)
│       └── utils.ts              # Утилита cn() для Tailwind
├── tailwind.config.ts            # Конфигурация Tailwind CSS
├── tests/
│   └── smoke-test.js             # Smoke-тест (414 строк, 99 проверок)
├── tsconfig.json                 # Конфигурация TypeScript
├── worklog.md                    # Журнал разработки (967 строк, 23 задачи)
├── examples/                     # Примеры websocket (не используются)
├── mini-services/                # Шаблон mini-сервиса (не используется)
└── skills/                       # Skills Z.ai (не относятся к проекту)
```

### Ключевые файлы

| Файл | Строк | Назначение |
|---|---|---|
| `src/lib/card-constructor.ts` | 2795 | Вся логика приложения: состояния, рендеринг, темы, экспорт, undo/redo, drag |
| `src/app/page.tsx` | 542 | JSX-оболочка: top bar, sidebar, workspace, modal, popup |
| `src/app/card-constructor.css` | 3698 | 90 тем, дизайн-система Cardcraft, все стили UI |
| `src/app/layout.tsx` | 53 | Root layout: шрифты, метаданные |
| `tests/smoke-test.js` | 414 | 99 assertions для E2E проверки через Agent Browser |
| `worklog.md` | 967 | Журнал из 23 задач разработки |

### Точки входа

- **Точка входа приложения**: `src/app/page.tsx` → `'use client'` → `useEffect` → `initCardConstructor(rootRef.current)`
- **Точка входа Next.js**: `src/app/layout.tsx` (Root Layout) + `src/app/page.tsx` (единственный маршрут `/`)
- **Точка входа логики**: `initCardConstructor(root: HTMLElement)` в `src/lib/card-constructor.ts`

### Архитектура

Проект использует **гибридную архитектуру**: React-оболочка + императивный DOM-манипулятор.

- **React-слой** (`page.tsx`): рендерит статический JSX один раз при монтировании, затем делегирует всю интерактивность императивному модулю
- **Императивный слой** (`card-constructor.ts`): управляет всем состоянием, DOM-манипуляциями, событиями, localStorage
- **Стилизация** (`card-constructor.css`): чистый CSS с CSS-переменными, без Tailwind в самом приложении

## 2. Используемый стек

| Категория | Технология | Версия |
|---|---|---|
| Язык | TypeScript | ^5 |
| Фреймворк | Next.js (App Router) | ^16.1.1 |
| UI-библиотека | React | ^19.0.0 |
| Пакетный менеджер | Bun | 1.3.14 |
| Runtime | Node.js | v24.18.0 |
| Стили | Tailwind CSS 4 + чистый CSS | ^4 |
| Компоненты | shadcn/ui (New York style) | 48 компонентов |
| Иконки | Lucide React | ^0.525.0 |
| Экспорт изображений | html-to-image | ^1.11.13 |
| Шрифты | @fontsource (Golos Text, Lora, Manrope, Plus Jakarta Sans) | ^5.3.0 |
| Шрифты | next/font/google (Geist, Geist Mono) | встроено в Next.js |
| Анимации | Framer Motion | ^12.23.2 |
| База данных | Prisma ORM + SQLite | ^6.11.1 |
| Линтер | ESLint | ^9 |
| Reverse Proxy | Caddy | :81 → :3000 |

## 3. Полный список зависимостей

### dependencies (71 пакет)

| Пакет | Версия | Назначение | Обязателен | Можно удалить |
|---|---|---|---|---|
| `next` | ^16.1.1 | Фреймворк | ✅ | ❌ |
| `react` | ^19.0.0 | UI-библиотека | ✅ | ❌ |
| `react-dom` | ^19.0.0 | React DOM renderer | ✅ | ❌ |
| `html-to-image` | ^1.11.13 | Экспорт карточек в PNG | ✅ | ❌ |
| `@fontsource/golos-text` | ^5.3.0 | Шрифт Golos Text (self-hosted) | ✅ | ❌ |
| `@fontsource/lora` | ^5.3.0 | Шрифт Lora (self-hosted) | ✅ | ❌ |
| `@fontsource/manrope` | ^5.3.0 | Шрифт Manrope (self-hosted) | ✅ | ❌ |
| `@fontsource/plus-jakarta-sans` | ^5.3.0 | Шрифт Plus Jakarta Sans (self-hosted) | ✅ | ❌ |
| `@prisma/client` | ^6.11.1 | Prisma ORM клиент | ❌ | ✅ (не используется в приложении) |
| `prisma` | ^6.11.1 | Prisma CLI | ❌ | ✅ |
| `@radix-ui/*` (26 пакетов) | различные | Headless UI компоненты для shadcn/ui | ❌ | ✅ (не используются в приложении) |
| `@dnd-kit/*` (3 пакета) | ^6-10 | Drag & Drop | ❌ | ✅ |
| `@hookform/resolvers` | ^5.1.1 | Валидация форм | ❌ | ✅ |
| `@mdxeditor/editor` | ^3.39.1 | MDX редактор | ❌ | ✅ |
| `@reactuses/core` | ^6.0.5 | React hooks коллекция | ❌ | ✅ |
| `@tanstack/react-query` | ^5.82.0 | Server state management | ❌ | ✅ |
| `@tanstack/react-table` | ^8.21.3 | Таблицы | ❌ | ✅ |
| `class-variance-authority` | ^0.7.1 | Варианты компонентов | ❌ | ✅ (используется только shadcn) |
| `clsx` | ^2.1.1 | Утилита классов | ❌ | ✅ |
| `cmdk` | ^1.1.1 | Command palette | ❌ | ✅ |
| `date-fns` | ^4.1.0 | Работа с датами | ❌ | ✅ |
| `embla-carousel-react` | ^8.6.0 | Карусель | ❌ | ✅ |
| `framer-motion` | ^12.23.2 | Анимации | ❌ | ✅ |
| `input-otp` | ^1.4.2 | OTP ввод | ❌ | ✅ |
| `lucide-react` | ^0.525.0 | Иконки | ❌ | ✅ (приложение использует inline SVG) |
| `next-auth` | ^4.24.11 | Аутентификация | ❌ | ✅ |
| `next-intl` | ^4.3.4 | Интернационализация | ❌ | ✅ |
| `next-themes` | ^0.4.6 | Тёмная/светлая тема | ❌ | ✅ |
| `react-day-picker` | ^9.8.0 | Календарь | ❌ | ✅ |
| `react-hook-form` | ^7.60.0 | Формы | ❌ | ✅ |
| `react-markdown` | ^10.1.0 | Markdown рендеринг | ❌ | ✅ |
| `react-resizable-panels` | ^3.0.3 | Resizable панели | ❌ | ✅ |
| `react-syntax-highlighter` | ^15.6.1 | Подсветка синтаксиса | ❌ | ✅ |
| `recharts` | ^2.15.4 | Графики | ❌ | ✅ |
| `sharp` | ^0.34.3 | Обработка изображений | ❌ | ✅ |
| `sonner` | ^2.0.6 | Toast уведомления | ❌ | ✅ |
| `tailwind-merge` | ^3.3.1 | Merge Tailwind классов | ❌ | ✅ |
| `tailwindcss-animate` | ^1.0.7 | Анимации Tailwind | ❌ | ✅ |
| `uuid` | ^11.1.0 | UUID генерация | ❌ | ✅ (приложение использует crypto.randomUUID) |
| `vaul` | ^1.1.2 | Drawer компонент | ❌ | ✅ |
| `z-ai-web-dev-sdk` | ^0.0.18 | Z.ai SDK | ❌ | ✅ |
| `zod` | ^4.0.2 | Валидация схем | ❌ | ✅ |
| `zustand` | ^5.0.6 | State management | ❌ | ✅ |

### devDependencies (9 пакетов)

| Пакет | Версия | Назначение | Обязателен |
|---|---|---|---|
| `@tailwindcss/postcss` | ^4 | PostCSS плагин Tailwind | ✅ |
| `tailwindcss` | ^4 | CSS фреймворк | ✅ |
| `tw-animate-css` | ^1.3.5 | CSS анимации | ❌ |
| `typescript` | ^5 | TypeScript компилятор | ✅ |
| `eslint` | ^9 | Линтер | ✅ |
| `eslint-config-next` | ^16.1.1 | ESLint конфиг для Next.js | ✅ |
| `@types/react` | ^19 | Типы React | ✅ |
| `@types/react-dom` | ^19 | Типы React DOM | ✅ |
| `bun-types` | ^1.3.4 | Типы Bun | ❌ |

### Вывод по зависимостям

Из 71 зависимости **обязательны только 6** для работы приложения: `next`, `react`, `react-dom`, `html-to-image`, 4 `@fontsource` пакета. Остальные 65 — это зависимости shadcn/ui scaffold, которые **не используются** в самом приложении.

## 4. Запуск проекта локально

### Требования

- **Node.js**: v24.18.0 (установленная версия), рекомендуется v20+
- **Bun**: 1.3.14 (пакетный менеджер и runtime)
- **npm**: 11.16.0 (альтернатива, не рекомендуется)

### Команды

```bash
# Установка зависимостей
bun install

# Запуск dev-сервера (порт 3000)
bun run dev

# Сборка production
bun run build

# Запуск production
bun run start

# Линтер
bun run lint

# Работа с БД (не используется в приложении)
bun run db:push      # Применить схему
bun run db:generate  # Генерация клиента
bun run db:migrate   # Миграции
bun run db:reset     # Сброс БД
```

### Доступ

- **Локально**: `http://localhost:3000`
- **Через Caddy gateway**: порт 81 → порт 3000
- **Внешний доступ**: через Preview Panel (не `localhost`)

## 5. Переменные окружения

### `.env`

```
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

| Переменная | Значение | Назначение | Обязательна |
|---|---|---|---|
| `DATABASE_URL` | `file:/home/z/my-project/db/custom.db` | Путь к SQLite БД для Prisma | ❌ (не используется приложением) |

Дополнительные `.env.local`, `.env.production`, `.env.development` — **отсутствуют**.

## 6. Конфигурационные файлы

| Файл | Назначение |
|---|---|
| `package.json` | Зависимости, скрипты, метаданные проекта |
| `tsconfig.json` | TypeScript конфигурация: target ES2017, strict, jsx react-jsx, paths `@/*` → `./src/*` |
| `next.config.ts` | Next.js конфиг: `output: standalone`, `reactStrictMode: false`, `ignoreBuildErrors: true`, `allowedDevOrigins: ["*.space-z.ai"]` |
| `eslint.config.mjs` | ESLint flat config: next/core-web-vitals + next/typescript, большинство правил отключено |
| `postcss.config.mjs` | PostCSS: плагин `@tailwindcss/postcss` |
| `tailwind.config.ts` | Tailwind: darkMode class, content paths, расширенные цвета и border-radius |
| `components.json` | shadcn/ui: style new-york, RSC, TSX, baseColor neutral, aliases |
| `Caddyfile` | Caddy reverse proxy: порт 81, `XTransformPort` query для mini-services, default → :3000 |
| `prisma/schema.prisma` | Prisma: SQLite, модели User и Post (не используются приложением) |
| `.gitignore` | Исключения: node_modules, .next, .env*, dev.log, skills/ |

## 7. Архитектура проекта

### Поток данных

```
Пользователь → DOM события → card-constructor.ts (императивная логика)
                                    ↓
                         cards[] — массив карточек (состояние в памяти)
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
              renderEditor()   renderPreview()   localStorage
              (DOM rebuild)    (DOM rebuild)     (debounce 400ms)
```

### Жизненный цикл приложения

1. **Монтирование React**: `page.tsx` рендерит статический JSX (top bar, sidebar, workspace, modal, popup)
2. **`useEffect`**: вызывает `initCardConstructor(root)` — инициализирует всё приложение
3. **Инициализация**:
   - `loadCardsFromLocalStorage()` — загружает данные
   - `bindStatic()` — навешивает обработчики на статические элементы
   - `renderEditor()` — строит блоки редактора
   - `renderPreview()` — строит превью карточек
   - `initVerticalResize()` / `initHorizontalResize()` — resize-разделители
   - `makeWordPopupDraggable()` — drag попапа слова
   - `setSidebarOpen()` — открывает sidebar на desktop
4. **Взаимодействие**: все события обрабатываются императивно через `addEventListener`
5. **Размонтирование**: cleanup функция удаляет все слушатели

### Обновление Preview

**Три уровня оптимизации:**

| Функция | Когда вызывается | Сложность |
|---|---|---|
| `updatePreviewField(idx, field)` | Ввод текста (input/paste) | O(1) — обновляет один элемент |
| `updateCardField(idx, field)` | Изменение стилей в модалке | O(1) — обновляет style + innerHTML |
| `updateCardTheme(idx)` | Смена темы карточки | O(1) — обновляет data-theme |
| `renderPreview()` | Структурные изменения (add/delete/move/undo) | O(n) — полная перестройка |

`deleteCard()` — **локализованное удаление** без `renderPreview()`: удаляет DOM-узлы + обновляет номера.

### Обновление редактора

- `renderEditor()` — полная перестройка `#editorCardsList` (O(n))
- Вызывается при: add/delete/duplicate/move/undo/redo/import
- Ввод текста **не вызывает** `renderEditor()` — обновляется только `h3` заголовок

### Система сохранения

- **Debounce**: `scheduleSave()` → 400ms задержка → `saveCardsToLocalStorage()`
- **beforeunload**: принудительное сохранение при закрытии вкладки
- **localStorage ключи** (11 шт.):

| Ключ | Тип | Назначение |
|---|---|---|
| `flashcard-cards` | JSON | Массив карточек |
| `flashcard-theme` | string | Глобальная тема |
| `flashcard-format` | string | Формат карточек |
| `flashcard-show-numbers` | boolean | Видимость нумерации |
| `flashcard-show-progress` | boolean | Видимость шкалы прогресса |
| `flashcard-progress-style` | string | Стиль прогресса |
| `flashcard-list-style` | string | Стиль списков |
| `flashcard-gradient-angle` | number | Угол градиента |
| `flashcard-char-limit` | boolean | Лимит символов |
| `flashcard-sidebar-width` | number | Ширина sidebar (resize) |
| `flashcard-header-height` | number | Высота header (resize) |

### Система тем

- **90 тем** в CSS: 48 сплошных + 40 градиентных + 2 «без фона»
- **4 группы**: Светлые (29), Тёмные (19), Градиентные (40), Без фона (2)
- CSS-переменные на `[data-theme="name"]` селекторах
- Градиентные темы используют `var(--gradient-angle, 135deg)` для динамического угла
- Темы «без фона»: `--card-bg: transparent`, шахматный паттерн в превью
- Индивидуальная тема карточки: `card.theme` переопределяет глобальную через `data-theme` на `.card`

### Undo/Redo

- **Snapshot**: `{ cards, theme, format }` — глубокая копия через `JSON.parse(JSON.stringify())`
- **Стек**: массив до 50 снимков, `histIndex` указывает на текущий
- **Debounce**: `scheduleHistoryPush()` → 700ms задержка для текстовых правок
- **Мгновенный push**: для структурных операций (add/delete/duplicate/move/theme change)
- **Горячие клавиши**: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo)

### Экспорт карточек

- **Библиотека**: `html-to-image` (`toPng`, `toBlob`)
- **Pixel ratio**: 2x для качества
- **Cache bust**: `cacheBust: true`
- **Export mode**: `root.classList.add('exporting')` — скрывает маркеры стилизованных слов, плейсхолдеры
- **Прозрачный фон**: для тем «без фона» `html-to-image` по умолчанию не устанавливает `backgroundColor`
- **Пакетный экспорт**: последовательная генерация всех карточек с прогрессом "Скачано X из Y"
- **Копирование**: `toBlob` → `navigator.clipboard.write` с фолбэком на скачивание

## 8. Производительность

### Тяжёлые места

| Место | Проблема | Влияние |
|---|---|---|
| `renderPreview()` | Полная перестройка `cardsArea.innerHTML = ''` + rebuild всех карточек | O(n) на каждый структурный change |
| `renderEditor()` | Полная перестройка `editorCardsList.innerHTML = ''` + rebuild всех блоков | O(n) при add/delete/move |
| `applyWordStylesToText()` | Regex-замена + escapeHtml + split по индексам для каждого поля | Вызывается при каждом рендере превью |
| `deepClone()` через JSON | `JSON.parse(JSON.stringify())` для undo/redo snapshots | O(n) по размеру данных, медленно для больших карточек |
| `html-to-image` экспорт | Синхронный рендеринг DOM → Canvas → PNG | ~1-3s на карточку, блокирует UI |

### Возможные лишние re-render

| Место | Когда | Причина |
|---|---|---|
| Смена стиля прогресса | `progressBarStyleSelect.change` | Вызывает `renderPreview()` — нужна для shape-стилей, но избыточно для bar-стилей |
| Смена темы карточки в модалке | `modalCardThemeSelect.click` | Вызывает `updateCardTheme()` (O(1)) — оптимизировано |
| Смена стиля списка | `listStyleSelect.change` | CSS-only через `data-list-style` — не вызывает re-render ✅ |
| Удаление карточки | `deleteCard()` | Локализованное удаление — не вызывает `renderPreview()` ✅ |

### Узкие места

1. **`cardsArea.innerHTML = ''`** в `renderPreview()` — заставляет browser пересчитать layout для всех карточек
2. **`editorCardsList.innerHTML = ''`** в `renderEditor()` — пересоздаёт все обработчики событий
3. **Массовый экспорт** — последовательный `await` в цикле, каждый ~300ms задержка
4. **90 тем в CSS** — 3698 строк CSS парсятся при загрузке (не критично, браузеры оптимизируют)

### Потенциальные проблемы масштабирования

| Проблема | При | Решение |
|---|---|---|
| Тормозит при >50 карточках | `renderPreview()` O(n) | Виртуализация / пагинация |
| localStorage переполнение | ~5MB лимит, карточки с большим текстом | QuotaExceededError обработан, но нет миграции |
| Undo стек растёт | 50 снимков × размер данных | Ограничение MAX_HISTORY = 50 |
| CSS 3698 строк | 90 тем × 13 переменных | Можно вынести в JS-генерацию |

## 9. Внешние зависимости

| Тип | Что используется | Где | Можно убрать |
|---|---|---|---|
| Google Fonts | `Geist` и `Geist_Mono` через `next/font/google` | `layout.tsx` | ❌ (используются для --font-geist-sans/mono) |
| Self-hosted fonts | `@fontsource/golos-text`, `lora`, `manrope`, `plus-jakarta-sans` | `layout.tsx` | ❌ (шрифты карточек, same-origin для экспорта) |
| Внешний CDN | `https://z-cdn.chatglm.cn/z-ai/static/logo.svg` | `layout.tsx` metadata.icons | ✅ (favicon, не влияет на функциональность) |
| Внешних API | Нет | — | — |
| Внешних скриптов | Нет | — | — |
| Внешних изображений | Нет (только favicon) | — | — |

## 10. Что необходимо установить на чистый компьютер для запуска проекта

### Требования к ПО

| ПО | Версия | Назначение |
|---|---|---|
| Node.js | v20+ (рекомендуется v24) | JavaScript runtime |
| Bun | v1.0+ | Пакетный менеджер и runtime |

### Последовательность действий

```bash
# 1. Установить Node.js (если не установлен)
#    Скачать с https://nodejs.org/ или через nvm:
nvm install 24
nvm use 24

# 2. Установить Bun
curl -fsSL https://bun.sh/install | bash

# 3. Клонировать проект (если из репозитория)
git clone <repository-url>
cd my-project

# 4. Установить зависимости
bun install

# 5. Создать .env файл
echo "DATABASE_URL=file:$(pwd)/db/custom.db" > .env

# 6. Запустить dev-сервер
bun run dev

# 7. Открыть в браузере
#    http://localhost:3000
```

### Дополнительные утилиты (опционально)

| Утилита | Назначение |
|---|---|
| `agent-browser` | E2E тестирование (smoke-test.js) |
| ESLint extension для IDE | Проверка кода в реальном времени |

### Минимальный набор для работы приложения

```
node_modules/
  next/
  react/
  react-dom/
  html-to-image/
  @fontsource/golos-text/
  @fontsource/lora/
  @fontsource/manrope/
  @fontsource/plus-jakarta-sans/
src/
  app/page.tsx
  app/layout.tsx
  app/card-constructor.css
  app/globals.css
  lib/card-constructor.ts
.env
package.json
next.config.ts
tsconfig.json
postcss.config.mjs
tailwind.config.ts
```

### Проверка работоспособности

```bash
# Линтер
bun run lint

# Smoke-тест (требуется agent-browser)
agent-browser open http://localhost:3000
agent-browser eval "$(cat tests/smoke-test.js)"
# Ожидаемый результат: "passed: 109, failed: 0"
```

---

**Отчёт подготовлен на основе анализа исходного кода проекта. Никакие изменения в код не вносились.**