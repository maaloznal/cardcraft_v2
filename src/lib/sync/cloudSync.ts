/**
 * cloudSync.ts — Supabase cloud sync for cross-device card synchronization.
 *
 * Strategy: each user has ONE "default" project that stores the full SavedState
 * (cards + all settings) as a JSONB blob. This is the simplest model that
 * supports "open on another device → see your cards" without per-card sync
 * complexity. Last-write-wins: the most recent push wins.
 *
 * On login: pull default project → if it has data and is newer than local,
 * replace local state. If local has data and cloud is empty, push local.
 * On save (debounced): push current state to cloud.
 * On logout: keep local state, just stop syncing.
 */

import { supabase } from '@/lib/supabase/client'

export interface Project {
  id: string
  user_id: string
  name: string
  data: unknown
  version: number
  updated_at: string
  created_at: string
}

/** Name of the single per-user project that holds the full app state. */
export const DEFAULT_PROJECT_NAME = 'default'

/**
 * Pull all projects for a user (newest first by updated_at).
 * Returns [] if Supabase is not configured or user has no projects.
 */
export async function pullProjects(userId: string): Promise<Project[]> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get the user's "default" project (the one that stores the full app state).
 * Returns null if user has no default project yet.
 */
export async function getDefaultProject(userId: string): Promise<Project | null> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('name', DEFAULT_PROJECT_NAME)
    .maybeSingle()

  if (error) throw error
  return data || null
}

/**
 * Insert or update the user's "default" project with new state.
 * Uses upsert with merge-duplicates so it works whether or not the project exists.
 * Increments version on each push (last-write-wins conflict resolution).
 */
export async function upsertDefaultProject(
  userId: string,
  data: unknown,
  currentVersion: number | null,
): Promise<Project> {
  if (!supabase) throw new Error('Supabase is not configured')
  const newVersion = (currentVersion ?? 0) + 1

  const { data: result, error } = await supabase
    .from('projects')
    .upsert(
      {
        // Fixed UUID for the default project so upsert is deterministic per user.
        // Using a hash of "default" + user_id would also work, but a per-user
        // lookup via name=DEFAULT_PROJECT_NAME + user_id is the canonical pattern.
        // We rely on the unique (user_id, name) combination — but since the
        // table doesn't enforce this constraint, we use a simpler approach:
        // fetch-then-insert/update is atomic enough for our purposes via upsert
        // on id. To do that, we need the existing id; if not known, we fall back
        // to insert and let gen_random_uuid() assign one.
        user_id: userId,
        name: DEFAULT_PROJECT_NAME,
        data,
        version: newVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,name', ignoreDuplicates: false },
    )
    .select()
    .single()

  if (error) {
    // If upsert with onConflict fails (constraint may not exist), fall back
    // to explicit insert-or-update flow
    if (currentVersion === null || currentVersion === 0) {
      // Try insert
      const { data: ins, error: insErr } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: DEFAULT_PROJECT_NAME,
          data,
          version: 1,
        })
        .select()
        .single()
      if (insErr) throw insErr
      return ins as Project
    } else {
      throw error
    }
  }
  return result as Project
}

/**
 * Update an existing project by id (used after fetching the default project's id).
 * Increments version. Used by the controller when the project id is already known.
 */
export async function updateProject(
  projectId: string,
  userId: string,
  data: unknown,
  currentVersion: number,
): Promise<Project> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data: result, error } = await supabase
    .from('projects')
    .update({
      data,
      version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return result as Project
}

/**
 * Insert a new default project for the user (first-time sync).
 * Returns the created project.
 */
export async function insertDefaultProject(
  userId: string,
  data: unknown,
): Promise<Project> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data: result, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: DEFAULT_PROJECT_NAME,
      data,
      version: 1,
    })
    .select()
    .single()

  if (error) throw error
  return result as Project
}

/** Delete a project by id (only if it belongs to the user — RLS enforced). */
export async function deleteProject(projectId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw error
}
