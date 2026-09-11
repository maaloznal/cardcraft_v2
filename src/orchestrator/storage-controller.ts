/**
 * storage-controller.ts — persistence + toast notifications.
 *
 * Wraps StorageManager with debounced save + user-facing toast feedback.
 * The toast wrapper lives here because storage operations are the primary
 * notifier; other controllers call ctx.storage.showToast(msg) for user
 * notifications.
 *
 * Extracted from CardCraftApp.ts sections 6 + 7 (lines 228-283) +
 * saveOnUnload (line 1260-1262).
 *
 * Public API:
 *   scheduleSave(opts?)          — debounced save (CONFIG.SAVE_DEBOUNCE_MS)
 *   saveCardsToLocalStorage()    — synchronous save
 *   loadCardsFromLocalStorage()  — load + dispatch settings to StateManager
 *   saveOnUnload()               — synchronous save (called from beforeunload)
 *   showToast(msg, duration?)    — toast notification
 *   destroy()                    — clear pending save timer
 */

import * as Storage from '@/storage/StorageManager';
import { CONFIG } from '@/core/constants';
import type { OrchestratorContext } from './types';

export interface StorageController {
  scheduleSave(opts?: { silent?: boolean }): void;
  saveCardsToLocalStorage(opts?: { silent?: boolean }): void;
  loadCardsFromLocalStorage(): void;
  saveOnUnload(): void;
  showToast(msg: string, duration?: number, options?: { priority?: boolean }): void;
  destroy(): void;
}

export function createStorageController(ctx: OrchestratorContext): StorageController {
  const { stateManager, toastQueue } = ctx;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(msg: string, duration = 2500, options?: { priority?: boolean }): void {
    toastQueue.show(msg, duration, options);
  }

  function saveCardsToLocalStorage({ silent = false } = {}): void {
    try {
      const state = stateManager.get();
      Storage.save({
        cards: state.cards.list,
        theme: state.settings.theme,
        format: state.settings.format,
        showCardNumbers: state.settings.showCardNumbers,
        showProgressBar: state.settings.showProgressBar,
        progressBarStyle: state.settings.progressBarStyle,
        listStyleType: state.settings.listStyleType,
        gradientAngle: state.settings.gradientAngle,
        charLimitEnabled: state.settings.charLimitEnabled,
      });
      if (!silent) showToast('Карточки успешно сохранены!');
    } catch (e) {
      const err = e as Error;
      if (err.message === 'QuotaExceededError') {
        if (!silent) showToast('Недостаточно места. Удалите старые карточки.');
      } else if (!silent) {
        showToast('Ошибка при сохранении карточек');
      }
    }
  }

  function scheduleSave(opts: { silent?: boolean } = {}): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCardsToLocalStorage(opts), CONFIG.SAVE_DEBOUNCE_MS);
  }

  function loadCardsFromLocalStorage(): void {
    const saved = Storage.load();
    if (saved.cards && saved.cards.length) {
      stateManager.setCards(saved.cards);
    }
    if (saved.theme) stateManager.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: saved.theme } });
    if (saved.format) stateManager.dispatch({ type: 'SET_FORMAT', payload: { format: saved.format } });
    if (saved.showCardNumbers !== undefined)
      stateManager.dispatch({ type: 'SET_SHOW_CARD_NUMBERS', payload: { show: saved.showCardNumbers } });
    if (saved.showProgressBar !== undefined)
      stateManager.dispatch({ type: 'SET_SHOW_PROGRESS_BAR', payload: { show: saved.showProgressBar } });
    if (saved.progressBarStyle)
      stateManager.dispatch({ type: 'SET_PROGRESS_BAR_STYLE', payload: { style: saved.progressBarStyle } });
    if (saved.listStyleType)
      stateManager.dispatch({ type: 'SET_LIST_STYLE', payload: { style: saved.listStyleType } });
    if (saved.gradientAngle !== undefined)
      stateManager.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: { angle: saved.gradientAngle } });
    if (saved.charLimitEnabled !== undefined)
      stateManager.dispatch({ type: 'SET_CHAR_LIMIT', payload: { enabled: saved.charLimitEnabled } });
  }

  function saveOnUnload(): void {
    saveCardsToLocalStorage({ silent: true });
  }

  return {
    scheduleSave,
    saveCardsToLocalStorage,
    loadCardsFromLocalStorage,
    saveOnUnload,
    showToast,
    destroy() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
    },
  };
}
