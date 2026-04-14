/**
 * Backfill training metrics from executed_sessions into daily_logs.
 * Uses the total_volume_kg from executed_sessions (calculated by sync from Hevy API)
 * rather than recalculating from stored sets (which may be incomplete for older data).
 */
import { createClient } from '@/lib/supabase/client'
import { classifyStimulus } from '@/lib/recovery'

export async function backfillTrainingData(userId: string): Promise<number> {
  const supabase = createClient()

  const { data: sessions } = await supabase
    .from('executed_sessions')
    .select(`
      id,
      session_date,
      total_volume_kg,
      notes,
      hevy_workout_id,
      executed_exercises (
        id,
        exercise_name,
        executed_sets (
          weight_kg,
          reps,
          rpe
        )
      )
    `)
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(30)

  if (!sessions || sessions.length === 0) return 0

  let updated = 0

  for (const session of sessions) {
    const exercises = (session.executed_exercises ?? []) as Array<{
      id: string
      exercise_name: string | null
      executed_sets: Array<{ weight_kg: number | null; reps: number | null; rpe: number | null }>
    }>

    // Compute RPE metrics from stored sets
    const allSets = exercises.flatMap(ex => ex.executed_sets ?? [])
    const rpes = allSets.map(s => s.rpe).filter((r): r is number => r != null)
    const rpeAvg = rpes.length > 0
      ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
      : null
    const rpeMax = rpes.length > 0 ? Math.max(...rpes) : null
    const totalSets = allSets.length
    const stimulus = classifyStimulus(rpeAvg, rpeMax, 0)

    // Use the total_volume_kg from the session (set by sync from Hevy API)
    // This is the authoritative value — don't recalculate from incomplete stored sets
    const volume = session.total_volume_kg

    const trainingFields = {
      training_name: session.notes || 'Entrenamiento',
      training_volume_kg: volume,
      training_sets: totalSets,
      training_rpe_avg: rpeAvg,
      training_rpe_max: rpeMax,
      training_stimulus: stimulus,
    }

    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('log_date', session.session_date)
      .single()

    if (existingLog) {
      await supabase
        .from('daily_logs')
        .update(trainingFields)
        .eq('id', existingLog.id)
      updated++
    } else {
      await supabase
        .from('daily_logs')
        .insert({
          user_id: userId,
          log_date: session.session_date,
          ...trainingFields,
        })
      updated++
    }
  }

  return updated
}
