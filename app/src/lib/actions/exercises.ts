'use server'

import { createClient } from '@/lib/supabase/server'

export async function searchExercises(userId: string, query: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function getExercisesWithMuscles(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select(`
      *,
      exercise_muscles (
        *,
        muscle_group:muscle_groups (*)
      )
    `)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function getMuscleGroups(_userId?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('muscle_groups')
    .select('*')
    .order('name')

  if (error) throw error
  return data ?? []
}
