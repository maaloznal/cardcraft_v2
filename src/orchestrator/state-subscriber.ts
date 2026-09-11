/**
 * state-subscriber.ts — subscribes to StateManager + syncs UI on changes.
 *
 * Optimization (P1-3): tracks previous settings reference. If only UI state
 * changed (settings ref unchanged — SET_UI preserves settings ref), the
 * expensive settings-sync work (sync selects/toggles/sliders, apply CSS
 * state, apply char limit) is skipped. This preserves O(1) typing
 * responsiveness — card-content edits dispatch UPDATE_CARD_FIELD which
 * doesn't touch settings, so the subscriber's expensive path is skipped.
 *
 * updateUndoRedoButtons() always runs (cheap; depends on history stack
 * not settings).
 *
 * Extracted from CardCraftApp.ts section 10 (lines 421-464).
 *
 * Public API:
 *   createStateSubscriber(ctx) — returns an unsubscribe function
 */

import type { AppState } from '@/state/StateManager';
import type { OrchestratorContext } from './types';

export function createStateSubscriber(ctx: OrchestratorContext): () => void {
  const { stateManager, refs, uiAppliers, history } = ctx;

  let prevSettings = stateManager.getSettings();

  return stateManager.subscribe((state: AppState) => {
    const settingsChanged = state.settings !== prevSettings;
    prevSettings = state.settings;
    if (settingsChanged) {
      // Sync selects/toggles/sliders (idempotent — only update if differs)
      if (refs.themeSelect && refs.themeSelect.value !== state.settings.theme) {
        refs.themeSelect.value = state.settings.theme;
      }
      if (refs.formatSelect && refs.formatSelect.value !== state.settings.format) {
        refs.formatSelect.value = state.settings.format;
      }
      if (
        refs.gradientAngleSlider &&
        refs.gradientAngleSlider.value !== String(state.settings.gradientAngle)
      ) {
        refs.gradientAngleSlider.value = String(state.settings.gradientAngle);
      }
      if (refs.gradientAngleValue)
        refs.gradientAngleValue.textContent = `${state.settings.gradientAngle}°`;
      if (refs.numberingToggle && refs.numberingToggle.checked !== state.settings.showCardNumbers) {
        refs.numberingToggle.checked = state.settings.showCardNumbers;
      }
      if (
        refs.progressBarToggle &&
        refs.progressBarToggle.checked !== state.settings.showProgressBar
      ) {
        refs.progressBarToggle.checked = state.settings.showProgressBar;
      }
      if (
        refs.progressBarStyleSelect &&
        refs.progressBarStyleSelect.value !== state.settings.progressBarStyle
      ) {
        refs.progressBarStyleSelect.value = state.settings.progressBarStyle;
      }
      if (refs.listStyleSelect && refs.listStyleSelect.value !== state.settings.listStyleType) {
        refs.listStyleSelect.value = state.settings.listStyleType;
      }
      if (refs.charLimitToggle && refs.charLimitToggle.checked !== state.settings.charLimitEnabled) {
        refs.charLimitToggle.checked = state.settings.charLimitEnabled;
      }
      // Apply CSS state
      uiAppliers.applyThemeToWorkspace();
      uiAppliers.applyNumberingVisibility();
      uiAppliers.applyProgressBarVisibility();
      uiAppliers.applyProgressBarStyle();
      uiAppliers.applyListStyle();
      ctx.charLimit.applyCharLimit();
    }
    history.updateUndoRedoButtons();
  });
}
