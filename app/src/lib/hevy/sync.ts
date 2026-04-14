import { createClient } from '@/lib/supabase/client'
import { dateToLocal } from '@/lib/date-utils'
import { classifyStimulus, classifyMuscleZone } from '@/lib/recovery'

// ─── Hevy API types ────────────────────────────────────────────────
interface HevySet {
  index: number
  type: string // "warmup" | "normal" | "dropset" | "failure"
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
  rpe: number | null
  custom_metric: number | null
}

interface HevyExercise {
  index: number
  title: string
  notes: string
  exercise_template_id: string
  superset_id: string | null
  sets: HevySet[]
}

interface HevyWorkout {
  id: string
  title: string
  routine_id: string | null
  description: string
  start_time: string
  end_time: string
  updated_at: string
  created_at: string
  exercises: HevyExercise[]
}

interface HevyWorkoutsResponse {
  page: number
  page_count: number
  workouts: HevyWorkout[]
}

// ─── Fetch workouts from Hevy via our proxy ────────────────────────
async function fetchHevyWorkouts(page: number, pageSize: number = 5): Promise<HevyWorkoutsResponse> {
  const params = new URLSearchParams({
    endpoint: 'workouts',
    page: page.toString(),
    page_size: pageSize.toString(),
  })

  const res = await fetch(`/api/hevy?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Error ${res.status} al consultar Hevy`)
  }
  return res.json()
}

// ─── Find or create exercise mapping ───────────────────────────────
async function getOrCreateMapping(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  hevyExercise: HevyExercise
): Promise<string | null> {
  // Check if we already have a mapping for this Hevy exercise
  const { data: existing } = await supabase
    .from('exercise_mappings')
    .select('exercise_id')
    .eq('user_id', userId)
    .eq('hevy_exercise_id', hevyExercise.exercise_template_id)
    .single()

  if (existing?.exercise_id) {
    return existing.exercise_id
  }

  // Try to match by name (fuzzy: case-insensitive, trimmed)
  const normalizedTitle = hevyExercise.title.trim()
  const { data: matches } = await supabase
    .from('exercises')
    .select('id, name')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .ilike('name', `%${normalizedTitle}%`)
    .limit(1)

  const matchedExerciseId = matches?.[0]?.id ?? null

  // Upsert the mapping
  await supabase.from('exercise_mappings').upsert(
    {
      user_id: userId,
      hevy_exercise_id: hevyExercise.exercise_template_id,
      hevy_exercise_name: normalizedTitle,
      exercise_id: matchedExerciseId,
      is_confirmed: false,
    },
    { onConflict: 'user_id,hevy_exercise_id' }
  )

  return matchedExerciseId
}

// ─── Main sync function ────────────────────────────────────────────
export async function syncHevyWorkouts(
  userId: string,
  onProgress?: (msg: string) => void
): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const supabase = createClient()
  const result = { synced: 0, skipped: 0, errors: [] as string[] }

  try {
    onProgress?.('Consultando workouts en Hevy...')

    // Fetch first 3 pages (most recent workouts)
    const pagesToFetch = 3
    const allWorkouts: HevyWorkout[] = []

    for (let page = 1; page <= pagesToFetch; page++) {
      const response = await fetchHevyWorkouts(page, 5)
      allWorkouts.push(...response.workouts)
      if (page >= response.page_count) break
    }

    onProgress?.(`Se encontraron ${allWorkouts.length} workouts. Sincronizando...`)

    for (const workout of allWorkouts) {
      try {
        // Check if already imported (by hevy_workout_id)
        const { data: existingSession } = await supabase
          .from('executed_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('hevy_workout_id', workout.id)
          .single()

        if (existingSession) {
          result.skipped++
          continue
        }

        // Calculate duration in minutes
        const startTime = new Date(workout.start_time)
        const endTime = new Date(workout.end_time)
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / 60000
        )

        // Calculate total volume (all sets except warmup)
        let totalVolumeKg = 0
        for (const ex of workout.exercises) {
          for (const set of ex.sets) {
            if (set.type !== 'warmup' && set.weight_kg && set.reps) {
              totalVolumeKg += set.weight_kg * set.reps
            }
          }
        }

        // Insert executed_session
        const sessionDate = dateToLocal(startTime)
        const { data: session, error: sessionError } = await supabase
          .from('executed_sessions')
          .insert({
            user_id: userId,
            hevy_workout_id: workout.id,
            session_date: sessionDate,
            duration_minutes: durationMinutes,
            total_volume_kg: Math.round(totalVolumeKg * 10) / 10,
            notes: workout.title || null,
          })
          .select('id')
          .single()

        if (sessionError || !session) {
          result.errors.push(`Sesion ${workout.title}: ${sessionError?.message}`)
          continue
        }

        // Insert exercises & sets
        for (const hevyExercise of workout.exercises) {
          const exerciseId = await getOrCreateMapping(
            supabase,
            userId,
            hevyExercise
          )

          const { data: execExercise, error: exError } = await supabase
            .from('executed_exercises')
            .insert({
              executed_session_id: session.id,
              exercise_id: exerciseId,
              exercise_name: hevyExercise.title,
              display_order: hevyExercise.index,
            })
            .select('id')
            .single()

          if (exError || !execExercise) {
            result.errors.push(`Ejercicio ${hevyExercise.title}: ${exError?.message}`)
            continue
          }

          // Insert sets (only "normal" sets, skip warmups)
          const normalSets = hevyExercise.sets.filter(s => s.type === 'normal')
          if (normalSets.length > 0) {
            const setsToInsert = normalSets.map((set, idx) => ({
              executed_exercise_id: execExercise.id,
              set_number: idx + 1,
              weight_kg: set.weight_kg,
              reps: set.reps,
              rpe: set.rpe,
              duration_seconds: set.duration_seconds,
            }))

            const { error: setsError } = await supabase
              .from('executed_sets')
              .insert(setsToInsert)

            if (setsError) {
              result.errors.push(`Sets de ${hevyExercise.title}: ${setsError.message}`)
            }
          }
        }

        // ─── Enrich daily_log with training metrics ────────────────
        const allNormalSets = workout.exercises.flatMap(ex =>
          ex.sets.filter(s => s.type !== 'warmup')
        )
        const rpesWithValues = allNormalSets.map(s => s.rpe).filter((r): r is number => r != null)
        const rpeAvg = rpesWithValues.length > 0
          ? Math.round((rpesWithValues.reduce((a, b) => a + b, 0) / rpesWithValues.length) * 10) / 10
          : null
        const rpeMax = rpesWithValues.length > 0
          ? Math.max(...rpesWithValues)
          : null
        const totalSets = allNormalSets.length

        // Fetch muscle groups from exercise templates via our proxy
        const muscleGroups: string[] = []
        try {
          for (const ex of workout.exercises) {
            const params = new URLSearchParams({
              endpoint: `exercise_templates/${ex.exercise_template_id}`,
            })
            const res = await fetch(`/api/hevy?${params.toString()}`)
            if (res.ok) {
              const tmpl = await res.json()
              if (tmpl.primary_muscle_group) {
                muscleGroups.push(tmpl.primary_muscle_group)
              }
            }
          }
        } catch {
          // non-critical: muscle groups are best-effort
        }

        const uniqueMuscleGroups = [...new Set(muscleGroups)]
        const stimulus = classifyStimulus(rpeAvg, rpeMax, 0) // PRs computed separately

        // Upsert training fields into daily_log
        const { data: existingLog } = await supabase
          .from('daily_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('log_date', sessionDate)
          .single()

        const trainingFields = {
          training_name: workout.title || null,
          training_volume_kg: Math.round(totalVolumeKg * 10) / 10,
          training_sets: totalSets,
          training_rpe_avg: rpeAvg,
          training_rpe_max: rpeMax,
          training_stimulus: stimulus,
          training_muscle_groups: uniqueMuscleGroups.length > 0 ? uniqueMuscleGroups : null,
        }

        if (existingLog) {
          await supabase
            .from('daily_logs')
            .update(trainingFields)
            .eq('id', existingLog.id)
        } else {
          await supabase
            .from('daily_logs')
            .insert({
              user_id: userId,
              log_date: sessionDate,
              ...trainingFields,
            })
        }

        result.synced++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Workout ${workout.title}: ${msg}`)
      }
    }

    // Update profile sync timestamp
    await supabase
      .from('profiles')
      .update({
        hevy_last_sync_at: new Date().toISOString(),
        hevy_sync_status: result.errors.length > 0 ? 'partial' : 'success',
      })
      .eq('id', userId)

    onProgress?.(
      `Sincronizacion completa: ${result.synced} importados, ${result.skipped} ya existian.`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(msg)
    onProgress?.(`Error: ${msg}`)

    // Update profile with error status
    await supabase
      .from('profiles')
      .update({ hevy_sync_status: 'error' })
      .eq('id', userId)
  }

  return result
}
