'use server'

import { createClient } from '@/lib/supabase/server'
import type { RoutineInsert, RoutineSetInsert } from '@/lib/supabase/types'

export async function getRoutinesForPhase(phaseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('routines')
    .select(`
      *,
      routine_exercises (
        *,
        exercise:exercises (*),
        routine_sets (*)
      )
    `)
    .eq('phase_id', phaseId)
    .order('display_order', { ascending: true })

  if (error) throw error

  // Sort nested exercises and sets
  return (data ?? []).map((routine) => ({
    ...routine,
    routine_exercises: (routine.routine_exercises ?? [])
      .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
      .map((re: { routine_sets?: { set_number: number }[] }) => ({
        ...re,
        routine_sets: (re.routine_sets ?? []).sort(
          (a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number
        ),
      })),
  }))
}

export async function createRoutine(data: RoutineInsert) {
  const supabase = await createClient()
  const { data: routine, error } = await supabase
    .from('routines')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return routine
}

export async function updateRoutine(id: string, data: Partial<RoutineInsert>) {
  const supabase = await createClient()
  const { data: routine, error } = await supabase
    .from('routines')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return routine
}

export async function deleteRoutine(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function addExerciseToRoutine(
  routineId: string,
  exerciseId: string,
  sets: Omit<RoutineSetInsert, 'routine_exercise_id'>[]
) {
  const supabase = await createClient()

  // Get current max display_order
  const { data: existing } = await supabase
    .from('routine_exercises')
    .select('display_order')
    .eq('routine_id', routineId)
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0

  // Insert the routine exercise
  const { data: routineExercise, error: reError } = await supabase
    .from('routine_exercises')
    .insert({
      routine_id: routineId,
      exercise_id: exerciseId,
      display_order: nextOrder,
    })
    .select()
    .single()

  if (reError) throw reError

  // Insert the sets
  if (sets.length > 0) {
    const { error: setsError } = await supabase
      .from('routine_sets')
      .insert(
        sets.map((s) => ({
          ...s,
          routine_exercise_id: routineExercise.id,
        }))
      )

    if (setsError) throw setsError
  }

  return routineExercise
}

export async function updateRoutineExercise(
  id: string,
  data: { notes?: string; rest_seconds?: number }
) {
  const supabase = await createClient()
  const { data: routineExercise, error } = await supabase
    .from('routine_exercises')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return routineExercise
}

export async function removeExerciseFromRoutine(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('routine_exercises')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function reorderExercises(routineId: string, exerciseIds: string[]) {
  const supabase = await createClient()

  // Update each exercise's display_order
  const updates = exerciseIds.map((id, index) =>
    supabase
      .from('routine_exercises')
      .update({ display_order: index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('routine_id', routineId)
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}
