/**
 * cloudSync.ts — Supabase cloud sync for cross-device card synchronization.
 *
 * Each named project stores its cards and editor settings as a JSONB document.
 * The active project is selected locally; RLS restricts cloud rows to their owner.
 * Updates use a monotonically increasing version with last-write-wins sync.
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

export async function getProject(projectId: string, userId: string): Promise<Project | null> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function createProject(userId: string, name: string, data: unknown): Promise<Project> {
  if (!supabase) throw new Error('Supabase is not configured')
  const normalized = name.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (normalized.length < 2) throw new Error('Название должно содержать минимум 2 символа.')
  const { data: duplicates, error: duplicateError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', normalized)
    .limit(1)
  if (duplicateError) throw duplicateError
  if (duplicates?.length) throw new Error('Проект с таким названием уже существует.')

  const { data: result, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, name: normalized, data, version: 1 })
    .select()
    .single()
  if (error) throw error
  return result as Project
}

export async function renameProject(projectId: string, userId: string, name: string): Promise<Project> {
  if (!supabase) throw new Error('Supabase is not configured')
  const normalized = name.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (normalized.length < 2) throw new Error('Название должно содержать минимум 2 символа.')
  const { data: result, error } = await supabase
    .from('projects')
    .update({ name: normalized, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return result as Project
}

/**
 * Update an existing project by id.
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
