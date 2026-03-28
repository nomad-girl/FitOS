'use server'

import { createClient } from '@/lib/supabase/server'
import type { LearnResourceInsert } from '@/lib/supabase/types'

export async function getResources(
  userId: string,
  filters?: { type?: string; tag?: string; pinned?: boolean }
) {
  const supabase = await createClient()
  let query = supabase
    .from('learn_resources')
    .select('*')
    .eq('user_id', userId)

  if (filters?.type) {
    query = query.eq('resource_type', filters.type)
  }
  if (filters?.tag) {
    query = query.contains('tags', [filters.tag])
  }
  if (filters?.pinned !== undefined) {
    query = query.eq('is_pinned', filters.pinned)
  }

  const { data, error } = await query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createResource(data: LearnResourceInsert) {
  const supabase = await createClient()
  const { data: resource, error } = await supabase
    .from('learn_resources')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return resource
}

export async function togglePin(id: string) {
  const supabase = await createClient()

  // First get current pinned state
  const { data: current, error: fetchError } = await supabase
    .from('learn_resources')
    .select('is_pinned')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const { data, error } = await supabase
    .from('learn_resources')
    .update({
      is_pinned: !current.is_pinned,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
