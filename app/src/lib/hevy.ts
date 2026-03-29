const HEVY_BASE_URL = 'https://api.hevyapp.com/v1'
const DEV_API_KEY = '2a89c282-5b29-4523-94d1-3bac5c9a7386'

function getApiKey(): string {
  return process.env.HEVY_API_KEY || DEV_API_KEY
}

async function hevyFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${HEVY_BASE_URL}/${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const res = await fetch(url.toString(), {
    headers: {
      'api-key': getApiKey(),
      'Accept': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Hevy API error ${res.status}: ${text}`)
  }

  return res.json()
}

// ─── Types ──────────────────────────────────────────────────────────

export interface HevySet {
  index: number
  type: string
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
  rpe: number | null
  custom_metric: number | null
}

export interface HevyExercise {
  index: number
  title: string
  notes: string
  exercise_template_id: string
  superset_id: string | null
  sets: HevySet[]
}

export interface HevyWorkout {
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

export interface HevyWorkoutsResponse {
  page: number
  page_count: number
  workouts: HevyWorkout[]
}

export interface HevyRoutineExercise {
  index: number
  title: string
  notes: string
  exercise_template_id: string
  superset_id: string | null
  sets: HevySet[]
}

export interface HevyRoutine {
  id: string
  title: string
  created_at: string
  updated_at: string
  exercises: HevyRoutineExercise[]
}

export interface HevyRoutinesResponse {
  page: number
  page_count: number
  routines: HevyRoutine[]
}

export interface HevyExerciseTemplate {
  id: string
  title: string
  type: string
  primary_muscle_group: string
  secondary_muscle_groups: string[]
  is_custom: boolean
}

export interface HevyExerciseTemplatesResponse {
  page: number
  page_count: number
  exercise_templates: HevyExerciseTemplate[]
}

// ─── API functions ──────────────────────────────────────────────────

export async function fetchHevyWorkouts(
  page: number = 1,
  pageSize: number = 5
): Promise<HevyWorkoutsResponse> {
  return hevyFetch<HevyWorkoutsResponse>('workouts', {
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
}

export async function fetchHevyRoutines(): Promise<HevyRoutinesResponse> {
  return hevyFetch<HevyRoutinesResponse>('routines', {
    page: '1',
    pageSize: '10',
  })
}

export async function fetchHevyExerciseTemplates(
  page: number = 1
): Promise<HevyExerciseTemplatesResponse> {
  return hevyFetch<HevyExerciseTemplatesResponse>('exercise_templates', {
    page: page.toString(),
    pageSize: '10',
  })
}
