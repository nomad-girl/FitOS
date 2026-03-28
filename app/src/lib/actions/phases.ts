'use server'

import { createClient } from '@/lib/supabase/server'
import type { PhaseInsert, PhaseUpdate } from '@/lib/supabase/types'

export async function getActivePhase(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phases')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getPhases(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phases')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createPhase(data: PhaseInsert) {
  const supabase = await createClient()

  // Deactivate any existing active phase for this user
  if (data.status === 'active') {
    await supabase
      .from('phases')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('user_id', data.user_id)
      .eq('status', 'active')
  }

  const { data: phase, error } = await supabase
    .from('phases')
    .insert({
      ...data,
      status: data.status ?? 'active',
    })
    .select()
    .single()

  if (error) throw error
  return phase
}

export async function updatePhase(id: string, data: PhaseUpdate) {
  const supabase = await createClient()
  const { data: phase, error } = await supabase
    .from('phases')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return phase
}

export async function completePhase(id: string, outcomeNotes?: string) {
  const supabase = await createClient()
  const { data: phase, error } = await supabase
    .from('phases')
    .update({
      status: 'completed',
      end_date: new Date().toISOString().split('T')[0],
      outcome_notes: outcomeNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return phase
}

export async function abandonPhase(id: string) {
  const supabase = await createClient()
  const { data: phase, error } = await supabase
    .from('phases')
    .update({
      status: 'abandoned',
      end_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return phase
}
