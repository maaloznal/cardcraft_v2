/**
 * PreviewRenderer — renders card preview and manages targeted updates.
 * Only module that manipulates the #cardsArea DOM.
 *
 * Public API:
 *   render(cards, settings)         — full rebuild O(n)
 *   updateCardField(card, field)    — O(1) text update
 *   updateCardStyle(card, field)    — O(1) style update (colors, word styles)
 *   updateCardTheme(card, theme)    — O(1) theme attribute
 *   removeCard(cardId)              — O(1) DOM removal
 *   insertCard(card, index, settings) — O(1) DOM insertion
 *   updateProgressBars(total)       — O(n) rebuild progress bars only
 */

import { wordAtPoint } from '../word-editor/word-at-point';
import type { Card } from '../core/types';
import { escapeAttr, sanitizeCardId } from '../core/utils';
import {
  FIELD_CONFIG,
  SHAPE_PROGRESS_STYLES,
  ALLOWED_THEMES,
  ALLOWED_FORMATS,
} from '../core/constants';
import {
  buildSectionStyle,
  buildListNumStyle,
  applyWordStylesToText,
} from '../styles/StyleHelpers';

export interface PreviewSettings {
  theme: string;
  format: string;
  progressBarStyle: string;
  showCardNumbers: boolean;
  showProgressBar: boolean;
}

type ActionHandler = (action: string, data: Record<string, unknown>) => void;

export class PreviewRenderer {
  private container: HTMLElement;
  private actionHandler: ActionHandler | null = null;
  /** Tracked listeners for cleanup (StrictMode double-mount safety) */
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private dblclickHandler: ((e: MouseEvent) => void) | null = null;
  private pointerUpHandler: ((e: PointerEvent) => void) | null = null;
  private selectionHandler: (() => void) | null = null;
  private pointerDownHandler: ((e: PointerEvent) => void) | null = null;
  private selectionTimer: number | null = null;
  private touchSelection = false;
  private touchStart: { x: number; y: number; time: number } | null = null;
  private touchTap: { x: number; y: number } | null = null;
  private selectionButton: HTMLButtonElement | null = null;
  private selected: Record<string, unknown> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupDelegation();
  }

  /** Set callback for user actions (edit, download, copy, delete, dblclick) */
  onAction(handler: ActionHandler): void {
    this.actionHandler = handler;
  }

  /** Remove all event listeners (StrictMode double-mount safety) */
  destroy(): void {
    if (this.clickHandler) this.container.removeEventListener('click', this.clickHandler);
    if (this.dblclickHandler) this.container.removeEventListener('dblclick', this.dblclickHandler);
    if (this.pointerUpHandler) this.container.removeEventListener('pointerup', this.pointerUpHandler);
    if (this.pointerDownHandler) this.container.removeEventListener('pointerdown', this.pointerDownHandler);
    if (this.selectionHandler) document.removeEventListener('selectionchange', this.selectionHandler);
    if (this.selectionTimer !== null) window.clearTimeout(this.selectionTimer);
    this.selectionButton?.remove();
    this.selected = null;
    this.clickHandler = null;
    this.dblclickHandler = null;
    this.pointerUpHandler = null;
    this.actionHandler = null;
  }

  // ─── Full render ────────────────────────────────────────────

  /** Full O(n) rebuild — wipe #cardsArea and append a fresh wrapper per card. */
  render(cards: Card[], settings: PreviewSettings): void {
    this.container.innerHTML = '';
    cards.forEach((card, index) => {
      const wrapper = this.buildCardWrapper(card, index, cards.length, settings);
      this.container.appendChild(wrapper);
    });
  }

  // ─── Targeted updates ───────────────────────────────────────

  /** Update a single text field in preview (O(1)) */
  updateCardField(card: Card, field: string, cardIndex: number): void {
    const cardNode = this.getCardNode(card.id);
    if (!cardNode) {
      return; // Card not in DOM — caller should call render()
    }

    const value = (card[field as keyof Card] as string) || '';

    // listItems → rebuild list section
    if (field === 'listItems') {
      this.updateList(cardNode, card, cardIndex);
      this.updateEmptyHint(cardNode, card);
      return;
    }

    // listNumber color fields → update CSS vars on .card-list-num
    if (['listNumber', 'listNumBg', 'listNumBorder', 'listNumSize'].includes(field)) {
      this.updateListNumVars(cardNode, card);
      return;
    }

    const el = cardNode.querySelector<HTMLElement>(`[data-field="${field}"]`);

    // Case 1: content exists, element exists → update in-place
    if (value && el) {
      const styled = applyWordStylesToText(value, card.wordStyles, field);
      el.innerHTML = field === 'subtitle' || field === 'text' ? styled.replace(/\n/g, '<br>') : styled;
      this.updateEmptyHint(cardNode, card);
      return;
    }

    // Case 2: content exists, element missing → create and insert
    if (value && !el) {
      this.createFieldElement(cardNode, card, cardIndex, field, value);
      this.updateEmptyHint(cardNode, card);
      return;
    }

    // Case 3: content empty, element exists → remove
    if (!value && el) {
      const parent = el.parentElement;
      el.remove();
      if (parent?.classList.contains('card-bottom-content') && !parent.children.length) parent.remove();
      this.updateEmptyHint(cardNode, card);
      return;
    }
  }

  /** Update style (color, fontWeight, fontSize, wordStyles) for a field (O(1)) */
  updateCardStyle(card: Card, field: string, cardIndex: number): void {
    const cardNode = this.getCardNode(card.id);
    if (!cardNode) return;

    if (field === 'list') {
      this.updateList(cardNode, card, cardIndex);
      return;
    }

    if (['listNumber', 'listNumBg', 'listNumBorder', 'listNumSize'].includes(field)) {
      this.updateListNumVars(cardNode, card);
      return;
    }

    const el = cardNode.querySelector<HTMLElement>(`[data-field="${field}"]`);
    const value = (card[field as keyof Card] as string) || '';

    if (el && value) {
      const styleStr = buildSectionStyle(card, field);
      const styleValue = styleStr ? styleStr.replace(/^style="/, '').replace(/"$/, '') : '';
      if (styleValue) el.setAttribute('style', styleValue);
      else el.removeAttribute('style');

      const styled = applyWordStylesToText(value, card.wordStyles, field);
      el.innerHTML = field === 'subtitle' || field === 'text' ? styled.replace(/\n/g, '<br>') : styled;
    }
  }

  /** Update card theme attribute (O(1)) */
  updateCardTheme(card: Card, globalTheme: string): void {
    const cardNode = this.getCardNode(card.id);
    if (!cardNode) return;
    const cardTheme = card.theme && card.theme !== 'default' ? card.theme : globalTheme;
    if (cardTheme !== 'default') cardNode.setAttribute('data-theme', cardTheme);
    else cardNode.removeAttribute('data-theme');
  }

  /** Remove a card from DOM (O(1)) */
  removeCard(cardId: string): void {
    const node = this.getCardNode(cardId);
    node?.closest('.card-wrapper')?.remove();
  }

  /** Insert a card at a specific index (O(1)) */
  insertCard(card: Card, index: number, total: number, settings: PreviewSettings): void {
    const wrapper = this.buildCardWrapper(card, index, total, settings);
    const wrappers = this.container.querySelectorAll<HTMLElement>('.card-wrapper');
    if (index >= wrappers.length) {
      this.container.appendChild(wrapper);
    } else {
      this.container.insertBefore(wrapper, wrappers[index]);
    }
  }

  /** Rebuild all progress bars (O(n)) — used when count or style changes */
  updateProgressBars(cards: Card[], settings: PreviewSettings): void {
    const total = cards.length;
    this.container.querySelectorAll<HTMLElement>('.card').forEach((cardNode, i) => {
      const oldProgress = cardNode.querySelector<HTMLElement>('.progress');
      if (oldProgress) {
        const html = buildProgressBarHtml(i, total, settings.progressBarStyle);
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const newProgress = temp.firstElementChild;
        if (newProgress) oldProgress.replaceWith(newProgress);
      }
      // Update tag
      if (settings.showCardNumbers) {
        const tag = cardNode.querySelector<HTMLElement>('.tag span');
        if (tag) {
          const cardNum = String(i + 1).padStart(2, '0');
          const totalNum = String(total).padStart(2, '0');
          tag.textContent = `${cardNum} / ${totalNum}`;
        }
      }
    });
  }

  // ─── Private helpers ────────────────────────────────────────

  private getCardNode(cardId: string): HTMLElement | null {
    const safeCardId = sanitizeCardId(cardId);
    return document.getElementById(`card-node-${safeCardId}`);
  }

  private buildCardWrapper(
    card: Card,
    index: number,
    total: number,
    settings: PreviewSettings,
  ): HTMLElement {
    const cardNum = String(index + 1).padStart(2, '0');
    const totalNum = String(total).padStart(2, '0');
    const progressHtml = settings.showProgressBar
      ? buildProgressBarHtml(index, total, settings.progressBarStyle)
      : '';
    const tagHtml = settings.showCardNumbers
      ? `<div class="tag"><span>${cardNum} / ${totalNum}</span><span></span></div>`
      : '';

    const titleStyle = buildSectionStyle(card, 'title');
    const subtitleStyle = buildSectionStyle(card, 'subtitle');
    const textStyle = buildSectionStyle(card, 'text');
    const listStyle = buildSectionStyle(card, 'list');
    const listNumStyle = buildListNumStyle(card);
    const footerStyle = buildSectionStyle(card, 'footer');
    const ctaStyle = buildSectionStyle(card, 'cta');

    // Sanitize card.id early — needed for data-card-id on list items + wrapper
    const safeCardId = sanitizeCardId(card.id);

    let listHtml = '';
    if ((card.listItems || '').trim()) {
      const items = card.listItems.split('\n').filter((i) => i.trim());
      listHtml = `<ul class="card-list">${items
        .map(
          (it, idx) => `<li class="card-list-item" ${listStyle}>
            <span class="card-list-num" ${listNumStyle}>${idx + 1}</span>
            <span class="card-list-text" ${listStyle} data-field="list" data-card-id="${safeCardId}">${applyWordStylesToText(it, card.wordStyles, 'list')}</span>
          </li>`,
        )
        .join('')}</ul>`;
    }

    // Validate and sanitize theme
    const cardTheme = card.theme && ALLOWED_THEMES.includes(card.theme as any) ? card.theme : settings.theme;
    const safeTheme = ALLOWED_THEMES.includes(cardTheme as any) ? cardTheme : 'default';
    const themeAttr = safeTheme !== 'default' ? `data-theme="${escapeAttr(safeTheme)}"` : '';

    // Validate and sanitize format
    const safeFormat = ALLOWED_FORMATS.includes(settings.format as any) ? settings.format : 'auto';
    const formatAttr = safeFormat !== 'auto' ? `data-format="${escapeAttr(safeFormat)}"` : '';

    const hasContent =
      card.title || card.subtitle || card.text || (card.listItems || '').trim() || card.footer || card.cta;
    const emptyHint = !hasContent
      ? `<div class="card-empty-hint">Карточка пуста — заполните поля в редакторе</div>`
      : '';

    // Build top content (progress + tag + title + subtitle + text + list).
    // Only render the wrapper div if it has any children — avoids empty
    // flex items that take up gap space (16px) for no reason.
    const cardCopyInner = `${emptyHint}${card.title ? `<h2 class="card-title" ${titleStyle} data-field="title" data-card-id="${safeCardId}">${applyWordStylesToText(card.title, card.wordStyles, 'title')}</h2>` : ''}${card.subtitle ? `<p class="card-subtitle" ${subtitleStyle} data-field="subtitle" data-card-id="${safeCardId}">${applyWordStylesToText(card.subtitle, card.wordStyles, 'subtitle').replace(/\n/g, '<br>')}</p>` : ''}${card.text ? `<p class="card-text" ${textStyle} data-field="text" data-card-id="${safeCardId}">${applyWordStylesToText(card.text, card.wordStyles, 'text').replace(/\n/g, '<br>')}</p>` : ''}${listHtml}`;
    const cardCopy = cardCopyInner.trim() ? `<div class="card-copy">${cardCopyInner}</div>` : '';
    const topContentInner = `${progressHtml}${tagHtml}${cardCopy}`;
    const topContent = topContentInner.trim()
      ? `<div class="card-top-content">${topContentInner}</div>`
      : '';

    // Build bottom content (footer + cta). Only render if at least one is present.
    const bottomContentInner = `${card.footer ? `<div class="card-footer-text" ${footerStyle} data-field="footer" data-card-id="${safeCardId}">${applyWordStylesToText(card.footer, card.wordStyles, 'footer')}</div>` : ''}${card.cta ? `<div class="accent-btn" ${ctaStyle} data-field="cta" data-card-id="${safeCardId}">${applyWordStylesToText(card.cta, card.wordStyles, 'cta')}</div>` : ''}`;
    const bottomContent = bottomContentInner.trim()
      ? `<div class="card-bottom-content">${bottomContentInner}</div>`
      : '';

    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    wrapper.dataset.cardId = safeCardId;
    wrapper.innerHTML = `
      <div class="card" id="card-node-${safeCardId}" ${themeAttr} ${formatAttr}>
        ${topContent}
        ${bottomContent}
      </div>
      <div class="card-actions">
        <div class="card-actions-main">
          <button class="btn-card-action btn-card-history" data-action="undo-preview" title="Отменить изменение" aria-label="Отменить изменение" disabled><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
          <button class="btn-card-action btn-card-history" data-action="redo-preview" title="Вернуть изменение" aria-label="Вернуть изменение" disabled><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
          <button class="btn-card-action" data-action="edit-preview" data-card-id="card-node-${safeCardId}" title="Редактировать карточку ${index + 1}" aria-label="Редактировать карточку ${index + 1}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
          <button class="btn-card-action" data-action="palette-preview" data-card-id="card-node-${safeCardId}" title="Персональные стили карточки ${index + 1}" aria-label="Персональные стили карточки ${index + 1}"><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></button>
          <button class="btn-card-action" data-action="download" data-card-id="card-node-${safeCardId}" data-filename="card-${index + 1}.png" title="Скачать" aria-label="Скачать"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
          <button class="btn-card-action" data-action="copy" data-card-id="card-node-${safeCardId}" title="Копировать" aria-label="Копировать"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="btn-card-action btn-card-action-danger" data-action="delete-preview" data-card-id="card-node-${safeCardId}" title="Удалить" aria-label="Удалить"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
          <button class="btn-card-action btn-card-ai" data-action="improve-ai" data-card-id="card-node-${safeCardId}" data-tooltip="Улучшить с ИИ" title="Улучшить с ИИ" aria-label="Улучшить карточку ${index + 1} с ИИ"><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z"/><path d="m18.5 13-.8 2.2-2.2.8 2.2.8.8 2.2.8-2.2 2.2-.8-2.2-.8-.8-2.2Z"/></svg><span class="btn-card-ai-label">Улучшить с ИИ</span></button>
        </div>
      </div>
    `;
    return wrapper;
  }

  private createFieldElement(
    cardNode: HTMLElement,
    card: Card,
    cardIndex: number,
    field: string,
    value: string,
  ): void {
    const cfg = FIELD_CONFIG[field];
    if (!cfg) return;

    const containerSel = cfg.container === 'top' ? '.card-copy' : '.card-bottom-content';
    let container = cardNode.querySelector<HTMLElement>(containerSel);
    if (!container && cfg.container === 'top') {
      const topContent = cardNode.querySelector<HTMLElement>('.card-top-content');
      if (topContent) {
        container = document.createElement('div');
        container.className = 'card-copy';
        topContent.appendChild(container);
      }
    }
    if (!container && cfg.container === 'bottom') {
      container = document.createElement('div');
      container.className = 'card-bottom-content';
      cardNode.appendChild(container);
    }
    if (!container) return;

    const el = document.createElement(cfg.tag);
    el.className = cfg.cls;
    el.setAttribute('data-field', field);
    // P1-1: use stable data-card-id instead of positional data-index
    el.setAttribute('data-card-id', sanitizeCardId(card.id));

    const styleStr = buildSectionStyle(card, field);
    if (styleStr) el.setAttribute('style', styleStr.replace('style="', '').replace(/"$/, ''));

    const styled = applyWordStylesToText(value, card.wordStyles, field);
    el.innerHTML = field === 'subtitle' || field === 'text' ? styled.replace(/\n/g, '<br>') : styled;

    // Find insertion position
    const fieldsInOrder = Object.keys(FIELD_CONFIG)
      .filter((k) => FIELD_CONFIG[k].container === cfg.container)
      .sort((a, b) => FIELD_CONFIG[a].order - FIELD_CONFIG[b].order);

    let insertBefore: HTMLElement | null = null;
    for (const f of fieldsInOrder) {
      if (FIELD_CONFIG[f].order > cfg.order) {
        if (f === 'list') {
          const listEl = container.querySelector<HTMLElement>('.card-list');
          if (listEl) { insertBefore = listEl; break; }
        } else {
          const nextEl = container.querySelector<HTMLElement>(`[data-field="${f}"]`);
          if (nextEl) { insertBefore = nextEl; break; }
        }
      }
    }

    if (insertBefore) container.insertBefore(el, insertBefore);
    else container.appendChild(el);
  }

  private updateList(cardNode: HTMLElement, card: Card, _cardIndex: number): void {
    const listStyle = buildSectionStyle(card, 'list');
    const listNumStyle = buildListNumStyle(card);
    const safeCardId = sanitizeCardId(card.id);

    let listHtml = '';
    if ((card.listItems || '').trim()) {
      const items = card.listItems.split('\n').filter((i) => i.trim());
      listHtml = items
        .map(
          (it, idx) => `<li class="card-list-item" ${listStyle}>
            <span class="card-list-num" ${listNumStyle}>${idx + 1}</span>
            <span class="card-list-text" ${listStyle} data-field="list" data-card-id="${safeCardId}">${applyWordStylesToText(it, card.wordStyles, 'list')}</span>
          </li>`,
        )
        .join('');
    }

    const existingList = cardNode.querySelector<HTMLElement>('.card-list');
    let topContent = cardNode.querySelector<HTMLElement>('.card-copy');
    if (!topContent) {
      const topWrapper = cardNode.querySelector<HTMLElement>('.card-top-content');
      if (topWrapper) {
        topContent = document.createElement('div');
        topContent.className = 'card-copy';
        topWrapper.appendChild(topContent);
      }
    }

    if (existingList) {
      if (listHtml) existingList.innerHTML = listHtml;
      else existingList.remove();
    } else if (listHtml && topContent) {
      const ul = document.createElement('ul');
      ul.className = 'card-list';
      ul.innerHTML = listHtml;
      topContent.appendChild(ul);
    }
  }

  private updateListNumVars(cardNode: HTMLElement, card: Card): void {
    const nums = cardNode.querySelectorAll<HTMLElement>('.card-list-num');
    const c = card.colors || {};
    nums.forEach((num) => {
      if (c.listNumber) num.style.setProperty('--num-color', c.listNumber);
      else num.style.removeProperty('--num-color');
      if (c.listNumBg) num.style.setProperty('--num-bg', c.listNumBg);
      else num.style.removeProperty('--num-bg');
      if (c.listNumBorder) num.style.setProperty('--num-border', c.listNumBorder);
      else num.style.removeProperty('--num-border');
      if (c.listNumSize) num.style.setProperty('--num-size', `${c.listNumSize}px`);
      else num.style.removeProperty('--num-size');
    });
  }

  private updateEmptyHint(cardNode: HTMLElement, card: Card): void {
    const hasContent =
      card.title || card.subtitle || card.text || (card.listItems || '').trim() || card.footer || card.cta;
    const existingHint = cardNode.querySelector<HTMLElement>('.card-empty-hint');
    if (hasContent && existingHint) {
      existingHint.remove();
    } else if (!hasContent && !existingHint) {
      let topContent = cardNode.querySelector<HTMLElement>('.card-copy');
      if (!topContent) {
        const topWrapper = cardNode.querySelector<HTMLElement>('.card-top-content');
        if (topWrapper) {
          topContent = document.createElement('div');
          topContent.className = 'card-copy';
          topWrapper.appendChild(topContent);
        }
      }
      if (topContent) {
        const hint = document.createElement('div');
        hint.className = 'card-empty-hint';
        hint.textContent = 'Карточка пуста — заполните поля в редакторе';
        topContent.appendChild(hint);
      }
    }
  }

  /** Event delegation — set up once on container */
  private setupDelegation(): void {
    // Click delegation for action buttons
    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-action]');
      if (!btn) {
        const tap = this.touchTap; this.touchTap = null;
        const field = target.closest<HTMLElement>('[data-field]');
        if (this.touchSelection && tap && field && this.container.contains(field)) {
          const text = wordAtPoint(field, tap.x, tap.y);
          if (text) {
            e.stopPropagation();
            this.actionHandler?.('dblclick', { text, field: field.dataset.field || '', cardId: field.dataset.cardId || '', x: tap.x, y: tap.y + 12 });
          }
        }
        return;
      }
      const action = btn.dataset.action || '';
      if (action === 'edit-preview' || action === 'palette-preview' || action === 'download' || action === 'copy' || action === 'improve-ai' || action === 'undo-preview' || action === 'redo-preview') {
        e.stopPropagation();
        this.actionHandler?.(action, {
          cardId: btn.dataset.cardId || '',
          filename: btn.dataset.filename || '',
          button: btn,
        });
      } else if (action === 'delete-preview') {
        e.stopPropagation();
        // P1-1: delete-preview now uses stable data-card-id (format: "card-node-<id>")
        // The orchestrator resolves the index from the card id.
        this.actionHandler?.(action, {
          cardId: btn.dataset.cardId || '',
        });
      }
    };
    this.container.addEventListener('click', this.clickHandler);

    // A drag/long-press selection can contain a phrase or any other range.
    // Only accept a selection whose endpoints both belong to the same card
    // field, so text from neighbouring fields can never be styled by mistake.
    this.touchSelection = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    this.selectionButton = document.createElement('button');
    this.selectionButton.type = 'button';
    this.selectionButton.className = 'preview-selection-action';
    this.selectionButton.textContent = 'Оформить выделение';
    this.selectionButton.hidden = true;
    this.selectionButton.addEventListener('pointerdown', (event) => event.preventDefault());
    this.selectionButton.addEventListener('click', () => {
      if (!this.selected) return;
      this.actionHandler?.('dblclick', this.selected);
      window.getSelection()?.removeAllRanges();
      this.selected = null;
      this.selectionButton!.hidden = true;
    });
    (this.container.closest('.cc-root') || this.container).append(this.selectionButton);
    this.pointerDownHandler = (event) => {
      this.touchSelection = event.pointerType === 'touch' || event.pointerType === 'pen';
      this.touchStart = this.touchSelection ? { x: event.clientX, y: event.clientY, time: event.timeStamp } : null;
      this.touchTap = null;
    };
    this.container.addEventListener('pointerdown', this.pointerDownHandler);
    // Native long-press/selection handles can cancel the pointer sequence entirely.
    // selectionchange keeps the touch action current without covering those handles.
    this.selectionHandler = () => {
      if (!this.touchSelection) return;
      this.selected = this.readSelectedText();
      this.selectionButton!.hidden = !this.selected;
    };
    document.addEventListener('selectionchange', this.selectionHandler);
    this.pointerUpHandler = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') this.touchSelection = true;
      const start = this.touchStart;
      this.touchTap = start && event.timeStamp - start.time < 500 && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 12
        ? { x: event.clientX, y: event.clientY } : null;
      this.touchStart = null;
      if (this.selectionTimer !== null) window.clearTimeout(this.selectionTimer);
      this.selectionTimer = window.setTimeout(() => {
        if (this.touchSelection) this.selectionHandler?.();
        else this.openSelectedText();
      }, 0);
    };
    this.container.addEventListener('pointerup', this.pointerUpHandler);

    // Dblclick delegation for word styling
    this.dblclickHandler = (e: MouseEvent) => {
      if (this.touchSelection) this.selectionHandler?.();
      else this.openSelectedText();
      e.stopPropagation();
    };
    this.container.addEventListener('dblclick', this.dblclickHandler);
  }

  private openSelectedText(): void {
    const selected = this.readSelectedText();
    if (selected) this.actionHandler?.('dblclick', selected);
  }

  private readSelectedText(): Record<string, unknown> | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const start = (range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement)?.closest<HTMLElement>('[data-field]');
    const end = (range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer as Element
      : range.endContainer.parentElement)?.closest<HTMLElement>('[data-field]');
    if (!start || start !== end || !this.container.contains(start)) return null;

    const text = selection.toString().trim();
    if (!text) return null;
    const rect = range.getBoundingClientRect();
    return {
      text,
      field: start.dataset.field || '',
      cardId: start.dataset.cardId || '',
      x: rect.left,
      y: rect.bottom + 6,
    };
  }
}

// ─── Pure helper (not exported separately — used by renderer) ──

function buildProgressBarHtml(index: number, total: number, style: string): string {
  const isShapeStyle = SHAPE_PROGRESS_STYLES.includes(style);
  if (isShapeStyle) {
    const items: string[] = [];
    for (let i = 0; i < total; i++) {
      const filled = i <= index;
      items.push(`<span class="ps-item${filled ? ' filled' : ''}"></span>`);
    }
    return `<div class="progress progress-shapes">${items.join('')}</div>`;
  }
  const percent = Math.round(((index + 1) / total) * 100);
  return `<div class="progress"><div class="progress-fill" style="width:${percent}%;"></div></div>`;
}
