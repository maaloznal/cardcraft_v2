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
import type { Session, User, RealtimeChannel } from '@supabase/supabase-js';
import {
  getDefaultProject,
  insertDefaultProject,
  updateProject,
  DEFAULT_PROJECT_NAME,
  type Project,
} from '@/lib/sync/cloudSync';
import type { SavedState } from '@/storage/StorageManager';
import * as Storage from '@/storage/StorageManager';
import type { OrchestratorContext } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('CloudSync');

const CLOUD_PUSH_DEBOUNCE_MS = 3000;
// Debounce for applying remote updates — coalesces rapid broadcasts (e.g. when
// the other device pushes multiple times in quick succession) into one apply.
const REMOTE_APPLY_DEBOUNCE_MS = 200;

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
  let remoteApplyTimer: ReturnType<typeof setTimeout> | null = null;
  let authSubscription: { subscription: { unsubscribe: () => void } } | null = null;
  let realtimeChannel: RealtimeChannel | null = null;
  let realtimeUserId: string | null = null;
  let currentUser: User | null = null;
  let cachedProject: Project | null = null; // cache of the default project (id + version)
  let syncing = false;
  let lastSyncedAt: Date | null = null;
  let lastError: string | null = null;
  let initialPullDone = false;
  // Guard flag: when applying remote state to local, we don't want to trigger
  // a cloud push back (which would echo our own change). Set true during apply.
  let isApplyingRemote = false;

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
      charLimit: state.settings.charLimit,
      exportQuality: state.settings.exportQuality,
      sidebarWidth: null,
      headerHeight: null,
    };
  }

  /**
   * Apply cloud state to the local app (replaces cards + settings).
   * Called after a successful pull OR after a Realtime broadcast.
   * Sets isApplyingRemote=true during the apply so the storage-controller's
   * cloud-push hook is a no-op (prevents echo: remote → apply → push → broadcast).
   */
  function applyCloudState(payload: SavedState): void {
    isApplyingRemote = true;
    try {
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
      if (payload.charLimit !== undefined)
        stateManager.dispatch({ type: 'SET_CHAR_LIMIT_VALUE', payload: { limit: payload.charLimit } });
      if (payload.exportQuality !== undefined)
        stateManager.dispatch({ type: 'SET_EXPORT_QUALITY', payload: { quality: payload.exportQuality } });
      // Persist to local storage so it survives reloads even without re-pulling
      storage.saveCardsToLocalStorage({ silent: true });
      // Re-render the cards in UI — stateManager.setCards updates state, but
      // the preview/editor renderers are NOT subscribed to state changes
      // (they're called explicitly by controllers). Without these calls the
      // state is correct but the UI shows stale cards.
      try {
        ctx.uiAppliers.renderEditor();
        ctx.uiAppliers.renderPreview();
      } catch (renderErr) {
        log.error('Failed to re-render after cloud apply', {
          error: renderErr instanceof Error ? renderErr.message : String(renderErr),
        });
      }
    } finally {
      // Reset on next tick — local dispatches happen synchronously, so by the
      // time any push would fire, the apply is complete and the guard can drop.
      setTimeout(() => { isApplyingRemote = false; }, 0);
    }
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
  async function pushToCloud(forceInsert = false): Promise<boolean> {
    if (!supabase || !currentUser) return false;
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
      Storage.markCloudSyncClean(currentUser.id);
      log.info('Pushed to cloud', { version: result.version, cards: payload.cards.length });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      log.error('Push failed', { error: msg });
      // Silent failure — don't spam the user with toasts on every debounced save
      return false;
    } finally {
      syncing = false;
    }
  }

  /** Debounced cloud push — called by storage-controller after a local save. */
  function scheduleCloudPush(): void {
    if (!getEnabled()) return; // no-op when not logged in
    if (isApplyingRemote) return; // skip: we're applying a remote update, push would echo
    Storage.markCloudSyncDirty(currentUser!.id);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void pushToCloud(false);
    }, CLOUD_PUSH_DEBOUNCE_MS);
  }

  /**
   * Subscribe to Supabase Realtime for changes to the user's default project.
   * On UPDATE events where new.version > cachedProject.version, fetch the
   * latest state and apply it locally (without pushing back). This enables
   * cross-device sync without page reloads: edit on phone → appears on desktop.
   *
   * Filter: user_id=eq.<userId> — RLS also enforces this, so even without the
   * filter the user would only see their own rows.
   */
  function subscribeToRealtime(userId: string): void {
    if (!supabase) return;
    // Supabase can emit INITIAL_SESSION and SIGNED_IN back-to-back for the
    // same session. Reusing an already-subscribed channel and adding another
    // postgres_changes callback throws, so this operation must be idempotent.
    if (realtimeChannel && realtimeUserId === userId) return;

    // Unsubscribe any channel from a stale/different session. A different
    // user has a different channel topic, so removal can finish asynchronously.
    if (realtimeChannel) {
      void supabase.removeChannel(realtimeChannel).catch(() => {
        // ignore — channel may already be removed
      });
      realtimeChannel = null;
      realtimeUserId = null;
    }

    log.info('Subscribing to realtime updates', { userId });
    realtimeChannel = supabase
      .channel(`projects:user_id=eq.${userId}`, {
        config: { broadcast: { self: false } }, // don't receive our own broadcasts
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            const eventType = payload.eventType;
            const newRecord = payload.new as Project | undefined;
            const oldRecord = payload.old as Project | undefined;
            log.debug('Realtime event received', { eventType, newVersion: newRecord?.version });

            // Only care about our 'default' project
            if (newRecord && newRecord.name !== DEFAULT_PROJECT_NAME && oldRecord?.name !== DEFAULT_PROJECT_NAME) {
              return;
            }

            if (eventType === 'DELETE') {
              log.info('Default project deleted remotely — keeping local state');
              cachedProject = null;
              return;
            }

            // UPDATE or INSERT — apply if version is newer than what we have
            if (newRecord && (!cachedProject || newRecord.version > (cachedProject.version ?? 0))) {
              // Debounce apply — coalesces rapid broadcasts
              if (remoteApplyTimer) clearTimeout(remoteApplyTimer);
              remoteApplyTimer = setTimeout(() => {
                void applyRemoteUpdate();
              }, REMOTE_APPLY_DEBOUNCE_MS);
            }
          } catch (e) {
            log.error('Realtime event handler failed', { error: e instanceof Error ? e.message : String(e) });
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          log.info('Realtime channel subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          log.warn('Realtime channel error', { status });
        }
      });
    realtimeUserId = userId;
  }

  /**
   * Apply a remote update: fetch fresh state from cloud (authoritative) and
   * apply it locally without pushing back. This is called from the realtime
   * subscription handler when another device pushed new data.
   */
  async function applyRemoteUpdate(): Promise<void> {
    if (!supabase || !currentUser) return;
    // Fetch fresh to get the latest committed state (the realtime payload may
    // be slightly stale if multiple updates were coalesced on the server)
    try {
      const fresh = await getDefaultProject(currentUser.id);
      if (!fresh) {
        log.warn('Realtime event but project no longer exists in cloud');
        return;
      }
      cachedProject = fresh;
      const payload = fresh.data as SavedState;
      if (!payload || typeof payload !== 'object') {
        log.warn('Realtime pull returned malformed payload');
        return;
      }
      applyCloudState(payload);
      lastSyncedAt = new Date(fresh.updated_at);
      log.info('Applied remote update', { version: fresh.version, updatedAt: fresh.updated_at });
      storage.showToast('Карточки обновлены с другого устройства', 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      log.error('Apply remote update failed', { error: msg });
    }
  }

  /**
   * Auth state change handler.
   * - INITIAL_SESSION: if logged in, do the initial pull (once) + start realtime.
   * - SIGNED_IN: pull from cloud + start realtime.
   * - SIGNED_OUT: clear local state (cards + localStorage) to prevent card leakage
   *   between accounts on shared devices, stop realtime + sync.
   *
   * Why clear on sign-out: previously, cards stayed in localStorage after
   * logout. The next user to log in on the same device would see those cards
   * (and they could even get auto-pushed to the new account's cloud — a
   * privacy leak). Clearing on sign-out ensures each account starts clean.
   */
  function handleAuthChange(event: string, session: Session | null): void {
    const user = session?.user;
    // INITIAL_SESSION without a user is an anonymous page load, not a logout.
    // Clearing here used to erase guest cards from localStorage on refresh.
    if (!user && event !== 'SIGNED_OUT') {
      currentUser = null;
      return;
    }
    if (event === 'SIGNED_OUT') {
      log.info('User signed out — stopping cloud sync + clearing local state');
      currentUser = null;
      cachedProject = null;
      initialPullDone = false;
      if (pushTimer) {
        clearTimeout(pushTimer);
        pushTimer = null;
      }
      if (remoteApplyTimer) {
        clearTimeout(remoteApplyTimer);
        remoteApplyTimer = null;
      }
      // Unsubscribe from realtime
      if (realtimeChannel && supabase) {
        void supabase.removeChannel(realtimeChannel).catch(() => {
          // ignore — channel may already be removed
        });
        realtimeChannel = null;
        realtimeUserId = null;
      }
      // Clear local state — prevents card leakage between accounts on shared
      // devices. Without this, the next user to log in would see the previous
      // user's cards in localStorage (and they could get pushed to the new
      // account's cloud project — a privacy violation).
      clearLocalState();
      storage.showToast('Вы вышли из аккаунта. Локальные карточки очищены.', 3000);
      return;
    }
    if (!user) return;
    if (user.id !== currentUser?.id) {
      currentUser = user;
      cachedProject = null; // reset cache for new user
      log.info('User signed in', { userId: currentUser.id, email: currentUser.email });
    }
    // Start realtime subscription for this user (idempotent — unsubscribes previous)
    subscribeToRealtime(currentUser.id);
    // Do the initial pull once per session
    if (!initialPullDone && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      initialPullDone = true;
      const hasUnsyncedLocalChanges = Storage.getCloudSyncDirtyUser() === currentUser.id;
      const initialSync = hasUnsyncedLocalChanges
        ? pushToCloud(false).then((pushed) => ({
            pulled: false,
            reason: pushed ? 'pushed unsynced local changes' : 'failed to push unsynced local changes',
          }))
        : pullFromCloud();
      void initialSync.then(({ pulled, reason }) => {
        if (pulled) {
          storage.showToast('Карточки синхронизированы с облаком', 2500);
        } else if (reason === 'cloud was empty, pushed local instead') {
          storage.showToast('Локальные карточки сохранены в облако', 2500);
        } else if (reason === 'pushed unsynced local changes') {
          storage.showToast('Последние изменения сохранены в облако', 2500);
        }
      });
    }
  }

  /**
   * Clear local state — cards (in-memory + localStorage) + settings.
   * Called on SIGNED_OUT to prevent card leakage between accounts on shared
   * devices. Also resets to a single empty card so the editor is ready for
   * the next user.
   */
  function clearLocalState(): void {
    try {
      // 1. Clear in-memory state — replace cards with a single empty card
      stateManager.dispatch({ type: 'CLEAR_ALL' });
      // 2. Clear localStorage (cards + all settings)
      Storage.clear();
      // 3. Re-render editor + preview to show the cleared state
      try {
        ctx.uiAppliers.renderEditor();
        ctx.uiAppliers.renderPreview();
      } catch (renderErr) {
        log.error('Failed to re-render after clearLocalState', {
          error: renderErr instanceof Error ? renderErr.message : String(renderErr),
        });
      }
    } catch (e) {
      log.error('Failed to clear local state', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Subscribe to auth changes
  if (supabase) {
    // onAuthStateChange always emits INITIAL_SESSION after registration. A
    // separate getSession() races with that event and used to initialize the
    // same Realtime channel twice.
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
      if (remoteApplyTimer) clearTimeout(remoteApplyTimer);
      remoteApplyTimer = null;
      if (authSubscription) {
        authSubscription.subscription.unsubscribe();
        authSubscription = null;
      }
      if (realtimeChannel && supabase) {
        void supabase.removeChannel(realtimeChannel).catch(() => {
          // ignore — channel may already be removed
        });
        realtimeChannel = null;
        realtimeUserId = null;
      }
      currentUser = null;
      cachedProject = null;
    },
  };
}

// Re-export for consumers
export { DEFAULT_PROJECT_NAME };
