/**
 * cloud-sync-controller.ts — bridges Supabase auth + cloud sync with the
 * orchestrator's local state.
 *
 * Responsibilities:
 *   1. Subscribe to supabase.auth.onAuthStateChange
 *   2. On SIGNED_IN: pull default project from cloud
 *      - If cloud has data: replace local state with cloud state (after
 *        asking the user, if local has unsaved changes)
 *      - If cloud is empty: push current local state to cloud (first sync)
 *   3. Expose scheduleCloudPush() — called by storage-controller after a
 *      debounced local save. Pushes to cloud with extra debounce (3s) to
 *      avoid hammering Supabase on every keystroke.
 *   4. On SIGNED_OUT: stop syncing, keep local state untouched
 *
 * Conflict resolution: last-write-wins. The most recent push wins; pulls
 * on login only (no realtime subscription yet — could be added later).
 *
 * Public API:
 *   scheduleCloudPush()   — debounced push of current state to cloud
 *   pullFromCloud()       — manual pull (replaces local state)
 *   getSyncStatus()       — { enabled, lastSyncedAt, syncing, error }
 *   destroy()             — unsubscribe from auth changes, clear timers
 */

import { supabase } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import {
  getDefaultProject,
  insertDefaultProject,
  updateProject,
  DEFAULT_PROJECT_NAME,
  type Project,
} from '@/lib/sync/cloudSync';
import type { SavedState } from '@/storage/StorageManager';
import type { OrchestratorContext } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('CloudSync');

const CLOUD_PUSH_DEBOUNCE_MS = 3000;

export interface SyncStatus {
  enabled: boolean;        // user is logged in + supabase configured
  syncing: boolean;         // a push/pull is in flight
  lastSyncedAt: Date | null;
  error: string | null;
  projectId: string | null; // id of the user's default project (cached)
  projectVersion: number | null; // last known cloud version
}

export interface CloudSyncController {
  scheduleCloudPush(): void;
  pullFromCloud(): Promise<{ pulled: boolean; reason?: string }>;
  getSyncStatus(): SyncStatus;
  destroy(): void;
}

export function createCloudSyncController(ctx: OrchestratorContext): CloudSyncController {
  const { stateManager, storage } = ctx;

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let authSubscription: { subscription: { unsubscribe: () => void } } | null = null;
  let currentUser: User | null = null;
  let cachedProject: Project | null = null; // cache of the default project (id + version)
  let syncing = false;
  let lastSyncedAt: Date | null = null;
  let lastError: string | null = null;
  let initialPullDone = false;

  function getEnabled(): boolean {
    return supabase !== null && currentUser !== null;
  }

  function getSyncStatus(): SyncStatus {
    return {
      enabled: getEnabled(),
      syncing,
      lastSyncedAt,
      error: lastError,
      projectId: cachedProject?.id ?? null,
      projectVersion: cachedProject?.version ?? null,
    };
  }

  /**
   * Build the cloud payload from current app state.
   * Includes cards + all settings so the user sees the same setup on every device.
   */
  function buildCloudPayload(): SavedState {
    const state = stateManager.get();
    return {
      cards: state.cards.list,
      theme: state.settings.theme,
      format: state.settings.format,
      showCardNumbers: state.settings.showCardNumbers,
      showProgressBar: state.settings.showProgressBar,
      progressBarStyle: state.settings.progressBarStyle,
      listStyleType: state.settings.listStyleType,
      gradientAngle: state.settings.gradientAngle,
      charLimitEnabled: state.settings.charLimitEnabled,
      sidebarWidth: null,
      headerHeight: null,
    };
  }

  /**
   * Apply cloud state to the local app (replaces cards + settings).
   * Called after a successful pull.
   */
  function applyCloudState(payload: SavedState): void {
    if (payload.cards && Array.isArray(payload.cards) && payload.cards.length) {
      stateManager.setCards(payload.cards);
    }
    if (payload.theme) stateManager.dispatch({ type: 'SET_GLOBAL_THEME', payload: { theme: payload.theme } });
    if (payload.format) stateManager.dispatch({ type: 'SET_FORMAT', payload: { format: payload.format } });
    if (payload.showCardNumbers !== undefined)
      stateManager.dispatch({ type: 'SET_SHOW_CARD_NUMBERS', payload: { show: payload.showCardNumbers } });
    if (payload.showProgressBar !== undefined)
      stateManager.dispatch({ type: 'SET_SHOW_PROGRESS_BAR', payload: { show: payload.showProgressBar } });
    if (payload.progressBarStyle)
      stateManager.dispatch({ type: 'SET_PROGRESS_BAR_STYLE', payload: { style: payload.progressBarStyle } });
    if (payload.listStyleType)
      stateManager.dispatch({ type: 'SET_LIST_STYLE', payload: { style: payload.listStyleType } });
    if (payload.gradientAngle !== undefined)
      stateManager.dispatch({ type: 'SET_GRADIENT_ANGLE', payload: { angle: payload.gradientAngle } });
    if (payload.charLimitEnabled !== undefined)
      stateManager.dispatch({ type: 'SET_CHAR_LIMIT', payload: { enabled: payload.charLimitEnabled } });
    // Persist to local storage so it survives reloads even without re-pulling
    storage.saveCardsToLocalStorage({ silent: true });
  }

  /**
   * Pull the user's default project from cloud and apply to local state.
   * If cloud is empty, push current local state to cloud instead (first sync).
   */
  async function pullFromCloud(): Promise<{ pulled: boolean; reason?: string }> {
    if (!supabase || !currentUser) {
      return { pulled: false, reason: 'sync disabled (not logged in)' };
    }
    syncing = true;
    lastError = null;
    try {
      log.info('Pulling from cloud', { userId: currentUser.id });
      const project = await getDefaultProject(currentUser.id);
      if (!project) {
        // Cloud empty — push current local state to seed the user's cloud project
        log.info('Cloud empty — pushing local state as initial sync');
        await pushToCloud(true);
        return { pulled: false, reason: 'cloud was empty, pushed local instead' };
      }
      cachedProject = project;
      const payload = project.data as SavedState;
      if (!payload || typeof payload !== 'object') {
        return { pulled: false, reason: 'cloud data is malformed' };
      }
      applyCloudState(payload);
      lastSyncedAt = new Date(project.updated_at);
      log.info('Pulled from cloud', { version: project.version, updatedAt: project.updated_at });
      return { pulled: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      log.error('Pull failed', { error: msg });
      storage.showToast(`Синхронизация не удалась: ${msg}`, 4000, { priority: true });
      return { pulled: false, reason: msg };
    } finally {
      syncing = false;
    }
  }

  /**
   * Push current app state to cloud. If `forceInsert` is true, skip the
   * update path and always insert (used for first-sync when cloud is empty).
   */
  async function pushToCloud(forceInsert = false): Promise<void> {
    if (!supabase || !currentUser) return;
    syncing = true;
    lastError = null;
    try {
      const payload = buildCloudPayload();
      // If we don't have a cached project id, fetch it first
      if (!cachedProject && !forceInsert) {
        const existing = await getDefaultProject(currentUser.id);
        cachedProject = existing;
      }

      let result: Project;
      if (cachedProject && !forceInsert) {
        // Update existing project
        result = await updateProject(
          cachedProject.id,
          currentUser.id,
          payload,
          cachedProject.version,
        );
      } else {
        // Insert new (first sync or forceInsert)
        result = await insertDefaultProject(currentUser.id, payload);
      }
      cachedProject = result;
      lastSyncedAt = new Date(result.updated_at);
      log.info('Pushed to cloud', { version: result.version, cards: payload.cards.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      log.error('Push failed', { error: msg });
      // Silent failure — don't spam the user with toasts on every debounced save
    } finally {
      syncing = false;
    }
  }

  /** Debounced cloud push — called by storage-controller after a local save. */
  function scheduleCloudPush(): void {
    if (!getEnabled()) return; // no-op when not logged in
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void pushToCloud(false);
    }, CLOUD_PUSH_DEBOUNCE_MS);
  }

  /**
   * Auth state change handler.
   * - INITIAL_SESSION: if logged in, do the initial pull (once).
   * - SIGNED_IN: pull from cloud.
   * - SIGNED_OUT: clear cached project, stop syncing, keep local state.
   */
  function handleAuthChange(event: string, session: Session | null): void {
    if (event === 'SIGNED_OUT' || !session?.user) {
      log.info('User signed out — stopping cloud sync');
      currentUser = null;
      cachedProject = null;
      initialPullDone = false;
      if (pushTimer) {
        clearTimeout(pushTimer);
        pushTimer = null;
      }
      return;
    }
    if (session.user.id !== currentUser?.id) {
      currentUser = session.user;
      cachedProject = null; // reset cache for new user
      log.info('User signed in', { userId: currentUser.id, email: currentUser.email });
    }
    // Do the initial pull once per session
    if (!initialPullDone && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      initialPullDone = true;
      void pullFromCloud().then(({ pulled, reason }) => {
        if (pulled) {
          storage.showToast('Карточки синхронизированы с облаком', 2500);
        } else if (reason === 'cloud was empty, pushed local instead') {
          storage.showToast('Локальные карточки сохранены в облако', 2500);
        }
      });
    }
  }

  // Subscribe to auth changes
  if (supabase) {
    // Get initial session synchronously (best-effort)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        handleAuthChange('INITIAL_SESSION', data.session);
      }
    }).catch((e) => {
      log.error('Failed to get initial session', { error: e instanceof Error ? e.message : String(e) });
    });
    // Subscribe to future changes
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });
    authSubscription = sub.data;
  }

  return {
    scheduleCloudPush,
    pullFromCloud,
    getSyncStatus,
    destroy() {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = null;
      if (authSubscription) {
        authSubscription.subscription.unsubscribe();
        authSubscription = null;
      }
      currentUser = null;
      cachedProject = null;
    },
  };
}

// Re-export for consumers
export { DEFAULT_PROJECT_NAME };
