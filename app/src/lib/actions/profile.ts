'use server'

import { createClient } from '@/lib/supabase/server'
import type { ProfileUpdate } from '@/lib/supabase/types'

export async function getProfile(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function updateProfile(userId: string, data: ProfileUpdate) {
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return profile
}
