import { createClient } from '@/lib/supabase/client'
import { dateToLocal } from '@/lib/date-utils'
import { classifyStimulus } from '@/lib/recovery'

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
  const { data: existing } = await supabase
    .from('exercise_mappings')
    .select('exercise_id')
    .eq('user_id', userId)
    .eq('hevy_exercise_id', hevyExercise.exercise_template_id)
    .single()

  if (existing?.exercise_id) return existing.exercise_id

  const normalizedTitle = hevyExercise.title.trim()
  const { data: matches } = await supabase
    .from('exercises')
    .select('id, name')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .ilike('name', `%${normalizedTitle}%`)
    .limit(1)

  const matchedExerciseId = matches?.[0]?.id ?? null

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

// ─── Volume helper ───────────────────────────────────────────────
/** Calculate total volume: weight * reps for all sets.
 *  For bodyweight exercises (weight_kg=0 or null), uses userWeight. */
function calcVolume(workout: HevyWorkout, userWeight: number): number {
  let total = 0
  for (const ex of workout.exercises) {
    for (const set of ex.sets) {
      if (set.reps) {
        const w = (set.weight_kg != null && set.weight_kg > 0) ? set.weight_kg : userWeight
        total += w * set.reps
      }
    }
  }
  return Math.round(total * 10) / 10
}

// ─── PR detection from exercise history ──────────────────────────
/** Detect PRs Hevy-style: per exercise + rep count.
 *  A record = best weight at that rep count. First time = new record too. */
function countPRsFromHistory(
  workout: HevyWorkout,
  exerciseBests: Map<string, { weight: number; reps: number }>
): number {
  let prCount = 0

  for (const ex of workout.exercises) {
    for (const set of ex.sets) {
      if (set.type === 'warmup') continue
      const w = set.weight_kg ?? 0
      const r = set.reps ?? 0
      if (r <= 0) continue

      const key = `${ex.exercise_template_id}:${r}`
      const prev = exerciseBests.get(key)

      if (!prev) {
        // First time at this rep count = new record
        prCount++
        exerciseBests.set(key, { weight: w, reps: r })
      } else if (w > prev.weight) {
        // Beat previous best = new record
        prCount++
        exerciseBests.set(key, { weight: w, reps: r })
      }
    }
  }

  return prCount
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

    // Fetch user weight for bodyweight exercise volume calculation
    const { data: latestCheckin } = await supabase
      .from('weekly_checkins')
      .select('weight_kg')
      .eq('user_id', userId)
      .not('weight_kg', 'is', null)
      .order('checkin_date', { ascending: false })
      .limit(1)
      .single()
    const userWeight = latestCheckin?.weight_kg ?? 60

    // Fetch first 3 pages (most recent workouts)
    const pagesToFetch = 3
    const allWorkouts: HevyWorkout[] = []

    for (let page = 1; page <= pagesToFetch; page++) {
      const response = await fetchHevyWorkouts(page, 5)
      allWorkouts.push(...response.workouts)
      if (page >= response.page_count) break
    }

    onProgress?.(`Se encontraron ${allWorkouts.length} workouts. Sincronizando...`)

    // Sort workouts chronologically (oldest first) so PRs build correctly
    allWorkouts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    // ─── Pre-fetch muscle groups for every unique exercise template ──
    // Hevy returns one primary_muscle_group + secondary_muscle_groups[] per
    // template; we cache both to store directly on executed_exercises.
    const uniqueTemplateIds = [...new Set(
      allWorkouts.flatMap(w => w.exercises.map(e => e.exercise_template_id))
    )]
    const templateMuscleMap = new Map<string, { primary: string | null; secondary: string[] }>()
    for (const templateId of uniqueTemplateIds) {
      try {
        const params = new URLSearchParams({ endpoint: `exercise_templates/${templateId}` })
        const res = await fetch(`/api/hevy?${params.toString()}`)
        if (res.ok) {
          const tmpl = await res.json()
          templateMuscleMap.set(templateId, {
            primary: tmpl.primary_muscle_group ?? null,
            secondary: Array.isArray(tmpl.secondary_muscle_groups) ? tmpl.secondary_muscle_groups : [],
          })
        } else {
          templateMuscleMap.set(templateId, { primary: null, secondary: [] })
        }
      } catch {
        templateMuscleMap.set(templateId, { primary: null, secondary: [] })
      }
    }

    // Build exercise bests from DB history (workouts BEFORE the ones we're syncing)
    const oldestDate = allWorkouts.length > 0
      ? dateToLocal(new Date(allWorkouts[0].start_time))
      : dateToLocal(new Date())

    const { data: prHistory } = await supabase
      .from('executed_sessions')
      .select(`
        session_date,
        executed_exercises (
          exercise_name,
          executed_sets ( weight_kg, reps )
        )
      `)
      .eq('user_id', userId)
      .lt('session_date', oldestDate)
      .order('session_date', { ascending: true })

    // Build initial bests map from older sessions
    const exerciseBests = new Map<string, { weight: number; reps: number }>()

    // We need exercise_template_id but stored data uses exercise_name.
    // Build a name→templateId mapping from current workouts
    const nameToTemplateId = new Map<string, string>()
    for (const w of allWorkouts) {
      for (const ex of w.exercises) {
        nameToTemplateId.set(ex.title, ex.exercise_template_id)
      }
    }

    if (prHistory) {
      for (const session of prHistory) {
        for (const ex of (session.executed_exercises ?? []) as any[]) {
          const templateId = nameToTemplateId.get(ex.exercise_name)
          if (!templateId) continue
          for (const s of (ex.executed_sets ?? []) as any[]) {
            const w = s.weight_kg ?? 0
            const r = s.reps ?? 0
            const prev = exerciseBests.get(templateId)
            if (!prev || w > prev.weight || (w === prev.weight && r > prev.reps)) {
              exerciseBests.set(templateId, { weight: w, reps: r })
            }
          }
        }
      }
    }

    // Process workouts chronologically
    for (const workout of allWorkouts) {
      try {
        const recalcVolume = calcVolume(workout, userWeight)
        const prCount = countPRsFromHistory(workout, exerciseBests)

        // Check if already imported
        const { data: existingSession } = await supabase
          .from('executed_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('hevy_workout_id', workout.id)
          .single()

        if (existingSession) {
          // Update volume and PR count
          const sessionDate = dateToLocal(new Date(workout.start_time))
          await Promise.all([
            supabase
              .from('executed_sessions')
              .update({ total_volume_kg: recalcVolume })
              .eq('id', existingSession.id),
            supabase
              .from('daily_logs')
              .update({ training_volume_kg: recalcVolume, pr_count: prCount > 0 ? prCount : null })
              .eq('user_id', userId)
              .eq('log_date', sessionDate),
          ])
          result.skipped++
          continue
        }

        // ─── New session ──────────────────────────────────────
        const startTime = new Date(workout.start_time)
        const endTime = new Date(workout.end_time)
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / 60000
        )

        const sessionDate = dateToLocal(startTime)
        const { data: session, error: sessionError } = await supabase
          .from('executed_sessions')
          .insert({
            user_id: userId,
            hevy_workout_id: workout.id,
            session_date: sessionDate,
            duration_minutes: durationMinutes,
            total_volume_kg: recalcVolume,
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
          const exerciseId = await getOrCreateMapping(supabase, userId, hevyExercise)

          const muscleInfo = templateMuscleMap.get(hevyExercise.exercise_template_id)
          const { data: execExercise, error: exError } = await supabase
            .from('executed_exercises')
            .insert({
              executed_session_id: session.id,
              exercise_id: exerciseId,
              exercise_name: hevyExercise.title,
              hevy_muscle_group: muscleInfo?.primary ?? null,
              hevy_secondary_muscle_groups: muscleInfo?.secondary ?? [],
              display_order: hevyExercise.index,
            })
            .select('id')
            .single()

          if (exError || !execExercise) {
            result.errors.push(`Ejercicio ${hevyExercise.title}: ${exError?.message}`)
            continue
          }

          const allSets = hevyExercise.sets
          if (allSets.length > 0) {
            const setsToInsert = allSets.map((set, idx) => ({
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

        // ─── Enrich daily_log ─────────────────────────────────
        const allSetsFlat = workout.exercises.flatMap(ex => ex.sets)
        const totalSets = allSetsFlat.length // Hevy counts all sets including warmups
        // RPE from working sets only (exclude warmups)
        const workingSets = allSetsFlat.filter(s => s.type !== 'warmup')
        const rpesWithValues = workingSets.map(s => s.rpe).filter((r): r is number => r != null)
        const rpeAvg = rpesWithValues.length > 0
          ? Math.round((rpesWithValues.reduce((a, b) => a + b, 0) / rpesWithValues.length) * 10) / 10
          : null
        const rpeMax = rpesWithValues.length > 0 ? Math.max(...rpesWithValues) : null

        // Muscle groups for daily_log come from the pre-fetched cache (primary only)
        const uniqueMuscleGroups = [...new Set(
          workout.exercises
            .map(ex => templateMuscleMap.get(ex.exercise_template_id)?.primary)
            .filter((m): m is string => !!m)
        )]
        const stimulus = classifyStimulus(rpeAvg, rpeMax, prCount)

        const { data: existingLog } = await supabase
          .from('daily_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('log_date', sessionDate)
          .single()

        const trainingFields = {
          training_name: workout.title || null,
          training_volume_kg: recalcVolume,
          training_sets: totalSets,
          training_rpe_avg: rpeAvg,
          training_rpe_max: rpeMax,
          training_stimulus: stimulus,
          training_muscle_groups: uniqueMuscleGroups.length > 0 ? uniqueMuscleGroups : null,
          pr_count: prCount > 0 ? prCount : null,
        }

        if (existingLog) {
          await supabase.from('daily_logs').update(trainingFields).eq('id', existingLog.id)
        } else {
          await supabase.from('daily_logs').insert({ user_id: userId, log_date: sessionDate, ...trainingFields })
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

    await supabase
      .from('profiles')
      .update({ hevy_sync_status: 'error' })
      .eq('id', userId)
  }

  return result
}
