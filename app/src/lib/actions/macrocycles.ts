'use server'

import { createClient } from '@/lib/supabase/server'
import type { MacrocycleInsert } from '@/lib/supabase/types'

export async function getMacrocycle(userId: string, year: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('macrocycles')
    .select(`
      *,
      phases (*)
    `)
    .eq('user_id', userId)
    .eq('year', year)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (data && data.phases) {
    data.phases.sort(
      (a: { display_order: number }, b: { display_order: number }) =>
        a.display_order - b.display_order
    )
  }

  return data
}

export async function createMacrocycle(data: MacrocycleInsert) {
  const supabase = await createClient()
  const { data: macrocycle, error } = await supabase
    .from('macrocycles')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return macrocycle
}

export async function updateMacrocycle(
  id: string,
  data: { name?: string; year?: number; notes?: string | null }
) {
  const supabase = await createClient()
  const { data: macrocycle, error } = await supabase
    .from('macrocycles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return macrocycle
}
