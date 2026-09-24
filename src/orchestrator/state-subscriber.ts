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
import { getThemeLabel } from '@/themes/ThemeManager';

/** P2-SUMMARY: Short format labels for the design summary */
const FORMAT_SHORT: Record<string, string> = {
  'auto': 'Авто',
  'aspect-4-5': '4:5',
  'aspect-9-16': '9:16',
  'whatsapp': 'WA',
  'telegram': 'TG',
  'vk': 'VK',
};

/** P2-SUMMARY: Full format labels for screen reader text */
const FORMAT_FULL: Record<string, string> = {
  'auto': 'Стандартный',
  'aspect-4-5': '4:5 Instagram',
  'aspect-9-16': '9:16 Stories',
  'whatsapp': 'WhatsApp',
  'telegram': 'Telegram',
  'vk': 'VK',
};

/** P2-SUMMARY: Update the compact design summary in the Дизайн header.
 *  P3-A11Y: also updates sr-only text for screen readers. */
function updateDesignSummary(format: string, theme: string): void {
  const summary = document.getElementById('designSummary');
  const srText = document.getElementById('designSummaryText');
  // Shorten theme label: "1. Clean Minimal (Notion / Apple)" → "1. Clean Minimal"
  const themeLabel = getThemeLabel(theme);
  const themeShort = themeLabel.replace(/\s*\(.*\)/, '').trim();
  const fmtShort = FORMAT_SHORT[format] || format;
  const visualText = `${fmtShort} · ${themeShort}`;
  if (summary) summary.textContent = visualText;
  // P3-A11Y: screen reader text uses full names
  const fmtFull = FORMAT_FULL[format] || format;
  if (srText) srText.textContent = `Формат: ${fmtFull}, тема: ${themeShort}`;
}

/**
 * Subscribe to StateManager and sync the UI on every state change. Tracks the
 * previous settings reference so the expensive settings-sync path (sync
 * selects / toggles / sliders, apply CSS state, apply char limit) is skipped
 * when only UI state changed — keeps O(1) typing responsiveness. Returns the
 * unsubscribe function returned by StateManager.subscribe.
 */
export function createStateSubscriber(ctx: OrchestratorContext): () => void {
  const { stateManager, refs, uiAppliers, history } = ctx;

  let prevSettings = stateManager.getSettings();

  return stateManager.subscribe((state: AppState) => {
    const settingsChanged = state.settings !== prevSettings;
    prevSettings = state.settings;
    if (settingsChanged) {
      // P2-SUMMARY: update design summary on every settings change
      updateDesignSummary(state.settings.format, state.settings.theme);
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
