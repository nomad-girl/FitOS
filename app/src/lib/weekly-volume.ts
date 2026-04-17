// Aggregate sets per muscle group for a user across a date range.
// Used by the "Esta semana" dashboard block to show target vs actual volume.
//
// Source of truth: executed_exercises.hevy_muscle_group (filled by sync from
// Hevy's exercise_template.primary_muscle_group). Falls back to null otherwise.

import type { SupabaseClient } from '@supabase/supabase-js'

// Hevy muscle names (snake_case, lowercase) → plan muscle names
// (matches keys in MUSCLE_VOLUME_PROGRESSION).
// Plus a few Spanish variants in case we ever write to the column from the UI.
const MUSCLE_NAME_MAP: Record<string, string> = {
  // Hevy — glutes family
  glutes: 'Glúteos',
  abductors: 'Glúteos',
  // Hevy — quads
  quadriceps: 'Cuádriceps',
  // Hevy — hamstrings
  hamstrings: 'Isquiotibiales',
  // Hevy — back
  lats: 'Espalda',
  upper_back: 'Espalda',
  lower_back: 'Espalda',
  traps: 'Hombros', // trapezius — goes with shoulders in our split
  // Hevy — arms
  biceps: 'Bíceps',
  forearms: 'Bíceps',
  triceps: 'Tríceps',
  // Hevy — other
  shoulders: 'Hombros',
  chest: 'Pecho',
  // Spanish fallbacks (from exercise_muscles.muscle_groups.name if used)
  'Glúteo': 'Glúteos',
  'Gluteo': 'Glúteos',
  'Glúteos': 'Glúteos',
  'Cuádriceps': 'Cuádriceps',
  'Cuadriceps': 'Cuádriceps',
  'Femoral': 'Isquiotibiales',
  'Isquiotibiales': 'Isquiotibiales',
  'Espalda': 'Espalda',
  'Hombro': 'Hombros',
  'Hombros': 'Hombros',
  'Bíceps': 'Bíceps',
  'Biceps': 'Bíceps',
  'Tríceps': 'Tríceps',
  'Triceps': 'Tríceps',
  'Pecho': 'Pecho',
}

export function normalizeMuscleName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.trim()
  return MUSCLE_NAME_MAP[key] ?? MUSCLE_NAME_MAP[key.toLowerCase()] ?? null
}

// Count sets per muscle for a user across [startDate, endDate] (inclusive, YYYY-MM-DD).
// Each set contributes 1 to the exercise's primary muscle group (Hevy model).
// Returns a map keyed by normalized muscle name. Unmapped muscles are dropped.
export async function getWeeklyVolumeByMuscle(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  // Step 1: sessions for the week
  const { data: sessions } = await supabase
    .from('executed_sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('session_date', startDate)
    .lte('session_date', endDate)

  if (!sessions || sessions.length === 0) return {}
  const sessionIds = sessions.map(s => s.id)

  // Step 2: executed_exercises + primary + secondary muscle groups
  const { data: exercises } = await supabase
    .from('executed_exercises')
    .select('id, hevy_muscle_group, hevy_secondary_muscle_groups')
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

  // Step 4: distribute sets. Primary gets full set; each secondary gets 0.5.
  // This reflects that pulling (lats primary) still works biceps (~50% stimulus),
  // pressing (chest primary) still works triceps, etc.
  const volumeByMuscle: Record<string, number> = {}
  const SECONDARY_FACTOR = 0.5
  for (const ex of exercises as Array<{
    id: string
    hevy_muscle_group: string | null
    hevy_secondary_muscle_groups: string[] | null
  }>) {
    const setCount = setCountByExercise[ex.id] ?? 0
    if (setCount === 0) continue

    // Primary: full count
    const primary = normalizeMuscleName(ex.hevy_muscle_group)
    if (primary) {
      volumeByMuscle[primary] = (volumeByMuscle[primary] ?? 0) + setCount
    }

    // Secondaries: half count each, dedup to our normalized buckets so a single
    // exercise can't double-count into the same bucket (e.g. lats + upper_back
    // both map to Espalda — only count 0.5 once beyond the primary).
    const seenSecondary = new Set<string>()
    if (primary) seenSecondary.add(primary)
    for (const raw of ex.hevy_secondary_muscle_groups ?? []) {
      const norm = normalizeMuscleName(raw)
      if (!norm || seenSecondary.has(norm)) continue
      seenSecondary.add(norm)
      volumeByMuscle[norm] = (volumeByMuscle[norm] ?? 0) + setCount * SECONDARY_FACTOR
    }
  }

  // Round to 1 decimal
  const rounded: Record<string, number> = {}
  for (const [k, v] of Object.entries(volumeByMuscle)) {
    rounded[k] = Math.round(v * 10) / 10
  }
  return rounded
}
