Да, с учётом нового глубокого аудита из `Pasted markdown(9).md` предыдущую оценку нужно существенно скорректировать.

Если раньше текущая версия выглядела как успешная миграция из монолита в модульную архитектуру, то новый аудит показывает более жёсткую картину: **архитектура стала модульной внешне, но ключевые контракты нарушены, появились критические проблемы безопасности, а оркестратор фактически стал новым God Module меньшего размера**.

Ниже — обновлённый анализ проекта, сравнение начальной и текущей версии, а также конкретный план действий для агента.

---

# 1. Главный вывод

## Кратко

Проект прошёл путь от одного гигантского файла с God Function до модульной структуры из примерно 20 модулей. Это реальный архитектурный прогресс.

Но текущая версия имеет критические проблемы:

- 4 подтверждённые XSS-уязвимости через атрибуты DOM;
- отсутствует валидация данных из localStorage;
- отсутствует CSP;
- `ignoreBuildErrors: true` скрывает ошибки TypeScript;
- ESLint фактически ослаблен;
- StateManager декларирует централизованное состояние, но часть изменений делается прямыми мутациями в обход dispatch;
- undo/redo работает не для всех изменений;
- существуют мёртвые O(1)-методы, которые архитектурно готовы, но не используются;
- оркестратор `CardCraftApp.ts` снова содержит признаки God Module;
- нет unit-тестов;
- production readiness ниже, чем казалось в предыдущем отчёте.

Итог:

> Текущая версия лучше начальной по структуре и потенциалу, но хуже по безопасности, целостности состояния и производственной готовности.

---

# 2. Обновлённая оценка проекта

## Начальная версия

По первому аудиту:

| Параметр           | Оценка | Комментарий                                       |
| ------------------ | -----: | ------------------------------------------------- |
| Архитектура        |   3/10 | Один файл, одна God Function                      |
| Производительность |   7/10 | Есть O(1)-оптимизации для ввода                   |
| UX                 |   7/10 | Продукт рабочий, но есть UX-шероховатости         |
| UI                 |   8/10 | Премиальный визуальный стиль                      |
| Масштабируемость   |   2/10 | При росте всё должно было сломаться               |
| Читаемость         |   4/10 | Огромная функция, сложная навигация               |
| Поддерживаемость   |   3/10 | Любое изменение требует понимания всего замыкания |
| Стабильность       |   7/10 | 109 smoke-проверок, runtime-ошибок нет            |
| Итог               | 5.5/10 | Функциональный MVP с тяжёлым архитектурным долгом |

Главная проблема начальной версии:

- `src/lib/card-constructor.ts`;
- God Function около 2473–2795 строк;
- 66 функций;
- 33 переменные состояния;
- 68 обработчиков;
- 51 querySelector;
- всё в одном замыкании.

Это было плохо для долгосрочной разработки, но функционально стабильно.

---

## Текущая версия после нового аудита

По новому глубокому аудиту:

| Параметр              | Оценка | Комментарий                                         |
| --------------------- | -----: | --------------------------------------------------- |
| Архитектура           |   5/10 | Модули есть, но оркестратор стал новым God Module   |
| Управление состоянием |   3/10 | Нарушен контракт StateManager                       |
| Производительность    |   5/10 | O(1)-методы есть, но не подключены                  |
| Работа с DOM          |   6/10 | Есть утечки listeners и хрупкие паттерны            |
| Рендеринг             |   4/10 | Full rebuild там, где уже есть локальные обновления |
| Стабильность          |   5/10 | Есть критические edge cases                         |
| UX                    |   5/10 | Много лишних кликов, несогласованность              |
| Дизайн-система        |   4/10 | Две параллельные системы, мёртвый dark mode         |
| Масштабируемость      |   4/10 | Выдержит 2–3x, но не 10x                            |
| Качество кода         |   5/10 | Есть чистые модули, но много casts, dead code       |
| Безопасность          |   3/10 | XSS, нет CSP, нет валидации localStorage            |
| Production readiness  |   3/10 | В текущем виде нельзя выпускать                     |
| Итог                  | 4.5/10 | Модульный фасад поверх хрупкого ядра                |

Важно:

> Текущая версия имеет более высокий архитектурный потенциал, но более низкую фактическую готовность к продакшену из-за безопасности и нарушений контрактов.

---

# 3. Отличие начальной версии от текущей

## 3.1. Архитектура

| Параметр                            | Начальная версия                     | Текущая версия                                                    |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Основная проблема                   | God Function в `card-constructor.ts` | God Module в `CardCraftApp.ts`                                    |
| Размер проблемы                     | ~2731 строка в одном файле           | ~1226–1228 строк в оркестраторе                                   |
| Модульность                         | Нет                                  | Есть 20 модулей                                                   |
| Слои                                | Нет                                  | Core / Infrastructure / State / Rendering / UI Kit / Orchestrator |
| Граф зависимостей                   | Один монолит                         | Ациклический, но со скрытыми конвенциями                          |
| Повторное использование             | Плохое                               | Лучше, но есть дублирование                                       |
| Реальное разделение ответственности | Нет                                  | Частично                                                          |

Вывод:

> Архитектурная форма улучшилась, но часть старой болезни переехала в новый оркестратор.

---

## 3.2. Управление состоянием

| Параметр               | Начальная версия             | Текущая версия                                  |
| ---------------------- | ---------------------------- | ----------------------------------------------- |
| Источник истины        | Массив `cards[]` в замыкании | StateManager с `AppState`                       |
| Декларируемый контракт | Не было явного контракта     | Все изменения через dispatch                    |
| Фактический контракт   | Прямые изменения переменных  | Есть прямые мутации в обход dispatch            |
| UI-state               | Переменные в замыкании       | UIState есть, но мёртвый                        |
| Теневое состояние      | 33 переменные                | 5 локальных `let` в оркестраторе                |
| Undo/redo              | Частично неполный            | Неполный, часть изменений не попадает в историю |

Главная проблема текущей версии:

StateManager декларирует:

> все изменения состояния идут через dispatch;

но новый аудит нашёл 7+ мест прямой мутации карточек.

Это критично, потому что:

- подписчики могут не сработать;
- история может не записаться;
- состояние становится непредсказуемым;
- отладка усложняется;
- unit-тесты теряют смысл.

---

## 3.3. Производительность

| Параметр         | Начальная версия                | Текущая версия                        |
| ---------------- | ------------------------------- | ------------------------------------- |
| Ввод текста      | O(1) через `updatePreviewField` | O(1), но с лишними побочными вызовами |
| Add/delete/move  | Full rebuild                    | Всё ещё full rebuild                  |
| O(1)-методы      | Частично были                   | Существуют, но не используются        |
| Event listeners  | Много, пересоздавались          | Делегирование лучше, но есть утечки   |
| History cloning  | JSON deep clone                 | Всё ещё JSON deep clone               |
| Масштабируемость | Плохая                          | Лучше, но не достаточно               |

Новый аудит выявил парадокс:

> `PreviewRenderer` имеет `removeCard`, `insertCard`, `updateProgressBars`, но они мёртвые, а все операции всё равно делают full rebuild.

Это значит, что архитектурный задел сделан, но он не подключён.

---

## 3.4. Безопасность

Это самое серьёзное отличие.

В начальном аудите говорилось, что пользовательские данные экранируются через `escapeHtml` перед вставкой в `innerHTML`.

Но новый аудит нашёл XSS в атрибутах:

| Место                    | Проблема                                             |
| ------------------------ | ---------------------------------------------------- |
| `PreviewRenderer.ts:251` | `id="card-node-${card.id}"` без безопасной обработки |
| `PreviewRenderer.ts:267` | `data-card-id="card-node-${card.id}"`                |
| `PreviewRenderer.ts:268` | аналогично                                           |
| `PreviewRenderer.ts:239` | `data-theme="${cardTheme}"`                          |
| `PreviewRenderer.ts:240` | `data-format="${settings.format}"`                   |

Если злоумышленник сможет подменить localStorage, он может получить персистентный XSS при загрузке страницы.

Дополнительно:

- нет CSP;
- нет валидации данных из localStorage;
- цвета не проверяются как hex;
- темы не проверяются по whitelist;
- `card.id` не проверяется как безопасный идентификатор;
- CSS-контекст экранируется недостаточно.

Вывод:

> Текущая версия опаснее начальной по безопасности.

---

## 3.5. Стабильность

В прошлой версии было:

- 109 smoke-проверок;
- 0 runtime-ошибок;
- базовые bounds checks;
- обработка повреждённого localStorage через try/catch.

В текущей версии новый аудит нашёл:

- `deleteCard(NaN)` может удалить карточку №0;
- `HistoryManager.push` ломает `histIndex` при достижении MAX_HISTORY;
- `migrateCard` может упасть на `null` внутри `sectionStyles`;
- undo/redo при открытой модалке оставляет stale `activeCardIndexForColors`;
- toast queue может блокировать важные ошибки длинным toast экспорта;
- `WordEditorManager` имеет утечки listeners.

Вывод:

> Стабильность стала более хрупкой, особенно в edge cases.

---

## 3.6. Тестирование

| Параметр                       | Начальная версия | Текущая версия                           |
| ------------------------------ | ---------------- | ---------------------------------------- |
| Smoke-тесты                    | Есть             | Есть                                     |
| Unit-тесты                     | Нет              | Нет                                      |
| CI                             | Нет              | Нет                                      |
| Изолированная проверка модулей | Невозможна       | Возможна архитектурно, но не реализована |
| Проверка безопасности          | Нет              | Нет                                      |

Главная проблема:

> Появились модули, которые можно тестировать, но тестов до сих пор нет.

Это делает любой рефакторинг рискованным.

---

# 4. Что нового выявил файл Pasted markdown(9).md

Новый аудит меняет акценты:

1. **Модульность оказалась не полной**
   - 20 модулей существуют;
   - но оркестратор концентрирует слишком много ответственности;
   - `bindStatic()` — 345 строк;
   - в оркестраторе 24 секции, 15+ вложенных функций, 47 локальных переменных.

2. **StateManager не является настоящим единым источником истины**
   - есть прямые мутации карточек;
   - UIState мёртвый;
   - часть action-ов не используется;
   - `UPDATE_CARD_FIELD` мёртвый.

3. **O(1)-оптимизации не подключены**
   - `removeCard` мёртвый;
   - `insertCard` мёртвый;
   - `updateProgressBars` мёртвый;
   - add/delete/duplicate/move всё ещё делают full rebuild.

4. **Безопасность критична**
   - 4 XSS-вектора;
   - нет CSP;
   - нет валидации localStorage;
   - нет security headers.

5. **Production readiness ниже, чем казалось**
   - `ignoreBuildErrors: true`;
   - `reactStrictMode: false`;
   - ESLint ослаблен;
   - нет unit-тестов;
   - нет мониторинга ошибок;
   - нет CI.

---

# 5. Итоговая сравнительная таблица

| Область              | Начальная версия              | Оптимистичный промежуточный отчёт | Текущая версия после глубокого аудита          |
| -------------------- | ----------------------------- | --------------------------------- | ---------------------------------------------- |
| Архитектура          | Монолит                       | Модули + оркестратор              | Модули, но оркестратор — God Module            |
| Состояние            | Переменные в замыкании        | StateManager                      | StateManager частично обойдён                  |
| История              | Undo/redo базовый             | Generic HistoryManager            | HistoryManager имеет критический баг           |
| Рендеринг            | Full rebuild + O(1) для ввода | PreviewRenderer с O(1)-методами   | O(1)-методы мёртвые, full rebuild сохраняется  |
| Безопасность         | escapeHtml для innerHTML      | Не акцентировалось                | XSS в атрибутах, нет CSP, нет валидации        |
| Тесты                | Smoke only                    | Smoke 108/109 или 109/109         | Smoke есть, unit-тестов нет, CI нет            |
| Зависимости          | 71 пакет, много мёртвых       | Удалено 17                        | Всё ещё много мёртвых зависимостей             |
| Документация         | Нет полной                    | architecture.md                   | Документация частично приукрашивает реальность |
| Production readiness | MVP с оговорками              | Почти ready                       | Не готов                                       |
| Оценка               | 5.5/10                        | ~7/10 ранее                       | 4.5/10 сейчас                                  |

---

# 6. Что нужно агенту сделать в первую очередь

Агенту нужно остановить любую работу над новыми функциями и сосредоточиться на стабилизации.

Главный приоритет:

> Сначала безопасность, целостность состояния и тесты. Только потом новые фичи и оптимизации.

---

# 7. Пошаговый план для агента

## Этап P0. Критические исправления

Срок: 1–3 дня.

Цель: сделать проект минимально безопасным и предсказуемым.

---

## P0-1. Исправить XSS в PreviewRenderer

Нужно защитить все места, где в HTML-атрибуты попадают данные из состояния.

Файл:

```text
src/preview/PreviewRenderer.ts
```

Проблемные места:

- `id="card-node-${card.id}"`
- `data-card-id="card-node-${card.id}"`
- `data-theme="${cardTheme}"`
- `data-format="${settings.format}"`

Что сделать:

1. Добавить безопасное экранирование атрибутов.
2. Использовать `escapeHtml` или отдельный `escapeAttr`.
3. Для `card.id` лучше ввести жёсткий формат.

Пример проверки id:

```ts
function sanitizeCardId(id: unknown): string {
  if (typeof id !== "string") return crypto.randomUUID();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return crypto.randomUUID();
  return id;
}
```

Использовать только безопасный id:

```ts
const safeId = sanitizeCardId(card.id);
```

Критерий готовности:

- невозможно инъектировать атрибут через `card.id`;
- невозможно инъектировать `data-theme`;
- невозможно инъектировать `data-format`;
- есть тест на вредоносные значения.

---

## P0-2. Добавить валидацию localStorage

Файл:

```text
src/state/StorageManager.ts
```

или там, где находится `migrateCard`.

Нужно валидировать:

### card.id

Правило:

```ts
/^[a-zA-Z0-9_-]{1,64}$/;
```

Если невалиден:

```ts
card.id = crypto.randomUUID();
```

### card.theme

Правило:

- должен быть в whitelist известных тем;
- если нет — использовать глобальную тему или дефолт.

### settings.theme

То же самое:

- whitelist;
- fallback на default.

### settings.format

Правило:

- whitelist допустимых форматов;
- fallback на default.

### colors

Все цвета должны проходить проверку:

```ts
/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
```

Или ограничить только hex-цветами.

Если значение невалидно — удалить или заменить дефолтом.

### fontSize

Проверять:

```ts
typeof value === "number";
Number.isFinite(value);
value >= 8;
value <= 96;
```

Или использовать диапазон из бизнес-логики.

### sectionStyles

Добавить guard:

```ts
if (!sectionStyles || typeof sectionStyles !== "object") {
  return {};
}
```

Для каждого поля:

```ts
if (!fieldStyle || typeof fieldStyle !== "object") {
  continue;
}
```

Критерий готовности:

- повреждённый localStorage не ломает приложение;
- вредоносный localStorage не приводит к XSS;
- есть unit-тесты на corrupted data;
- есть unit-тесты на malicious data.

---

## P0-3. Добавить CSP headers

Файл:

```text
next.config.ts
```

Добавить `headers()` с базовой политикой.

Пример:

```ts
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'"
          ].join('; ')
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        }
      ]
    }
  ];
}
```

Важно:

Next.js может требовать inline scripts/styles. Если CSP ломает dev/build, нужно:

1. временно разрешить `'unsafe-inline'` для styles;
2. проверить scripts;
3. постепенно ужесточать через nonce или hash.

Критерий готовности:

- CSP присутствует;
- страница работает;
- XSS-векторы существенно ограничены;
- нет внешних бесконтрольных script-src.

---

## P0-4. Убрать ignoreBuildErrors

Файл:

```text
next.config.ts
```

Найти:

```ts
ignoreBuildErrors: true;
```

Удалить только после исправления всех TypeScript-ошибок.

Порядок:

```bash
bun run build
```

Собрать список ошибок.

Исправить по категориям:

1. nullable DOM elements;
2. missing properties;
3. incorrect payload types;
4. unsafe casts;
5. optional fields;
6. array index access;
7. string/number mismatches.

Критерий готовности:

```bash
bun run build
```

проходит без `ignoreBuildErrors`.

---

## P0-5. Восстановить полноценный ESLint

Файл:

```text
eslint.config.mjs
```

Новый аудит указывает, что отключено слишком много важных правил.

Нужно постепенно включить:

- `no-explicit-any`;
- `no-unused-vars`;
- `no-unreachable`;
- `no-fallthrough`;
- `react-hooks/exhaustive-deps`;
- `prefer-const`;
- `no-undef`;
- `no-debugger`.

Если ошибок слишком много:

1. включить как warnings;
2. исправить критичные;
3. затем перевести в errors.

Критерий готовности:

- ESLint реально проверяет код;
- нет бессмысленного режима “0 errors”, потому что правила отключены.

---

## P0-6. Исправить undo для цветов, размеров и секций

Новый аудит нашёл 5 операций, которые меняют карточку, но не вызывают `scheduleHistoryPush`.

Нужно добавить историю для:

1. color input;
2. color swatch click;
3. single-color reset;
4. section size slider;
5. list num size slider.

Файл:

```text
src/orchestrator/CardCraftApp.ts
```

Что сделать:

- после мутации/изменения вызывать:

```ts
scheduleHistoryPush();
scheduleSave();
```

Но лучше не мутировать напрямую, а dispatch-ить action.

Критерий готовности:

- пользователь меняет цвет → undo возвращает старый цвет;
- пользователь меняет size → undo возвращает старый size;
- пользователь сбрасывает цвет → undo восстанавливает состояние до сброса;
- нет дублирования истории при debounce.

---

## P0-7. Исправить HistoryManager MAX_HISTORY

Файл:

```text
src/state/HistoryManager.ts
```

Проблема:

При достижении MAX_HISTORY делается `shift()`, но `histIndex` не декрементируется.

Из-за этого:

- undo/redo может сломаться;
- `canRedo` может стать навсегда false;
- история тихо портится на 50-й записи.

Что сделать:

```ts
if (this.stack.length >= MAX_HISTORY) {
  this.stack.shift();
  this.histIndex--;
}
```

Добавить clamp:

```ts
this.histIndex = Math.max(0, Math.min(this.histIndex, this.stack.length - 1));
```

Критерий готовности:

- после 60 push undo работает;
- redo работает корректно;
- есть unit-тест на 51/60 push.

---

## P0-8. Защитить deleteCard от NaN

Файл:

```text
src/orchestrator/CardCraftApp.ts
```

Проблема:

```ts
deleteCard(NaN);
```

может интерпретироваться как удаление карточки №0.

Добавить guard:

```ts
if (Number.isNaN(idx) || idx < 0 || idx >= cards.length) {
  return;
}
```

Критерий готовности:

- NaN не удаляет карточку;
- отрицательный индекс не удаляет карточку;
- индекс вне диапазона не удаляет карточку;
- есть unit-тест или smoke-проверка.

---

## P0-9. Защитить migrateCard от null sectionStyles

Файл:

```text
src/state/StorageManager.ts
```

Проблема:

Если localStorage повреждён:

```ts
sectionStyles[field] === null;
```

то обращение к `old.bold` может бросить TypeError.

Добавить:

```ts
if (!old || typeof old !== "object") continue;
```

Критерий готовности:

- corrupted localStorage не приводит к crash;
- приложение восстанавливает дефолты;
- есть тест на `sectionStyles: null`.

---

# 8. Этап P1. Восстановление архитектурного контракта

Срок: 3–7 дней.

Цель: сделать StateManager настоящим единым источником истины.

---

## P1-1. Убрать прямые мутации состояния

Новый аудит нашёл 7+ мест, где карточки мутируются напрямую.

Примеры:

```ts
(card as unknown as Record<string, unknown>)[field] = value;
card.colors.listNumSize = String(size);
card.colors[f.key] = this.value;
card.colors[f] = hex;
card.sectionStyles[field]!.fontSize = size;
card.colors = {};
card.sectionStyles = {};
```

Нужно заменить на dispatch actions.

Например:

```ts
stateManager.dispatch({
  type: "SET_CARD_FIELD_COLOR",
  payload: {
    cardId,
    field,
    value,
  },
});
```

Или:

```ts
stateManager.dispatch({
  type: "SET_SECTION_FONT_SIZE",
  payload: {
    cardId,
    field,
    size,
  },
});
```

Критерий готовности:

- нет прямых мутаций `card.colors`;
- нет прямых мутаций `card.sectionStyles`;
- нет прямых мутаций полей карточки;
- все изменения идут через dispatch;
- подписчики реагируют корректно.

---

## P1-2. Сделать Action типобезопасным

Сейчас проблема:

```ts
payload?: unknown
```

Это порождает множество `as` casts.

Нужно использовать discriminated union:

```ts
type Action =
  | { type: "ADD_CARD" }
  | { type: "DELETE_CARD"; payload: { cardId: string } }
  | { type: "MOVE_CARD"; payload: { cardId: string; direction: "up" | "down" } }
  | {
      type: "SET_CARD_COLOR";
      payload: { cardId: string; field: string; value: string };
    }
  | {
      type: "SET_SECTION_FONT_SIZE";
      payload: { cardId: string; field: string; size: number };
    }
  | { type: "RESTORE_SNAPSHOT"; payload: Snapshot };
```

Критерий готовности:

- удалены `as unknown as`;
- reducer получает типизированный payload;
- TypeScript помогает, а не мешает.

---

## P1-3. Убрать теневое UI-состояние

Сейчас есть:

- `UIState` в StateManager;
- локальные `let` переменные в оркестраторе:
  - `activeCardIndexForColors`;
  - `activeCardIndexForWord`;
  - `activeFieldForWord`;
  - `lastActiveField`;
  - `sidebarWasCollapsedBeforeModal`.

Нужно решить:

1. либо реально использовать `UIState` из StateManager;
2. либо честно удалить его и оформить локальное состояние как отдельный контроллер.

Рекомендация:

> Перенести UI-состояние в StateManager.

Это даст:

- единый источник истины;
- тестируемость;
- предсказуемое закрытие модалок при undo/redo;
- возможность сброса состояния.

---

## P1-4. restore() должен закрывать modal и popup

Файл:

```text
src/orchestrator/CardCraftApp.ts
```

При undo/redo/restore нужно:

- закрыть color modal;
- закрыть word popup;
- сбросить active indices;
- сбросить lastActiveField;
- отменить pending timers при необходимости.

Критерий готовности:

- после undo нет открытой модалки с устаревшей карточкой;
- после redo нет popup, привязанного к несуществующей карточке;
- нет stale activeCardIndex.

---

# 9. Этап P1. Исправление утечек и cleanup

---

## P1-5. Исправить WordEditorManager listener leaks

Файл:

```text
src/word-editor/WordEditorManager.ts
```

Проблема:

`initControls()` навешивает примерно 16 listeners без tracking.

`destroy()` удаляет только drag cleanup.

Что сделать:

1. Создать массив listeners:

```ts
private listeners: Array<{
  target: EventTarget;
  type: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
}> = [];
```

2. Все addEventListener регистрировать.

3. В destroy:

```ts
for (const { target, type, handler, options } of this.listeners) {
  target.removeEventListener(type, handler, options);
}
this.listeners = [];
```

Критерий готовности:

- destroy удаляет все listeners;
- повторная инициализация не создаёт дубли;
- нет утечек при StrictMode.

---

## P1-6. Исправить ToastQueue timeout leak

Файл:

```text
src/orchestrator/toast.ts
```

или соответствующий модуль.

Проблема:

Внутренний `setTimeout` не отслеживается, и `destroy()` не может его отменить.

Что сделать:

- сохранять timeout id;
- очищать в destroy;
- не показывать toast после cleanup.

Критерий готовности:

- после destroy toast не появляется;
- нет stale DOM;
- нет ошибок при размонтировании.

---

## P1-7. Исправить Dropdown rAF leak

Файл:

```text
src/ui/Dropdown.ts
```

Проблема:

`requestAnimationFrame` может добавить listener после destroy.

Что сделать:

- сохранять rAF id;
- отменять в destroy;
- проверять destroyed flag перед addEventListener.

Критерий готовности:

- destroy до rAF callback предотвращает listener;
- нет ошибок при быстром unmount.

---

# 10. Этап P1. Подключить O(1)-методы или удалить мёртвый код

Новый аудит выявил, что существуют методы:

- `removeCard`;
- `insertCard`;
- `updateProgressBars`;
- возможно `updateCardNumber`;

но они не используются.

Есть два пути.

---

## Вариант A. Подключить O(1)-методы

Это правильный путь, но требует аккуратности.

Нужно:

1. Заменить `data-index` на `data-card-id`.
2. Обновить editor и preview по id.
3. После локальных операций обновлять номера.
4. Проверить numbering, progress bar, badges.
5. Проверить undo/redo после локальных операций.

Операции:

| Операция              | Текущее       | Должно быть                |
| --------------------- | ------------- | -------------------------- |
| add                   | full rebuild  | insertCard                 |
| delete                | full rebuild  | removeCard                 |
| duplicate             | full rebuild  | insertCard после оригинала |
| move                  | full rebuild  | DOM swap + update state    |
| progress style change | renderPreview | updateProgressBars         |
| theme change          | renderPreview | updateCardTheme            |

Критерий готовности:

- нет stale `data-index`;
- операции работают по id;
- preview/editor синхронизированы;
- undo/redo корректен.

---

## Вариант B. Удалить мёртвый код

Если O(1)-методы пока рискованно подключать:

- удалить `removeCard`;
- удалить `insertCard`;
- удалить `updateProgressBars`;
- удалить неиспользуемые actions;
- обновить документацию.

Но стратегически лучше выбрать вариант A.

---

# 11. Этап P2. Декомпозиция оркестратора

Срок: 1–2 недели.

Цель: убрать новый God Module.

---

## P2-1. Разделить CardCraftApp.ts

Файл:

```text
src/orchestrator/CardCraftApp.ts
```

Рекомендуемая декомпозиция:

```text
src/orchestrator/
 ├── CardCraftApp.ts        # тонкий entry point
 ├── boot.ts                # инициализация
 ├── dom-refs.ts            # кэш DOM элементов
 ├── events.ts              # bindStatic
 ├── modal-controller.ts    # color modal
 ├── word-popup-controller.ts
 ├── export-controller.ts
 ├── theme-controller.ts
 ├── resize-controller.ts
 ├── keyboard-controller.ts
 ├── char-limit-controller.ts
 └── history-controller.ts
```

Ответственности должны быть разделены:

| Модуль                | Ответственность           |
| --------------------- | ------------------------- |
| boot                  | создание и destroy        |
| dom-refs              | сбор DOM-ссылок           |
| events                | подписки                  |
| modal-controller      | открытие/закрытие модалки |
| word-popup-controller | popup слова               |
| export-controller     | PNG export                |
| theme-controller      | темы                      |
| resize-controller     | resize sidebar/header     |
| keyboard-controller   | Ctrl+Z/Y                  |
| history-controller    | undo/redo                 |

Критерий готовности:

- `CardCraftApp.ts` становится тонким;
- нет функции на 1000+ строк;
- каждый контроллер имеет destroy;
- легко писать unit/integration тесты.

---

## P2-2. Разделить bindStatic

`bindStatic()` сейчас слишком большой.

Нужно разбить на:

- bindTopbarEvents;
- bindSidebarEvents;
- bindEditorEvents;
- bindPreviewEvents;
- bindModalEvents;
- bindPopupEvents;
- bindExportEvents;
- bindKeyboardEvents;
- bindResizeEvents.

Критерий готовности:

- нет одной функции на 345 строк;
- каждая группа событий имеет cleanup;
- легко найти нужный обработчик.

---

# 12. Этап P2. Тестирование

Это критически важно.

---

## P2-3. Добавить Vitest

Установить:

```bash
bun add -d vitest @vitest/coverage-v8 jsdom @testing-library/dom
```

или аналогичный набор.

Добавить скрипт:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## P2-4. Написать unit-тесты для критических модулей

### StateManager

Проверить:

- ADD_CARD;
- DELETE_CARD;
- MOVE_CARD;
- DUPLICATE_CARD;
- SET_THEME;
- SET_FORMAT;
- SET_PROGRESS_CONFIG;
- RESTORE_SNAPSHOT;
- иммутабельность состояния;
- подписки.

### HistoryManager

Проверить:

- push;
- undo;
- redo;
- MAX_HISTORY;
- debounce;
- canUndo/canRedo;
- восстановление после 50+ push.

### StorageManager

Проверить:

- save;
- load;
- corrupted JSON;
- missing keys;
- malicious card.id;
- malicious theme;
- invalid colors;
- null sectionStyles;
- quota exceeded.

### utils / StyleHelpers

Проверить:

- escapeHtml;
- containsWholeWord;
- applyWordStylesToText;
- pruneOrphanWordStyles.

### PreviewRenderer

Проверить:

- экранирование card.id;
- экранирование theme;
- экранирование format;
- render;
- updateCardField;
- updateCardStyle;
- removeCard;
- insertCard.

Критерий готовности:

- есть `bun run test`;
- критические функции покрыты;
- тесты могут запускаться без Agent Browser.

---

## P2-5. Сделать smoke-тест CI-runnable

Сейчас smoke-тест завязан на Agent Browser.

Нужно либо:

1. оставить его как дополнительный;
2. либо переписать на Playwright.

Рекомендация:

> Добавить Playwright E2E.

Проверить:

- приложение загружается;
- можно добавить карточку;
- можно ввести текст;
- можно поменять тему;
- undo/redo работает;
- export mode включается;
- нет console errors.

---

# 13. Этап P2. Удаление мёртвого кода и зависимостей

---

## P2-6. Удалить мёртвые зависимости

Новый аудит говорит, что фактически используется около 6 зависимостей.

Нужно проверить:

```bash
bun pm ls
```

Кандидаты на удаление:

- `@prisma/client`;
- `prisma`;
- `sharp`;
- `recharts`;
- `embla-carousel-react`;
- `react-day-picker`;
- `react-resizable-panels`;
- `react-hook-form`;
- `cmdk`;
- `vaul`;
- `sonner`;
- `next-themes`;
- `next-auth`;
- `next-intl`;
- `zod`;
- `zustand`;
- `@tanstack/*`;
- `@radix-ui/*`, если не используются;
- `z-ai-web-dev-sdk`, если нет реальных AI-фич.

Удалять только после:

```bash
bun run build
bun run lint
```

Критерий готовности:

- в `package.json` только реально используемые пакеты;
- build проходит;
- lint проходит;
- приложение работает.

---

## P2-7. Удалить мёртвый shadcn/UI kit

Если `src/components/ui/*` не используется:

- удалить;
- удалить неиспользуемые hooks;
- удалить `lib/db.ts`, если Prisma не используется;
- удалить неиспользуемые utils.

Критерий готовности:

- нет ~5300 строк мёртвого кода;
- нет ложного ощущения, что проект использует design system shadcn.

---

# 14. Этап P3. StrictMode, bundle, performance

---

## P3-1. Включить React StrictMode только после cleanup

Файл:

```text
next.config.ts
```

Установить:

```ts
reactStrictMode: true;
```

Но только после:

- исправления listener leaks;
- исправления destroy;
- исправления toast timeout;
- исправления dropdown rAF;
- проверки double-mount;
- проверки повторной инициализации.

Критерий готовности:

- в dev нет дублей DOM;
- нет дублей listeners;
- нет ошибок;
- smoke/E2E проходят.

---

## P3-2. Bundle analysis

Добавить:

```bash
bun add -D @next/bundle-analyzer
```

Проверить:

- размер первого load;
- vendor chunks;
- размер `html-to-image`;
- размер шрифтов;
- размер CSS.

Возможные улучшения:

```ts
const { toPng } = await import("html-to-image");
```

Критерий готовности:

- есть bundle report;
- тяжёлые модули загружаются лениво, если возможно;
- нет мёртвых библиотек в bundle.

---

## P3-3. Улучшить export pipeline

Проблемы:

- sequential await;
- блокировка UI;
- нет cancel;
- нет нормального progress;
- пользователь может редактировать во время экспорта.

Нужно:

1. блокировать редактирование на время экспорта;
2. показывать progress;
3. добавить cancel;
4. рассмотреть `requestIdleCallback` или batching;
5. не блокировать error toasts длинными toast.

Критерий готовности:

- экспорт не даёт пользователю ломать состояние;
- есть progress;
- есть cancel;
- ошибки видны сразу.

---

# 15. Этап P3. UX и дизайн-система

Это не критично для безопасности, но важно для продукта.

---

## P3-4. Исправить ESC и confirm dialog

Проблема:

ESC не закрывает `#confirmOverlay`.

Нужно добавить:

- ESC закрывает confirm dialog;
- focus trap;
- aria-modal;
- единый паттерн для всех overlay.

---

## P3-5. Уменьшить количество лишних кликов

Рекомендации:

1. открыть первый важный sidebar accordion по умолчанию;
2. в модалке стилей открыть наиболее используемую секцию;
3. показывать live preview в модалке;
4. обновлять char counter при blur/переключении карточки;
5. убрать декоративные кнопки, если они не несут действия;
6. дать фидбек при неудачном открытии word popup.

---

## P3-6. Разделить CSS

Файл:

```text
src/app/card-constructor.css
```

Размер: ~3700 строк.

Разделить на:

```text
styles/
 ├── tokens.css
 ├── layout.css
 ├── sidebar.css
 ├── editor.css
 ├── preview.css
 ├── modal.css
 ├── popup.css
 ├── themes.css
 └── export.css
```

Критерий готовности:

- CSS легче поддерживать;
- темы вынесены отдельно;
- нет случайных конфликтов.

---

## P3-7. Решить вопрос с dark mode

Сейчас dark mode мёртвый.

Варианты:

1. удалить `.dark` tokens и `next-themes`;
2. либо реально реализовать dark mode.

Не следует оставлять фантомную функциональность.

---

# 16. Рекомендуемые спринты для агента

## Спринт 0. Остановка деградации

Цель: зафиксировать текущее состояние.

Задачи:

1. Запретить новые фичи.
2. Запустить:
   ```bash
   bun install
   bun run build
   bun run lint
   bun run dev
   ```
3. Прогнать smoke-тест.
4. Если есть 1 failing test — зафиксировать как P0.
5. Сделать backup branch.

Definition of Done:

- есть baseline;
- известно, сколько тестов проходит;
- есть branch для стабилизации.

---

## Спринт 1. Безопасность и данные

Цель: закрыть критические уязвимости.

Задачи:

1. Валидация localStorage.
2. Экранирование атрибутов.
3. CSP headers.
4. Fix `migrateCard` null guard.
5. Fix `deleteCard(NaN)`.
6. Fix HistoryManager MAX_HISTORY.
7. Добавить тесты на эти случаи.

Definition of Done:

- нет XSS через localStorage;
- corrupted data не роняет приложение;
- undo не ломается на 50+ записей;
- NaN не удаляет карточку.

---

## Спринт 2. State contract

Цель: вернуть StateManager как единый источник истины.

Задачи:

1. Убрать прямые мутации.
2. Ввести typed actions.
3. Подключить `scheduleHistoryPush` к недостающим операциям.
4. Закрыть modal/popup при restore.
5. Убрать мёртвый UIState или начать использовать его.

Definition of Done:

- все изменения идут через dispatch;
- undo работает для цвета, размеров, секций;
- нет stale active indices после undo.

---

## Спринт 3. Cleanup и leaks

Цель: подготовить проект к StrictMode.

Задачи:

1. WordEditorManager destroy.
2. ToastQueue destroy.
3. Dropdown rAF leak.
4. Проверить все listeners.
5. Проверить timers.
6. Проверить double-mount вручную.

Definition of Done:

- нет утечек listeners;
- destroy полностью очищает модули;
- повторный mount безопасен.

---

## Спринт 4. Декомпозиция оркестратора

Цель: убрать God Module.

Задачи:

1. Выделить boot.
2. Выделить dom-refs.
3. Вынести modal controller.
4. Вынести word popup controller.
5. Вынести export controller.
6. Вынести keyboard controller.
7. Обновить destroy.

Definition of Done:

- `CardCraftApp.ts` больше не содержит 1000+ строк логики;
- каждый контроллер имеет понятный public API;
- код легче тестировать.

---

## Спринт 5. Тесты и CI

Цель: сделать рефакторинг безопасным.

Задачи:

1. Vitest.
2. Unit-тесты для StateManager.
3. Unit-тесты для HistoryManager.
4. Unit-тесты для StorageManager.
5. Unit-тесты для utils.
6. Playwright smoke.
7. CI pipeline.

Definition of Done:

```bash
bun run test
```

работает локально и в CI.

---

## Спринт 6. Production readiness

Цель: подготовить релиз.

Задачи:

1. Убрать `ignoreBuildErrors`.
2. Включить нормальный ESLint.
3. Включить StrictMode.
4. Bundle analysis.
5. Удалить мёртвые зависимости.
6. Удалить мёртвый shadcn kit.
7. Добавить security headers.
8. Проверить Lighthouse и a11y.

Definition of Done:

- build без ignoreBuildErrors;
- lint реальный;
- strict mode работает;
- bundle контролируемый;
- нет мёртвых зависимостей.

---

# 17. Что агенту НЕ нужно делать сейчас

Не нужно:

1. Добавлять новые фичи.
2. Делать AI-интеграции.
3. Переписывать всё на React-компоненты до стабилизации.
4. Включать StrictMode до исправления leaks.
5. Удалять зависимости без проверки build.
6. Подключать O(1)-методы без тестов.
7. Игнорировать XSS из-за того, что данные локальные.
8. Считать smoke-тесты достаточной гарантией качества.
9. Оставлять `ignoreBuildErrors: true` как постоянное решение.
10. Держать документацию, которая не отражает реальное состояние.

---

# 18. Финальная оценка

## Начальная версия

**5.5/10**

Плюсы:

- рабочий продукт;
- хороший UX/UI;
- 109 smoke-проверок;
- базовая защита от XSS через innerHTML.

Минусы:

- God Function;
- нет модульности;
- плохая масштабируемость;
- высокая стоимость изменений.

---

## Текущая версия

**4.5/10 по production readiness**

Плюсы:

- модульная структура;
- есть StateManager, HistoryManager, StorageManager;
- есть PreviewRenderer, EditorRenderer, WordEditorManager;
- есть O(1)-заделы;
- есть Error Boundary;
- часть зависимостей удалена.

Минусы:

- XSS в атрибутах;
- нет CSP;
- нет валидации localStorage;
- StateManager обойдён;
- undo не покрывает часть изменений;
- оркестратор снова God Module;
- мёртвый код;
- нет unit-тестов;
- production readiness низкий.

---

## Потенциал после исправлений

Если агент выполнит P0 и P1:

- безопасность: 3/10 → 7/10;
- управление состоянием: 3/10 → 7/10;
- стабильность: 5/10 → 7.5/10;
- поддерживаемость: 4/10 → 7/10;
- production readiness: 3/10 → 7/10;
- общая оценка: 4.5/10 → 7.5/10.

---

# 19. Самый короткий приказ агенту

Если нужно дать агенту одну директиву, она должна быть такой:

> Немедленно остановить разработку новых функций.  
> Приоритет №1 — безопасность и целостность состояния.  
> Нужно исправить XSS через атрибуты, добавить валидацию localStorage, добавить CSP, убрать `ignoreBuildErrors`, исправить undo для цветов и размеров, исправить HistoryManager MAX_HISTORY, защитить deleteCard от NaN, закрыть modal/popup при undo, исправить утечки listeners и добавить unit-тесты для StateManager, HistoryManager, StorageManager и критических utils.  
> Только после этого разрешается декомпозиция оркестратора, подключение O(1)-методов, включение StrictMode и дальнейшее развитие продукта.
