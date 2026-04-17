// Backfill executed_exercises.hevy_muscle_group from Hevy's
// exercise_template.primary_muscle_group.
//
// Iterates all pages of the user's Hevy workouts, builds a
// (hevy_workout_id, exercise_name) → primary_muscle_group map, then
// UPDATEs matching executed_exercises rows that currently have NULL.

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
  if (!res.ok) throw new Error(`Hevy ${res.status} on ${endpoint}`)
  return res.json()
}

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const userId = user.id

  // 1. Fetch every Hevy workout
  const allWorkouts: any[] = []
  for (let page = 1; page <= 20; page++) {
    const data = await fetchHevy(`workouts?page=${page}&page_size=10`)
    allWorkouts.push(...data.workouts)
    if (page >= data.page_count) break
  }

  // 2. Collect unique template IDs + the title that appeared with each
  const templateIds = new Set<string>()
  for (const w of allWorkouts) {
    for (const ex of w.exercises) templateIds.add(ex.exercise_template_id)
  }

  // 3. Fetch template → { primary, secondary[] }
  const muscleByTemplate = new Map<string, { primary: string | null; secondary: string[] }>()
  for (const id of templateIds) {
    try {
      const tmpl = await fetchHevy(`exercise_templates/${id}`)
      muscleByTemplate.set(id, {
        primary: tmpl.primary_muscle_group ?? null,
        secondary: Array.isArray(tmpl.secondary_muscle_groups) ? tmpl.secondary_muscle_groups : [],
      })
    } catch {
      muscleByTemplate.set(id, { primary: null, secondary: [] })
    }
  }

  // 4. Build (hevy_workout_id, exercise_name) → { primary, secondary[] }
  type Key = string
  const muscleByWorkoutExercise = new Map<Key, { primary: string; secondary: string[] }>()
  for (const w of allWorkouts) {
    for (const ex of w.exercises) {
      const info = muscleByTemplate.get(ex.exercise_template_id)
      if (info?.primary) {
        muscleByWorkoutExercise.set(`${w.id}::${ex.title}`, {
          primary: info.primary,
          secondary: info.secondary,
        })
      }
    }
  }

  // 5. Load all executed_exercises that need filling
  const { data: sessions } = await supabase
    .from('executed_sessions')
    .select('id, hevy_workout_id, executed_exercises(id, exercise_name, hevy_muscle_group)')
    .eq('user_id', userId)
    .not('hevy_workout_id', 'is', null)

  let updated = 0
  let skipped = 0
  const misses: string[] = []

  for (const s of (sessions ?? []) as any[]) {
    for (const ex of (s.executed_exercises ?? []) as any[]) {
      if (ex.hevy_muscle_group) { skipped++; continue }
      const key = `${s.hevy_workout_id}::${ex.exercise_name}`
      const info = muscleByWorkoutExercise.get(key)
      if (!info) { misses.push(key); continue }
      const { error } = await supabase
        .from('executed_exercises')
        .update({
          hevy_muscle_group: info.primary,
          hevy_secondary_muscle_groups: info.secondary,
        })
        .eq('id', ex.id)
      if (!error) updated++
    }
  }

  return NextResponse.json({
    workouts_scanned: allWorkouts.length,
    templates_resolved: muscleByTemplate.size,
    exercises_updated: updated,
    exercises_already_filled: skipped,
    exercises_missed: misses.length,
    misses_sample: misses.slice(0, 10),
  })
}
