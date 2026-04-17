// Aggregate sets per muscle group for a user across a date range.
// Used by the "Esta semana" dashboard block to show target vs actual volume.

import type { SupabaseClient } from '@supabase/supabase-js'

// DB muscle names (Spanish, singular) → doc plan names (matches MUSCLE_VOLUME_PROGRESSION keys)
const MUSCLE_NAME_MAP: Record<string, string> = {
  'Glúteo': 'Glúteos',
  'Gluteo': 'Glúteos',
  'glutes': 'Glúteos',
  'Espalda': 'Espalda',
  'back': 'Espalda',
  'lats': 'Espalda',
  'upper_back': 'Espalda',
  'Cuádriceps': 'Cuádriceps',
  'Cuadriceps': 'Cuádriceps',
  'quadriceps': 'Cuádriceps',
  'Femoral': 'Isquiotibiales',
  'hamstrings': 'Isquiotibiales',
  'Hombro': 'Hombros',
  'shoulders': 'Hombros',
  'Bíceps': 'Bíceps',
  'Biceps': 'Bíceps',
  'biceps': 'Bíceps',
  'Tríceps': 'Tríceps',
  'Triceps': 'Tríceps',
  'triceps': 'Tríceps',
  'Pecho': 'Pecho',
  'chest': 'Pecho',
}

export function normalizeMuscleName(raw: string | null | undefined): string | null {
  if (!raw) return null
  return MUSCLE_NAME_MAP[raw] ?? null
}

export interface MuscleSetCount {
  muscle: string   // normalized name matching MUSCLE_VOLUME_PROGRESSION
  sets: number
}

interface FetchedSet {
  executed_exercise: {
    exercise: {
      exercise_muscles: {
        factor: number | null
        is_primary: boolean | null
        muscle_groups: { name: string } | null
      }[] | null
    } | null
  } | null
}

// Count sets per muscle for a user across [startDate, endDate] (inclusive, YYYY-MM-DD).
// Each set contributes `factor` (default 1 if null) to each muscle it targets.
// Returns a map keyed by normalized muscle name. Unmapped muscles are dropped.
export async function getWeeklyVolumeByMuscle(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  // Step 1: get executed_sessions for the week
  const { data: sessions } = await supabase
    .from('executed_sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('session_date', startDate)
    .lte('session_date', endDate)

  if (!sessions || sessions.length === 0) return {}

  const sessionIds = sessions.map(s => s.id)

  // Step 2: get all executed_exercises + their exercise.exercise_muscles + muscle_groups
  const { data: exercises } = await supabase
    .from('executed_exercises')
    .select(`
      id,
      exercise_id,
      exercises:exercise_id (
        exercise_muscles ( factor, is_primary, muscle_groups ( name ) )
      )
    `)
    .in('executed_session_id', sessionIds)

  if (!exercises || exercises.length === 0) return {}

  const exerciseIds = exercises.map(e => e.id)

  // Step 3: count sets per executed_exercise
  const { data: allSets } = await supabase
    .from('executed_sets')
    .select('executed_exercise_id')
    .in('executed_exercise_id', exerciseIds)

  const setCountByExercise: Record<string, number> = {}
  for (const s of allSets ?? []) {
    setCountByExercise[s.executed_exercise_id] = (setCountByExercise[s.executed_exercise_id] ?? 0) + 1
  }

  // Step 4: for each exercise, distribute its sets across its muscles (weighted by factor)
  const volumeByMuscle: Record<string, number> = {}
  for (const ex of exercises as unknown as Array<{
    id: string
    exercises: { exercise_muscles: Array<{ factor: number | null; is_primary: boolean | null; muscle_groups: { name: string } | null }> } | null
  }>) {
    const setCount = setCountByExercise[ex.id] ?? 0
    if (setCount === 0) continue

    const muscles = ex.exercises?.exercise_muscles ?? []
    for (const em of muscles) {
      const name = em.muscle_groups?.name
      const normalized = normalizeMuscleName(name)
      if (!normalized) continue
      const factor = em.factor ?? (em.is_primary ? 1 : 0.5)
      volumeByMuscle[normalized] = (volumeByMuscle[normalized] ?? 0) + setCount * factor
    }
  }

  // Round to 1 decimal for display
  const rounded: Record<string, number> = {}
  for (const [k, v] of Object.entries(volumeByMuscle)) {
    rounded[k] = Math.round(v * 10) / 10
  }
  return rounded
}
