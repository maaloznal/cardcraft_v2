# MASTER TASK: Довести Cardcraft до максимально возможного production-ready уровня

## РОЛЬ

Ты работаешь как автономный senior engineering team над существующим проектом Cardcraft.

Твоя задача — не просто внести несколько изменений, а последовательно довести проект до максимально качественного состояния на основании этого технического аудита.

Работай с проектом как с реальным production-продуктом.

Ты можешь и должен использовать субагентов, если это ускоряет или повышает качество работы.

---

# ГЛАВНОЕ ПРАВИЛО

**НЕ ОСТАНАВЛИВАЙСЯ, ПОКА НЕ ПРОЙДЕН ВЕСЬ СПИСОК ЗАДАЧ.**

Не думай категориями:

- неделя;
- спринт;
- сколько времени осталось;
- “этого уже достаточно”;
- “это можно сделать потом”.

Спринты из исходного отчёта НЕ являются ограничением.

Они нужны только для первоначальной группировки.

Ты должен воспринимать весь список ниже как **единый backlog**, который необходимо пройти от начала до конца.

---

# SOURCE OF TRUTH

В самом начале работы:

1. Изучи весь существующий проект.
2. Изучи package.json, структуру проекта, конфигурацию Next.js, тесты, CI, deployment-конфигурацию и документацию.
3. Проверь, какие пункты из этого задания уже реализованы.
4. Не реализовывай повторно уже работающую функциональность.
5. Создай файл:

```text
docs/MASTER_TASK.md
```

Этот файл является постоянным источником истины по данной работе.

В него необходимо перенести весь список задач из этого документа.

Для каждой задачи используй статус:

```text
[ ] TODO
[~] IN_PROGRESS
[x] DONE
[!] BLOCKED
```

У каждой задачи должна быть возможность определить:

- что требуется;
- что уже сделано;
- что осталось;
- каким тестом/проверкой подтверждается готовность.

---

# РАБОТА С КОНТЕКСТОМ

После создания `docs/MASTER_TASK.md`:

**Перед каждой новой крупной задачей перечитывай этот файл.**

После завершения каждой существенной подзадачи:

1. запусти соответствующие проверки;
2. обнови статус;
3. запиши краткий результат;
4. запиши обнаруженные проблемы;
5. только после этого переходи дальше.

Не держи план исключительно в памяти.

Весь важный контекст должен находиться в файлах проекта.

---

# СУБАГЕНТЫ

Используй субагентов там, где это имеет смысл.

Примерное распределение:

### Agent — Architecture / Rendering

Проверяет:

- PreviewRenderer;
- add/delete/duplicate/move;
- O(1) операции;
- DOM updates;
- undo/redo;
- structural sharing;
- StateManager.

### Agent — Testing

Проверяет:

- unit coverage;
- Playwright;
- E2E;
- visual regression;
- mutation testing.

### Agent — CI/CD

Проверяет:

- GitHub Actions;
- lint;
- TypeScript;
- unit tests;
- E2E;
- deployment;
- preview environments.

### Agent — Security

Проверяет:

- CSP;
- nonce;
- SRI;
- source maps;
- dependencies;
- security headers;
- production configuration.

### Agent — Accessibility

Проверяет:

- WCAG 2.1 AA;
- keyboard navigation;
- focus trap;
- aria;
- screen readers;
- contrast;
- reduced motion.

### Agent — Performance

Проверяет:

- rendering;
- virtual scrolling;
- workers;
- bundle;
- lazy loading;
- IndexedDB;
- export performance.

### Agent — UX

Проверяет:

- color modal;
- live preview;
- onboarding;
- keyboard shortcuts;
- dark mode;
- usability.

### Agent — Documentation / DX

Проверяет:

- Storybook;
- ADR;
- JSDoc;
- Husky;
- Conventional Commits;
- changelog.

Не создавай субагента просто ради создания субагента.

Используй их там, где независимая проверка или параллельная работа действительно полезна.

---

# ПРАВИЛО ПРОВЕРКИ

Никогда не ставь:

```text
[x] DONE
```

только потому, что код написан.

Задача считается DONE только если:

1. реализация существует;
2. она интегрирована в существующую архитектуру;
3. TypeScript проходит;
4. lint проходит;
5. существующие тесты проходят;
6. новые тесты добавлены там, где это необходимо;
7. нет очевидной регрессии;
8. результат проверен фактически.

Если задача требует E2E — должен быть E2E.

Если задача требует accessibility — должна быть соответствующая проверка.

Если задача требует performance — должны быть измерения или разумное техническое подтверждение.

---

# ЭТАП 0 — ПОЛНЫЙ АУДИТ

Перед изменением кода проведи аудит.

Проверь:

- текущую архитектуру;
- состояние StateManager;
- PreviewRenderer;
- все операции над карточками;
- существующие unit tests;
- текущий coverage;
- package.json;
- Next.js;
- TypeScript;
- lint;
- существующий deployment;
- GitHub;
- наличие/отсутствие CI;
- ErrorBoundary;
- CSS tokens;
- dark mode;
- модальные окна;
- accessibility;
- экспорт;
- импорт;
- сохранение;
- производительность;
- зависимости;
- документацию.

После аудита обнови:

```text
docs/MASTER_TASK.md
```

Если какой-либо пункт уже полностью реализован — пометь его DONE и укажи доказательство.

---

# PRIORITY 1 — РЕНДЕРИНГ И O(1) ОПЕРАЦИИ

## 1.1 data-card-id

Проверить PreviewRenderer.

Заменить зависимость от:

```text
data-index
```

на стабильный:

```text
data-card-id
```

если это необходимо архитектуре.

Не использовать позицию карточки как постоянный идентификатор.

---

## 1.2 Add

Операция добавления карточки должна использовать:

```text
insertCard()
```

вместо полного rebuild preview.

---

## 1.3 Delete

Операция удаления должна использовать:

```text
removeCard()
```

вместо полного rebuild.

---

## 1.4 Duplicate

Duplicate должен:

1. создать новую карточку;
2. вставить её непосредственно после оригинала;
3. использовать локальное DOM-обновление.

---

## 1.5 Move

Move должен выполнять локальную перестановку DOM, а не полностью пересобирать preview.

---

## 1.6 Progress

Изменение progress bar должно использовать:

```text
updateProgressBars()
```

где это архитектурно возможно.

---

## 1.7 Theme

Изменение темы карточки должно использовать:

```text
updateCardTheme()
```

или соответствующий локальный механизм.

---

## 1.8 Undo / Redo

Проверить:

- add;
- delete;
- duplicate;
- move;
- изменение текста;
- изменение темы;
- изменение progress.

Undo/redo не должны ломаться после перехода на локальные DOM-операции.

---

## 1.9 Performance verification

Создать тест/benchmark для проекта примерно на:

- 10 карточках;
- 50 карточках;
- 100 карточках.

Сравнить структурные операции до/после, если старую реализацию возможно измерить.

Цель:

```text
не делать full rebuild там, где можно сделать локальное изменение.
```

Не подгонять benchmark искусственно под красивую цифру.

---

# PRIORITY 2 — E2E TESTING

Установить Playwright, если его ещё нет:

```bash
bun add -d @playwright/test
```

Адаптировать команду под фактический package manager проекта, если он отличается.

Создать полноценный E2E набор.

Минимально проверить:

1. приложение запускается;
2. пользователь видит интерфейс;
3. создание карточки;
4. редактирование карточки;
5. удаление;
6. duplicate;
7. move;
8. undo;
9. redo;
10. изменение темы;
11. изменение progress;
12. открытие color modal;
13. экспорт;
14. cancel;
15. импорт JSON;
16. повторная загрузка состояния;
17. keyboard navigation;
18. modal behavior;
19. отсутствие критических console errors;
20. базовый smoke test.

Не ограничивайся ровно 15 тестами, если архитектура требует больше.

---

# PRIORITY 3 — CI/CD

Создать:

```text
.github/workflows/ci.yml
```

CI должен как минимум выполнять:

```text
bun install
bun run lint
bun run tsc --noEmit
bun run test
bun run playwright test
```

Адаптировать команды под реальные scripts проекта.

CI должен падать при:

- lint error;
- TypeScript error;
- failed unit test;
- failed E2E;
- критической ошибке сборки.

Проверить возможность:

- PR checks;
- preview deployment;
- production deployment.

Если Vercel/Netlify уже используется — интегрировать существующий deployment.

Не добавлять новую платформу без необходимости.

---

# PRIORITY 4 — MONITORING / ERROR REPORTING

Добавить production error monitoring.

Предпочтительно Sentry, если это соответствует проекту и не создаёт неоправданной сложности.

Проверить:

- ErrorBoundary;
- runtime exceptions;
- source maps;
- release identification;
- production environment;
- breadcrumbs;
- dispatch/state-related errors.

Если внешний сервис невозможно корректно настроить без секретов или аккаунта:

не симулировать готовность.

Сделать максимально возможную интеграцию и отметить оставшийся блокер в MASTER_TASK.md.

---

# PRIORITY 5 — ACCESSIBILITY

Провести полноценный accessibility audit.

## Modals

Добавить:

```text
aria-modal="true"
```

где необходимо.

Реализовать корректный:

```text
focus trap
```

Проверить:

- открытие;
- закрытие;
- ESC;
- возврат focus;
- Tab;
- Shift+Tab.

---

## Icon buttons

Все кнопки без текста должны иметь понятные:

```text
aria-label
```

Проверить:

- duplicate;
- delete;
- download;
- copy;
- close;
- settings;
- theme;
- другие icon-only controls.

---

## Keyboard navigation

Проверить:

- Tab;
- Shift+Tab;
- Enter;
- Escape;
- Arrow keys.

Где это логично:

- карточки должны быть доступны с клавиатуры;
- редактирование должно быть доступно с клавиатуры;
- перемещение карточек должно иметь keyboard alternative.

---

## Screen reader

Добавить announcements для важных операций:

```text
Карточка добавлена
Карточка удалена
Карточка перемещена
Цвет изменён
```

Использовать корректный ARIA-паттерн.

---

## Color contrast

Проверить основные интерфейсные элементы и темы.

Исправить реальные нарушения WCAG 2.1 AA.

---

## Reduced motion

Добавить поддержку:

```text
prefers-reduced-motion
```

Анимации не должны мешать пользователям, которые отключили движение.

---

# PRIORITY 6 — DARK MODE

Провести аудит существующего dark mode.

Выбрать решение на основании реального состояния проекта.

### Если dark mode нужен:

Реализовать его полностью:

- toggle;
- theme state;
- CSS variables;
- persistence;
- контраст;
- все основные UI-компоненты;
- темы карточек;
- модальные окна;
- dropdown;
- toast;
- preview.

### Если dark mode не нужен:

Полностью удалить мёртвые:

```text
.dark
```

tokens и связанные с ними неиспользуемые части.

Не оставлять фантомную функциональность.

Решение документировать в ADR.

---

# PRIORITY 7 — LIVE PREVIEW

Улучшить color/style modal.

На desktop:

```text
контролы | preview
```

или другой действительно удобный split-screen/floating preview.

Preview должен обновляться в реальном времени.

Проверить:

- цвет;
- фон;
- стиль;
- progress;
- текст;
- выбранную карточку.

На mobile использовать адаптированный UX.

---

# PRIORITY 8 — LARGE PROJECT PERFORMANCE

Исследовать производительность на:

```text
100 карточек
250 карточек
500 карточек
```

если архитектура проекта позволяет.

## Virtual scrolling

Реализовать, если текущий список действительно страдает от большого количества элементов.

Не добавлять virtual scrolling только ради галочки.

---

## Web Worker

Исследовать возможность вынести тяжёлые операции экспорта/html-to-image в worker.

Если используемая библиотека технически не позволяет безопасно перенести операцию в worker:

зафиксировать это как техническое ограничение.

Не ломать экспорт ради формального выполнения пункта.

---

## IndexedDB

Сейчас quota exceeded приводит к ошибке/toast.

Добавить fallback на IndexedDB, если это соответствует архитектуре хранения.

Проверить:

- сохранение;
- загрузку;
- quota;
- восстановление проекта;
- отсутствие потери данных.

---

## Code splitting

Проверить тяжёлые компоненты.

Использовать dynamic import там, где это реально уменьшает initial bundle.

---

# PRIORITY 9 — BUNDLE OPTIMIZATION

Добавить bundle analysis.

Предпочтительно:

```text
@next/bundle-analyzer
```

если совместимо с проектом.

Проанализировать:

- самые тяжёлые chunks;
- fonts;
- html-to-image;
- редакторы;
- 48 тем;
- зависимости.

Проверить tree-shaking.

Удалить действительно мёртвый код.

Не удалять код только потому, что он выглядит редко используемым.

---

# PRIORITY 10 — DESIGN SYSTEM

Расширить существующие design tokens.

Минимально:

```text
colors
spacing
typography
font sizes
line heights
radii
shadows
z-index
transitions
```

Сделать единый источник истины.

---

# PRIORITY 11 — STORYBOOK

Добавить Storybook, если архитектура проекта это оправдывает.

Создать stories для основных UI-паттернов:

- Card;
- CardEditor;
- Modal;
- ColorModal;
- Toast;
- Dropdown;
- Buttons;
- inputs;
- progress;
- theme selector;
- другие ключевые reusable components.

Storybook должен использовать реальные компоненты проекта, а не дубликаты.

---

# PRIORITY 12 — ADR

Создать:

```text
docs/adr/
```

Документировать существенные архитектурные решения.

Например:

```text
001-rendering-strategy.md
002-state-management.md
003-card-identifiers.md
004-theme-system.md
005-persistence.md
006-export-architecture.md
```

Не создавать ADR ради количества.

Документировать реальные решения и причины.

---

# PRIORITY 13 — JSDoc / PUBLIC API

Провести аудит public API.

Добавить JSDoc там, где он реально помогает:

- controllers;
- state manager;
- renderer;
- public utilities;
- экспортируемые сложные функции.

Не добавлять бессмысленные комментарии:

```text
// Adds card
addCard()
```

---

# PRIORITY 14 — HUSKY

Добавить pre-commit checks.

Минимально:

```text
lint
typecheck
relevant tests
```

Не делать pre-commit настолько тяжёлым, чтобы разработчики начали его обходить.

---

# PRIORITY 15 — CONVENTIONAL COMMITS

Настроить Conventional Commits:

```text
feat:
fix:
refactor:
perf:
test:
docs:
chore:
```

Добавить автоматический changelog, если это соответствует текущему release workflow.

---

# PRIORITY 16 — VISUAL REGRESSION

Добавить visual regression.

Использовать Playwright screenshots или подходящий существующий инструмент.

Покрыть минимум:

- основные темы;
- карточку;
- editor;
- preview;
- modal;
- dropdown;
- dark/light mode, если dark mode реализован;
- export preview.

Не создавать сотни бессмысленных snapshot'ов.

---

# PRIORITY 17 — TEST COVERAGE 100%

Текущий coverage примерно 95.6%.

Найти оставшиеся непокрытые участки.

Не гнаться за 100% путём бессмысленных тестов.

Цель:

- 100% meaningful logic;
- критические ветки покрыты;
- error paths покрыты;
- edge cases покрыты.

Если 100% невозможно получить без тестов, которые только искусственно увеличивают число — объяснить это в отчёте.

---

# PRIORITY 18 — MUTATION TESTING

Исследовать Stryker.

Запустить mutation testing на критической бизнес-логике.

Особенно:

- state;
- card operations;
- undo/redo;
- import/export;
- validation.

Исправить слабые тесты, обнаруженные mutation testing.

---

# PRIORITY 19 — SECURITY HARDENING

Провести отдельный security audit.

Проверить:

- CSP;
- nonce;
- SRI;
- security headers;
- unsafe-inline;
- unsafe-eval;
- XSS vectors;
- HTML rendering;
- imported JSON;
- user-generated content;
- dependencies;
- exposed secrets;
- source maps;
- production config.

Если CSP можно усилить без поломки приложения — сделать это.

CSP reporting добавить, если архитектура и deployment позволяют.

---

# PRIORITY 20 — STRUCTURED LOGGING

Найти:

```text
console.log
console.error
console.warn
```

Провести классификацию.

Production logging должен быть контролируемым.

Добавить structured logger там, где это действительно необходимо.

Не оставлять debug logging в production.

---

# PRIORITY 21 — PRIVACY-FRIENDLY ANALYTICS

Рассмотреть:

- Plausible;
- Umami;
- другой privacy-friendly вариант.

Если аналитика добавляется:

собирать только необходимые продуктовые события.

Например:

```text
project_created
card_added
card_deleted
export_started
export_completed
theme_selected
```

Не собирать лишние персональные данные.

Если аналитика не может быть корректно внедрена без внешней инфраструктуры — задокументировать это.

---

# PRIORITY 22 — ONBOARDING

Добавить onboarding для нового пользователя.

Он должен кратко показать:

1. как создать карточку;
2. как редактировать;
3. как изменить тему;
4. как перемещать;
5. как экспортировать.

Не делать длинный tutorial.

Добавить возможность:

```text
Skip
```

и возможность повторного запуска onboarding.

---

# PRIORITY 23 — KEYBOARD SHORTCUTS PANEL

Добавить справку по горячим клавишам.

Например:

```text
?
```

открывает список shortcuts.

Документировать реальные shortcuts проекта.

Не показывать shortcuts, которых фактически нет.

---

# PRIORITY 24 — DEPENDENCY AUDIT

Проверить зависимости проекта.

Найти:

- outdated;
- deprecated;
- unused;
- vulnerable.

Не обновлять всё автоматически.

Каждое потенциально опасное обновление проверить совместимостью.

Особенно внимательно:

- Next.js;
- React;
- TypeScript;
- Playwright;
- html-to-image;
- state libraries;
- CSS tooling.

---

# PRIORITY 25 — FINAL PRODUCT AUDIT

После выполнения всех технических задач провести повторный полный аудит.

Проверить все 12 первоначальных параметров:

| Параметр      |
| ------------- |
| Security      |
| Architecture  |
| State         |
| Performance   |
| Rendering     |
| UX            |
| Design System |
| Testing       |
| CI/CD         |
| Monitoring    |
| Accessibility |
| Documentation |

Для каждого дать:

```text
до
после
что сделано
как проверено
что осталось
```

---

# КРИТЕРИЙ ОКОНЧАНИЯ

Работа считается законченной только после того, как:

1. весь `docs/MASTER_TASK.md` просмотрен сверху вниз;
2. каждая задача имеет статус;
3. все возможные задачи имеют DONE;
4. невозможные задачи имеют BLOCKED с конкретной причиной;
5. тесты проходят;
6. production build проходит;
7. CI конфигурация валидна;
8. E2E проходят;
9. accessibility проверена;
10. security проверена;
11. performance проверена;
12. документация обновлена.

---

# ОБЯЗАТЕЛЬНЫЙ FINAL REPORT

В конце создай:

```text
docs/FINAL_IMPLEMENTATION_REPORT.md
```

Отчёт должен содержать:

## 1. Итоговая оценка

Не придумывай 10/10 автоматически.

Честно оцени результат.

---

## 2. Что было сделано

Таблица:

| ID  | Задача | Статус | Что сделано | Проверка |
| --- | ------ | ------ | ----------- | -------- |

---

## 3. Что не завершено

Для каждого незавершённого пункта:

```text
Задача:
Статус:
Что сделано:
Что осталось:
Почему не завершено:
Технический блокер:
Что требуется для завершения:
```

---

## 4. Тестирование

Указать фактический результат:

```text
Unit tests:
Coverage:
E2E:
TypeScript:
Lint:
Build:
Accessibility:
Visual regression:
Mutation testing:
```

Не писать “успешно”, если команда реально не запускалась.

---

## 5. Архитектурные изменения

Кратко перечислить наиболее важные изменения.

---

## 6. Performance

Указать реальные измерения, если они проводились.

---

## 7. Security

Указать, что проверено и какие ограничения остались.

---

## 8. Known Issues

Все известные проблемы.

---

## 9. Следующий шаг

Если остались BLOCKED задачи — конкретно указать, что необходимо сделать.

---

# ВАЖНО

Не удаляй:

```text
docs/MASTER_TASK.md
docs/FINAL_IMPLEMENTATION_REPORT.md
```

после завершения.

Эти файлы являются persistent context проекта.

Если работа будет продолжена позже, сначала прочитай:

```text
docs/MASTER_TASK.md
docs/FINAL_IMPLEMENTATION_REPORT.md
```

и продолжи с первого:

```text
[ ] TODO
```

или:

```text
[!] BLOCKED
```

который можно разблокировать.

---

# ФИНАЛЬНОЕ ПРАВИЛО

**Не заканчивай работу потому, что закончился текущий сеанс, контекст, один субагент или одна группа задач.**

Если задача ещё не выполнена:

- обнови MASTER_TASK;
- зафиксируй текущее состояние;
- сохрани результаты;
- продолжай с оставшихся пунктов.

Если технически невозможно продолжить — это должно быть явно записано в `FINAL_IMPLEMENTATION_REPORT.md`.

**Главная цель: не написать много кода, а реально довести существующий Cardcraft до максимально качественного, проверенного и документированного production-состояния.**
