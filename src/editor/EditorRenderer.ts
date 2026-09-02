/**
 * EditorRenderer — renders card editor blocks and manages their events.
 * Only module that manipulates the #editorCardsList DOM.
 *
 * Uses event delegation: ONE click + ONE input + ONE paste listener
 * on the container (vs old code: 3+N forEach loops per render).
 *
 * Public API:
 *   render(cards)                      — full rebuild O(n)
 *   onAction(handler)                  — callback for editor actions
 *   collapseLastCard()                 — collapse the last card block
 */

import type { Card } from '../core/types';
import { escapeHtml } from '../core/utils';
import { EDITOR_FIELDS } from '../core/constants';

type EditorActionHandler = (
  action: 'input' | 'paste' | 'palette' | 'collapse' | 'delete' | 'duplicate' | 'move' | 'focus' | 'clear-field',
  data: Record<string, unknown>,
) => void;

export class EditorRenderer {
  private container: HTMLElement;
  private actionHandler: EditorActionHandler | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupDelegation();
  }

  /** Set callback for user actions */
  onAction(handler: EditorActionHandler): void {
    this.actionHandler = handler;
  }

  // ─── Full render ────────────────────────────────────────────

  render(cards: Card[]): void {
    this.container.innerHTML = '';
    cards.forEach((card, index) => {
      const block = this.buildEditorBlock(card, index, cards.length);
      this.container.appendChild(block);
    });
  }

  // ─── Targeted updates ───────────────────────────────────────

  /** Set the last card block to collapsed state */
  collapseLastCard(): void {
    const blocks = this.container.querySelectorAll<HTMLElement>('.card-editor-block');
    const lastBlock = blocks[blocks.length - 1];
    if (!lastBlock) return;
    lastBlock.classList.add('collapsed');
    const chevron = lastBlock.querySelector<HTMLElement>('.card-collapse-toggle svg');
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
  }

  // ─── Private helpers ────────────────────────────────────────

  private buildEditorBlock(card: Card, index: number, total: number): HTMLElement {
    const block = document.createElement('div');
    block.className = 'card-editor-block';
    const title = `Карточка ${index + 1}`;

    block.innerHTML = `
      <div class="card-editor-header">
        <button class="btn-icon card-collapse-toggle" data-action="collapse" data-index="${index}" title="Свернуть/развернуть" aria-label="Свернуть" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="card-editor-title-group">
          <span class="card-editor-num-badge">${index + 1}</span>
          <h3 title="${title}">${title}</h3>
        </div>
        <div class="card-editor-actions">
          <button class="btn-icon" data-action="duplicate" data-index="${index}" title="Дублировать" aria-label="Дублировать"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="btn-icon" data-action="move" data-index="${index}" data-dir="-1" title="Переместить выше" aria-label="Выше" ${index === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
          <button class="btn-icon" data-action="move" data-index="${index}" data-dir="1" title="Переместить ниже" aria-label="Ниже" ${index === total - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
          ${total > 1 ? `<button class="btn-delete" data-action="delete" data-index="${index}" title="Удалить карточку" aria-label="Удалить"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>` : ''}
        </div>
      </div>
      <div class="card-editor-body">
        <button class="btn-card-editor-palette" data-action="palette" data-index="${index}" title="Цвета и стили карточки">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          <span>Стили</span>
        </button>
        ${EDITOR_FIELDS.map(
          (f) => `
        <div class="form-group">
          <div class="form-group-header">
            <label>${f.label}</label>
            <button class="btn-clear-field" data-action="clear-field" data-index="${index}" data-field="${f.key}" title="Очистить ${f.label}" aria-label="Очистить ${f.label}" type="button">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          ${
            f.multiline
              ? `<textarea data-field="${f.key}" data-index="${index}" maxlength="${f.maxlength}" placeholder="${f.label}…">${escapeHtml(card[f.key])}</textarea>`
              : `<input type="text" data-field="${f.key}" data-index="${index}" maxlength="${f.maxlength}" placeholder="${f.label}…" value="${escapeHtml(card[f.key])}">`
          }
        </div>`,
        ).join('')}
      </div>
    `;
    return block;
  }

  /** Event delegation — set up ONCE on container */
  private setupDelegation(): void {
    // Click delegation for action buttons
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action || '';

      if (action === 'collapse') {
        const block = btn.closest('.card-editor-block');
        if (!block) return;
        block.classList.toggle('collapsed');
        const svg = btn.querySelector('svg');
        if (svg) svg.style.transform = block.classList.contains('collapsed') ? 'rotate(-90deg)' : '';
        return;
      }

      if (['palette', 'delete', 'duplicate', 'move', 'clear-field'].includes(action)) {
        e.stopPropagation();
        this.actionHandler?.(action as 'palette' | 'delete' | 'duplicate' | 'move' | 'clear-field', {
          index: Number(btn.dataset.index || 0),
          dir: Number(btn.dataset.dir || 0),
          field: btn.dataset.field || '',
        });
      }
    });

    // Input delegation for text fields
    this.container.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('input[data-field], textarea[data-field]')) {
        const el = target as HTMLInputElement | HTMLTextAreaElement;
        this.actionHandler?.('input', {
          index: Number(el.dataset.index || 0),
          field: el.dataset.field || '',
          value: el.value,
        });
      }
    });

    // Focus delegation for char counter
    this.container.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('input[data-field], textarea[data-field]')) {
        const el = target as HTMLInputElement | HTMLTextAreaElement;
        this.actionHandler?.('focus', {
          index: Number(el.dataset.index || 0),
        });
      }
    });

    // Paste delegation with text cleanup
    this.container.addEventListener('paste', (e) => {
      const target = e.target as HTMLElement;
      if (!target.matches('input[data-field], textarea[data-field]')) return;
      e.preventDefault();
      const el = target as HTMLInputElement | HTMLTextAreaElement;
      const text = e.clipboardData ? e.clipboardData.getData('text') : '';
      const field = el.dataset.field || '';
      const multiline = ['subtitle', 'text', 'listItems'].includes(field);
      const cleanText = multiline ? text : text.replace(/\s+/g, ' ').trim();
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const cur = el.value;
      el.value = cur.substring(0, start) + cleanText + cur.substring(end);
      this.actionHandler?.('paste', {
        index: Number(el.dataset.index || 0),
        field,
        value: el.value,
      });
    });
  }
}
