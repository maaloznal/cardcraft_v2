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

import type { Card } from '../core/types';
import { escapeHtml, escapeAttr, sanitizeCardId } from '../core/utils';
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

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupDelegation();
  }

  /** Set callback for user actions (download, copy, delete, dblclick) */
  onAction(handler: ActionHandler): void {
    this.actionHandler = handler;
  }

  // ─── Full render ────────────────────────────────────────────

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
      el.remove();
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
      // Update data-index on all elements
      cardNode.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
        el.dataset.index = String(i);
      });
      // Update delete-preview data-index
      const delPreview = cardNode.parentElement?.querySelector<HTMLElement>('[data-action="delete-preview"]');
      if (delPreview) delPreview.dataset.index = String(i);
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

    let listHtml = '';
    if ((card.listItems || '').trim()) {
      const items = card.listItems.split('\n').filter((i) => i.trim());
      listHtml = `<ul class="card-list">${items
        .map(
          (it, idx) => `<li class="card-list-item" ${listStyle}>
            <span class="card-list-num" ${listNumStyle}>${idx + 1}</span>
            <span class="card-list-text" ${listStyle} data-field="list" data-index="${index}">${applyWordStylesToText(it, card.wordStyles, 'list')}</span>
          </li>`,
        )
        .join('')}</ul>`;
    }

    // Sanitize card.id to prevent XSS
    const safeCardId = sanitizeCardId(card.id);
    
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

    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    wrapper.innerHTML = `
      <div class="card" id="card-node-${safeCardId}" ${themeAttr} ${formatAttr}>
        <div class="card-top-content" style="display:flex;flex-direction:column;gap:16px;">
          ${progressHtml}
          ${tagHtml}
          ${emptyHint}
          ${card.title ? `<h2 class="card-title" ${titleStyle} data-field="title" data-index="${index}">${applyWordStylesToText(card.title, card.wordStyles, 'title')}</h2>` : ''}
          ${card.subtitle ? `<p class="card-subtitle" ${subtitleStyle} data-field="subtitle" data-index="${index}">${applyWordStylesToText(card.subtitle, card.wordStyles, 'subtitle').replace(/\n/g, '<br>')}</p>` : ''}
          ${card.text ? `<p class="card-text" ${textStyle} data-field="text" data-index="${index}">${applyWordStylesToText(card.text, card.wordStyles, 'text').replace(/\n/g, '<br>')}</p>` : ''}
          ${listHtml}
        </div>
        <div class="card-bottom-content" style="display:flex;flex-direction:column;gap:16px;">
          ${card.footer ? `<div class="card-footer-text" ${footerStyle} data-field="footer" data-index="${index}">${applyWordStylesToText(card.footer, card.wordStyles, 'footer')}</div>` : ''}
          ${card.cta ? `<div class="accent-btn" ${ctaStyle} data-field="cta" data-index="${index}">${applyWordStylesToText(card.cta, card.wordStyles, 'cta')}</div>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-card-action" data-action="download" data-card-id="card-node-${safeCardId}" data-filename="card-${index + 1}.png" title="Скачать" aria-label="Скачать"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
        <button class="btn-card-action" data-action="copy" data-card-id="card-node-${safeCardId}" title="Копировать" aria-label="Копировать"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="btn-card-action btn-card-action-danger" data-action="delete-preview" data-index="${index}" title="Удалить" aria-label="Удалить"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
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

    const containerSel = cfg.container === 'top' ? '.card-top-content' : '.card-bottom-content';
    const container = cardNode.querySelector<HTMLElement>(containerSel);
    if (!container) return;

    const el = document.createElement(cfg.tag);
    el.className = cfg.cls;
    el.setAttribute('data-field', field);
    el.setAttribute('data-index', String(cardIndex));

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

  private updateList(cardNode: HTMLElement, card: Card, cardIndex: number): void {
    const listStyle = buildSectionStyle(card, 'list');
    const listNumStyle = buildListNumStyle(card);

    let listHtml = '';
    if ((card.listItems || '').trim()) {
      const items = card.listItems.split('\n').filter((i) => i.trim());
      listHtml = items
        .map(
          (it, idx) => `<li class="card-list-item" ${listStyle}>
            <span class="card-list-num" ${listNumStyle}>${idx + 1}</span>
            <span class="card-list-text" ${listStyle} data-field="list" data-index="${cardIndex}">${applyWordStylesToText(it, card.wordStyles, 'list')}</span>
          </li>`,
        )
        .join('');
    }

    const existingList = cardNode.querySelector<HTMLElement>('.card-list');
    const topContent = cardNode.querySelector<HTMLElement>('.card-top-content');

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
      const topContent = cardNode.querySelector<HTMLElement>('.card-top-content');
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
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action || '';
      if (action === 'download' || action === 'copy' || action === 'delete-preview') {
        e.stopPropagation();
        this.actionHandler?.(action, {
          cardId: btn.dataset.cardId || '',
          filename: btn.dataset.filename || '',
          index: Number(btn.dataset.index || 0),
        });
      }
    });

    // Dblclick delegation for word styling
    this.container.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      const el = target.closest<HTMLElement>('[data-field]');
      if (!el) return;
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';
      const field = el.dataset.field || '';
      const cardIndex = Number(el.dataset.index);
      if (text.length > 0) {
        const rect = el.getBoundingClientRect();
        this.actionHandler?.('dblclick', {
          text,
          field,
          cardIndex,
          x: rect.left,
          y: rect.top + 24,
        });
      }
      e.stopPropagation();
    });
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
