import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Nati's real user ID from the existing profiles table
const DEMO_USER_ID = '4c870837-a1aa-45f9-b91c-91b216b2eaed'

export async function POST(request: Request) {
  try {
    // Protect seed endpoint: only allow in development or with secret header
    const isDev = process.env.NODE_ENV === 'development'
    const seedSecret = request.headers.get('x-seed-secret')
    const validSecret = process.env.SEED_SECRET

    if (!isDev && (!validSecret || seedSecret !== validSecret)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no esta configurada' },
        { status: 500 }
      )
    }

    // Determine user: try body, fall back to Nati's real user
    let userId = DEMO_USER_ID
    const body = await request.json().catch(() => ({}))
    if (body.userId) {
      userId = body.userId
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ─── Check if user already has data ──────────────────────────────
    const { data: existingPhases } = await supabase
      .from('phases')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (existingPhases && existingPhases.length > 0) {
      return NextResponse.json({
        message: 'El usuario ya tiene datos. Seed omitido.',
        skipped: true,
      })
    }

    // ─── 1. Check/create exercises ───────────────────────────────────
    const { data: existingExercises } = await supabase
      .from('exercises')
      .select('id, name')

    const exerciseMap = new Map<string, string>()
    if (existingExercises && existingExercises.length > 0) {
      for (const e of existingExercises) {
        exerciseMap.set(e.name, e.id)
      }
    }

    // Exercises we need for seed. We'll try to match existing ones, or create new ones.
    const neededExercises = [
      { name: 'Hip Thrust con barra', category: 'compound', equipment: 'barbell' },
      { name: 'Jalon al pecho', category: 'compound', equipment: 'cable' },
      { name: 'Sentadilla Smith', category: 'compound', equipment: 'smith_machine' },
      { name: 'Press de banca con barra', category: 'compound', equipment: 'barbell' },
      { name: 'Peso muerto rumano', category: 'compound', equipment: 'barbell' },
      { name: 'Abduccion de cadera (maquina)', category: 'isolation', equipment: 'machine' },
      { name: 'Plancha', category: 'core', equipment: 'bodyweight' },
      { name: 'Dominada negativa', category: 'compound', equipment: 'bodyweight' },
      { name: 'Zancada inversa con mancuernas', category: 'compound', equipment: 'dumbbell' },
      { name: 'Remo con cable', category: 'compound', equipment: 'cable' },
      { name: 'Curl de piernas (maquina)', category: 'isolation', equipment: 'machine' },
      { name: 'Press militar con mancuernas', category: 'compound', equipment: 'dumbbell' },
      { name: 'Curl de biceps con mancuernas', category: 'isolation', equipment: 'dumbbell' },
      { name: 'Sentadilla bulgara', category: 'compound', equipment: 'dumbbell' },
      { name: 'Press inclinado con mancuernas', category: 'compound', equipment: 'dumbbell' },
      { name: 'Face pull con cable', category: 'isolation', equipment: 'cable' },
      { name: 'Patada de gluteo con cable', category: 'isolation', equipment: 'cable' },
      { name: 'Elevacion lateral con mancuernas', category: 'isolation', equipment: 'dumbbell' },
      { name: 'Extension de triceps con cable', category: 'isolation', equipment: 'cable' },
      { name: 'Prensa de piernas', category: 'compound', equipment: 'machine' },
    ]

    // Create missing exercises
    const toInsert = neededExercises.filter((e) => !exerciseMap.has(e.name))
    if (toInsert.length > 0) {
      const { data: inserted } = await supabase
        .from('exercises')
        .insert(
          toInsert.map((e) => ({
            name: e.name,
            category: e.category,
            equipment: e.equipment,
            is_custom: false,
          }))
        )
        .select('id, name')

      if (inserted) {
        for (const e of inserted) {
          exerciseMap.set(e.name, e.id)
        }
      }
    }

    const exId = (name: string) => exerciseMap.get(name) ?? null

    // ─── 2. Create macrocycle ────────────────────────────────────────
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

    if (!macrocycle) {
      return NextResponse.json({ error: 'Error creando macrociclo' }, { status: 500 })
    }

    // ─── 3. Create phases ────────────────────────────────────────────
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

    if (!phases) {
      return NextResponse.json({ error: 'Error creando fases' }, { status: 500 })
    }

    const activePhase = phases.find((p) => p.status === 'active')!

    // ─── 4. Create routines ──────────────────────────────────────────
    const routinesData = [
      { user_id: userId, phase_id: activePhase.id, name: 'Dia A: Fuerza', display_order: 0, estimated_duration_min: 75 },
      { user_id: userId, phase_id: activePhase.id, name: 'Dia B: Hipertrofia', display_order: 1, estimated_duration_min: 70 },
      { user_id: userId, phase_id: activePhase.id, name: 'Dia C: Volumen', display_order: 2, estimated_duration_min: 80 },
    ]

    const { data: routines } = await supabase
      .from('routines')
      .insert(routinesData)
      .select()

    if (!routines) {
      return NextResponse.json({ error: 'Error creando rutinas' }, { status: 500 })
    }

    // ─── 5. Add exercises to routines ────────────────────────────────
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
        { name: 'Hip Thrust con barra', rest_seconds: 120, sets: [
          { set_number: 1, rep_range_low: 5, rep_range_high: 7, target_rpe: 8, target_weight: 67.5 },
          { set_number: 2, rep_range_low: 5, rep_range_high: 7, target_rpe: 8, target_weight: 67.5 },
          { set_number: 3, rep_range_low: 5, rep_range_high: 7, target_rpe: 9, target_weight: 70 },
          { set_number: 4, rep_range_low: 5, rep_range_high: 7, target_rpe: 9, target_weight: 70 },
        ]},
        { name: 'Jalon al pecho', sets: [
          { set_number: 1, rep_range_low: 8, rep_range_high: 10, target_rpe: 7.5, target_weight: 42.5 },
          { set_number: 2, rep_range_low: 8, rep_range_high: 10, target_rpe: 8, target_weight: 42.5 },
          { set_number: 3, rep_range_low: 8, rep_range_high: 10, target_rpe: 8.5, target_weight: 45 },
        ]},
        { name: 'Sentadilla Smith', rest_seconds: 120, sets: [
          { set_number: 1, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 50 },
          { set_number: 2, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 50 },
          { set_number: 3, rep_range_low: 6, rep_range_high: 8, target_rpe: 8.5, target_weight: 50 },
          { set_number: 4, rep_range_low: 6, rep_range_high: 8, target_rpe: 9, target_weight: 50 },
        ]},
        { name: 'Press de banca con barra', sets: [
          { set_number: 1, rep_range_low: 6, rep_range_high: 8, target_rpe: 7.5, target_weight: 30 },
          { set_number: 2, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 30 },
          { set_number: 3, rep_range_low: 6, rep_range_high: 8, target_rpe: 8, target_weight: 30 },
        ]},
        { name: 'Peso muerto rumano', rest_seconds: 90, sets: [
          { set_number: 1, rep_range_low: 8, rep_range_high: 10, target_rpe: 7.5, target_weight: 50 },
          { set_number: 2, rep_range_low: 8, rep_range_high: 10, target_rpe: 8, target_weight: 50 },
          { set_number: 3, rep_range_low: 8, rep_range_high: 10, target_rpe: 8.5, target_weight: 52.5 },
          { set_number: 4, rep_range_low: 8, rep_range_high: 10, target_rpe: 9, target_weight: 52.5 },
        ]},
        { name: 'Abduccion de cadera (maquina)', rest_seconds: 60, sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 45 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 45 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 45 },
        ]},
        { name: 'Plancha', rest_seconds: 60, sets: [
          { set_number: 1, rep_range_low: 45, rep_range_high: 45, target_rpe: 7, target_weight: 0, duration_seconds: 45 },
          { set_number: 2, rep_range_low: 45, rep_range_high: 45, target_rpe: 7, target_weight: 0, duration_seconds: 45 },
          { set_number: 3, rep_range_low: 45, rep_range_high: 45, target_rpe: 7.5, target_weight: 0, duration_seconds: 45 },
        ]},
      ],
      [routines[1].id]: [
        { name: 'Hip Thrust con barra', sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 60 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 60 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 60 },
        ]},
        { name: 'Dominada negativa', sets: [
          { set_number: 1, rep_range_low: 6, rep_range_high: 6, target_rpe: 8, target_weight: 0 },
          { set_number: 2, rep_range_low: 6, rep_range_high: 6, target_rpe: 8.5, target_weight: 0 },
          { set_number: 3, rep_range_low: 6, rep_range_high: 6, target_rpe: 9, target_weight: 0 },
          { set_number: 4, rep_range_low: 6, rep_range_high: 6, target_rpe: 9.5, target_weight: 0 },
        ]},
        { name: 'Zancada inversa con mancuernas', sets: [
          { set_number: 1, rep_range_low: 10, rep_range_high: 10, target_rpe: 7, target_weight: 12 },
          { set_number: 2, rep_range_low: 10, rep_range_high: 10, target_rpe: 7.5, target_weight: 12 },
          { set_number: 3, rep_range_low: 10, rep_range_high: 10, target_rpe: 8, target_weight: 12 },
        ]},
        { name: 'Remo con cable', sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 35 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 7.5, target_weight: 35 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 35 },
          { set_number: 4, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 35 },
        ]},
        { name: 'Curl de piernas (maquina)', sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 30 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 7.5, target_weight: 30 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 30 },
        ]},
        { name: 'Press militar con mancuernas', sets: [
          { set_number: 1, rep_range_low: 10, rep_range_high: 10, target_rpe: 7, target_weight: 8 },
          { set_number: 2, rep_range_low: 10, rep_range_high: 10, target_rpe: 7.5, target_weight: 8 },
          { set_number: 3, rep_range_low: 10, rep_range_high: 10, target_rpe: 8, target_weight: 8 },
        ]},
        { name: 'Curl de biceps con mancuernas', sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 12, target_rpe: 7, target_weight: 8 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 12, target_rpe: 7.5, target_weight: 8 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 12, target_rpe: 8, target_weight: 8 },
        ]},
      ],
      [routines[2].id]: [
        { name: 'Sentadilla bulgara', rest_seconds: 90, sets: [
          { set_number: 1, rep_range_low: 8, rep_range_high: 10, target_rpe: 7.5, target_weight: 14 },
          { set_number: 2, rep_range_low: 8, rep_range_high: 10, target_rpe: 8, target_weight: 14 },
          { set_number: 3, rep_range_low: 8, rep_range_high: 10, target_rpe: 8.5, target_weight: 14 },
          { set_number: 4, rep_range_low: 8, rep_range_high: 10, target_rpe: 9, target_weight: 14 },
        ]},
        { name: 'Press inclinado con mancuernas', sets: [
          { set_number: 1, rep_range_low: 10, rep_range_high: 12, target_rpe: 7, target_weight: 12 },
          { set_number: 2, rep_range_low: 10, rep_range_high: 12, target_rpe: 7.5, target_weight: 12 },
          { set_number: 3, rep_range_low: 10, rep_range_high: 12, target_rpe: 8, target_weight: 12 },
        ]},
        { name: 'Prensa de piernas', rest_seconds: 120, sets: [
          { set_number: 1, rep_range_low: 10, rep_range_high: 12, target_rpe: 7, target_weight: 100 },
          { set_number: 2, rep_range_low: 10, rep_range_high: 12, target_rpe: 8, target_weight: 100 },
          { set_number: 3, rep_range_low: 10, rep_range_high: 12, target_rpe: 8.5, target_weight: 100 },
          { set_number: 4, rep_range_low: 10, rep_range_high: 12, target_rpe: 9, target_weight: 100 },
        ]},
        { name: 'Face pull con cable', sets: [
          { set_number: 1, rep_range_low: 15, rep_range_high: 15, target_rpe: 7, target_weight: 15 },
          { set_number: 2, rep_range_low: 15, rep_range_high: 15, target_rpe: 7.5, target_weight: 15 },
          { set_number: 3, rep_range_low: 15, rep_range_high: 15, target_rpe: 8, target_weight: 15 },
        ]},
        { name: 'Patada de gluteo con cable', rest_seconds: 60, sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 10 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 10 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 10 },
          { set_number: 4, rep_range_low: 12, rep_range_high: 15, target_rpe: 8.5, target_weight: 10 },
        ]},
        { name: 'Elevacion lateral con mancuernas', sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 5 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 5 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 5 },
        ]},
        { name: 'Extension de triceps con cable', sets: [
          { set_number: 1, rep_range_low: 12, rep_range_high: 15, target_rpe: 7, target_weight: 15 },
          { set_number: 2, rep_range_low: 12, rep_range_high: 15, target_rpe: 7.5, target_weight: 15 },
          { set_number: 3, rep_range_low: 12, rep_range_high: 15, target_rpe: 8, target_weight: 15 },
        ]},
      ],
    }

    let exercisesAdded = 0
    let setsAdded = 0

    for (const [routineId, exerciseDefs] of Object.entries(routineExercises)) {
      for (let i = 0; i < exerciseDefs.length; i++) {
        const def = exerciseDefs[i]
        const exerciseId = exId(def.name)
        if (!exerciseId) {
          console.warn(`Ejercicio no encontrado: ${def.name}, saltando`)
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
          exercisesAdded++
          const { data: insertedSets } = await supabase.from('routine_sets').insert(
            def.sets.map((s) => ({
              routine_exercise_id: re.id,
              set_number: s.set_number,
              rep_range_low: s.rep_range_low,
              rep_range_high: s.rep_range_high,
              target_rpe: s.target_rpe,
              target_weight: s.target_weight,
              duration_seconds: s.duration_seconds ?? null,
            }))
          ).select()
          setsAdded += insertedSets?.length ?? 0
        }
      }
    }

    // ─── 6. Daily logs ───────────────────────────────────────────────
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

    const daysFromMonday = Math.floor(
      (today.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)
    )

    let logsCreated = 0

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

      if (dailyLog) {
        logsCreated++
        if (log.offset === 2) {
          await supabase.from('fatigue_entries').insert([
            { daily_log_id: dailyLog.id, zone: 'legs' },
            { daily_log_id: dailyLog.id, zone: 'lower_back' },
          ])
        }
      }
    }

    // ─── 7. Weekly check-in ──────────────────────────────────────────
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

    // ─── 8. Insights ─────────────────────────────────────────────────
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
        title: 'Sentadilla Smith estancada',
        body: 'Sin progresion en 3 semanas a 50kg. Considerar revisar tecnica o hacer un deload.',
        suggestion: 'Hacer deload a 42.5kg por 1 semana, luego retomar.',
      },
    ])

    // ─── 9. Learn resources ──────────────────────────────────────────
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

    return NextResponse.json({
      message: 'Datos de demo cargados exitosamente!',
      seeded: {
        macrocycle: 1,
        phases: phases.length,
        routines: routines.length,
        exercises_in_routines: exercisesAdded,
        sets: setsAdded,
        daily_logs: logsCreated,
        checkin: checkin ? 1 : 0,
        insights: 3,
        learn_resources: 3,
      },
      userId,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
