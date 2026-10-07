import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return {
    from: vi.fn(() => query),
    query,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

import { ProjectVersionConflictError, updateProject } from '@/lib/sync/cloudSync';

describe('cloud project writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.update.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.query.select.mockReturnValue(mocks.query);
  });

  it('updates only the version that the device last observed', async () => {
    const updated = {
      id: 'project-1', user_id: 'user-1', name: 'Project', data: {},
      version: 8, updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
    };
    mocks.query.maybeSingle.mockResolvedValue({ data: updated, error: null });

    await expect(updateProject('project-1', 'user-1', { cards: [] }, 7)).resolves.toBe(updated);
    expect(mocks.query.eq).toHaveBeenCalledWith('version', 7);
    expect(mocks.query.update).toHaveBeenCalledWith(expect.objectContaining({ version: 8 }));
  });

  it('reports a conflict when another device already changed the version', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(updateProject('project-1', 'user-1', { cards: [] }, 7))
      .rejects.toBeInstanceOf(ProjectVersionConflictError);
  });
});
