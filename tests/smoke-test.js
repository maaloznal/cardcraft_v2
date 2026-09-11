/**
 * Тестовый сценарий для Agent Browser — проверка ключевых потоков Cardcraft.
 * Запускается через agent-browser eval с встроенным тестовым набором.
 *
 * Использование: agent-browser open http://localhost:3000 && agent-browser eval "$(cat tests/smoke-test.js)"
 */
(function testCardcraft() {
  'use strict';
  var results = [];
  var passed = 0;
  var failed = 0;

  function assert(name, cond, detail) {
    if (cond) {
      passed++;
      results.push('  ✓ ' + name);
    } else {
      failed++;
      results.push('  ✗ ' + name + (detail ? ' — ' + detail : ''));
    }
  }

  function q(s) { return document.querySelector(s); }
  function qa(s) { return document.querySelectorAll(s); }

  try {
    results.push('=== CARDCRAFT SMOKE TEST ===');

    // 1. Структура DOM
    assert('Top bar существует', !!q('.top-bar'));
    assert('Brand "Cardcraft" существует', q('.brand-name')?.textContent === 'Cardcraft');
    assert('Toggle в top bar (не плавающий)', !!q('.top-bar .sidebar-toggle') && !q('.toggle-sidebar-btn'));
    assert('Sidebar существует', !!q('#editorSidebar'));
    assert('Workspace существует', !!q('#previewWorkspace'));
    assert('Cards area существует', !!q('#cardsArea'));
    assert('Modal существует', !!q('#colorModal'));
    assert('Word popup существует', !!q('#wordStylePopup'));
    assert('Toast существует', !!q('#toast'));

    // 2. Нет эмодзи в UI chrome
    var uiText = (q('.top-bar')?.textContent || '') + (q('.editor-sidebar')?.textContent || '');
    var emojiPattern = /[\u{1F300}-\u{1F9FF}]|✨|🎨|📐|💾|📋/u;
    assert('Нет эмодзи в top bar и sidebar', !emojiPattern.test(uiText), uiText.substring(0, 80));

    // 3. На desktop сайдбар уже открыт при загрузке
    var sidebarInitiallyOpen = !q('#editorSidebar').classList.contains('collapsed');
    assert('Сайдбар открыт на desktop при загрузке', sidebarInitiallyOpen);
    // Тестируем toggle: закрываем, потом открываем
    q('#toggleSidebarBtn').click();
    assert('Toggle закрывает сайдбар', q('#editorSidebar').classList.contains('collapsed'));
    q('#toggleSidebarBtn').click();
    assert('Toggle открывает сайдбар', !q('#editorSidebar').classList.contains('collapsed'));

    // 4. Карточка рендерится
    assert('Превью карточки рендерится', qa('.card').length >= 1);
    // Тег может быть скрыт если нумерация выключена — проверяем что card рендерится
    assert('Карточка имеет top-content', !!q('.card-top-content'));

    // 5. Заполним первую карточку (state-independent: работаем с тем что есть)
    var titleInput = qa('input[data-field="title"]')[0];
    if (titleInput) {
      titleInput.value = 'Тестовый заголовок';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    assert('Заголовок обновляется в превью', q('.card-title')?.textContent === 'Тестовый заголовок');
    // Проверяем плейсхолдер именно первой карточки
    var firstCard = q('.card');
    var firstCardHint = firstCard?.querySelector('.card-empty-hint');
    assert('Плейсхолдер исчезает при заполнении', !firstCardHint);

    // 6. Добавление карточки
    var before = qa('.card').length;
    q('#addCardBtn').click();
    assert('Карточка добавляется', qa('.card').length === before + 1);
    var expectedBadge = (before + 1) === 1 ? '1 карточка' : (before + 1) <= 4 ? (before + 1) + ' карточки' : (before + 1) + ' карточек';
    assert('Бейдж счётчика обновляется', q('#cardCountBadge')?.textContent.trim() === expectedBadge,
      'got "' + q('#cardCountBadge')?.textContent.trim() + '" expected "' + expectedBadge + '"');

    // 7. Структура card editor block
    var block = q('.card-editor-block');
    assert('Card editor block существует', !!block);
    assert('Кнопка Стили — отдельная полноширинная', !!block.querySelector('.btn-card-editor-palette'));
    assert('В header только иконки (нет Стили)', !block.querySelector('.card-editor-header .btn-palette'));
    assert('Кнопка дублировать есть', !!block.querySelector('[data-action="duplicate"]'));
    assert('Кнопки перемещения есть', block.querySelectorAll('[data-action="move"]').length === 2);

    // 8. Проверка геометрии — кнопки не выходят за границу блока
    var blockRect = block.getBoundingClientRect();
    var actions = block.querySelector('.card-editor-actions');
    var actionsRect = actions.getBoundingClientRect();
    var h3Rect = block.querySelector('.card-editor-header h3').getBoundingClientRect();
    assert('Кнопки не выходят за блок', actionsRect.right <= blockRect.right + 1,
      'actions right=' + Math.round(actionsRect.right) + ' block right=' + Math.round(blockRect.right));
    assert('Заголовок не налезает на кнопки', h3Rect.right <= actionsRect.left + 1,
      'h3 right=' + Math.round(h3Rect.right) + ' actions left=' + Math.round(actionsRect.left));

    // 9. Дублирование
    before = qa('.card').length;
    block.querySelector('[data-action="duplicate"]').click();
    assert('Дублирование работает', qa('.card').length === before + 1);

    // 10. Undo
    q('#undoBtn').click();
    assert('Undo работает', qa('.card').length === before);

    // 11. Модалка стилей
    q('[data-action="palette"]').click();
    assert('Модалка открывается', q('#colorModal').classList.contains('active'));
    assert('Заголовок модалки без эмодзи', !/🎨/.test(q('#modalCardTitle')?.textContent));
    assert('Заголовок содержит "Стили"', /Стили/.test(q('#modalCardTitle')?.textContent));

    // listNumber — нет форматных контролов
    var lnRow = q('.color-picker-row[data-row-field="listNumber"]');
    assert('listNumber без форматных контролов', lnRow?.querySelectorAll('.format-btn-section').length === 0);
    assert('title имеет форматные контролы', q('.color-picker-row[data-row-field="title"]')?.querySelectorAll('.format-btn-section').length === 4);

    // Закрыть модалку
    q('#applyColorsBtn').click();
    assert('Модалка закрывается', !q('#colorModal').classList.contains('active'));

    // 12. Смена темы
    var ts = q('#themeSelect');
    ts.value = 'obsidian-gold';
    ts.dispatchEvent(new Event('change', { bubbles: true }));
    assert('Тема применяется к workspace', q('#previewWorkspace').getAttribute('data-theme') === 'obsidian-gold');

    // 13. Стилизация слов — ТОЛЬКО в превью, не в полях ввода редактора
    // 13a. Сначала убедимся, что dblclick в поле ввода редактора НЕ открывает попап
    var editorInput = qa('input[data-field="title"]')[0] || qa('textarea[data-field="title"]')[0];
    if (editorInput) {
      editorInput.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }
    assert('Dblclick в поле редактора НЕ открывает попап', !q('#wordStylePopup').classList.contains('active'));

    // 13b. Dblclick в превью — открывает попап
    var titleEl = q('.card-title');
    if (titleEl) {
      var tn = titleEl.firstChild;
      var word = 'заголовок';
      var idx = titleEl.textContent.toLowerCase().indexOf(word);
      if (idx !== -1 && tn) {
        var range = document.createRange();
        range.setStart(tn, idx);
        range.setEnd(tn, idx + word.length);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        titleEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      }
    }
    assert('Попап слова открывается из превью', q('#wordStylePopup').classList.contains('active'));
    assert('Заголовок попапа показывает слово', !!q('#wordPopupHeader')?.textContent.trim());

    // Применить жирный
    var boldBtn = q('#wordStylePopup .format-btn[data-format="bold"]');
    if (boldBtn) boldBtn.click();
    assert('Стиль слова применяется', !!q('.card-title .cc-styled-word'));

    // Сброс стиля слова
    q('#wordClearBtn')?.click();
    assert('Сброс стиля слова работает', !q('.card-title .cc-styled-word'));

    // 14. Экспорт/импорт кнопки имеют SVG (не эмодзи)
    assert('Undo имеет SVG', !!q('#undoBtn svg'));
    assert('Redo имеет SVG', !!q('#redoBtn svg'));

    // 15. Удаление карточки
    before = qa('.card').length;
    if (before > 1) {
      q('[data-action="delete"]')?.click();
      assert('Удаление работает', qa('.card').length === before - 1);
    } else {
      results.push('  ⚠ Удаление пропущено (одна карточка)');
    }

    // 16. Производительность: точечное обновление при вводе
    var titleInput2 = qa('input[data-field="title"]')[0];
    if (titleInput2) {
      titleInput2.focus();
      var t0 = performance.now();
      for (var k = 0; k < 20; k++) {
        titleInput2.value = 'Perf test ' + k;
        titleInput2.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var elapsed = performance.now() - t0;
      assert('20 нажатий < 50ms', elapsed < 50, 'elapsed=' + elapsed.toFixed(1) + 'ms');
      assert('Превью обновилось', q('.card-title')?.textContent === 'Perf test 19');
      // Фокус сохранён в поле ввода
      assert('Фокус в поле ввода сохранён', document.activeElement === titleInput2);
    }

    // 17. Edge case: очистка поля (content→empty) — точечное удаление, без renderPreview
    if (titleInput2) {
      var cardIdx = Number(titleInput2.dataset.index);
      var firstCardNode = qa('.card')[cardIdx];
      titleInput2.value = '';
      titleInput2.dispatchEvent(new Event('input', { bubbles: true }));
      // Элемент должен быть удалён точечно (без renderPreview) в конкретной карточке
      assert('Заголовок удалён из превью', !firstCardNode.querySelector('.card-title'));
      assert('Карточка осталась', qa('.card').length >= 1);
      // Появился плейсхолдер пустой карточки
      assert('Плейсхолдер появился', !!firstCardNode.querySelector('.card-empty-hint'));
      // Восстановим заголовок — точечное создание
      titleInput2.value = 'Восстановлен';
      titleInput2.dispatchEvent(new Event('input', { bubbles: true }));
      assert('Заголовок восстановлен', firstCardNode.querySelector('.card-title')?.textContent === 'Восстановлен');
      assert('Плейсхолдер исчез', !firstCardNode.querySelector('.card-empty-hint'));
    }

    // 17b. Edge case: первая буква в пустом поле (empty→content) — точечное создание
    var subtitleInput = qa('textarea[data-field="subtitle"]')[0];
    if (subtitleInput) {
      assert('Подзаголовка нет изначально', !q('.card-subtitle'));
      subtitleInput.value = 'А';
      subtitleInput.dispatchEvent(new Event('input', { bubbles: true }));
      assert('Подзаголовок создан с 1 буквой', q('.card-subtitle')?.textContent === 'А');
      // Порядок: title, subtitle, text (если есть)
      var topClasses = Array.from(q('.card-top-content').children).map(function(c){return c.className;});
      assert('Подзаголовок после заголовка', topClasses.indexOf('card-subtitle') > topClasses.indexOf('card-title'));
    }

    // 18. listItems — точечное обновление списка
    var listInput = qa('textarea[data-field="listItems"]')[0];
    if (listInput) {
      listInput.value = 'Один\nДва\nТри';
      listInput.dispatchEvent(new Event('input', { bubbles: true }));
      assert('Список: 3 пункта', qa('.card-list-item').length === 3);
      // Изменим количество пунктов
      listInput.value = 'Один\nДва';
      listInput.dispatchEvent(new Event('input', { bubbles: true }));
      assert('Список: 2 пункта после изменения', qa('.card-list-item').length === 2);
      // Нумерация корректна (число без точки — точка добавляется CSS)
      var nums = Array.from(qa('.card-list-num')).map(function(e){return e.textContent;});
      assert('Нумерация списка корректна', nums[0] === '1' && nums[1] === '2');
      // Очистим список
      listInput.value = '';
      listInput.dispatchEvent(new Event('input', { bubbles: true }));
      assert('Список очищен', qa('.card-list-item').length === 0);
    }

    // 19. Task 7: Нумерация карточек — toggle
    assert('Toggle нумерации существует', !!q('#numberingToggle'));
    // Убедимся что нумерация включена
    if (!q('#numberingToggle').checked) q('#numberingToggle').click();
    // Проверяем через computed style (CSS управляет видимостью)
    var tagEl = q('.tag');
    assert('Тег виден при включённой нумерации', tagEl && getComputedStyle(tagEl).display !== 'none');
    q('#numberingToggle').click();
    assert('Тег скрыт после выключения', getComputedStyle(tagEl).display === 'none');
    q('#numberingToggle').click();
    assert('Тег виден после включения', getComputedStyle(tagEl).display !== 'none');

    // 20. БАГ#1: Стили progress bar
    assert('Select стиля progress bar существует', !!q('#progressBarStyleSelect'));
    var pbStyles = ['default','dashed','circles','squares','diamonds','hexagons','stars'];
    pbStyles.forEach(function(s) {
      q('#progressBarStyleSelect').value = s;
      q('#progressBarStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));
      assert('Progress стиль ' + s, q('.cc-root').getAttribute('data-progress-style') === s);
    });
    // Toggle — progress скрыт
    q('#progressBarToggle').click();
    assert('Progress toggle скрывает элемент', q('.cc-root').classList.contains('no-progress-bar'));
    q('#progressBarToggle').click();
    assert('Progress toggle показывает элемент', !q('.cc-root').classList.contains('no-progress-bar'));
    // Вернём default
    q('#progressBarStyleSelect').value = 'default';
    q('#progressBarStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));

    // 21. Task 9: Стили списков
    assert('Select стиля списков существует', !!q('#listStyleSelect'));
    var listStyles = ['numbers','bullets','dashes','circles','squares','decorative'];
    listStyles.forEach(function(s) {
      q('#listStyleSelect').value = s;
      q('#listStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));
      assert('Стиль списка ' + s, q('.cc-root').getAttribute('data-list-style') === s);
    });
    q('#listStyleSelect').value = 'numbers';
    q('#listStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));

    // 22. Task 10: Идентификация карточек
    assert('Title group существует', !!q('.card-editor-title-group'));
    assert('Num badge существует', !!q('.card-editor-num-badge'));
    assert('Num badge показывает номер', /^\d+$/.test(q('.card-editor-num-badge')?.textContent || ''));
    var h3 = q('.card-editor-title-group h3');
    assert('H3 показывает техническое название', h3?.textContent?.startsWith('Карточка'));
    // Название не зависит от заголовка
    var titleForId = qa('input[data-field="title"]')[0];
    if (titleForId) {
      titleForId.value = 'Тест идентификации';
      titleForId.dispatchEvent(new Event('input', {bubbles: true}));
      assert('H3 не копирует заголовок', q('.card-editor-title-group h3')?.textContent?.startsWith('Карточка'));
    }

    // 23. БАГ#2: Точки в нумерации списков
    var listForBug2 = qa('textarea[data-field="listItems"]')[0];
    if (listForBug2) {
      listForBug2.value = 'Один\nДва';
      listForBug2.dispatchEvent(new Event('input', {bubbles: true}));
      // numbers: текст "1", CSS добавляет "." → отображается "1."
      q('#listStyleSelect').value = 'numbers';
      q('#listStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));
      var numText = q('.card-list-num')?.textContent;
      var numAfter = getComputedStyle(q('.card-list-num'), '::after').content;
      assert('Numbers: число без точки в HTML', numText === '1');
      assert('Numbers: CSS добавляет одну точку', numAfter === '"."');
      // circles: без точки
      q('#listStyleSelect').value = 'circles';
      q('#listStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));
      var circAfter = getComputedStyle(q('.card-list-num'), '::after').content;
      assert('Circles: без точки после номера', circAfter === '""');
      // squares: без точки
      q('#listStyleSelect').value = 'squares';
      q('#listStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));
      var sqAfter = getComputedStyle(q('.card-list-num'), '::after').content;
      assert('Squares: без точки после номера', sqAfter === '""');
      q('#listStyleSelect').value = 'numbers';
      q('#listStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));
    }

    // 24. БАГ#3: Независимый цвет номера списка
    // Сначала заполним список (тест 23 мог его очистить)
    var listForBug3 = qa('textarea[data-field="listItems"]')[0];
    if (listForBug3) {
      listForBug3.value = 'Один\nДва';
      listForBug3.dispatchEvent(new Event('input', {bubbles: true}));
    }
    q('[data-action="palette"]')?.click();
    var listColorInput = q('#col-list');
    var listNumColorInput = q('#col-listNumber');
    if (listColorInput && listNumColorInput) {
      listColorInput.value = '#2563eb';
      listColorInput.dispatchEvent(new Event('input', {bubbles: true}));
      listNumColorInput.value = '#dc2626';
      listNumColorInput.dispatchEvent(new Event('input', {bubbles: true}));
      q('#applyColorsBtn').click();
      var numEl = q('.card-list-num');
      var textEl = q('.card-list-text');
      assert('Цвет номера не совпадает с текстом', getComputedStyle(numEl).color !== getComputedStyle(textEl).color);
      assert('Цвет номера красный', /220,\s*38,\s*38/.test(getComputedStyle(numEl).color));
      assert('Цвет текста синий', /37,\s*99,\s*235/.test(getComputedStyle(textEl).color));
    }

    // 25. Улучшение#1: Независимая прокрутка редактора
    assert('Fixed header существует', !!q('.sidebar-fixed-header'));
    assert('Scroll area существует', !!q('.sidebar-scroll-area'));
    assert('Scroll area имеет overflow-y auto', getComputedStyle(q('.sidebar-scroll-area')).overflowY === 'auto');

    // 26. Улучшение#2: Аккордеон в редакторе стилей (закрыт по умолчанию)
    q('[data-action="palette"]')?.click();
    var groupCount = qa('.modal-accordion-group').length;
    assert('Аккордеон группы существуют', groupCount >= 3);
    assert('Все группы закрыты по умолчанию', qa('.modal-accordion-group.expanded').length === 0);
    // Раскроем первую
    q('.modal-accordion-header').click();
    assert('Разворачивание работает', qa('.modal-accordion-group.expanded').length === 1);
    q('.modal-accordion-header').click();
    assert('Сворачивание работает', qa('.modal-accordion-group.expanded').length === 0);
    q('#applyColorsBtn').click();

    // 27. БАГ#4: Независимые параметры нумерации (circles)
    // Установим circles style
    q('#listStyleSelect').value = 'circles';
    q('#listStyleSelect').dispatchEvent(new Event('change', {bubbles: true}));
    q('[data-action="palette"]')?.click();
    // text=синий, digit=белый, bg=красный, border=зелёный
    var listIn = q('#col-list');
    var numIn = q('#col-listNumber');
    var bgIn = q('#col-listNumBg');
    var borderIn = q('#col-listNumBorder');
    if (listIn && numIn && bgIn && borderIn) {
      listIn.value = '#2563eb'; listIn.dispatchEvent(new Event('input', {bubbles: true}));
      numIn.value = '#ffffff'; numIn.dispatchEvent(new Event('input', {bubbles: true}));
      bgIn.value = '#dc2626'; bgIn.dispatchEvent(new Event('input', {bubbles: true}));
      borderIn.value = '#059669'; borderIn.dispatchEvent(new Event('input', {bubbles: true}));
      q('#applyColorsBtn').click();
      var numEl = q('.card-list-num');
      var textEl = q('.card-list-text');
      assert('Цвет цифры белый', /255,\s*255,\s*255/.test(getComputedStyle(numEl).color));
      assert('Цвет фона красный', /220,\s*38,\s*38/.test(getComputedStyle(numEl).backgroundColor));
      assert('Цвет рамки зелёный', /5,\s*150,\s*105/.test(getComputedStyle(numEl).borderColor));
      assert('Цвет текста синий', /37,\s*99,\s*235/.test(getComputedStyle(textEl).color));
    }

    // 28. Размер фигуры (slider)
    q('[data-action="palette"]')?.click();
    var sizeSlider = q('#listNumSizeSlider');
    var sizeValue = q('#listStyleSelect');
    if (sizeSlider) {
      sizeSlider.value = '32';
      sizeSlider.dispatchEvent(new Event('input', {bubbles: true}));
      q('#applyColorsBtn').click();
      var numEl2 = q('.card-list-num');
      assert('Размер фигуры 32px', getComputedStyle(numEl2).width === '32px');
      assert('Высота фигуры 32px', getComputedStyle(numEl2).height === '32px');
      assert('Размер шрифта 16px (32*0.5)', getComputedStyle(numEl2).fontSize === '16px');
    }

    // 29. Resize dividers
    assert('Вертикальный разделитель существует', !!q('#resizeDividerH'));
    assert('Горизонтальный разделитель существует', !!q('#resizeDividerV'));
    assert('Разделитель H имеет cursor row-resize', getComputedStyle(q('#resizeDividerH')).cursor === 'row-resize');
    assert('Разделитель V имеет cursor col-resize', getComputedStyle(q('#resizeDividerV')).cursor === 'col-resize');

    results.push('');
    results.push('=== ИТОГ: ' + passed + ' passed, ' + failed + ' failed ===');
    console.log(results.join('\n'));
    return JSON.stringify({ passed: passed, failed: failed, results: results });
  } catch (err) {
    results.push('  ✗ FATAL: ' + err.message);
    console.error(results.join('\n'));
    return JSON.stringify({ passed: passed, failed: failed + 1, results: results, error: err.message });
  }
})();
