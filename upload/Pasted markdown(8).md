Ниже — сводный анализ проекта на основе трёх отчётов: первичного технического аудита, технической документации и сравнительного отчёта о рефакторинге. Главный вывод: проект прошёл очень большой путь от неподдерживаемого монолита к модульной архитектуре с оркестратором, но сейчас находится в переходном состоянии — новый оркестратор уже включён, старый God Function ещё оставлен как fallback, один smoke-тест падает, часть рисков не закрыта.

---

# 1. Краткая оценка

## Исходная версия

Исходная версия была функционально рабочей, визуально качественной, но архитектурно слабой.

Основная проблема — один гигантский модуль `src/lib/card-constructor.ts` и одна огромная функция `initCardConstructor`.

Характеристики старой версии:

- примерно 2.7 тыс. строк в одном файле;
- God Function около 2473–2731 строк;
- 66 функций внутри одного замыкания;
- 33 переменные состояния в одном scope;
- 68 `addEventListener`;
- 51 `querySelector`;
- 11 localStorage-ключей;
- 90 тем в CSS;
- 71 зависимость в `package.json`, из которых реально использовалось только около 6;
- `reactStrictMode: false`;
- `ignoreBuildErrors: true`;
- 128 non-null assertions;
- отсутствие модульности;
- отсутствие изолированных unit-тестов;
- единственный smoke-test через Agent Browser.

При этом сильные стороны старой версии были важными:

- XSS-защита через `escapeHtml`;
- рабочее сохранение в localStorage;
- undo/redo;
- экспорт PNG;
- 109 passing smoke-проверок;
- хороший UX и премиальный визуальный стиль;
- оптимизированные точечные обновления preview через `updatePreviewField`.

Но масштабирование было плохим: добавление любой функции требовало понимания всего монолита.

Итоговая оценка старой версии: примерно **5.5/10**.

Это был хороший MVP/прототип, но плохая основа для долгосрочной разработки.

---

## Текущая версия

Текущая версия уже сильно лучше.

Выполнен крупный рефакторинг:

- создан `src/orchestrator/CardCraftApp.ts`;
- логика разнесена по модулям;
- выделены StateManager, HistoryManager, StorageManager, PreviewRenderer, EditorRenderer, WordEditorManager, UI Kit;
- добавлен Error Boundary;
- удалено 17 неиспользуемых production-зависимостей;
- `page.tsx` переключён на новый оркестратор через `USE_NEW_ORCHESTRATOR = true`;
- старый `card-constructor.ts` оставлен только как fallback;
- smoke-тесты проходят на **108/109**.

Текущая модульная статистика:

| Слой                   | Примерный размер |
| ---------------------- | ---------------: |
| Core                   |        268 строк |
| Infrastructure         |       534 строки |
| State                  |        409 строк |
| Rendering              |       972 строки |
| UI Kit                 |       701 строка |
| Orchestrator + helpers |       1475 строк |
| Итого                  |       4359 строк |
| Модулей                |               20 |
| Средний модуль         |       ~218 строк |

То есть общая строк стало больше, но это нормально: появились явные границы, типы, классы, менеджерские сущности, UI-компоненты и оркестрация. Главное не количество строк, а снижение когнитивной нагрузки.

Раньше нужно было понимать одну функцию на 2.7 тыс. строк. Теперь можно править отдельный модуль со средней длиной около 200 строк.

Итоговая оценка текущей версии: примерно **7.0/10**.

Но важно: это оценка с оговорками, потому что:

- один тест падает;
- legacy-код ещё не удалён;
- StrictMode всё ещё отключён;
- нет полноценных unit-тестов;
- bundle-оптимизация не сделана;
- часть зависимостей всё ещё может быть лишней;
- нужно проверить double-mount, cleanup и race conditions.

---

# 2. Главное отличие начальной версии от текущей

## Архитектура

| Область                 | Раньше                                        | Сейчас                                          |
| ----------------------- | --------------------------------------------- | ----------------------------------------------- |
| Архитектура             | Один God Function                             | Модульная система + Orchestrator                |
| Точка входа             | `initCardConstructor(root)`                   | `initCardCraftApp` / `CardCraftApp`             |
| Состояние               | Переменные в замыкании                        | StateManager, типизированный `AppState`         |
| История                 | Встроенный undo/redo внутри монолита          | Generic `HistoryManager<T>`                     |
| Рендер preview          | `renderPreview()` O(n), полная перестройка    | `PreviewRenderer` с точечными O(1)-обновлениями |
| Рендер editor           | `renderEditor()` O(n), пересоздание listeners | `EditorRenderer` + event delegation             |
| Word popup              | Логика внутри God Function                    | Отдельный `WordEditorManager`                   |
| UI-компоненты           | Императивные куски в одном файле              | UI Kit: Accordion, Modal, Switch, Dropdown      |
| Обработка ошибок        | Нет Error Boundary                            | Error Boundary добавлен                         |
| Тесты                   | 109/109 на старой версии                      | 108/109 на новой версии                         |
| Зависимости             | 71 пакет, много мусора                        | Удалено 17 неиспользуемых пакетов               |
| Поддерживаемость        | Низкая                                        | Заметно выше                                    |
| Готовность к расширению | Плохая                                        | Хорошая после стабилизации                      |

---

## Что стало лучше

### 1. Разделение ответственности

Раньше всё было в одном замыкании:

- состояние;
- рендеринг;
- события;
- undo/redo;
- localStorage;
- экспорт;
- drag;
- resize;
- word styles;
- темы;
- валидация.

Теперь есть отдельные зоны ответственности:

- StateManager;
- HistoryManager;
- StorageManager;
- PreviewRenderer;
- EditorRenderer;
- WordEditorManager;
- UI Kit;
- Orchestrator;
- helpers: toast, resizers, export-mode.

Это главное архитектурное улучшение.

---

### 2. События и DOM

Раньше:

- `renderEditor()` пересоздавал много обработчиков;
- было 68 `addEventListener`;
- существовал риск дублирования listeners;
- удаление обработчиков было частичным.

Сейчас:

- введены event delegation подходы;
- PreviewRenderer использует 2 слушателя вместо 3×N;
- EditorRenderer использует 4 слушателя вместо 3NM;
- UI-компоненты имеют `destroy()`;
- cleanup стал более осознанным.

Но всё равно нужно проверить, что при unmount в React StrictMode всё корректно уничтожается.

---

### 3. Производительность

Раньше:

- `renderPreview()` полностью перестраивал DOM;
- `renderEditor()` полностью перестраивал editor;
- смена темы или прогресс-стиля могла вызывать лишние full re-render;
- `deepClone` через `JSON.parse(JSON.stringify())` был медленным.

Сейчас:

- есть точечные обновления `updateCardField`, `updateCardStyle`, `removeCard`, `insertCard`;
- event delegation уменьшает количество listeners;
- состояние отделено от рендеринга;
- потенциально можно быстрее обновлять UI.

Но пока нет benchmark-сравнения старой и новой версии. Поэтому фактический прирост нужно измерить.

---

### 4. Надёжность

Раньше:

- не было Error Boundary;
- падение `initCardConstructor` приводило к белому экрану;
- TypeScript-ошибки игнорировались через `ignoreBuildErrors: true`;
- было много non-null assertions.

Сейчас:

- добавлен Error Boundary;
- архитектура стала более тестируемой;
- часть зависимостей удалена;
- smoke-тесты почти полностью проходят.

Но:

- один тест падает;
- StrictMode выключен;
- нужно подтвердить, что новый orchestrator не имеет проблем с double-mount.

---

### 5. Зависимости

Раньше:

- 71 production-зависимость;
- реально нужно было около 6;
- большое количество shadcn/radix/tanstack/framer-motion/zod/next-auth и других пакетов были неиспользуемыми.

Сейчас:

- удалено 17 production-зависимостей;
- но полная очистка ещё не завершена.

Это важно для:

- скорости установки;
- размера bundle;
- supply-chain безопасности,
- упрощения поддержки.

---

# 3. Сравнительная оценка

| Параметр             | Старая версия | Текущая версия | Комментарий                                     |
| -------------------- | ------------: | -------------: | ----------------------------------------------- |
| Архитектура          |          3/10 |           7/10 | Был God Function, стала модульная структура     |
| Масштабируемость     |          2/10 |           5/10 | Стало лучше, но нужны тесты, bundle, cleanup    |
| Поддерживаемость     |          3/10 |         6.5/10 | Правки теперь можно делать локально             |
| Читаемость           |          4/10 |         6.5/10 | Модули меньше, но нужны JSDoc и docs            |
| Производительность   |          7/10 |           7/10 | Есть потенциал, но нет benchmark                |
| Стабильность         |          7/10 |         6.5/10 | Раньше 109/109, сейчас 108/109                  |
| UX                   |          7/10 |           7/10 | Существенно не менялся                          |
| UI                   |          8/10 |           8/10 | Премиальный визуальный стиль сохранён           |
| Тестируемость        |          2/10 |           5/10 | Появилась возможность unit-тестов               |
| Type safety          |          5/10 |         5.5/10 | Есть прогресс, но нужно убрать `!`, `as never`  |
| Production readiness |    Условно да |       Почти да | Нужно исправить падающий тест и убрать fallback |
| Итог                 |        5.5/10 |         7.0/10 | Большой прогресс                                |

---

# 4. Что уже сделано сверх первоначального плана

Первый план предполагал этапы:

1. Core/Infrastructure/State;
2. PreviewRenderer;
3. EditorRenderer;
4. WordEditorManager;
5. UI Kit;
6. Stabilization.

Фактически сделано больше:

- создан полноценный Orchestrator;
- `page.tsx` переведён на новый оркестратор;
- добавлен feature flag;
- smoke-тесты прогнаны через браузер;
- StateManager получил дополнительные actions;
- исправлен ряд багов;
- обновлены UI defaults;
- создан `docs/architecture.md`;
- внедрён Error Boundary;
- удалена часть зависимостей.

То есть проект перешёл из состояния «монолит» в состояние «новая архитектура уже работает, но требует финальной стабилизации».

---

# 5. Текущие главные риски

## P0: падающий smoke-тест

Один тест падает:

> «Dblclick в поле редактора НЕ открывает попап».

Это критично, потому что:

- нарушено ожидаемое поведение;
- новый оркестратор может неправильно обрабатывать dblclick;
- возможен конфликт event delegation;
- возможен лишний вызов word popup.

Вероятная причина:

- в новом orchestrator обработчик dblclick слушает слишком широкую область;
- не проверяется, что событие произошло внутри `textarea`/`input` редактора;
- отсутствует `stopPropagation` или guard;
- старый код гасил такое событие, а новый — нет.

Это нужно исправить первым.

---

## P1: legacy fallback всё ещё существует

Старый `src/lib/card-constructor.ts` пока оставлен как fallback.

Это правильно для миграции, но плохо для долгосрочной поддержки:

- два параллельных пути;
- риск, что кто-то случайно включит старый код;
- дублирование логики;
- сложнее рефакторить;
- тесты могут проверять неактуальный путь.

Нужно удалить legacy после подтверждения стабильности.

---

## P1: React StrictMode отключён

`reactStrictMode: false` скрывает проблемы double-mount.

Для нового оркестратора это особенно важно, потому что:

- оркестратор императивно управляет DOM;
- при double-mount могут создаваться дубли listeners;
- могут утекать timers;
- могут оставаться подписки;
- могут дублироваться resize/drag/popup handlers.

StrictMode нужно включать только после проверки cleanup.

---

## P1: нет unit-тестов

Smoke-тест — это хорошо, но недостаточно.

Нужны unit-тесты для:

- StateManager;
- HistoryManager;
- StorageManager;
- PreviewRenderer;
- EditorRenderer;
- WordEditorManager;
- миграции карточек;
- undo/redo;
- localStorage recovery;
- export-mode;
- валидации данных.

Без unit-тестов рефакторинг снова может деградировать.

---

## P2: bundle и зависимости

Не сделано:

- анализ размера bundle;
- tree-shaking;
- code-splitting;
- dynamic import для тяжёлых частей, например `html-to-image`;
- полная очистка неиспользуемых зависимостей.

Это влияет на:

- скорость загрузки;
- install time;
- безопасность;
- production-стабильность.

---

## P2: document gaps

Нужно обновить `docs/architecture.md`:

- добавить Orchestrator layer;
- добавить helper-модули;
- обновить статистику;
- описать миграционный флаг;
- зафиксировать правила слоёв;
- описать порядок удаления legacy.

---

# 6. Необходимые шаги для агента

Ниже — конкретный план действий.

---

# Этап A. Срочная стабилизация

Приоритет: **P0**.

## A1. Исправить падающий тест

Задача:

> Dblclick в поле редактора не должен открывать word popup.

Что сделать:

1. Запустить проект:

   ```bash
   bun install
   bun run dev
   ```

2. Открыть приложение.

3. Вручную проверить:
   - dblclick в textarea редактора;
   - dblclick в input редактора;
   - dblclick в preview-области;
   - dblclick на карточке;
   - dblclick на кнопках;
   - dblclick на пустой области.

4. Найти место, где новый orchestrator открывает word popup.

Вероятные файлы:

- `src/orchestrator/CardCraftApp.ts`;
- `src/word-editor/WordEditorManager.ts`;
- `src/editor/EditorRenderer.ts`;
- `src/preview/PreviewRenderer.ts`.

5. Добавить guard.

Пример логики:

```ts
if (event.target instanceof HTMLElement) {
  const isEditableField = event.target.closest(
    'textarea, input, [contenteditable="true"]',
  );
  if (isEditableField) return;
}
```

Или, если событие должно игнорироваться только в editor area:

```ts
const editorRoot = ...;
if (editorRoot.contains(event.target)) return;
```

6. Проверить, что:
   - dblclick в editor field НЕ открывает popup;
   - dblclick там, где нужно, открывает popup;
   - popup корректно закрывается;
   - нет дублирования popup;
   - нет утечки listeners.

7. Прогнать smoke-тест:
   ```bash
   agent-browser open http://localhost:3000
   agent-browser eval "$(cat tests/smoke-test.js)"
   ```

Ожидаемый результат:

```text
passed: 109
failed: 0
```

Критерий готовности:

- 109/109 smoke-тестов проходят;
- поведение dblclick соответствует старой версии;
- нет новых визуальных регрессий.

---

## A2. Проверить cleanup при unmount

Задача:

Убедиться, что новый оркестратор корректно уничтожается.

Проверить:

- `destroy()` у UI Kit;
- `destroy()` у WordEditorManager;
- удаление document listeners;
- удаление resize listeners;
- очистку debounce timers;
- очистку history timers;
- очистку localStorage schedule timers;
- отсутствие дублей после повторного mount.

Что проверить в коде:

```ts
initCardCraftApp(...)
```

и соответствующий cleanup.

Если используется `useEffect`, cleanup должен вызывать:

```ts
app.destroy();
```

или аналог.

Критерий готовности:

- повторный mount не создаёт дубли обработчиков;
- в dev-режиме нет ошибок из-за повторной инициализации;
- нет утечек DOM-ссылок.

---

## A3. Проверить race conditions между save/history

В исходном аудите был риск:

> `scheduleSave` и `scheduleHistoryPush` могут выполниться после undo/restore и сохранить уже отменённое состояние.

Что сделать:

1. Найти debounce-логику:
   - `scheduleSave`;
   - `scheduleHistoryPush`.

2. При undo/redo/restore явно отменять pending timers.

Например:

```ts
saveTimer?.clear();
historyTimer?.clear();
```

или использовать `AbortController` / token-based cancellation.

3. Проверить сценарий:
   - пользователь вводит текст;
   - сразу жмёт Ctrl+Z;
   - debounce не должен сохранить отменённое состояние.

Критерий готовности:

- undo/redo не конфликтует с автосохранением;
- localStorage содержит актуальное состояние;
- нет «воскрешения» отменённых карточек после reload.

---

# Этап B. Закрепление новой архитектуры

Приоритет: **P1**.

## B1. Обновить документацию

Обновить `docs/architecture.md`.

Добавить:

1. Текущую схему слоёв:
   - Core;
   - Infrastructure;
   - State;
   - Rendering;
   - UI Kit;
   - Orchestrator;
   - helpers.

2. Описание модулей:
   - `CardCraftApp.ts`;
   - `toast.ts`;
   - `resizers.ts`;
   - `export-mode.ts`;
   - `PreviewRenderer.ts`;
   - `EditorRenderer.ts`;
   - `WordEditorManager.ts`;
   - `StateManager.ts`;
   - `HistoryManager.ts`;
   - `StorageManager.ts`.

3. Правила зависимостей:
   - UI не знает о DOM напрямую;
   - renderers не хранят business state;
   - StateManager не ходит в DOM;
   - Orchestrator связывает модули;
   - helpers не содержат глобального состояния.

4. Текущую статистику:
   - 20 модулей;
   - 4359 строк;
   - средний модуль ~218 строк;
   - smoke-тесты 108/109 или 109/109 после фикса.

5. Migration status:
   - `USE_NEW_ORCHESTRATOR = true`;
   - legacy fallback существует;
   - условия удаления legacy.

Критерий готовности:

- документация отражает фактическую архитектуру;
- новому разработчику понятны слои и правила;
- описан план удаления старого кода.

---

## B2. Провести performance benchmark

Нужно сравнить старый и новый путь.

Замеры:

1. Initial render:
   - время инициализации;
   - время первого рендера preview;
   - время первого рендера editor.

2. Typing:
   - ввод 1 символа;
   - ввод 100 символов;
   - paste большого текста.

3. Structural operations:
   - add card;
   - delete card;
   - duplicate card;
   - move up/down;
   - undo/redo.

4. Themes:
   - смена глобальной темы;
   - смена темы карточки;
   - смена progress style;
   - смена list style.

5. Export:
   - export одной карточки;
   - export всех карточек.

Метрики:

- ms;
- memory;
- количество listeners;
- количество DOM nodes;
- количество reflow-операций.

Критерий готовности:

- есть таблица old vs new;
- видно, где новый код быстрее;
- видно, где есть регрессии;
- зафиксированы baseline-метрики.

---

## B3. Подтвердить стабильность нового оркестратора

Перед удалением legacy нужно получить:

1. 109/109 smoke-тестов.
2. Отсутствие ошибок в console.
3. Отсутствие дублей listeners.
4. Корректный cleanup.
5. Корректную работу после reload.
6. Корректное undo/redo.
7. Корректный экспорт PNG.
8. Корректную работу localStorage.
9. Корректную работу resize.
10. Корректную работу word popup.

Можно ввести verification period:

- 1 день стабильной работы;
- 2 дня стабильной работы;
- 3 дня без регрессий.

После этого разрешается удалить legacy.

---

# Этап C. Удаление legacy

Приоритет: **P1**, после стабилизации.

## C1. Удалить старый God Function

Когда выполнены условия:

- 109/109 тестов;
- нет критических багов;
- cleanup проверен;
- documentation обновлена;
- benchmark не показывает регрессий;

выполнить:

1. Удалить:

   ```text
   src/lib/card-constructor.ts
   ```

2. Удалить fallback из `page.tsx`.

3. Удалить или заменить флаг:

   ```ts
   USE_NEW_ORCHESTRATOR;
   ```

4. Обновить импорты.

5. Проверить build:

   ```bash
   bun run build
   ```

6. Проверить lint:

   ```bash
   bun run lint
   ```

7. Прогнать smoke-тесты.

Критерий готовности:

- старого `card-constructor.ts` больше нет;
- нет мёртвых импортов;
- нет двойной логики;
- приложение работает только через новый orchestrator.

---

## C2. Убрать feature flag

После удаления legacy:

1. Удалить временный флаг.
2. Упростить `page.tsx`.
3. Убедиться, что нет путей возврата к старому коду.

Это важно, чтобы проект снова не стал гибридом двух архитектур.

---

# Этап D. Качество кода и type safety

Приоритет: **P2**.

## D1. Убрать `ignoreBuildErrors`

В `next.config.ts` вероятно есть:

```ts
ignoreBuildErrors: true;
```

Нужно:

1. Запустить:

   ```bash
   bun run build
   ```

2. Собрать список TypeScript-ошибок.

3. Исправить их по категориям:
   - nullable DOM elements;
   - missing types;
   - incorrect casts;
   - optional fields;
   - unsafe index access.

4. Только после этого удалить:
   ```ts
   ignoreBuildErrors: true;
   ```

Критерий готовности:

- build проходит без игнорирования ошибок;
- TypeScript реально защищает от багов.

---

## D2. Сократить non-null assertions

В старом аудите было 128 `!`.

Нужно заменить:

```ts
element!.value;
```

на безопасные проверки:

```ts
if (!element) return;
```

или на type-narrowing.

Особое внимание:

- `cards[idx]`;
- `dataset.index`;
- `document.getElementById`;
- `querySelector`;
- `wordStyles?.[key]`;
- `modal` elements;
- `canvas`/export nodes.

Критерий готовности:

- количество `!` существенно снижено;
- нет опасных обращений по индексу без bounds check;
- нет runtime-падений из-за undefined.

---

## D3. Заменить небезопасные приведения типов

Например:

```ts
cards[idx][field] = this.value as never;
```

Это опасно.

Нужно:

- типизировать fields;
- использовать discriminated union;
- или написать type-safe setter.

Пример направления:

```ts
type CardTextField = "title" | "back" | "description";
type CardStyleField = "background" | "textColor";

function setCardField(card: Card, field: CardTextField, value: string) {
  card[field] = value;
}
```

---

# Этап E. Тестирование

Приоритет: **P2**, но стратегически очень важно.

## E1. Добавить unit-тесты

Рекомендуемый стек:

- Vitest;
- jsdom или happy-dom;
- возможно Testing Library для DOM-проверок.

Минимальный набор:

### StateManager

Проверить:

- add card;
- delete card;
- update card;
- move card;
- duplicate card;
- set theme;
- set format;
- set progress config;
- set word styles;
- restore snapshot.

### HistoryManager

Проверить:

- push;
- undo;
- redo;
- max history limit;
- debounce;
- cancel pending push;
- восстановление после нескольких undo.

### StorageManager

Проверить:

- save;
- load;
- corrupted JSON;
- missing keys;
- invalid version;
- quota exceeded fallback.

### PreviewRenderer

Проверить:

- render;
- updateCardField;
- updateCardStyle;
- removeCard;
- insertCard;
- theme updates;
- progress bar updates.

### EditorRenderer

Проверить:

- render;
- collapse/expand;
- move up/down;
- delete;
- duplicate;
- numbering update.

### WordEditorManager

Проверить:

- open;
- close;
- drag;
- apply style;
- clear style;
- destroy.

Критерий готовности:

- есть `bun run test`;
- критические модули покрыты unit-тестами;
- тесты запускаются в CI.

---

## E2. Расширить smoke-тест

Добавить проверки:

- новый orchestrator активен;
- legacy не используется;
- dblclick в editor не открывает popup;
- popup открывается там, где должен;
- undo/redo работает после нескольких операций;
- localStorage восстанавливает состояние;
- export mode включает и выключает класс;
- resize работает;
- error boundary показывается при искусственной ошибке.

---

# Этап F. Зависимости и bundle

Приоритет: **P2**.

## F1. Провести аудит зависимостей

Проверить:

```bash
bun pm ls
```

или использовать depcheck/npx depcheck.

Нужно определить:

- какие пакеты реально импортируются;
- какие нужны только для shadcn/ui scaffold;
- какие можно удалить.

Особое внимание:

- `@radix-ui/*`;
- `@tanstack/*`;
- `framer-motion`;
- `next-auth`;
- `next-intl`;
- `next-themes`;
- `react-hook-form`;
- `zod`;
- `zustand`;
- `sonner`;
- `recharts`;
- `sharp`;
- `uuid`;
- `cmdk`;
- `date-fns`;
- `embla-carousel-react`;
- `react-markdown`;
- `react-syntax-highlighter`.

Удалять только после проверки build и lint.

Критерий готовности:

- в `package.json` только реально используемые пакеты;
- `bun install` стал быстрее;
- `node_modules` меньше;
- supply-chain surface уменьшен.

---

## F2. Bundle analysis

Проверить:

```bash
bun run build
```

Добавить анализ:

- `@next/bundle-analyzer` или аналог;
- размер first load;
- размер vendor chunks;
- размер `html-to-image`;
- размер шрифтов;
- размер CSS.

Возможные оптимизации:

1. Dynamic import для экспорта:

   ```ts
   const { toPng } = await import("html-to-image");
   ```

2. Убрать неиспользуемые шрифты или уменьшить веса.

3. Генерировать темы из JS вместо огромного CSS.

4. Разделить CSS:
   - core app styles;
   - themes;
   - modal/popup styles.

Критерий готовности:

- есть bundle report;
- есть список тяжёлых мест;
- тяжёлые библиотеки загружаются лениво, если это возможно.

---

# Этап G. React StrictMode

Приоритет: **P2**, но только после cleanup.

## G1. Проверить double-mount safety

Включить локально:

```ts
reactStrictMode: true;
```

Затем проверить:

- приложение не дублирует DOM;
- нет двойных listeners;
- нет двух orchestrator instances;
- нет утечки таймеров;
- resize не дублируется;
- popup не дублируется;
- localStorage не пишет дважды;
- history не пушит дважды.

Если появляются проблемы:

- исправить `destroy`;
- добавить idempotent init;
- проверять, что root уже инициализирован;
- очищать side effects в `useEffect`.

Только после этого оставлять StrictMode включённым.

Критерий готовности:

- dev-режим работает без ошибок;
- double-mount не создаёт побочных эффектов;
- smoke-тесты проходят.

---

# Этап H. UX и продуктовые улучшения

Приоритет: **P3**, после стабилизации.

Из исходного аудита остались UX-проблемы:

1. Аккордеоны закрыты по умолчанию.
2. Модалка стилей закрывает preview.
3. Нет удобного live-preview в модалке.
4. Shape-стили могут переполнять карточку при 20+ элементах.
5. Char counter может не обновляться при переключении карточек.
6. Нет confirmation при undo массовых изменений.

Рекомендации:

- сделать первый важный аккордеон открытым;
- уменьшить ширину модалки или сделать её перетаскиваемой;
- добавить compact preview внутри модалки;
- для shape-стилей добавить scroll/wrap/limit;
- обновлять char counter при active card change;
- для разрушительных undo операций добавить confirmation или toast с action.

---

# 7. Рекомендуемый порядок работы агента

Ниже — финальный приоритетный план.

## Спринт 1. Критическая стабилизация

Цель: получить 109/109 тестов.

Задачи:

1. Исправить падающий тест:
   - dblclick в поле редактора не должен открывать popup.
2. Проверить cleanup.
3. Проверить timers и race conditions.
4. Прогнать smoke-тесты.
5. Проверить console errors.

Definition of Done:

```text
109 passed
0 failed
```

---

## Спринт 2. Документация и проверка поведения

Цель: закрепить текущее состояние.

Задачи:

1. Обновить `docs/architecture.md`.
2. Описать Orchestrator layer.
3. Добавить helper-модули.
4. Обновить статистику.
5. Сделать benchmark old vs new.
6. Зафиксировать performance baseline.

Definition of Done:

- документация актуальна;
- benchmark создан;
- регрессии найдены или отсутствуют.

---

## Спринт 3. Удаление legacy

Цель: оставить только новую архитектуру.

Задачи:

1. Убедиться, что 109/109 проходят.
2. Убедиться, что нет критических багов.
3. Удалить `src/lib/card-constructor.ts`.
4. Удалить fallback.
5. Удалить `USE_NEW_ORCHESTRATOR`.
6. Обновить импорты.
7. Прогнать build, lint, smoke.

Definition of Done:

- legacy-файл удалён;
- приложение работает только на новом orchestrator;
- тесты проходят.

---

## Спринт 4. Type safety и build quality

Цель: сделать проект безопаснее для будущей разработки.

Задачи:

1. Исправить TypeScript ошибки.
2. Убрать `ignoreBuildErrors`.
3. Сократить non-null assertions.
4. Заменить unsafe casts.
5. Улучшить типы StateManager и card actions.

Definition of Done:

```bash
bun run build
```

проходит без ignoreBuildErrors.

---

## Спринт 5. Тесты и зависимости

Цель: снизить риск регрессий.

Задачи:

1. Добавить Vitest.
2. Покрыть StateManager.
3. Покрыть HistoryManager.
4. Покрыть StorageManager.
5. Покрыть PreviewRenderer.
6. Покрыть EditorRenderer.
7. Удалить оставшиеся неиспользуемые зависимости.
8. Сделать bundle analysis.

Definition of Done:

- есть unit-тесты;
- есть команда запуска тестов;
- удалены лишние пакеты;
- есть bundle report.

---

## Спринт 6. StrictMode и финальная стабилизация

Цель: подготовить проект к долгосрочной разработке.

Задачи:

1. Проверить cleanup.
2. Проверить double-mount.
3. Включить `reactStrictMode: true`.
4. Прогнать smoke-тесты.
5. Проверить dev-mode.

Definition of Done:

- StrictMode включён;
- нет ошибок;
- нет дублей эффектов.

---

# 8. Что агенту НЕ следует делать

Не следует:

1. Удалять legacy до исправления падающего теста.
2. Включать StrictMode до проверки cleanup.
3. Начинать полный rewrite на React-components до стабилизации текущего оркестратора.
4. Добавлять новые фичи до удаления legacy.
5. Массово переписывать CSS без задачи по темам.
6. Удалять зависимости без проверки build.
7. Игнорировать один падающий тест.
8. Считать 108/109 достаточным финальным результатом.
9. Оставлять `ignoreBuildErrors: true` навсегда.
10. Держать два параллельных кодовых пути слишком долго.

---

# 9. Финальный вердикт

Проект сильно улучшен по сравнению с начальной версией.

Раньше это был функциональный, но неподдерживаемый монолит с God Function. Сейчас это уже модульная архитектура с оркестратором, разделением ответственности, точечными обновлениями, UI Kit, Error Boundary и почти полностью проходящими smoke-тестами.

Главное отличие:

> Старая версия работала, но плохо масштабировалась.  
> Текущая версия уже может масштабироваться, но требует финальной стабилизации.

Текущий статус:

- архитектура: хорошо;
- миграция: почти завершена;
- стабильность: почти production-ready;
- главный блоккер: один падающий тест;
- главный технический долг: legacy fallback, отсутствие unit-тестов, StrictMode off, type safety, bundle cleanup.

Рекомендуемая цель для агента:

1. Исправить 1 failing test.
2. Получить 109/109.
3. Проверить cleanup и race conditions.
4. Обновить документацию.
5. Удалить legacy.
6. Включить StrictMode.
7. Добавить unit-тесты.
8. Почистить зависимости и bundle.

Если выполнить эти шаги, проект можно будет оценить уже не как MVP с архитектурным долгом, а как устойчивую кодовую базу, готовую к дальнейшему развитию.
