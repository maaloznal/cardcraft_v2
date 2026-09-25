import { requestTextCards } from '@/ai/text-to-cards-client';
import {
  AI_DEFAULT_TARGET_CHARS,
  AI_MAX_CARDS,
  AI_TEXT_MAX_LENGTH,
  AI_ROLE_OPTIONS,
  countAiCardCharacters,
  isAiRole,
  normalizeAiTargetChars,
  type AiCardDraft,
  type AiRole,
  type AiTextMode,
} from '@/ai/text-to-cards-contract';
import { Modal } from '@/ui/Modal';
import * as Storage from '@/storage/StorageManager';
import { THEME_GROUPS } from '@/themes/themeData';
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
  const validThemes = new Set(THEME_GROUPS.flatMap((group) => group.themes.map((theme) => theme.value)));
  const savedPreferences = Storage.loadAiImportPreferences();
  let selectedRole: AiRole = isAiRole(savedPreferences.role) ? savedPreferences.role : 'content-strategist';
  let selectedTheme = typeof savedPreferences.theme === 'string' && validThemes.has(savedPreferences.theme)
    ? savedPreferences.theme
    : '';
  let targetChars = normalizeAiTargetChars(savedPreferences.targetChars) ?? AI_DEFAULT_TARGET_CHARS;

  function persistPreferences(): void {
    Storage.saveAiImportPreferences({ role: selectedRole, theme: selectedTheme, targetChars });
  }

  function syncPreferencesUI(): void {
    const role = AI_ROLE_OPTIONS.find((option) => option.value === selectedRole) ?? AI_ROLE_OPTIONS[0];
    if (refs.aiRoleLabel) refs.aiRoleLabel.textContent = role.label;
    const selectedRoleInput = refs.aiImportModal
      ?.querySelector<HTMLInputElement>(`input[name="aiRole"][value="${selectedRole}"]`);
    if (selectedRoleInput) selectedRoleInput.checked = true;
    if (refs.aiThemeSelect) refs.aiThemeSelect.value = selectedTheme;
    if (refs.aiTargetChars) refs.aiTargetChars.value = String(targetChars);
  }

  function open(): void {
    const hasAccess = refs.aiImportBtn?.dataset.aiAccess === 'granted'
      || refs.mobileAiImportBtn?.dataset.aiAccess === 'granted';
    if (!hasAccess) return;
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
    refs.aiThemeSelect?.toggleAttribute('disabled', busy);
    refs.aiTargetChars?.toggleAttribute('disabled', busy);
    refs.aiImportModal?.querySelectorAll<HTMLInputElement>('input[name="aiRole"], input[name="aiTextMode"]')
      .forEach((input) => { input.disabled = busy; });
    if (refs.aiGenerateBtn) refs.aiGenerateBtn.textContent = busy ? 'Обработка…' : 'Подготовить карточки';
  }

  function updateCount(): void {
    const length = refs.aiSourceText?.value.length ?? 0;
    if (refs.aiCharCount) refs.aiCharCount.textContent = `${length.toLocaleString('ru-RU')} / ${AI_TEXT_MAX_LENGTH.toLocaleString('ru-RU')}`;
    if (refs.aiGenerateBtn && !requestAbort) refs.aiGenerateBtn.disabled = length === 0 || length > AI_TEXT_MAX_LENGTH;
    if (refs.aiCardEstimate) {
      if (length === 0) {
        refs.aiCardEstimate.textContent = 'Добавьте текст для оценки';
      } else {
        const estimated = Math.min(AI_MAX_CARDS, Math.max(1, Math.ceil(length / targetChars)));
        refs.aiCardEstimate.textContent = `Ориентировочно: ${estimated} ${estimated === 1 ? 'карточка' : estimated < 5 ? 'карточки' : 'карточек'}`;
      }
    }
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
      const count = document.createElement('small');
      count.textContent = `${countAiCardCharacters(card)} / ${targetChars}`;
      item.append(title, excerpt, count);
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
    const requestedTarget = normalizeAiTargetChars(refs.aiTargetChars?.value);
    if (!requestedTarget) {
      setError('Укажите лимит от 180 до 2 200 символов на карточку.');
      refs.aiTargetChars?.focus();
      return;
    }
    targetChars = requestedTarget;
    persistPreferences();
    const selected = refs.aiImportModal?.querySelector<HTMLInputElement>('input[name="aiTextMode"]:checked');
    const mode = (selected?.value ?? 'preserve') as AiTextMode;
    resetResult();
    setError();
    requestAbort = new AbortController();
    setBusy(true);
    try {
      const result = await requestTextCards(text, { mode, role: selectedRole, targetChars }, requestAbort.signal);
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
  ctx.listeners.addEl(refs.mobileAiImportBtn, 'click', open);
  ctx.listeners.addEl(refs.aiSourceText, 'input', () => {
    resetResult();
    setError();
    updateCount();
  });
  ctx.listeners.addEl(refs.aiImportModal, 'change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target instanceof HTMLInputElement && target.name === 'aiRole' && isAiRole(target.value)) {
      selectedRole = target.value;
      const role = AI_ROLE_OPTIONS.find((option) => option.value === selectedRole);
      if (refs.aiRoleLabel && role) refs.aiRoleLabel.textContent = role.label;
      if (refs.aiRolePicker) refs.aiRolePicker.open = false;
      resetResult();
      setError();
      persistPreferences();
    } else if (target instanceof HTMLInputElement && target.name === 'aiTextMode') {
      resetResult();
      setError();
    } else if (target === refs.aiThemeSelect) {
      selectedTheme = validThemes.has(target.value) ? target.value : '';
      persistPreferences();
    } else if (target === refs.aiTargetChars) {
      const normalizedTarget = normalizeAiTargetChars(target.value);
      resetResult();
      if (!normalizedTarget) {
        setError('Укажите лимит от 180 до 2 200 символов на карточку.');
        return;
      }
      targetChars = normalizedTarget;
      target.value = String(targetChars);
      setError();
      updateCount();
      persistPreferences();
    }
  });
  ctx.listeners.addEl(refs.aiGenerateBtn, 'click', () => void generate());
  ctx.listeners.addEl(refs.aiCancelBtn, 'click', () => requestAbort?.abort());
  ctx.listeners.addEl(refs.aiAddCardsBtn, 'click', () => {
    if (!drafts.length) return;
    ctx.cardOps.addCards(drafts, selectedTheme || undefined);
    resetResult();
    if (refs.aiSourceText) refs.aiSourceText.value = '';
    updateCount();
    modal?.close();
  });
  modal?.onClose(() => requestAbort?.abort());
  syncPreferencesUI();
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
