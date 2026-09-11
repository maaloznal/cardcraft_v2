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
import { createLogger } from '@/lib/logger';

const log = createLogger('Storage');

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

  /** Show a toast via the shared toast queue (default 2500 ms; priority toasts bypass the queue). */
  function showToast(msg: string, duration = 2500, options?: { priority?: boolean }): void {
    toastQueue.show(msg, duration, options);
  }

  /**
   * Persist cards + all settings to localStorage synchronously. Falls back to
   * IndexedDB on QuotaExceededError (P8.4). Toasts success / fallback / error
   * unless called with { silent: true }.
   */
  function saveCardsToLocalStorage({ silent = false } = {}): void {
    const state = stateManager.get();
    const stateToSave = {
      cards: state.cards.list,
      theme: state.settings.theme,
      format: state.settings.format,
      showCardNumbers: state.settings.showCardNumbers,
      showProgressBar: state.settings.showProgressBar,
      progressBarStyle: state.settings.progressBarStyle,
      listStyleType: state.settings.listStyleType,
      gradientAngle: state.settings.gradientAngle,
      charLimitEnabled: state.settings.charLimitEnabled,
    };
    try {
      Storage.save(stateToSave);
      if (!silent) showToast('Карточки успешно сохранены!');
    } catch (e) {
      const err = e as Error;
      if (err.message === 'QuotaExceededError') {
        // P8.4: Fallback to IndexedDB when localStorage quota is exceeded
        // P8.5: Lazy-load IndexedDBBackend only when needed (not in initial bundle)
        void import('@/storage/IndexedDBBackend')
          .then((IndexedDB) => {
            if (!IndexedDB.isAvailable()) {
              if (!silent)
                showToast('Недостаточно места. Удалите старые карточки.', 2500, {
                  priority: true,
                });
              return;
            }
            return IndexedDB.save(stateToSave);
          })
          .then(() => {
            if (!silent) showToast('Сохранено в резервное хранилище');
          })
          .catch(() => {
            if (!silent)
              showToast('Недостаточно места. Удалите старые карточки.', 2500, {
                priority: true,
              });
          });
      } else if (!silent) {
        showToast('Ошибка при сохранении карточек');
      }
    }
  }

  /** Debounce saveCardsToLocalStorage by CONFIG.SAVE_DEBOUNCE_MS — coalesces rapid edits into one write. */
  function scheduleSave(opts: { silent?: boolean } = {}): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCardsToLocalStorage(opts), CONFIG.SAVE_DEBOUNCE_MS);
  }

  /** Load cards + settings from localStorage and dispatch them into StateManager (replaces in-memory state). */
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

  /** Synchronous silent save used by the beforeunload handler — no toast, no debounce. */
  function saveOnUnload(): void {
    saveCardsToLocalStorage({ silent: true });
  }

  return {
    scheduleSave,
    saveCardsToLocalStorage,
    loadCardsFromLocalStorage,
    saveOnUnload,
    showToast,
    /** Cancel any pending debounced save timer — call on app teardown. */
    destroy() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
    },
  };
}
