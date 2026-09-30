import type { Card } from '@/core/types';
import { FIELD_LABELS } from '@/core/constants';

/** Tap-based word/phrase selection, independent of native long-press menus. */
export function openTextPicker(root: HTMLElement, card: Card, onSelect: (text: string, field: string) => void): void {
  root.querySelector('dialog.text-picker')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'text-picker';
  dialog.setAttribute('aria-labelledby', 'text-picker-title');
  dialog.innerHTML = '<h3 id="text-picker-title">Оформление текста</h3><p>Нажмите на слово. Для фразы нажмите на первое и последнее слово.</p><label for="text-picker-field">Часть карточки</label><select id="text-picker-field"></select><div class="text-picker-words" aria-label="Слова карточки"></div><p class="text-picker-selection" role="status"></p><div class="text-picker-actions"><button type="button" data-picker="apply">Оформить</button><button type="button" data-picker="reset">Сбросить</button><button type="button" data-picker="close">Закрыть</button></div>';
  const fields: Array<[string, string]> = [['title', card.title], ['subtitle', card.subtitle], ['text', card.text], ['list', card.listItems], ['footer', card.footer], ['cta', card.cta]];
  const select = dialog.querySelector('select')!;
  const words = dialog.querySelector<HTMLElement>('.text-picker-words')!;
  const status = dialog.querySelector<HTMLElement>('.text-picker-selection')!;
  const apply = dialog.querySelector<HTMLButtonElement>('[data-picker="apply"]')!;
  let selected = '';
  let anchor: number | null = null;
  for (const [field, text] of fields) {
    if (!text?.trim()) continue;
    const option = document.createElement('option'); option.value = field; option.textContent = FIELD_LABELS[field] || field; select.append(option);
  }
  function render() {
    const text = fields.find(([field]) => field === select.value)?.[1] || '';
    const tokens = [...text.matchAll(/\S+/g)];
    selected = ''; anchor = null; apply.disabled = true;
    status.textContent = tokens.length ? 'Выберите слово или фразу' : 'Сначала добавьте текст в карточку';
    words.replaceChildren();
    tokens.forEach((token, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = token[0]; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        if (anchor === null) anchor = index;
        const first = Math.min(anchor, index); const last = Math.max(anchor, index);
        selected = text.slice(tokens[first].index!, tokens[last].index! + tokens[last][0].length);
        words.querySelectorAll('button').forEach((item, i) => item.setAttribute('aria-pressed', String(i >= first && i <= last)));
        status.textContent = selected; apply.disabled = false;
      });
      words.append(button);
    });
  }
  const previousFocus = document.activeElement;
  dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); });
  select.addEventListener('change', render);
  dialog.querySelector('[data-picker="reset"]')!.addEventListener('click', render);
  dialog.querySelector('[data-picker="close"]')!.addEventListener('click', () => dialog.close());
  apply.addEventListener('click', () => {
    if (!selected) return;
    const text = selected; const field = select.value;
    dialog.close(); dialog.remove(); onSelect(text, field);
  });
  root.append(dialog); render(); dialog.showModal();
}
