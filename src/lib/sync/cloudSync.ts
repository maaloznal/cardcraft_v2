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

export async function pushProject(project: {
  id: string
  name: string
  data: unknown
  version: number
}, userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.from('projects').upsert({
    id: project.id,
    user_id: userId,
    name: project.name,
    data: project.data,
    version: project.version,
    updated_at: new Date().toISOString(),
  })

  if (error) throw error
}

export async function deleteProject(projectId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw error
}
