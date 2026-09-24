import { requestTextCards } from '@/ai/text-to-cards-client';
import {
  AI_TEXT_MAX_LENGTH,
  type AiCardDraft,
  type AiTextMode,
} from '@/ai/text-to-cards-contract';
import { Modal } from '@/ui/Modal';
import type { OrchestratorContext } from './types';

export function createAiImportController(ctx: OrchestratorContext) {
  const { refs } = ctx;
  const modal = refs.aiImportModal
    ? new Modal(refs.aiImportModal, {
        closeSelector: '[data-ai-close]',
        closeOnBackdrop: true,
        closeOnEscape: true,
        initialFocusSelector: '#aiSourceText',
      })
    : null;
  let requestAbort: AbortController | null = null;
  let drafts: AiCardDraft[] = [];

  function open(): void {
    modal?.open();
    // The overlay becomes visible through a CSS transition. Focus on the next
    // frame so Chromium/Safari do not discard focus while visibility changes.
    window.setTimeout(() => {
      if (modal?.isOpen) refs.aiSourceText?.focus();
    }, 50);
  }

  function setError(message = ''): void {
    if (!refs.aiImportError) return;
    refs.aiImportError.textContent = message;
    refs.aiImportError.hidden = !message;
  }

  function setBusy(busy: boolean): void {
    refs.aiGenerateBtn?.toggleAttribute('disabled', busy);
    refs.aiSourceText?.toggleAttribute('disabled', busy);
    refs.aiCancelBtn?.toggleAttribute('hidden', !busy);
    if (refs.aiGenerateBtn) refs.aiGenerateBtn.textContent = busy ? 'Обработка…' : 'Подготовить карточки';
  }

  function updateCount(): void {
    const length = refs.aiSourceText?.value.length ?? 0;
    if (refs.aiCharCount) refs.aiCharCount.textContent = `${length.toLocaleString('ru-RU')} / ${AI_TEXT_MAX_LENGTH.toLocaleString('ru-RU')}`;
    if (refs.aiGenerateBtn && !requestAbort) refs.aiGenerateBtn.disabled = length === 0 || length > AI_TEXT_MAX_LENGTH;
  }

  function renderPreview(cards: AiCardDraft[]): void {
    if (!refs.aiPreview || !refs.aiAddCardsBtn) return;
    refs.aiPreview.replaceChildren();
    const heading = document.createElement('p');
    heading.className = 'ai-preview-summary';
    heading.textContent = `Подготовлено карточек: ${cards.length}`;
    refs.aiPreview.appendChild(heading);
    const list = document.createElement('ol');
    list.className = 'ai-preview-list';
    cards.forEach((card) => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = card.title || 'Без заголовка';
      const excerpt = document.createElement('span');
      excerpt.textContent = card.text || card.subtitle || card.listItems || 'Пустая карточка';
      item.append(title, excerpt);
      list.appendChild(item);
    });
    refs.aiPreview.appendChild(list);
    refs.aiPreview.hidden = false;
    refs.aiAddCardsBtn.hidden = false;
    refs.aiAddCardsBtn.textContent = `Добавить ${cards.length} карточек`;
  }

  function resetResult(): void {
    drafts = [];
    refs.aiPreview?.replaceChildren();
    if (refs.aiPreview) refs.aiPreview.hidden = true;
    if (refs.aiAddCardsBtn) refs.aiAddCardsBtn.hidden = true;
  }

  async function generate(): Promise<void> {
    const text = refs.aiSourceText?.value ?? '';
    if (!text.trim() || text.length > AI_TEXT_MAX_LENGTH || requestAbort) return;
    const selected = refs.aiImportModal?.querySelector<HTMLInputElement>('input[name="aiTextMode"]:checked');
    const mode = (selected?.value ?? 'preserve') as AiTextMode;
    resetResult();
    setError();
    requestAbort = new AbortController();
    setBusy(true);
    try {
      const result = await requestTextCards(text, mode, requestAbort.signal);
      drafts = result.cards;
      renderPreview(drafts);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setError(error instanceof Error ? error.message : 'Не удалось обработать текст.');
      }
    } finally {
      requestAbort = null;
      setBusy(false);
      updateCount();
    }
  }

  ctx.listeners.addEl(refs.aiImportBtn, 'click', open);
  ctx.listeners.addEl(refs.aiSourceText, 'input', () => {
    resetResult();
    setError();
    updateCount();
  });
  ctx.listeners.addEl(refs.aiGenerateBtn, 'click', () => void generate());
  ctx.listeners.addEl(refs.aiCancelBtn, 'click', () => requestAbort?.abort());
  ctx.listeners.addEl(refs.aiAddCardsBtn, 'click', () => {
    if (!drafts.length) return;
    ctx.cardOps.addCards(drafts);
    resetResult();
    if (refs.aiSourceText) refs.aiSourceText.value = '';
    updateCount();
    modal?.close();
  });
  modal?.onClose(() => requestAbort?.abort());
  updateCount();

  return {
    open,
    close: () => modal?.close(),
    destroy() {
      requestAbort?.abort();
      modal?.destroy();
    },
  };
}
