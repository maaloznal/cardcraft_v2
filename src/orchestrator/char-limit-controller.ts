/**
 * char-limit-controller.ts — character-limit enforcement + counter.
 *
 * Owns:
 *   - applyCharLimit() — set maxlength on every editor input/textarea
 *     based on settings.charLimitEnabled + current format limit. Toggle
 *     char-counter visibility. Called by the state subscriber (on
 *     settings change) and by the topbar char-limit-toggle event handler.
 *   - updateCharCounter(idx) — update the counter text for a specific
 *     card; called by editor input/paste callbacks (typing → counter
 *     updates) and on focus.
 *
 * Extracted from CardCraftApp.ts section 8 (applyCharLimit +
 * updateCharCounter, lines 314-353).
 *
 * Public API:
 *   applyCharLimit()
 *   updateCharCounter(idx)
 *   destroy() — no-op (stateless)
 */

import { FORMAT_CHAR_LIMITS, EDITOR_FIELDS } from '@/core/constants';
import type { OrchestratorContext } from './types';

export interface CharLimitController {
  applyCharLimit(): void;
  updateCharCounter(idx: number): void;
  destroy(): void;
}

export function createCharLimitController(ctx: OrchestratorContext): CharLimitController {
  const { refs, stateManager } = ctx;

  function applyCharLimit(): void {
    if (!refs.editorCardsList) return;
    const settings = stateManager.getSettings();
    const limit = settings.charLimitEnabled ? FORMAT_CHAR_LIMITS[settings.format] || 0 : 0;
    refs.editorCardsList
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[data-field], textarea[data-field]')
      .forEach((el) => {
        if (limit > 0) {
          el.setAttribute('maxlength', String(limit));
        } else {
          const field = el.dataset.field;
          const f = EDITOR_FIELDS.find((ef) => ef.key === field);
          if (f) el.setAttribute('maxlength', String(f.maxlength));
        }
      });
    if (refs.charCounter) {
      refs.charCounter.style.display = settings.charLimitEnabled && limit > 0 ? '' : 'none';
    }
  }

  function updateCharCounter(idx: number): void {
    const settings = stateManager.getSettings();
    if (!settings.charLimitEnabled || !refs.charCounterText || !refs.charCounter) return;
    const limit = FORMAT_CHAR_LIMITS[settings.format] || 0;
    if (limit <= 0) {
      refs.charCounter.style.display = 'none';
      return;
    }
    const card = stateManager.getCard(idx);
    if (!card) return;
    const totalChars =
      (card.title?.length || 0) +
      (card.subtitle?.length || 0) +
      (card.text?.length || 0) +
      (card.listItems?.length || 0) +
      (card.footer?.length || 0) +
      (card.cta?.length || 0);
    refs.charCounterText.textContent = `${totalChars} / ${limit}`;
    refs.charCounter.classList.toggle('near-limit', totalChars >= limit * 0.9);
  }

  return {
    applyCharLimit,
    updateCharCounter,
    destroy() {
      /* stateless */
    },
  };
}
