import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { OrchestratorContext } from '@/orchestrator/types';

const mocks = vi.hoisted(() => {
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
    getDefaultProject: vi.fn(() => new Promise<never>(() => undefined)),
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
  DEFAULT_PROJECT_NAME: 'default',
  getDefaultProject: mocks.getDefaultProject,
  insertDefaultProject: vi.fn(),
  updateProject: vi.fn(),
}));

import { createCloudSyncController } from '@/orchestrator/cloud-sync-controller';

describe('CloudSyncController auth lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.channel.on.mockReturnValue(mocks.channel);
    mocks.channel.subscribe.mockReturnValue(mocks.channel);
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
});
