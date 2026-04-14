import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const HEVY_BASE_URL = 'https://api.hevyapp.com/v1'
const HEVY_API_KEY = process.env.HEVY_API_KEY!

async function fetchHevy(endpoint: string): Promise<any> {
  const res = await fetch(`${HEVY_BASE_URL}/${endpoint}`, {
    headers: { 'api-key': HEVY_API_KEY, 'Accept': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Hevy ${res.status}`)
  return res.json()
}

function dateToLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const userId = user.id

  // Get user weight
  const { data: checkin } = await supabase
    .from('weekly_checkins')
    .select('weight_kg')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .order('checkin_date', { ascending: false })
    .limit(1)
    .single()
  const userWeight = checkin?.weight_kg ?? 60

  // Fetch ALL Hevy workouts
  const allWorkouts: any[] = []
  for (let page = 1; page <= 10; page++) {
    const data = await fetchHevy(`workouts?page=${page}&page_size=10`)
    allWorkouts.push(...data.workouts)
    if (page >= data.page_count) break
  }

  // Sort chronologically
  allWorkouts.sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  // Build exercise bests for PR detection
  const exerciseBests = new Map<string, { weight: number; reps: number }>()
  const results: any[] = []

  for (const workout of allWorkouts) {
    // Calculate volume
    let volume = 0
    for (const ex of workout.exercises) {
      for (const set of ex.sets) {
        if (set.reps) {
          const w = (set.weight_kg != null && set.weight_kg > 0) ? set.weight_kg : userWeight
          volume += w * set.reps
        }
      }
    }
    volume = Math.round(volume * 10) / 10

    // Calculate PRs — Hevy style: per exercise+rep count
    // E.g. if you beat your best 12-rep weight AND your best 8-rep weight, that's 2 PRs
    let prCount = 0
    for (const ex of workout.exercises) {
      for (const set of ex.sets) {
        if (set.type === 'warmup') continue
        const w = set.weight_kg ?? 0
        const r = set.reps ?? 0
        if (r <= 0) continue
        // Key: exercise + rep count (e.g. "TEMPLATE_ID:12" for 12-rep PR)
        const key = `${ex.exercise_template_id}:${r}`
        const prev = exerciseBests.get(key)
        if (prev) {
          if (w > prev.weight) {
            prCount++
          }
        }
        // Update best (even for first time — first time is NOT a PR)
        if (!prev || w > prev.weight) {
          exerciseBests.set(key, { weight: w, reps: r })
        }
      }
    }

    const sessionDate = dateToLocal(new Date(workout.start_time))

    // Update executed_sessions
    const { data: session } = await supabase
      .from('executed_sessions')
      .select('id, total_volume_kg')
      .eq('user_id', userId)
      .eq('hevy_workout_id', workout.id)
      .single()

    const oldVolume = session?.total_volume_kg

    if (session) {
      await supabase
        .from('executed_sessions')
        .update({ total_volume_kg: volume })
        .eq('id', session.id)
    }

    // Count all sets (including warmups — matching Hevy)
    const totalSets = workout.exercises.reduce((sum: number, ex: any) => sum + ex.sets.length, 0)

    // Update daily_logs
    await supabase
      .from('daily_logs')
      .update({
        training_volume_kg: volume,
        training_sets: totalSets,
        pr_count: prCount > 0 ? prCount : null,
      })
      .eq('user_id', userId)
      .eq('log_date', sessionDate)

    results.push({
      date: sessionDate,
      title: workout.title,
      old_volume: oldVolume,
      new_volume: volume,
      prs: prCount,
      user_weight: userWeight,
    })
  }

  return NextResponse.json({
    user_weight: userWeight,
    workouts_fixed: results.length,
    results,
  })
}
