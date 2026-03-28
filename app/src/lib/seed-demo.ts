import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Seeds demo data for a user. Call after first login or in demo mode.
 * Expects exercises and muscle_groups to already exist in the database.
 */
export async function seedDemoData(supabase: SupabaseClient, userId: string) {
  // ─── 1. Check if user already has data ────────────────────────────
  const { data: existingPhases } = await supabase
    .from('phases')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existingPhases && existingPhases.length > 0) {
    console.log('User already has data, skipping seed.')
    return
  }

  // ─── 2. Fetch existing exercises by name ──────────────────────────
  const exerciseNames = [
    'Hip Thrust (Barbell)',
    'Lat Pulldown (Cable)',
    'Squat (Smith Machine)',
    'Bench Press (Barbell)',
    'Romanian Deadlift',
    'Hip Abduction (Machine)',
    'Plank',
    'Negative Pull Up',
    'Reverse Lunge (Dumbbell)',
    'Cable Row',
    'Leg Curl (Machine)',
    'Overhead Press (Dumbbell)',
    'Bicep Curl (Dumbbell)',
    'Bulgarian Split Squat',
    'Incline Dumbbell Press',
    'Face Pull (Cable)',
    'Glute Kickback (Cable)',
    'Lateral Raise (Dumbbell)',
    'Tricep Pushdown (Cable)',
    'Leg Press',
  ]

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name')
    .in('name', exerciseNames)

  const exerciseMap = new Map<string, string>()
  if (exercises) {
    for (const e of exercises) {
      exerciseMap.set(e.name, e.id)
    }
  }

  // Helper: get exercise id or null
  const exId = (name: string) => exerciseMap.get(name) ?? null

  // ─── 3. Create macrocycle ─────────────────────────────────────────
  const { data: macrocycle } = await supabase
    .from('macrocycles')
    .insert({
      user_id: userId,
      name: 'Macrociclo 2026',
      year: 2026,
      notes: 'Plan anual: volumen invierno, definicion primavera, mantenimiento verano.',
    })
    .select()
    .single()

  if (!macrocycle) throw new Error('Failed to create macrocycle')

  // ─── 4. Create phases ─────────────────────────────────────────────
  const phasesData = [
    {
      user_id: userId,
      macrocycle_id: macrocycle.id,
      name: 'Volumen Dic-Feb',
      goal: 'build',
      objective: 'Ganar masa muscular en tren inferior. Llegar a 55kg.',
      status: 'completed',
      duration_weeks: 8,
      frequency: 3,
      start_date: '2025-12-01',
      end_date: '2026-01-26',
      focus_muscles: ['glutes', 'quads', 'back'],
      split_type: 'full_body',
      calorie_target: 2000,
      protein_target: 130,
      step_goal: 8000,
      sleep_goal: 8.0,
      outcome_notes: 'Llegue a 54.2kg. Fuerza en hip thrust +10kg. Buena adherencia.',
      display_order: 0,
    },
    {
      user_id: userId,
      macrocycle_id: macrocycle.id,
      name: 'Definicion Q1',
      goal: 'cut',
      objective: 'Llegar a 52.5kg, cintura <66cm. Mantener fuerza en compuestos.',
      status: 'active',
      duration_weeks: 6,
      frequency: 3,
      start_date: '2026-03-23',
      focus_muscles: ['glutes', 'back', 'quads'],
      split_type: 'full_body',
      calorie_target: 1650,
      protein_target: 120,
      carbs_target: 160,
      fat_target: 55,
      step_goal: 10000,
      sleep_goal: 7.5,
      exit_criteria: ['weight_target', 'waist_target', 'strength_maintained'],
      volume_targets: { glutes: 18, quads: 12, back: 14, chest: 6, shoulders: 6, arms: 6 },
      display_order: 1,
    },
    {
      user_id: userId,
      macrocycle_id: macrocycle.id,
      name: 'Mantenimiento Mayo',
      goal: 'maintain',
      objective: 'Mantener composicion durante vacaciones.',
      status: 'planned',
      duration_weeks: 4,
      frequency: 2,
      display_order: 2,
    },
    {
      user_id: userId,
      macrocycle_id: macrocycle.id,
      name: 'Volumen Q3',
      goal: 'build',
      objective: 'Segundo bloque de volumen. Foco en espalda y hombros.',
      status: 'planned',
      duration_weeks: 8,
      frequency: 4,
      display_order: 3,
    },
    {
      user_id: userId,
      macrocycle_id: macrocycle.id,
      name: 'Mini-cut Octubre',
      goal: 'cut',
      objective: 'Cut rapido de 4 semanas pre-verano.',
      status: 'planned',
      duration_weeks: 4,
      frequency: 3,
      display_order: 4,
    },
  ]

  const { data: phases } = await supabase
    .from('phases')
    .insert(phasesData)
    .select()

  if (!phases) throw new Error('Failed to create phases')

  const activePhase = phases.find((p) => p.status === 'active')!

  // ─── 5. Create routines for active phase ──────────────────────────
  const routinesData = [
    { user_id: userId, phase_id: activePhase.id, name: 'Dia A: Fuerza', display_order: 0, estimated_duration_min: 75 },
    { user_id: userId, phase_id: activePhase.id, name: 'Dia B: Hipertrofia', display_order: 1, estimated_duration_min: 70 },
    { user_id: userId, phase_id: activePhase.id, name: 'Dia C: Volumen', display_order: 2, estimated_duration_min: 80 },
  ]

  const { data: routines } = await supabase
    .from('routines')
    .insert(routinesData)
    .select()

  if (!routines) throw new Error('Failed to create routines')

  // ─── 6. Add exercises to routines ─────────────────────────────────
  type SetDef = {
    set_number: number
    rep_range_low: number
    rep_range_high: number
    target_rpe: number
    target_weight: number
    duration_seconds?: number
  }

  type ExDef = {
    name: string
    sets: SetDef[]
    rest_seconds?: number
  }

  const routineExercises: Record<string, ExDef[]> = {
    [routines[0].id]: [
      { name: 'Hip Thrust (Barbell)', rest_seconds: 120, sets: [
        { set_number: 1, rep_range_low: 5, rep_range_high: 7, target_rpe: 8, target_weight: 67.5 },
        { set_number: 2, rep_range_low: 5, rep_range_high: 7, target_rpe: 8, target_weight: 67.5 },
        { set_number: 3, rep_range_low: 5, rep_range_high: 7, target_rpe: 9, target_weight: 70 },
        { set_number: 4, rep_range_low: 5, rep_range_high: 7, target_rpe: 9, target_weight: 70 },
      ]},
      { name: 'Lat Pulldown (Cable)', sets: [
        { set_number: 1, rep_range_low: 8, rep_range_high: 10, target_rpe: 7.5, target_weight: 42.5 },
        { set_number: 2, rep_range_low: 8, rep_range_high: 10, target_rpe: 8, target_weight: 42.5 },
        { set_number: 3, rep_range_low: 8, rep_range_high: 10, target_rpe: 8.5, target_weight: 45 },
      ]},
      { name: 'Squat (Smith Machine)', rest_seconds: 120, sets: [
        { set_number: 1, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 50 },
        { set_number: 2, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 50 },
        { set_number: 3, rep_range_low: 6, rep_range_high: 8, target_rpe: 8.5, target_weight: 50 },
        { set_number: 4, rep_range_low: 6, rep_range_high: 8, target_rpe: 9, target_weight: 50 },
      ]},
      { name: 'Bench Press (Barbell)', sets: [
        { set_number: 1, rep_range_low: 6, rep_range_high: 8, target_rpe: 7.5, target_weight: 30 },
        { set_number: 2, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 30 },
        { set_number: 3, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 30 },
      ]},
      { name: 'Romanian Deadlift', rest_seconds: 90, sets: [
        { set_number: 1, rep_range_low: 8, rep_range_high: 10, target_rpe: 7.5, target_weight: 50 },
        { set_number: 2, rep_range_low: 8, rep_range_high: 10, target_rpe: 8, target_weight: 50 },
        { set_number: 3, rep_range_low: 8, rep_range_high: 10, target_rpe: 8.5, target_weight: 52.5 },
        { set_number: 4, rep_range_low: 8, rep_range_high: 10, target_rpe: 9, target_weight: 52.5 },
      ]},
      { name: 'Hip Abduction (Machine)', rest_seconds: 60, sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 45 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 45 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 45 },
      ]},
      { name: 'Plank', rest_seconds: 60, sets: [
        { set_number: 1, rep_range_low: 45, rep_range_high: 45, target_rpe: 7, target_weight: 0, duration_seconds: 45 },
        { set_number: 2, rep_range_low: 45, rep_range_high: 45, target_rpe: 7, target_weight: 0, duration_seconds: 45 },
        { set_number: 3, rep_range_low: 45, rep_range_high: 45, target_rpe: 7.5, target_weight: 0, duration_seconds: 45 },
      ]},
    ],
    [routines[1].id]: [
      { name: 'Hip Thrust (Barbell)', sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 60 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 60 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 60 },
      ]},
      { name: 'Negative Pull Up', sets: [
        { set_number: 1, rep_range_low: 6, rep_range_high: 6, target_rpe: 8, target_weight: 0 },
        { set_number: 2, rep_range_low: 6, rep_range_high: 6, target_rpe: 8.5, target_weight: 0 },
        { set_number: 3, rep_range_low: 6, rep_range_high: 6, target_rpe: 9, target_weight: 0 },
        { set_number: 4, rep_range_low: 6, rep_range_high: 6, target_rpe: 9.5, target_weight: 0 },
      ]},
      { name: 'Reverse Lunge (Dumbbell)', sets: [
        { set_number: 1, rep_range_low: 10, rep_range_high: 10, target_rpe: 7, target_weight: 12 },
        { set_number: 2, rep_range_low: 10, rep_range_high: 10, target_rpe: 7.5, target_weight: 12 },
        { set_number: 3, rep_range_low: 10, rep_range_high: 10, target_rpe: 8, target_weight: 12 },
      ]},
      { name: 'Cable Row', sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 35 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 7.5, target_weight: 35 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 35 },
        { set_number: 4, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 35 },
      ]},
      { name: 'Leg Curl (Machine)', sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 30 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 7.5, target_weight: 30 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 30 },
      ]},
      { name: 'Overhead Press (Dumbbell)', sets: [
        { set_number: 1, rep_range_low: 10, rep_range_high: 10, target_rpe: 7, target_weight: 8 },
        { set_number: 2, rep_range_low: 10, rep_range_high: 10, target_rpe: 7.5, target_weight: 8 },
        { set_number: 3, rep_range_low: 10, rep_range_high: 10, target_rpe: 8, target_weight: 8 },
      ]},
      { name: 'Bicep Curl (Dumbbell)', sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 8 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 7.5, target_weight: 8 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 8 },
      ]},
    ],
    [routines[2].id]: [
      { name: 'Bulgarian Split Squat', rest_seconds: 90, sets: [
        { set_number: 1, rep_range_low: 8, rep_range_high: 10, target_rpe: 7.5, target_weight: 14 },
        { set_number: 2, rep_range_low: 8, rep_range_high: 10, target_rpe: 8, target_weight: 14 },
        { set_number: 3, rep_range_low: 8, rep_range_high: 10, target_rpe: 8.5, target_weight: 14 },
        { set_number: 4, rep_range_low: 8, rep_range_high: 10, target_rpe: 9, target_weight: 14 },
      ]},
      { name: 'Incline Dumbbell Press', sets: [
        { set_number: 1, rep_range_low: 10, rep_range_high: 12, target_rpe: 7, target_weight: 12 },
        { set_number: 2, rep_range_low: 10, rep_range_high: 12, target_rpe: 7.5, target_weight: 12 },
        { set_number: 3, rep_range_low: 10, rep_range_high: 12, target_rpe: 8, target_weight: 12 },
      ]},
      { name: 'Leg Press', rest_seconds: 120, sets: [
        { set_number: 1, rep_range_low: 10, rep_range_high: 12, target_rpe: 7, target_weight: 100 },
        { set_number: 2, rep_range_low: 10, rep_range_high: 12, target_rpe: 8, target_weight: 100 },
        { set_number: 3, rep_range_low: 10, rep_range_high: 12, target_rpe: 8.5, target_weight: 100 },
        { set_number: 4, rep_range_low: 10, rep_range_high: 12, target_rpe: 9, target_weight: 100 },
      ]},
      { name: 'Face Pull (Cable)', sets: [
        { set_number: 1, rep_range_low: 15, rep_range_high: 15, target_rpe: 7, target_weight: 15 },
        { set_number: 2, rep_range_low: 15, rep_range_high: 15, target_rpe: 7.5, target_weight: 15 },
        { set_number: 3, rep_range_low: 15, rep_range_high: 15, target_rpe: 8, target_weight: 15 },
      ]},
      { name: 'Glute Kickback (Cable)', rest_seconds: 60, sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 10 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 10 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 10 },
        { set_number: 4, rep_range_low: 12, rep_range_high: 15, target_rpe: 8.5, target_weight: 10 },
      ]},
      { name: 'Lateral Raise (Dumbbell)', sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 5 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 5 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 5 },
      ]},
      { name: 'Tricep Pushdown (Cable)', sets: [
        { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 15 },
        { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 15 },
        { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 15 },
      ]},
    ],
  }

  for (const [routineId, exerciseDefs] of Object.entries(routineExercises)) {
    for (let i = 0; i < exerciseDefs.length; i++) {
      const def = exerciseDefs[i]
      const exerciseId = exId(def.name)
      if (!exerciseId) {
        console.warn(`Exercise not found: ${def.name}, skipping`)
        continue
      }

      const { data: re } = await supabase
        .from('routine_exercises')
        .insert({
          routine_id: routineId,
          exercise_id: exerciseId,
          display_order: i,
          rest_seconds: def.rest_seconds ?? 90,
        })
        .select()
        .single()

      if (re) {
        await supabase.from('routine_sets').insert(
          def.sets.map((s) => ({
            routine_exercise_id: re.id,
            set_number: s.set_number,
            rep_range_low: s.rep_range_low,
            rep_range_high: s.rep_range_high,
            target_rpe: s.target_rpe,
            target_weight: s.target_weight,
            duration_seconds: s.duration_seconds ?? null,
          }))
        )
      }
    }
  }

  // ─── 7. Create daily logs for current week ────────────────────────
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const dailyLogData = [
    { offset: 0, calories: 1620, protein_g: 118, carbs_g: 165, fat_g: 52, steps: 8200, sleep_hours: 7.5, energy: 3, hunger: 2, fatigue_level: 2 },
    { offset: 1, calories: 1580, protein_g: 122, carbs_g: 158, fat_g: 50, steps: 9100, sleep_hours: 7.0, energy: 3, hunger: 3, fatigue_level: 2 },
    { offset: 2, calories: 1700, protein_g: 115, carbs_g: 175, fat_g: 58, steps: 7500, sleep_hours: 8.0, energy: 2, hunger: 2, fatigue_level: 3 },
    { offset: 3, calories: 1650, protein_g: 120, carbs_g: 168, fat_g: 54, steps: 8000, sleep_hours: 7.5, energy: 3, hunger: 2, fatigue_level: 2 },
    { offset: 4, calories: 1600, protein_g: 125, carbs_g: 155, fat_g: 53, steps: 10200, sleep_hours: 7.8, energy: 4, hunger: 2, fatigue_level: 1 },
  ]

  // Only insert logs up to today
  const daysFromMonday = Math.floor((today.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24))

  for (const log of dailyLogData) {
    if (log.offset > daysFromMonday) break

    const logDate = new Date(monday)
    logDate.setDate(monday.getDate() + log.offset)
    const dateStr = logDate.toISOString().split('T')[0]

    const { data: dailyLog } = await supabase
      .from('daily_logs')
      .insert({
        user_id: userId,
        log_date: dateStr,
        calories: log.calories,
        protein_g: log.protein_g,
        carbs_g: log.carbs_g,
        fat_g: log.fat_g,
        steps: log.steps,
        sleep_hours: log.sleep_hours,
        energy: log.energy,
        hunger: log.hunger,
        fatigue_level: log.fatigue_level,
      })
      .select()
      .single()

    // Add fatigue entries for Wednesday (offset 2) — legs and lower back
    if (dailyLog && log.offset === 2) {
      await supabase.from('fatigue_entries').insert([
        { daily_log_id: dailyLog.id, zone: 'legs' },
        { daily_log_id: dailyLog.id, zone: 'lower_back' },
      ])
    }
  }

  // ─── 8. Create a weekly check-in ─────────────────────────────────
  const weekStartStr = monday.toISOString().split('T')[0]

  const { data: checkin } = await supabase
    .from('weekly_checkins')
    .insert({
      user_id: userId,
      phase_id: activePhase.id,
      week_number: 1,
      checkin_date: weekStartStr,
      weight_kg: 53.7,
      waist_cm: 67.5,
      hip_cm: 92.0,
      thigh_cm: 54.5,
      performance_trend: 'stable',
      avg_calories: 1638,
      avg_protein: 119,
      avg_steps: 8200,
      avg_sleep_hours: 7.6,
      avg_energy: 2.8,
      avg_hunger: 2.2,
      avg_fatigue: 2.0,
      fatigue_map: { legs: 2, lower_back: 1 },
      training_sets_planned: 74,
      training_sets_executed: 72,
      training_adherence: 97.3,
      nutrition_adherence: 94.0,
      weekly_score: 88,
      score_breakdown: {
        training: 97,
        nutrition: 94,
        steps: 82,
        sleep: 95,
      },
    })
    .select()
    .single()

  if (checkin) {
    await supabase.from('weekly_decisions').insert({
      checkin_id: checkin.id,
      user_id: userId,
      volume_decisions: ['Agregar 2 series de Cable Kickback al Dia C'],
      nutrition_decisions: ['Mantener calorias en 1650', 'Subir proteina a 125g'],
      phase_decisions: ['Continuar fase sin cambios'],
      context_snapshot: {
        weight_kg: 53.7,
        waist_cm: 67.5,
        weekly_score: 88,
        week_number: 1,
      },
    })
  }

  // ─── 9. Create insights ───────────────────────────────────────────
  await supabase.from('insights').insert([
    {
      user_id: userId,
      phase_id: activePhase.id,
      week_number: 1,
      insight_type: 'volume_deficit',
      severity: 'warning',
      title: 'Deficit de volumen de gluteos',
      body: '6 series debajo del objetivo semanal. Considera agregar Hip Abduction o Cable Kickbacks al Dia C.',
      suggestion: 'Agregar 2 series de Cable Kickback al Dia C.',
    },
    {
      user_id: userId,
      phase_id: activePhase.id,
      week_number: 1,
      insight_type: 'progression',
      severity: 'info',
      title: 'Hip Thrust listo para progresar',
      body: 'Ultimas 3 sesiones completadas a RPE 8 con 70kg. Listo para probar 72.5kg.',
      suggestion: 'Subir peso a 72.5kg en proxima sesion.',
    },
    {
      user_id: userId,
      phase_id: activePhase.id,
      week_number: 1,
      insight_type: 'stall',
      severity: 'warning',
      title: 'Squat (Smith) estancado',
      body: 'Sin progresion en 3 semanas a 50kg. Considerar revisar tecnica o hacer un deload.',
      suggestion: 'Hacer deload a 42.5kg por 1 semana, luego retomar.',
    },
  ])

  // ─── 10. Create learn resources ───────────────────────────────────
  await supabase.from('learn_resources').insert([
    {
      user_id: userId,
      title: 'Hip Thrust: Guia de Tecnica',
      resource_type: 'article',
      source: 'Bret Contreras',
      url: 'https://bretcontreras.com/hip-thrust-guide',
      tags: ['glutes', 'tecnica', 'compuesto'],
      is_pinned: true,
    },
    {
      user_id: userId,
      title: 'Periodizacion para naturales',
      resource_type: 'video',
      source: 'Jeff Nippard',
      url: 'https://youtube.com/watch?v=example',
      tags: ['programacion', 'periodizacion'],
      is_pinned: false,
    },
    {
      user_id: userId,
      title: 'Guia de deficit calorico',
      resource_type: 'note',
      content: 'Deficit de 300-500kcal para perder 0.5-1% peso corporal por semana. Proteina a 1.6-2.2g/kg.',
      tags: ['nutricion', 'definicion'],
      is_pinned: true,
    },
  ])

  console.log('Demo data seeded successfully!')
}
