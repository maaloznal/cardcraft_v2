import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { OrchestratorContext } from '@/orchestrator/types';

const mocks = vi.hoisted(() => {
  class ProjectVersionConflictError extends Error {}
  let authCallback: ((event: string, session: Session | null) => void) | null = null;
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  return {
    getAuthCallback: () => authCallback,
    setAuthCallback: (callback: (event: string, session: Session | null) => void) => {
      authCallback = callback;
    },
    channel,
    channelFactory: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue('ok'),
    unsubscribe: vi.fn(),
    getProject: vi.fn(() => new Promise<never>(() => undefined)),
    updateProject: vi.fn(),
    ProjectVersionConflictError,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        mocks.setAuthCallback(callback);
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      }),
    },
    channel: mocks.channelFactory,
    removeChannel: mocks.removeChannel,
  },
}));

vi.mock('@/lib/sync/cloudSync', () => ({
  getProject: mocks.getProject,
  updateProject: mocks.updateProject,
  ProjectVersionConflictError: mocks.ProjectVersionConflictError,
}));

import { createCloudSyncController } from '@/orchestrator/cloud-sync-controller';

describe('CloudSyncController auth lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.channel.on.mockReturnValue(mocks.channel);
    mocks.channel.subscribe.mockReturnValue(mocks.channel);
  });

  it('keeps guest cards on an anonymous INITIAL_SESSION event', () => {
    localStorage.setItem('flashcard-cards', JSON.stringify([{ id: 'local-card' }]));
    const showToast = vi.fn();
    const dispatch = vi.fn();
    const controller = createCloudSyncController({
      stateManager: { get: vi.fn(), dispatch },
      storage: { showToast },
      uiAppliers: { renderEditor: vi.fn(), renderPreview: vi.fn() },
    } as unknown as OrchestratorContext);

    mocks.getAuthCallback()?.('INITIAL_SESSION', null);

    expect(localStorage.getItem('flashcard-cards')).not.toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    controller.destroy();
  });

  it('marks signed-in local changes as pending before the debounced cloud push', () => {
    const controller = createCloudSyncController({
      stateManager: { get: vi.fn() },
      storage: { showToast: vi.fn() },
      uiAppliers: { renderEditor: vi.fn(), renderPreview: vi.fn() },
    } as unknown as OrchestratorContext);
    const session = {
      user: { id: 'user-pending', email: 'pending@example.com' },
    } as unknown as Session;
    localStorage.setItem('cardcraft-active-project-v1', JSON.stringify({
      id: 'project-pending', name: 'Project', ownerId: 'user-pending', remote: true,
    }));

    mocks.getAuthCallback()?.('SIGNED_IN', session);
    controller.scheduleCloudPush();

    expect(localStorage.getItem('flashcard-cloud-sync-dirty-user')).toContain('user-pending:project-pending');
    controller.destroy();
  });

  it('creates only one Realtime subscription for repeated events from the same session', () => {
    const controller = createCloudSyncController({
      stateManager: { get: vi.fn() },
      storage: { showToast: vi.fn() },
      uiAppliers: { renderEditor: vi.fn(), renderPreview: vi.fn() },
    } as unknown as OrchestratorContext);

    const callback = mocks.getAuthCallback();
    expect(callback).not.toBeNull();

    const session = {
      user: { id: 'user-1', email: 'test@example.com' },
    } as unknown as Session;
    callback?.('INITIAL_SESSION', session);
    callback?.('SIGNED_IN', session);

    expect(mocks.channelFactory).toHaveBeenCalledTimes(1);
    expect(mocks.channel.on).toHaveBeenCalledTimes(1);
    expect(mocks.channel.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.removeChannel).not.toHaveBeenCalled();

    controller.destroy();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('retries a stale write with the latest cloud version', async () => {
    const userId = 'user-conflict';
    const projectId = 'project-conflict';
    const project = (version: number) => ({
      id: projectId,
      user_id: userId,
      name: 'Project',
      data: { cards: [{ id: 'card-1', title: `v${version}` }] },
      version,
      updated_at: new Date(version * 1000).toISOString(),
      created_at: new Date(0).toISOString(),
    });
    mocks.getProject.mockResolvedValueOnce(project(1));
    mocks.updateProject
      .mockRejectedValueOnce(new mocks.ProjectVersionConflictError())
      .mockResolvedValueOnce(project(3));

    localStorage.setItem('cardcraft-active-project-v1', JSON.stringify({
      id: projectId, name: 'Project', ownerId: userId, remote: true,
    }));
    const setCards = vi.fn();
    const controller = createCloudSyncController({
      stateManager: {
        get: vi.fn(() => ({
          cards: { list: [{ id: 'card-1', title: 'local' }] },
          settings: {
            theme: 'theme-clean', format: '9:16', showCardNumbers: true,
            showProgressBar: true, progressBarStyle: 'numbers', listStyleType: 'numbers',
            gradientAngle: 135, charLimitEnabled: false, charLimit: 1000, exportQuality: 'x3',
          },
        })),
        setCards,
        dispatch: vi.fn(),
      },
      storage: { saveCardsToLocalStorage: vi.fn(), showToast: vi.fn() },
      uiAppliers: { renderEditor: vi.fn(), renderPreview: vi.fn() },
    } as unknown as OrchestratorContext);

    mocks.getAuthCallback()?.('SIGNED_IN', {
      user: { id: userId, email: 'conflict@example.com' },
    } as unknown as Session);
    await vi.waitFor(() => expect(mocks.getProject).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(setCards).toHaveBeenCalled());

    mocks.getProject.mockResolvedValueOnce(project(2));
    await new Promise<void>((resolve) => {
      window.dispatchEvent(new CustomEvent('cardcraft:flush-cloud-sync', { detail: { done: resolve } }));
    });

    expect(mocks.updateProject).toHaveBeenNthCalledWith(1, projectId, userId, expect.any(Object), 1);
    expect(mocks.updateProject).toHaveBeenNthCalledWith(2, projectId, userId, expect.any(Object), 2);
    controller.destroy();
  });
});
