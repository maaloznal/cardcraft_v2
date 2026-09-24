/**
 * ui-appliers.ts — pure UI sync functions + render wrappers.
 *
 * Every function here reads state and writes DOM (idempotent). Called by:
 *   - the state subscriber (on settings change)
 *   - card-ops controllers (after add/delete/duplicate/move → full re-render)
 *   - history restore (after undo/redo → full re-render)
 *
 * Extracted from CardCraftApp.ts sections 8 + 9 (lines 285-419).
 *
 * Public API:
 *   applyThemeToWorkspace()    — apply theme attr + gradient angle + dropdown sync
 *   applyGradientAngle()       -- set --gradient-angle CSS var
 *   applyNumberingVisibility() -- toggle .no-card-numbers root class
 *   applyProgressBarVisibility()
 *   applyProgressBarStyle()
 *   applyListStyle()
 *   syncThemeDropdown()        — sync theme dropdown label + .selected item
 *   updateCardCountBadge()     — sync "N карточки" badge
 *   renderPreview()            — full preview rebuild + badge update
 *   renderEditor()             — full editor rebuild
 */

import * as Theme from '@/themes/ThemeManager';
import type { PreviewSettings } from '@/preview/PreviewRenderer';
import type { OrchestratorContext } from './types';
import { perfMark } from './helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('Cardcraft');

export interface UIAppliers {
  applyThemeToWorkspace(): void;
  applyGradientAngle(): void;
  applyNumberingVisibility(): void;
  applyProgressBarVisibility(): void;
  applyProgressBarStyle(): void;
  applyListStyle(): void;
  syncThemeDropdown(): void;
  updateCardCountBadge(): void;
  renderPreview(): void;
  renderEditor(): void;
  destroy(): void;
}

export function createUIAppliers(ctx: OrchestratorContext): UIAppliers {
  const { root, refs, stateManager, previewRenderer, editorRenderer } = ctx;

  /** Apply the current gradient angle to #previewWorkspace via the `--gradient-angle` CSS variable. */
  function applyGradientAngle(): void {
    if (!refs.previewWorkspace) return;
    refs.previewWorkspace.style.setProperty(
      '--gradient-angle',
      `${stateManager.getGradientAngle()}deg`,
    );
  }

  /** Sync the theme dropdown label + .selected item with StateManager's current theme. */
  function syncThemeDropdown(): void {
    if (!refs.themeDropdownLabel || !refs.themeDropdown) return;
    const theme = stateManager.getTheme();
    refs.themeDropdownLabel.textContent = Theme.getThemeLabel(theme);
    refs.themeDropdown.querySelectorAll<HTMLElement>('.theme-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.value === theme);
    });
  }

  /** Apply the global theme attr + gradient angle + dropdown sync to the preview workspace. */
  function applyThemeToWorkspace(): void {
    if (!refs.previewWorkspace) return;
    Theme.applyThemeToElement(refs.previewWorkspace, stateManager.getTheme());
    applyGradientAngle();
    syncThemeDropdown();
  }

  /** Toggle the .no-card-numbers class on root based on settings.showCardNumbers. */
  function applyNumberingVisibility(): void {
    root.classList.toggle('no-card-numbers', !stateManager.getSettings().showCardNumbers);
  }

  /** Toggle the .no-progress-bar class on root based on settings.showProgressBar. */
  function applyProgressBarVisibility(): void {
    root.classList.toggle('no-progress-bar', !stateManager.getSettings().showProgressBar);
  }

  /** Set data-progress-style on root to the configured progress bar style. */
  function applyProgressBarStyle(): void {
    root.setAttribute('data-progress-style', stateManager.getSettings().progressBarStyle);
  }

  /** Set data-list-style on root to the configured list bullet style. */
  function applyListStyle(): void {
    root.setAttribute('data-list-style', stateManager.getListStyle());
  }

  /**
   * Update the sidebar card-count badge with the correct Russian plural form
   * (карточка / карточки / карточек) and hide it when the deck is empty.
   */
  function updateCardCountBadge(): void {
    if (!refs.cardCountBadge) return;
    const n = stateManager.getCardCount();
    const word = n === 1 ? 'карточка' : n >= 2 && n <= 4 ? 'карточки' : 'карточек';
    refs.cardCountBadge.textContent = `${n} ${word}`;
    refs.cardCountBadge.style.display = n > 0 ? '' : 'none';
  }

  /**
   * Full preview rebuild via previewRenderer.render + card-count badge refresh.
   * Wrapped in perfMark to warn if it exceeds one frame (16 ms).
   */
  function renderPreview(): void {
    const end = perfMark('renderPreview');
    try {
      const settings = stateManager.getSettings();
      const previewSettings: PreviewSettings = {
        theme: settings.theme,
        format: settings.format,
        progressBarStyle: settings.progressBarStyle,
        showCardNumbers: settings.showCardNumbers,
        showProgressBar: settings.showProgressBar,
      };
      previewRenderer.render(stateManager.getCards(), previewSettings);
      updateCardCountBadge();
    } catch (err) {
      log.error('Error in renderPreview', { error: err });
    } finally {
      end();
    }
  }

  /** Full editor rebuild via editorRenderer.render with all current cards. */
  function renderEditor(): void {
    try {
      editorRenderer.render(stateManager.getCards());
    } catch (err) {
      log.error('Error in renderEditor', { error: err });
    }
  }

  return {
    applyThemeToWorkspace,
    applyGradientAngle,
    applyNumberingVisibility,
    applyProgressBarVisibility,
    applyProgressBarStyle,
    applyListStyle,
    syncThemeDropdown,
    updateCardCountBadge,
    renderPreview,
    renderEditor,
    /** No-op — the appliers are stateless (settings live in StateManager); listeners are tracked + cleaned up by ctx.listeners.destroy(). */
    destroy() {
      /* stateless — listeners are tracked + cleaned up by ctx.listeners.destroy() */
    },
  };
}
