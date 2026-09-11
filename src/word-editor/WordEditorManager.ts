/**
 * WordEditorManager — manages word styling popup, drag, selection, and word styles.
 * Isolated from rendering and state — communicates via callbacks.
 *
 * Public API:
 *   open(x, y, text, field, cardIndex, wordStyles)  — show popup
 *   close()                                          — hide popup
 *   isOpen                                           — check if open
 *   onStyleChange(handler)                           — callback when style changes
 *   onRemoveWord(handler)                            — callback when word style removed
 *   onClear(handler)                                 — callback when clear clicked
 */

import type { WordStyle, Card } from '../core/types';
import { escapeHtml, splitOnce, stripMeta } from '../core/utils';
import { FIELD_LABELS } from '../core/constants';

type StyleChangeHandler = (
  cardIndex: number,
  field: string,
  word: string,
  styles: WordStyle,
) => void;

type RemoveWordHandler = (cardIndex: number, key: string) => void;
type ClearHandler = (cardIndex: number, field: string, word: string) => void;

export class WordEditorManager {
  private popup: HTMLElement;
  private header: HTMLElement;
  private sizeSlider: HTMLInputElement;
  private sizeValue: HTMLElement;
  private wordList: HTMLElement;

  private activeWordStyles: WordStyle & { text?: string } = { text: '' };
  private activeField: string | null = null;
  private activeCardIndex: number | null = null;

  private styleChangeHandler: StyleChangeHandler | null = null;
  private removeWordHandler: RemoveWordHandler | null = null;
  private clearHandler: ClearHandler | null = null;

  /** Tracked event listeners (added via trackListener) — removed in destroy(). */
  private listeners: Array<{
    target: EventTarget;
    type: string;
    handler: EventListenerOrEventListenerObject;
    options?: AddEventListenerOptions | boolean;
  }> = [];

  private dragCleanup: (() => void) | null = null;

  constructor(
    popup: HTMLElement,
    header: HTMLElement,
    sizeSlider: HTMLInputElement,
    sizeValue: HTMLElement,
    wordList: HTMLElement,
  ) {
    this.popup = popup;
    this.header = header;
    this.sizeSlider = sizeSlider;
    this.sizeValue = sizeValue;
    this.wordList = wordList;

    this.initDrag();
    this.initControls();
  }

  get isOpen(): boolean {
    return this.popup.classList.contains('active');
  }

  onStyleChange(handler: StyleChangeHandler): void {
    this.styleChangeHandler = handler;
  }

  onRemoveWord(handler: RemoveWordHandler): void {
    this.removeWordHandler = handler;
  }

  onClear(handler: ClearHandler): void {
    this.clearHandler = handler;
  }

  // ─── Open / Close ───────────────────────────────────────────

  open(
    x: number,
    y: number,
    selectedText: string,
    field: string,
    cardIndex: number,
    existingStyles?: WordStyle,
  ): void {
    this.activeField = field;
    this.activeCardIndex = cardIndex;
    this.activeWordStyles = { text: selectedText };

    if (existingStyles) {
      Object.assign(this.activeWordStyles, existingStyles);
    }

    // Update header
    const fieldLabel = FIELD_LABELS[field] || field;
    const displayWord = selectedText.length > 28 ? selectedText.slice(0, 27) + '…' : selectedText;
    this.header.innerHTML = `<span class="wp-header-label">${escapeHtml(fieldLabel)}:</span> <span class="wp-header-word">${escapeHtml(displayWord)}</span>`;

    // Sync format buttons
    this.syncFormatButtons();
    this.syncColorPresets();
    this.syncSizeSlider();

    // Position with clamp to viewport
    const pad = 12;
    this.popup.classList.add('active');
    this.popup.style.visibility = 'hidden';
    const rect = this.popup.getBoundingClientRect();
    this.popup.style.visibility = '';
    const left = Math.min(Math.max(pad, x), window.innerWidth - rect.width - pad);
    const top = Math.min(Math.max(pad, y), window.innerHeight - rect.height - pad);
    this.popup.style.left = `${left}px`;
    this.popup.style.top = `${top}px`;
  }

  close(): void {
    this.popup.classList.remove('active');
    this.activeField = null;
    this.activeCardIndex = null;
    this.activeWordStyles = { text: '' };
  }

  // ─── Tracked listener helper ───────────────────────────────

  /**
   * Attach a listener AND record it so destroy() can remove it.
   * Use this instead of raw addEventListener to prevent listener leaks
   * across React StrictMode double-mounts.
   */
  private trackListener(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void {
    target.addEventListener(type, handler, options);
    this.listeners.push({ target, type, handler, options });
  }

  // ─── Word style list ────────────────────────────────────────

  renderWordStyleList(card: Card): void {
    if (this.activeCardIndex === null || !this.activeField) {
      this.wordList.innerHTML = '';
      return;
    }
    const field = this.activeField;
    const entries = Object.keys(card.wordStyles || {})
      .filter((k) => {
        const [kf] = splitOnce(k, '::');
        return k.includes('::') ? kf === field : true;
      })
      .map((k) => ({ key: k, word: splitOnce(k, '::')[1] || k }));

    if (entries.length === 0) {
      this.wordList.innerHTML = '<div class="word-list-empty">Стилизованных слов нет</div>';
      return;
    }

    this.wordList.innerHTML =
      '<div class="word-list-title">Стили слов поля:</div>' +
      entries
        .map(
          (e) =>
            `<div class="word-list-item"><span class="word-list-word">${escapeHtml(e.word)}</span><button class="word-list-remove" data-word-key="${escapeHtml(e.key)}" title="Удалить стиль">✕</button></div>`,
        )
        .join('');

    // Attach remove handlers (tracked so destroy() cleans them up —
    // otherwise they'd accumulate on every renderWordStyleList() call).
    this.wordList.querySelectorAll<HTMLElement>('.word-list-remove').forEach((btn) =>
      this.trackListener(btn, 'click', () => {
        const key = btn.dataset.wordKey || '';
        if (this.activeCardIndex !== null && this.removeWordHandler) {
          this.removeWordHandler(this.activeCardIndex, key);
        }
      }),
    );
  }

  // ─── Private ────────────────────────────────────────────────

  private commitStyle(): void {
    if (this.activeCardIndex === null || !this.activeWordStyles.text || !this.activeField) return;
    const { text: _omit, ...rest } = this.activeWordStyles;
    void _omit;
    this.styleChangeHandler?.(this.activeCardIndex, this.activeField, this.activeWordStyles.text, rest);
  }

  private syncFormatButtons(): void {
    const root = this.popup.closest('.cc-root');
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.format-btn').forEach((btn) => {
      const fmt = btn.dataset.format;
      btn.classList.remove('active');
      if (fmt === 'bold' && this.activeWordStyles.fontWeight === 'bold') btn.classList.add('active');
      else if (fmt === 'italic' && this.activeWordStyles.fontStyle === 'italic') btn.classList.add('active');
      else if (fmt === 'underline' && this.activeWordStyles.textDecoration?.includes('underline')) btn.classList.add('active');
      else if (fmt === 'strikethrough' && this.activeWordStyles.textDecoration?.includes('line-through')) btn.classList.add('active');
    });
  }

  private syncColorPresets(): void {
    const root = this.popup.closest('.cc-root');
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.color-preset').forEach((p) => {
      if (this.activeWordStyles.color && p.dataset.color === this.activeWordStyles.color) p.classList.add('active');
      else p.classList.remove('active');
    });
  }

  private syncSizeSlider(): void {
    const sz = this.activeWordStyles.fontSize ? Number(this.activeWordStyles.fontSize) : 16;
    this.sizeSlider.value = String(sz);
    this.sizeValue.textContent = `${sz}px`;
  }

  private initControls(): void {
    const root = this.popup.closest('.cc-root');
    if (!root) return;

    // Format buttons
    root.querySelectorAll<HTMLElement>('.format-btn').forEach((btn) => {
      this.trackListener(btn, 'click', (e) => {
        e.stopPropagation();
        const fmt = btn.dataset.format || '';
        btn.classList.toggle('active');
        const active = btn.classList.contains('active');
        if (fmt === 'bold') this.activeWordStyles.fontWeight = active ? 'bold' : 'normal';
        else if (fmt === 'italic') this.activeWordStyles.fontStyle = active ? 'italic' : 'normal';
        else if (fmt === 'underline') {
          const d = this.activeWordStyles.textDecoration || '';
          this.activeWordStyles.textDecoration = active ? (d + ' underline').trim() : d.replace('underline', '').trim();
        } else if (fmt === 'strikethrough') {
          const d = this.activeWordStyles.textDecoration || '';
          this.activeWordStyles.textDecoration = active ? (d + ' line-through').trim() : d.replace('line-through', '').trim();
        }
        this.commitStyle();
      });
    });

    // Size slider
    this.trackListener(this.sizeSlider, 'input', () => {
      this.activeWordStyles.fontSize = Number(this.sizeSlider.value);
      this.sizeValue.textContent = `${this.sizeSlider.value}px`;
      this.commitStyle();
    });

    // Color presets
    root.querySelectorAll<HTMLElement>('.color-preset[data-color]').forEach((p) => {
      this.trackListener(p, 'click', (e) => {
        e.stopPropagation();
        root.querySelectorAll<HTMLElement>('.color-preset').forEach((x) => x.classList.remove('active'));
        p.classList.add('active');
        this.activeWordStyles.color = p.dataset.color || '';
        this.commitStyle();
      });
    });

    // Accordion sections
    root.querySelectorAll<HTMLElement>('.popup-section-title').forEach((title) => {
      this.trackListener(title, 'click', () => {
        title.closest('.popup-section')?.classList.toggle('collapsed');
      });
    });

    // Clear button
    const clearBtn = this.popup.querySelector<HTMLElement>('#wordClearBtn');
    if (clearBtn) {
      this.trackListener(clearBtn, 'click', (e) => {
        e.stopPropagation();
        if (this.activeCardIndex === null || !this.activeWordStyles.text || !this.activeField) return;
        this.clearHandler?.(this.activeCardIndex, this.activeField, this.activeWordStyles.text);
        // Reset active styles
        this.activeWordStyles = { text: this.activeWordStyles.text };
        this.syncFormatButtons();
        this.syncColorPresets();
        this.syncSizeSlider();
      });
    }
  }

  private initDrag(): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let popupStartX = 0;
    let popupStartY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.popup.getBoundingClientRect();
      popupStartX = rect.left;
      popupStartY = rect.top;
      this.header.style.cursor = 'grabbing';
      this.popup.style.userSelect = 'none';
      e.preventDefault();
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const pad = 8;
      const rect = this.popup.getBoundingClientRect();
      let newLeft = popupStartX + dx;
      let newTop = popupStartY + dy;
      newLeft = Math.min(Math.max(pad, newLeft), window.innerWidth - rect.width - pad);
      newTop = Math.min(Math.max(pad, newTop), window.innerHeight - rect.height - pad);
      this.popup.style.left = `${newLeft}px`;
      this.popup.style.top = `${newTop}px`;
    };

    const onPointerUp = () => {
      isDragging = false;
      this.header.style.cursor = 'grab';
      this.popup.style.userSelect = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    this.header.style.cursor = 'grab';
    this.header.addEventListener('pointerdown', onPointerDown);

    this.dragCleanup = () => {
      this.header.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }

  /** Cleanup all listeners (tracked + drag) */
  destroy(): void {
    // Remove all tracked listeners (format-btn, color-preset, popup-section-title,
    // size-slider, clearBtn, word-list-remove buttons) so React StrictMode
    // double-mounts don't accumulate duplicates.
    for (const { target, type, handler, options } of this.listeners) {
      target.removeEventListener(type, handler, options);
    }
    this.listeners = [];

    // Drag listeners (header pointerdown + any lingering document move/up).
    if (this.dragCleanup) this.dragCleanup();
  }
}
