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
 *   updateCardTitle(index)             — O(1) title badge update
 *   getCardInput(cardId, field)        — get input element for a card/field
 *   focusField(cardId, field)          — focus a specific input
 */

import type { Card } from '../core/types';
import { escapeHtml } from '../core/utils';
import { EDITOR_FIELDS } from '../core/constants';

type EditorActionHandler = (
  action: 'input' | 'paste' | 'palette' | 'collapse' | 'delete' | 'duplicate' | 'move' | 'focus',
  data: Record<string, unknown>,
) => void;

export class EditorRenderer {
  private container: HTMLElement;
  private actionHandler: EditorActionHandler | null = null;
  /** Tracked listeners for cleanup (StrictMode double-mount safety) */
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private inputHandler: ((e: Event) => void) | null = null;
  private focusinHandler: ((e: Event) => void) | null = null;
  private pasteHandler: ((e: ClipboardEvent) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupDelegation();
  }

  /** Set callback for user actions */
  onAction(handler: EditorActionHandler): void {
    this.actionHandler = handler;
  }

  /** Remove all event listeners (StrictMode double-mount safety) */
  destroy(): void {
    if (this.clickHandler) this.container.removeEventListener('click', this.clickHandler);
    if (this.inputHandler) this.container.removeEventListener('input', this.inputHandler);
    if (this.focusinHandler) this.container.removeEventListener('focusin', this.focusinHandler);
    if (this.pasteHandler) this.container.removeEventListener('paste', this.pasteHandler);
    this.clickHandler = null;
    this.inputHandler = null;
    this.focusinHandler = null;
    this.pasteHandler = null;
    this.actionHandler = null;
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

  /**
   * Insert a card editor block at a specific index (O(1) DOM insertion).
   * P1-2/1.4: used by addCard + duplicateCard to avoid full rebuild.
   */
  insertCard(card: Card, index: number, total: number): void {
    const block = this.buildEditorBlock(card, index, total);
    const blocks = this.container.querySelectorAll<HTMLElement>('.card-editor-block');
    if (index >= blocks.length) {
      this.container.appendChild(block);
    } else {
      this.container.insertBefore(block, blocks[index]);
    }
    // Re-index all subsequent blocks (badges, data-index attrs, move btn disabled states)
    this.reindexBlocks();
  }

  /**
   * Remove a card editor block by index (O(1) DOM removal).
   * P1-3: used by deleteCard to avoid full rebuild.
   */
  removeCard(index: number): void {
    const blocks = this.container.querySelectorAll<HTMLElement>('.card-editor-block');
    const block = blocks[index];
    if (!block) return;
    block.remove();
    this.reindexBlocks();
  }

  /**
   * Swap two adjacent card editor blocks (O(1) DOM swap).
   * P1-5: used by moveCard to avoid full rebuild.
   */
  moveCard(fromIndex: number, toIndex: number): void {
    const blocks = this.container.querySelectorAll<HTMLElement>('.card-editor-block');
    const a = blocks[fromIndex];
    const b = blocks[toIndex];
    if (!a || !b) return;
    // Swap DOM positions
    if (fromIndex < toIndex) {
      // moving down: insert b before a, then a after b's new position
      this.container.insertBefore(b, a);
    } else {
      // moving up: insert a before b
      this.container.insertBefore(a, b);
    }
    this.reindexBlocks();
  }

  /**
   * Re-index all editor blocks after a structural change (add/delete/move).
   * O(n) but cheap (only attribute updates, no DOM rebuild).
   */
  private reindexBlocks(): void {
    const blocks = this.container.querySelectorAll<HTMLElement>('.card-editor-block');
    blocks.forEach((block, index) => {
      const badge = block.querySelector<HTMLElement>('.card-editor-num-badge');
      if (badge) badge.textContent = String(index + 1);

      const h3 = block.querySelector<HTMLElement>('.card-editor-title-group h3');
      if (h3) {
        h3.textContent = `Карточка ${index + 1}`;
        h3.setAttribute('title', `Карточка ${index + 1}`);
      }

      // Update data-index on all indexed elements
      block.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
        el.dataset.index = String(index);
      });

      // Update move button disabled states
      const moveUp = block.querySelector<HTMLElement>('[data-action="move"][data-dir="-1"]');
      const moveDown = block.querySelector<HTMLElement>('[data-action="move"][data-dir="1"]');
      if (moveUp) moveUp.toggleAttribute('disabled', index === 0);
      if (moveDown) moveDown.toggleAttribute('disabled', index === blocks.length - 1);

      // Show/hide delete button (only hide when single card)
      const delBtn = block.querySelector<HTMLElement>('[data-action="delete"]');
      if (delBtn) delBtn.style.display = blocks.length > 1 ? '' : 'none';
    });
  }

  /** Update card number badge and title (O(1)) */
  updateCardNumber(index: number): void {
    const blocks = this.container.querySelectorAll<HTMLElement>('.card-editor-block');
    const block = blocks[index];
    if (!block) return;

    const badge = block.querySelector<HTMLElement>('.card-editor-num-badge');
    if (badge) badge.textContent = String(index + 1);

    const h3 = block.querySelector<HTMLElement>('.card-editor-title-group h3');
    if (h3) {
      h3.textContent = `Карточка ${index + 1}`;
      h3.setAttribute('title', `Карточка ${index + 1}`);
    }

    // Update data-index on all elements
    block.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
      el.dataset.index = String(index);
    });

    // Update move button disabled states
    const moveUp = block.querySelector<HTMLElement>('[data-action="move"][data-dir="-1"]');
    const moveDown = block.querySelector<HTMLElement>('[data-action="move"][data-dir="1"]');
    if (moveUp) moveUp.toggleAttribute('disabled', index === 0);
    if (moveDown) moveDown.toggleAttribute('disabled', index === blocks.length - 1);

    // Show/hide delete button
    const delBtn = block.querySelector<HTMLElement>('[data-action="delete"]');
    if (delBtn) delBtn.style.display = blocks.length > 1 ? '' : 'none';
  }

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
          <button class="btn-delete" data-action="delete" data-index="${index}" title="Удалить карточку" aria-label="Удалить" style="${total > 1 ? '' : 'display:none;'}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
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
          <label>${f.label}</label>
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
    this.clickHandler = (e: MouseEvent) => {
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

      if (['palette', 'delete', 'duplicate', 'move'].includes(action)) {
        e.stopPropagation();
        this.actionHandler?.(action as 'palette' | 'delete' | 'duplicate' | 'move', {
          index: Number(btn.dataset.index || 0),
          dir: Number(btn.dataset.dir || 0),
        });
      }
    };
    this.container.addEventListener('click', this.clickHandler);

    // Input delegation for text fields
    this.inputHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.matches('input[data-field], textarea[data-field]')) {
        const el = target as HTMLInputElement | HTMLTextAreaElement;
        this.actionHandler?.('input', {
          index: Number(el.dataset.index || 0),
          field: el.dataset.field || '',
          value: el.value,
        });
      }
    };
    this.container.addEventListener('input', this.inputHandler);

    // Focus delegation for char counter
    this.focusinHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.matches('input[data-field], textarea[data-field]')) {
        const el = target as HTMLInputElement | HTMLTextAreaElement;
        this.actionHandler?.('focus', {
          index: Number(el.dataset.index || 0),
        });
      }
    };
    this.container.addEventListener('focusin', this.focusinHandler);

    // Paste delegation with text cleanup
    this.pasteHandler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.matches('input[data-field], textarea[data-field]')) return;
      e.preventDefault();
      const el = target as HTMLInputElement | HTMLTextAreaElement;
      const text = e.clipboardData?.getData('text') ?? '';
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
    };
    this.container.addEventListener('paste', this.pasteHandler);
  }
}
