/**
 * Backfill training metrics from executed_sessions into daily_logs.
 * Runs once to enrich historical data that was synced before the recovery system.
 */
import { createClient } from '@/lib/supabase/client'
import { classifyStimulus } from '@/lib/recovery'

export async function backfillTrainingData(userId: string): Promise<number> {
  const supabase = createClient()

  // Find all executed_sessions that haven't been backfilled yet
  // (daily_logs where training_name is null but an executed_session exists for that date)
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

    // Compute metrics
    const allSets = exercises.flatMap(ex => ex.executed_sets ?? [])
    const rpes = allSets.map(s => s.rpe).filter((r): r is number => r != null)
    const rpeAvg = rpes.length > 0
      ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
      : null
    const rpeMax = rpes.length > 0 ? Math.max(...rpes) : null
    const totalSets = allSets.length
    const stimulus = classifyStimulus(rpeAvg, rpeMax, 0)

    const trainingFields = {
      training_name: session.notes || 'Entrenamiento',
      training_volume_kg: session.total_volume_kg, // Use stored total from executed_sessions directly
      training_sets: totalSets,
      training_rpe_avg: rpeAvg,
      training_rpe_max: rpeMax,
      training_stimulus: stimulus,
    }

    // Check if daily_log exists for this date
    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('id, training_name')
      .eq('user_id', userId)
      .eq('log_date', session.session_date)
      .single()

    if (existingLog) {
      // Only update if training_name is not already set
      if (!existingLog.training_name) {
        await supabase
          .from('daily_logs')
          .update(trainingFields)
          .eq('id', existingLog.id)
        updated++
      }
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
