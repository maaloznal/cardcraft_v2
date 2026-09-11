'use client';

import { useEffect, useRef } from 'react';
import { initCardCraftApp, THEME_GROUPS } from '@/orchestrator/CardCraftApp';
import './card-constructor.css';

const initCardConstructor = initCardCraftApp;

const FORMATS = [
  { value: 'auto', label: 'Стандартный — 380×auto' },
  { value: 'aspect-4-5', label: 'Instagram — 1080×1350' },
  { value: 'aspect-9-16', label: 'Stories — 1080×1920' },
  { value: 'whatsapp', label: 'WhatsApp — 1080×1920' },
  { value: 'telegram', label: 'Telegram — 1080×1350' },
  { value: 'vk', label: 'VK — 1200×630' },
];

const FORMAT_BTNS = [
  { fmt: 'bold', label: 'B', title: 'Жирный' },
  { fmt: 'italic', label: 'I', title: 'Курсив' },
  { fmt: 'underline', label: 'U', title: 'Подчёркнутый' },
  { fmt: 'strikethrough', label: 'S', title: 'Зачёркнутый' },
];

const MODAL_ROWS = [
  { key: 'title', label: 'Заголовок', defaultSize: 24, hasStyleControls: true },
  { key: 'subtitle', label: 'Подзаголовок', defaultSize: 18, hasStyleControls: true },
  { key: 'text', label: 'Основной текст', defaultSize: 16, hasStyleControls: true },
  { key: 'list', label: 'Список', defaultSize: 16, hasStyleControls: true },
  { key: 'listNumber', label: 'Цвет цифры', defaultSize: 16, hasStyleControls: false },
  { key: 'listNumBg', label: 'Цвет фона фигуры', defaultSize: 16, hasStyleControls: false },
  { key: 'listNumBorder', label: 'Цвет рамки фигуры', defaultSize: 16, hasStyleControls: false },
  { key: 'footer', label: 'Итоговый вывод', defaultSize: 14, hasStyleControls: true },
  { key: 'cta', label: 'Кнопка / CTA', defaultSize: 16, hasStyleControls: true },
];

// Улучшение#2: Группировка полей модалки в аккордеон-разделы
const MODAL_GROUPS = [
  { label: 'Заголовок и подзаголовок', keys: ['title', 'subtitle'] },
  { label: 'Текст и список', keys: ['text', 'list'] },
  { label: 'Нумерация списка', keys: ['listNumber', 'listNumBg', 'listNumBorder'] },
  { label: 'Итог и кнопка', keys: ['footer', 'cta'] },
];

const PRESETS = [
  '#0f172a', '#4f46e5', '#2563eb', '#059669',
  '#ea580c', '#dc2626', '#ec4899', '#7c3aed',
];

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    return initCardConstructor(rootRef.current);
  }, []);

  return (
    <div className="cc-root" ref={rootRef}>
      {/* ================= TOP BAR ================= */}
      <header className="top-bar">
        <div className="top-bar-left">
          <button
            className="sidebar-toggle"
            id="toggleSidebarBtn"
            aria-label="Показать/скрыть редактор"
            title="Редактор"
            type="button"
          >
            <PanelIcon />
          </button>
          <div className="brand">
            <span className="brand-name">Cardcraft</span>
            <span className="card-count-badge" id="cardCountBadge" aria-live="polite">
              1 карточка
            </span>
          </div>
        </div>
        <div className="top-bar-right">
          <button className="btn-icon top-bar-btn" id="undoBtn" title="Отменить (Ctrl+Z)" aria-label="Отменить" type="button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
          <button className="btn-icon top-bar-btn" id="redoBtn" title="Повторить (Ctrl+Y)" aria-label="Повторить" type="button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </header>

      {/* ================= APP LAYOUT ================= */}
      <div className="app-layout">
        {/* Sidebar */}
        <aside className="editor-sidebar collapsed" id="editorSidebar">
          <div className="sidebar-fixed-header">

          {/* 1. Формат */}
          <div className="sidebar-accordion" data-sidebar-accordion>
            <button className="sidebar-accordion-header" type="button" data-sidebar-toggle>
              <span>Формат</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="sidebar-accordion-body">
            <div className="sidebar-section">
            <select id="formatSelect" defaultValue="auto">
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className="toggle-row" style={{ marginTop: 10 }}>
              <span className="toggle-label">Лимит символов</span>
              <label className="switch">
                <input type="checkbox" id="charLimitToggle" />
                <span className="switch-slider" />
              </label>
            </div>
            <div className="char-counter" id="charCounter" style={{ display: 'none' }}>
              <span id="charCounterText">0 / 0</span>
            </div>
            </div>
            </div>
          </div>

          {/* 2. Тема оформления */}
          <div className="sidebar-accordion" data-sidebar-accordion>
            <button className="sidebar-accordion-header" type="button" data-sidebar-toggle>
              <span>Тема оформления</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="sidebar-accordion-body">
            <div className="sidebar-section">
            {/* Скрытый native select для совместимости с TS логикой */}
            <select id="themeSelect" defaultValue="default" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {THEME_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.themes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {/* Кастомный аккордеон-селектор */}
            <div className="theme-dropdown" id="themeDropdown">
              <button className="theme-dropdown-trigger" id="themeDropdownTrigger" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span className="theme-dropdown-label" id="themeDropdownLabel">1. Clean Minimal</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div className="theme-dropdown-panel" id="themeDropdownPanel" role="listbox">
                {THEME_GROUPS.map((g, gi) => (
                  <div className="theme-group" key={g.label} data-group-index={gi}>
                    <button className="theme-group-header" type="button" aria-expanded="false">
                      <span>{g.label}</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div className="theme-group-items">
                      {g.themes.map((t) => (
                        <button
                          className="theme-item"
                          data-value={t.value}
                          data-label={t.label}
                          type="button"
                          key={t.value}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
            </div>
          </div>

          {/* 3. Угол градиента */}
          <div className="sidebar-accordion" data-sidebar-accordion>
            <button className="sidebar-accordion-header" type="button" data-sidebar-toggle>
              <span>Угол градиента</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="sidebar-accordion-body">
            <div className="sidebar-section gradient-control-section">
            <div className="gradient-value-row">
              <span className="gradient-angle-value" id="gradientAngleValue">135°</span>
            </div>
            <input
              type="range"
              id="gradientAngleSlider"
              min={0}
              max={360}
              defaultValue={135}
              className="gradient-angle-slider"
            />
            </div>
            </div>
          </div>

          {/* 4. Стиль списков (включая нумерацию карточек) */}
          <div className="sidebar-accordion" data-sidebar-accordion>
            <button className="sidebar-accordion-header" type="button" data-sidebar-toggle>
              <span>Стиль списков</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="sidebar-accordion-body">
            <div className="sidebar-section">
            <select id="listStyleSelect" defaultValue="numbers">
              <option value="numbers">Классическая нумерация</option>
              <option value="bullets">Маркеры</option>
              <option value="dashes">Тире</option>
              <option value="circles">Цифры в круге</option>
              <option value="squares">Цифры в квадрате</option>
              <option value="decorative">Декоративные маркеры</option>
            </select>
            </div>
            <div className="sidebar-section">
            <div className="toggle-row">
              <span className="toggle-label">Нумерация карточек</span>
              <label className="switch">
                <input type="checkbox" id="numberingToggle" defaultChecked />
                <span className="switch-slider" />
              </label>
            </div>
            </div>
            </div>
          </div>

          {/* 5. Шкала прогресса (стиль + переключатель) */}
          <div className="sidebar-accordion" data-sidebar-accordion>
            <button className="sidebar-accordion-header" type="button" data-sidebar-toggle>
              <span>Шкала прогресса</span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="sidebar-accordion-body">
            <div className="sidebar-section">
            <div className="toggle-row" style={{ marginBottom: 10 }}>
              <span className="toggle-label">Показывать шкалу</span>
              <label className="switch">
                <input type="checkbox" id="progressBarToggle" defaultChecked />
                <span className="switch-slider" />
              </label>
            </div>
            <select id="progressBarStyleSelect" defaultValue="default">
              <option value="default">Сплошная линия</option>
              <option value="dashed">Пунктирная линия</option>
              <option value="circles">Круги</option>
              <option value="squares">Квадраты</option>
              <option value="diamonds">Ромбы</option>
              <option value="hexagons">Шестиугольники</option>
              <option value="stars">Звёзды</option>
            </select>
            </div>
            </div>
          </div>

          </div>

          {/* Вертикальный разделитель между верхней и нижней областью */}
          <div className="resize-divider resize-divider-h" id="resizeDividerH" title="Потяните для изменения высоты" />

          <div className="sidebar-scroll-area">
          <div id="editorCardsList" />

          <div className="sidebar-section" style={{ borderBottom: 'none', paddingTop: 0 }}>
            <button className="btn-add" id="addCardBtn" aria-label="Добавить новую карточку">
              + Добавить карточку
            </button>
          </div>

          <div className="sidebar-mass-actions">
            <button className="btn-secondary" id="saveAll" title="Скачать все карточки как PNG" type="button">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Скачать все
            </button>
            <button className="btn-delete-mass" id="deleteAllBtn" title="Удалить все карточки" type="button">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              Удалить все
            </button>
          </div>
          </div>
        </aside>

        {/* Горизонтальный разделитель между sidebar и workspace */}
        <div className="resize-divider resize-divider-v" id="resizeDividerV" title="Потяните для изменения ширины" />

        <div className="sidebar-backdrop" id="sidebarBackdrop" />

        {/* Workspace */}
        <main className="preview-workspace" id="previewWorkspace">
          <div className="cards-container" id="cardsArea" />
        </main>
      </div>

      {/* ================= MODAL PALETTE ================= */}
      <div className="modal-overlay" id="colorModal" role="dialog" aria-modal="true">
        <div className="modal-card">
          <div className="modal-header">
            <h3 id="modalCardTitle">Стили карточки</h3>
            <button className="modal-close" id="closeModalBtn" aria-label="Закрыть" type="button">
              ×
            </button>
          </div>

          {/* Тема карточки — первый пункт редактора стилей */}
          <div className="modal-card-theme-section">
            <label className="sidebar-label">Тема карточки</label>
            <div className="theme-dropdown" id="modalCardThemeDropdown">
              <button className="theme-dropdown-trigger" id="modalCardThemeTrigger" type="button">
                <span className="theme-dropdown-label" id="modalCardThemeLabel">По умолчанию</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div className="theme-dropdown-panel" id="modalCardThemePanel">
                <button className="theme-item modal-card-theme-item selected" data-modal-card-theme="default" data-label="По умолчанию" type="button">По умолчанию</button>
                {THEME_GROUPS.map((g) => (
                  <div className="theme-group" key={g.label}>
                    <button className="theme-group-header" type="button">
                      <span>{g.label}</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div className="theme-group-items">
                      {g.themes.map((t) => (
                        <button
                          className="theme-item modal-card-theme-item"
                          data-modal-card-theme={t.value}
                          data-label={t.label}
                          type="button"
                          key={t.value}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="palette-presets-section">
            <div className="palette-presets-title">
              Быстрые цвета: <span id="presetTargetLabel">Заголовок</span>
            </div>
            <div className="palette-swatches">
              {PRESETS.map((c) => (
                <div
                  key={c}
                  className="color-swatch"
                  data-preset={c}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="color-picker-grid">
            {MODAL_GROUPS.map((group) => (
              <div className="modal-accordion-group" key={group.label}>
                <button className="modal-accordion-header" type="button" data-accordion-toggle>
                  <span>{group.label}</span>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div className="modal-accordion-body">
                  {group.keys.map((key) => {
                    const row = MODAL_ROWS.find((r) => r.key === key);
                    if (!row) return null;
                    return (
                      <div className="color-picker-row" data-row-field={row.key} key={row.key}>
                        <span className="color-picker-label">{row.label}</span>
                        <div className="color-picker-controls">
                          <span className="color-hex-text is-auto" id={`hex-${row.key}`}>
                            АВТО
                          </span>
                          <input
                            type="color"
                            className="color-picker-input"
                            id={`col-${row.key}`}
                            data-field={row.key}
                            aria-label={`Цвет: ${row.label}`}
                          />
                          <button
                            className="btn-reset-single"
                            data-reset={row.key}
                            title="Сбросить цвет"
                            aria-label={`Сбросить цвет: ${row.label}`}
                            type="button"
                          >
                            ✕
                          </button>
                        </div>
                        {row.hasStyleControls && (
                          <div className="section-style-controls">
                            <div className="text-format-controls">
                              {FORMAT_BTNS.map((b) => (
                                <button
                                  key={b.fmt}
                                  className="format-btn-section"
                                  data-field={row.key}
                                  data-format={b.fmt}
                                  title={b.title}
                                  type="button"
                                >
                                  {b.label}
                                </button>
                              ))}
                            </div>
                            <div className="size-control-section">
                              <input
                                type="range"
                                className="size-slider-section"
                                data-field={row.key}
                                min={10}
                                max={48}
                                defaultValue={row.defaultSize}
                              />
                              <span className="size-value-section" data-field={row.key}>
                                {row.defaultSize}px
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {group.label === 'Нумерация списка' && (
                    <div className="color-picker-row">
                      <span className="color-picker-label">Размер фигуры</span>
                      <div className="size-control-section" style={{ paddingTop: 4 }}>
                        <input
                          type="range"
                          id="listNumSizeSlider"
                          min={16}
                          max={40}
                          defaultValue={22}
                        />
                        <span id="listNumSizeValue">22px</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="modal-footer">
            <button className="btn-secondary" id="resetCardColorsBtn" type="button">
              Сбросить всё
            </button>
            <button className="btn-primary" id="applyColorsBtn" type="button">
              Готово
            </button>
          </div>
        </div>
      </div>

      {/* ================= WORD STYLE POPUP ================= */}
      <div className="word-style-popup" id="wordStylePopup" role="dialog" aria-label="Настройка слова">
        <div className="word-popup-header" id="wordPopupHeader" />
        <button
          className="word-clear-btn"
          id="wordClearBtn"
          type="button"
          title="Убрать все стили с этого слова"
        >
          Сбросить стиль слова
        </button>
        <div className="popup-section">
          <div className="popup-section-title">
            <span>Текст</span>
          </div>
          <div className="popup-section-content">
            <div className="text-format-controls">
              {FORMAT_BTNS.map((b) => (
                <button
                  key={b.fmt}
                  className="format-btn"
                  data-format={b.fmt}
                  title={b.title}
                  type="button"
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="size-control-section">
              <input type="range" id="sizeSlider" min={10} max={48} defaultValue={16} />
              <span id="sizeValue">16px</span>
            </div>
          </div>
        </div>
        <div className="popup-section">
          <div className="popup-section-title">
            <span>Цвет</span>
          </div>
          <div className="popup-section-content">
            <div className="color-presets">
              {PRESETS.map((c) => (
                <div
                  key={c}
                  className="color-preset"
                  data-color={c}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="popup-section">
          <div className="popup-section-title">
            <span>Стили слов</span>
          </div>
          <div className="popup-section-content">
            <div id="wordStyleList" className="word-style-list" />
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      <div className="confirm-overlay" id="confirmOverlay">
        <div className="confirm-dialog">
          <p className="confirm-text" id="confirmText">Вы действительно хотите удалить все карточки?</p>
          <div className="confirm-actions">
            <button className="btn-secondary" id="confirmCancel" type="button">Отмена</button>
            <button className="btn-danger-confirm" id="confirmOk" type="button">Удалить</button>
          </div>
        </div>
      </div>

      <div id="toast" className="toast" aria-live="polite" />
    </div>
  );
}
