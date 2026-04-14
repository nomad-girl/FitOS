import { NextRequest, NextResponse } from 'next/server'

const HEVY_BASE_URL = 'https://api.hevyapp.com/v1'
const HEVY_API_KEY = process.env.HEVY_API_KEY

export async function GET(request: NextRequest) {
  if (!HEVY_API_KEY) {
    return NextResponse.json({ error: 'No API key' }, { status: 500 })
  }

  // Fetch most recent workout
  const res = await fetch(`${HEVY_BASE_URL}/workouts?page=1&page_size=3`, {
    headers: { 'api-key': HEVY_API_KEY, 'Accept': 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Hevy ${res.status}` }, { status: res.status })
  }

  const data = await res.json()

  // For each workout, show full set details and our volume calculation
  const analysis = data.workouts.map((w: any) => {
    let volumeAll = 0
    let volumeNormalOnly = 0
    let volumeRawWeightOnly = 0
    const exerciseDetails = w.exercises.map((ex: any) => {
      const sets = ex.sets.map((s: any) => {
        const rawVol = (s.weight_kg ?? 0) * (s.reps ?? 0)
        volumeRawWeightOnly += rawVol
        if (s.reps) {
          const w60 = (s.weight_kg != null && s.weight_kg > 0) ? s.weight_kg : 60
          volumeAll += w60 * s.reps
        }
        if (s.type === 'normal' && s.reps) {
          const w60 = (s.weight_kg != null && s.weight_kg > 0) ? s.weight_kg : 60
          volumeNormalOnly += w60 * s.reps
        }
        return {
          type: s.type,
          weight_kg: s.weight_kg,
          reps: s.reps,
          rpe: s.rpe,
          is_pr: s.is_personal_record,
          raw_volume: rawVol,
        }
      })
      return { title: ex.title, template_id: ex.exercise_template_id, sets }
    })

    return {
      id: w.id,
      title: w.title,
      date: w.start_time,
      // Show ALL fields from the workout object (maybe there's a volume field?)
      all_workout_keys: Object.keys(w),
      volume_field_if_exists: w.volume_kg ?? w.volume ?? w.total_volume ?? null,
      our_calc_all_sets_with_bw60: Math.round(volumeAll * 10) / 10,
      our_calc_raw_weight_only: Math.round(volumeRawWeightOnly * 10) / 10,
      our_calc_normal_only_bw60: Math.round(volumeNormalOnly * 10) / 10,
      exercises: exerciseDetails,
    }
  })

  return NextResponse.json(analysis, { status: 200 })
}
