/**
 * modal-controller.ts — color modal open/close + per-card theme dropdown.
 *
 * Owns:
 *   - openColorModal(idx) / closeColorModal() — populate modal fields from
 *     card state, sync per-card theme dropdown, open the Modal primitive
 *   - selectRowField(field) / syncPresetIndicator(field) — modal row selection
 *   - colorModalController.onOpen / onClose callbacks — workspace.modal-open
 *     class toggle, sidebar state capture/restore, UI state sync
 *   - modalCardThemeDropdownController.onOpen / onClose / onSelect callbacks —
 *     per-card theme dropdown open/close + selection (dispatches SET_CARD_THEME)
 *
 * Extracted from CardCraftApp.ts sections 14 (dropdown callbacks) + 15
 * (modal open/close) + 16's selectRowField/syncPresetIndicator (lines 364-704).
 *
 * Public API:
 *   openColorModal(index)
 *   closeColorModal()
 *   selectRowField(field)
 *   syncPresetIndicator(field)
 *   destroy() — no-op (colorModalController.destroy() called separately)
 */

import * as Theme from '@/themes/ThemeManager';
import { MODAL_FIELDS, FIELD_LABELS } from '@/core/constants';
import type { OrchestratorContext } from './types';

export interface ModalController {
  openColorModal(index: number): void;
  closeColorModal(): void;
  selectRowField(field: string): void;
  syncPresetIndicator(field: string): void;
  destroy(): void;
}

export function createModalController(ctx: OrchestratorContext): ModalController {
  const { root, refs, stateManager, previewRenderer, uiState } = ctx;

  /* ---------- Modal row selection ---------- */

  /** Highlight the preset color swatch matching the active card's color for `field` (clears highlight if no override). */
  function syncPresetIndicator(field: string): void {
    const activeColor =
      uiState.activeCardIndexForColors !== null
        ? stateManager.getCard(uiState.activeCardIndexForColors)?.colors?.[field]
        : undefined;
    root.querySelectorAll<HTMLElement>('.color-swatch').forEach((sw) => {
      sw.classList.toggle('active', !!(activeColor && sw.dataset.preset === activeColor));
    });
  }

  /** Mark `field` as the active modal row, update the preset-target label, and sync the preset swatch indicator. */
  function selectRowField(field: string): void {
    uiState.lastActiveField = field;
    const label = refs.$<HTMLElement>('#presetTargetLabel');
    if (label) label.textContent = FIELD_LABELS[field] || 'Заголовок';
    root.querySelectorAll<HTMLElement>('.color-picker-row').forEach((row) => {
      row.classList.toggle('selected', row.dataset.rowField === field);
    });
    syncPresetIndicator(field);
  }

  /* ---------- Color modal open/close ---------- */

  /**
   * Open the color modal for card at `index`: capture sidebar state, populate
   * all per-field color inputs / hex labels / format buttons / size sliders
   * from card state, default-select the title row, sync the per-card theme
   * dropdown + listNumSize slider, then open the underlying Modal primitive.
   */
  function openColorModal(index: number): void {
    uiState.activeCardIndexForColors = index;
    if (refs.modalCardTitle) refs.modalCardTitle.textContent = `Стили · Карточка ${index + 1}`;

    // Capture sidebar state before opening (don't change it)
    uiState.sidebarWasCollapsedBeforeModal =
      refs.editorSidebar?.classList.contains('collapsed') ?? true;

    const card = stateManager.getCard(index);
    if (!card) return;
    const currentColors = card.colors || {};
    const currentSectionStyles = card.sectionStyles || {};

    MODAL_FIELDS.forEach((f) => {
      const input = refs.$<HTMLInputElement>(`#col-${f.key}`);
      const hexText = refs.$<HTMLElement>(`#hex-${f.key}`);
      if (currentColors[f.key]) {
        if (input) input.value = currentColors[f.key];
        if (hexText) {
          hexText.textContent = currentColors[f.key];
          hexText.classList.remove('is-auto');
        }
      } else {
        if (input) input.value = '#000000';
        if (hexText) {
          hexText.textContent = 'АВТО';
          hexText.classList.add('is-auto');
        }
      }
      if (!f.hasStyleControls) return;
      const formatBtns = root.querySelectorAll<HTMLElement>(
        `.format-btn-section[data-field="${f.key}"]`,
      );
      const sl = refs.$<HTMLInputElement>(`.size-slider-section[data-field="${f.key}"]`);
      const sv = refs.$<HTMLElement>(`.size-value-section[data-field="${f.key}"]`);
      const styles = currentSectionStyles[f.key];
      formatBtns.forEach((btn) => {
        const fmt = btn.dataset.format;
        btn.classList.remove('active');
        if (!styles) return;
        if (fmt === 'bold' && styles.fontWeight === 'bold') btn.classList.add('active');
        else if (fmt === 'italic' && styles.fontStyle === 'italic') btn.classList.add('active');
        else if (fmt === 'underline' && styles.textDecoration?.includes('underline'))
          btn.classList.add('active');
        else if (fmt === 'strikethrough' && styles.textDecoration?.includes('line-through'))
          btn.classList.add('active');
      });
      if (sl && sv) {
        const sz = styles?.fontSize ?? f.defaultSize;
        sl.value = String(sz);
        sv.textContent = `${sz}px`;
      }
    });

    selectRowField('title');

    // Sync per-card theme dropdown
    const cardThemeVal = card.theme && card.theme !== 'default' ? card.theme : 'default';
    if (refs.modalCardThemeLabel) {
      refs.modalCardThemeLabel.textContent =
        cardThemeVal === 'default' ? 'По умолчанию' : Theme.getThemeLabel(cardThemeVal);
    }
    refs.modalCardThemeDropdown
      ?.querySelectorAll<HTMLElement>('.modal-card-theme-item')
      .forEach((item) => {
        item.classList.toggle('selected', item.dataset.modalCardTheme === cardThemeVal);
      });

    // Sync listNumSize slider
    const savedNumSize = card.colors?.listNumSize;
    if (refs.listNumSizeSlider) refs.listNumSizeSlider.value = String(savedNumSize || 22);
    if (refs.listNumSizeValue) refs.listNumSizeValue.textContent = `${savedNumSize || 22}px`;

    ctx.colorModalController.open();
  }

  /** Close the color modal (delegates to the underlying Modal primitive's close()). */
  function closeColorModal(): void {
    ctx.colorModalController.close();
  }

  /* ---------- Modal primitive callbacks ---------- */

  ctx.colorModalController.onOpen(() => {
    refs.previewWorkspace?.classList.add('modal-open');
    stateManager.setUI({ colorModalOpen: true });
  });

  ctx.colorModalController.onClose(() => {
    refs.previewWorkspace?.classList.remove('modal-open');
    uiState.activeCardIndexForColors = null;
    stateManager.setUI({ colorModalOpen: false });
    // Restore sidebar state captured before modal opened
    if (refs.editorSidebar) {
      if (uiState.sidebarWasCollapsedBeforeModal) {
        refs.editorSidebar.classList.add('collapsed');
        root.classList.remove('sidebar-open');
      } else {
        refs.editorSidebar.classList.remove('collapsed');
        root.classList.add('sidebar-open');
      }
    }
  });

  /* ---------- Per-card theme dropdown callbacks ---------- */

  ctx.modalCardThemeDropdownController.onOpen(() =>
    refs.modalCardThemeDropdown?.classList.add('open'),
  );
  ctx.modalCardThemeDropdownController.onClose(() =>
    refs.modalCardThemeDropdown?.classList.remove('open'),
  );

  ctx.modalCardThemeDropdownController.onSelect((value, item) => {
    if (uiState.activeCardIndexForColors === null) return;
    const label = item.dataset.label || 'По умолчанию';
    stateManager.dispatch({
      type: 'SET_CARD_THEME',
      payload: {
        idx: uiState.activeCardIndexForColors,
        theme: value === 'default' ? undefined : value,
      },
    });
    if (refs.modalCardThemeLabel) refs.modalCardThemeLabel.textContent = label;
    // Manually toggle .selected (Dropdown.setValue uses data-value, our items use data-modal-card-theme)
    refs.modalCardThemeDropdown?.querySelectorAll('.modal-card-theme-item').forEach((it) => {
      it.classList.toggle('selected', it === item);
    });
    const updated = stateManager.getCard(uiState.activeCardIndexForColors);
    if (updated) previewRenderer.updateCardTheme(updated, stateManager.getTheme());
    ctx.history.pushHistory();
    ctx.storage.scheduleSave({ silent: true });
  });

  return {
    openColorModal,
    closeColorModal,
    selectRowField,
    syncPresetIndicator,
    /**
     * No-op — the underlying Modal + Dropdown primitives are destroyed
     * separately by CardCraftApp.cleanup (they own their own listeners).
     */
    destroy() {
      /* colorModalController.destroy() + modalCardThemeDropdownController.destroy()
         are called separately by CardCraftApp.cleanup. */
    },
  };
}
