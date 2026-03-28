'use server'

import { createClient } from '@/lib/supabase/server'

export async function getActiveInsights(userId: string, phaseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', userId)
    .eq('phase_id', phaseId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function dismissInsight(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insights')
    .update({ is_dismissed: true })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function applyInsight(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insights')
    .update({ is_applied: true })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
