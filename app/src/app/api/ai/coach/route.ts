import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// ─── Supabase admin client (service role) ─────────────────────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

// ─── Types ────────────────────────────────────────────────────────
interface CoachRequest {
  userId: string
  analysisType: 'weekly' | 'progress' | 'checkin'
  context?: Record<string, unknown>
}

interface CoachHighlight {
  type: 'pr' | 'warning' | 'insight' | 'milestone'
  title: string
  body: string
}

interface CoachMemory {
  type: 'pattern' | 'observation' | 'milestone'
  content: string
}

interface CoachResponse {
  summary: string
  highlights: CoachHighlight[]
  adherence: { percentage: number; detail: string }
  patterns: string[]
  suggestions: string[]
  newMemories: CoachMemory[]
}

// ─── Data gathering ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gatherUserData(supabase: any, userId: string) {
  const now = new Date()
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Run all queries in parallel
  const [
    profileResult,
    activePhaseResult,
    dailyLogsResult,
    executedSessionsResult,
    weeklyCheckinsResult,
    memoriesResult,
  ] = await Promise.all([
    // Profile
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single(),

    // Active phase
    supabase
      .from('phases')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single(),

    // Daily logs (last 2 weeks)
    supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', twoWeeksAgo)
      .order('log_date', { ascending: false }),

    // Executed sessions with exercises and sets (last 4 weeks)
    supabase
      .from('executed_sessions')
      .select(`
        *,
        executed_exercises (
          *,
          exercise:exercise_id ( id, name, category ),
          executed_sets ( * )
        )
      `)
      .eq('user_id', userId)
      .gte('session_date', fourWeeksAgo)
      .order('session_date', { ascending: false }),

    // Weekly checkins (last 8)
    supabase
      .from('weekly_checkins')
      .select('*')
      .eq('user_id', userId)
      .order('checkin_date', { ascending: false })
      .limit(8),

    // Coach memories
    supabase
      .from('coach_memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Fetch planned routines for active phase (if exists)
  let routines = null
  if (activePhaseResult.data) {
    const { data } = await supabase
      .from('routines')
      .select(`
        *,
        routine_exercises (
          *,
          exercise:exercise_id ( id, name, category ),
          routine_sets ( * )
        )
      `)
      .eq('phase_id', activePhaseResult.data.id)
      .order('display_order', { ascending: true })

    routines = data
  }

  return {
    profile: profileResult.data,
    activePhase: activePhaseResult.data,
    dailyLogs: dailyLogsResult.data ?? [],
    executedSessions: executedSessionsResult.data ?? [],
    routines: routines ?? [],
    weeklyCheckins: weeklyCheckinsResult.data ?? [],
    memories: memoriesResult.data ?? [],
  }
}

// ─── System prompt builder ────────────────────────────────────────
function buildSystemPrompt(
  data: Awaited<ReturnType<typeof gatherUserData>>,
  analysisType: string,
  extraContext?: Record<string, unknown>
): string {
  const { profile, activePhase, dailyLogs, executedSessions, routines, weeklyCheckins, memories } = data

  // Calculate planned sets count
  let totalPlannedSets = 0
  for (const routine of routines) {
    for (const re of (routine as any).routine_exercises ?? []) {
      totalPlannedSets += (re.routine_sets ?? []).length
    }
  }

  // Calculate executed sets count (last 2 weeks to match adherence window)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const recentSessions = executedSessions.filter((s: any) => s.session_date >= twoWeeksAgo)
  let totalExecutedSets = 0
  for (const session of recentSessions) {
    for (const ex of (session as any).executed_exercises ?? []) {
      totalExecutedSets += (ex.executed_sets ?? []).length
    }
  }

  // Calculate expected planned sets for 2 weeks
  const frequency = activePhase?.frequency ?? profile?.training_days_per_week ?? 0
  const plannedSetsPerWeek = frequency > 0 && routines.length > 0
    ? totalPlannedSets * (frequency / routines.length)
    : 0
  const plannedSetsForPeriod = Math.round(plannedSetsPerWeek * 2)

  // Find PRs per exercise (max weight)
  const prMap: Record<string, { weight: number; reps: number; date: string }> = {}
  for (const session of executedSessions) {
    for (const ex of (session as any).executed_exercises ?? []) {
      const exerciseName = ex.exercise?.name ?? 'Desconocido'
      for (const set of ex.executed_sets ?? []) {
        if (set.weight_kg && (!prMap[exerciseName] || set.weight_kg > prMap[exerciseName].weight)) {
          prMap[exerciseName] = {
            weight: set.weight_kg,
            reps: set.reps ?? 0,
            date: (session as any).session_date,
          }
        }
      }
    }
  }

  // Detect stalled exercises (no weight/rep increase in 3+ weeks)
  const exerciseProgressMap: Record<string, { date: string; maxWeight: number; maxReps: number }[]> = {}
  for (const session of executedSessions) {
    for (const ex of (session as any).executed_exercises ?? []) {
      const name = ex.exercise?.name ?? 'Desconocido'
      if (!exerciseProgressMap[name]) exerciseProgressMap[name] = []
      let maxW = 0
      let maxR = 0
      for (const set of ex.executed_sets ?? []) {
        if (set.weight_kg && set.weight_kg > maxW) { maxW = set.weight_kg; maxR = set.reps ?? 0 }
        if (set.weight_kg === maxW && (set.reps ?? 0) > maxR) maxR = set.reps ?? 0
      }
      if (maxW > 0) {
        exerciseProgressMap[name].push({ date: (session as any).session_date, maxWeight: maxW, maxReps: maxR })
      }
    }
  }

  const stalledExercises: string[] = []
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  for (const [name, entries] of Object.entries(exerciseProgressMap)) {
    if (entries.length < 3) continue
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    const recent = sorted.filter(e => e.date >= threeWeeksAgo)
    const older = sorted.filter(e => e.date < threeWeeksAgo)
    if (recent.length > 0 && older.length > 0) {
      const recentMax = Math.max(...recent.map(e => e.maxWeight))
      const olderMax = Math.max(...older.map(e => e.maxWeight))
      const recentMaxReps = Math.max(...recent.filter(e => e.maxWeight === recentMax).map(e => e.maxReps))
      const olderMaxReps = Math.max(...older.filter(e => e.maxWeight === olderMax).map(e => e.maxReps))
      if (recentMax <= olderMax && recentMaxReps <= olderMaxReps) {
        stalledExercises.push(name)
      }
    }
  }

  // Build the prompt
  const parts: string[] = []

  parts.push(`Sos un coach de entrenamiento personal experto. Hablás en español argentino casual (usás "vos", tuteo rioplatense). Sos empático, motivador pero honesto -- si algo no está bien, lo decís con respeto pero sin vueltas.

Tu rol es analizar los datos del usuario y dar un análisis tipo "${analysisType}". Enfocate en PATRONES, no solo datos sueltos. Cruzá información entre nutrición, entrenamiento, sueño y energía para encontrar correlaciones.

IMPORTANTE: Respondé SOLAMENTE con un JSON válido (sin markdown, sin backticks, solo el JSON puro) con esta estructura exacta:
{
  "summary": "evaluación general breve (2-3 oraciones)",
  "highlights": [{ "type": "pr|warning|insight|milestone", "title": "...", "body": "..." }],
  "adherence": { "percentage": <número>, "detail": "explicación breve" },
  "patterns": ["patrón 1", "patrón 2"],
  "suggestions": ["sugerencia específica y accionable 1", "sugerencia 2"],
  "newMemories": [{ "type": "pattern|observation|milestone", "content": "algo importante para recordar para futuras sesiones" }]
}`)

  // User context
  if (profile) {
    parts.push(`\n─── PERFIL DEL USUARIO ───
Nombre: ${profile.full_name ?? 'No especificado'}
Objetivos nutricionales: ${profile.calorie_target ?? '?'} kcal, ${profile.protein_target ?? '?'}g proteína, ${profile.carbs_target ?? '?'}g carbos, ${profile.fat_target ?? '?'}g grasa
Objetivo de pasos: ${profile.step_goal ?? '?'}/día
Objetivo de sueño: ${profile.sleep_goal ?? '?'} horas
Días de entrenamiento/semana: ${profile.training_days_per_week ?? '?'}
Entrena desde: ${profile.training_since ?? 'No especificado'}
Contexto del coach: ${profile.coach_context ?? 'Sin contexto adicional'}`)
  }

  // Active phase
  if (activePhase) {
    parts.push(`\n─── FASE ACTIVA ───
Nombre: ${activePhase.name}
Objetivo: ${activePhase.goal}
Detalle: ${activePhase.objective ?? 'N/A'}
Duración: ${activePhase.duration_weeks} semanas
Frecuencia: ${activePhase.frequency} días/semana
Split: ${activePhase.split_type ?? 'N/A'}
Músculos foco: ${(activePhase.focus_muscles ?? []).join(', ') || 'N/A'}
Fecha inicio: ${activePhase.start_date ?? 'N/A'}
Fecha fin: ${activePhase.end_date ?? 'N/A'}
Criterios de salida: ${JSON.stringify(activePhase.exit_criteria)}
Objetivos de volumen: ${JSON.stringify(activePhase.volume_targets)}
Notas de salida custom: ${activePhase.custom_exit_notes ?? 'N/A'}
Targets nutricionales de fase: ${activePhase.calorie_target ?? '?'} kcal, ${activePhase.protein_target ?? '?'}g prot`)
  }

  // Planned routines
  if (routines.length > 0) {
    parts.push(`\n─── RUTINAS PLANIFICADAS (${routines.length} rutinas) ───`)
    for (const routine of routines) {
      const r = routine as any
      parts.push(`\nRutina: ${r.name}`)
      for (const re of r.routine_exercises ?? []) {
        const sets = (re.routine_sets ?? [])
          .map((s: any) => `${s.rep_range_low ?? '?'}-${s.rep_range_high ?? '?'} reps @ RPE ${s.target_rpe ?? '?'}, peso obj ${s.target_weight ?? '?'}kg`)
          .join(' | ')
        parts.push(`  - ${re.exercise?.name ?? 'Ejercicio sin nombre'}: ${sets || 'sin sets definidos'}`)
      }
    }
  }

  // Adherence summary
  parts.push(`\n─── ADHERENCIA (últimas 2 semanas) ───
Sesiones ejecutadas: ${recentSessions.length}
Sets ejecutados: ${totalExecutedSets}
Sets planificados (estimado para 2 semanas): ${plannedSetsForPeriod}
Adherencia estimada: ${plannedSetsForPeriod > 0 ? Math.round((totalExecutedSets / plannedSetsForPeriod) * 100) : '?'}%`)

  // Daily logs
  if (dailyLogs.length > 0) {
    parts.push(`\n─── LOGS DIARIOS (últimos 14 días, ${dailyLogs.length} registros) ───`)
    for (const log of dailyLogs) {
      const l = log as any
      parts.push(`${l.log_date}: ${l.calories ?? '?'}kcal, ${l.protein_g ?? '?'}g prot, ${l.carbs_g ?? '?'}g carbs, ${l.fat_g ?? '?'}g grasa | Pasos: ${l.steps ?? '?'} | Sueño: ${l.sleep_hours ?? '?'}h | Energía: ${l.energy ?? '?'}/5 | Hambre: ${l.hunger ?? '?'}/5 | Fatiga: ${l.fatigue_level ?? '?'}/5${l.notes ? ` | Nota: ${l.notes}` : ''}`)
    }
  }

  // Executed sessions
  if (executedSessions.length > 0) {
    parts.push(`\n─── SESIONES EJECUTADAS (últimas 4 semanas, ${executedSessions.length} sesiones) ───`)
    for (const session of executedSessions) {
      const s = session as any
      parts.push(`\n${s.session_date} | ${s.duration_minutes ?? '?'} min | Vol total: ${s.total_volume_kg ?? '?'}kg${s.notes ? ` | ${s.notes}` : ''}`)
      for (const ex of s.executed_exercises ?? []) {
        const setsStr = (ex.executed_sets ?? [])
          .map((set: any) => `${set.weight_kg ?? 0}kg x${set.reps ?? 0}${set.rpe ? ` @RPE${set.rpe}` : ''}`)
          .join(' | ')
        parts.push(`  - ${ex.exercise?.name ?? 'Ejercicio desconocido'}: ${setsStr || 'sin sets'}`)
      }
    }
  }

  // PRs
  const prEntries = Object.entries(prMap)
  if (prEntries.length > 0) {
    parts.push(`\n─── RECORDS PERSONALES (últimas 4 semanas) ───`)
    for (const [name, pr] of prEntries) {
      parts.push(`${name}: ${pr.weight}kg x${pr.reps} (${pr.date})`)
    }
  }

  // Stalled exercises
  if (stalledExercises.length > 0) {
    parts.push(`\n─── EJERCICIOS ESTANCADOS (sin progreso en 3+ semanas) ───
${stalledExercises.join(', ')}`)
  }

  // Weekly checkins
  if (weeklyCheckins.length > 0) {
    parts.push(`\n─── CHECKINS SEMANALES (últimos ${weeklyCheckins.length}) ───`)
    for (const checkin of weeklyCheckins) {
      const c = checkin as any
      parts.push(`Semana ${c.week_number} (${c.checkin_date}): Peso ${c.weight_kg ?? '?'}kg | Cintura ${c.waist_cm ?? '?'}cm | Cadera ${c.hip_cm ?? '?'}cm | Muslo ${c.thigh_cm ?? '?'}cm | Tendencia rendimiento: ${c.performance_trend ?? '?'} | Score: ${c.weekly_score ?? '?'} | Adherencia entrenamiento: ${c.training_adherence ?? '?'}% | Adherencia nutrición: ${c.nutrition_adherence ?? '?'}%`)
    }
  }

  // Coach memories (for continuity)
  if (memories.length > 0) {
    parts.push(`\n─── MEMORIAS PREVIAS DEL COACH (para continuidad) ───`)
    for (const mem of memories) {
      const m = mem as any
      parts.push(`[${m.type}] ${m.content} (${m.created_at?.split('T')[0] ?? '?'})`)
    }
  }

  // Extra context
  if (extraContext && Object.keys(extraContext).length > 0) {
    parts.push(`\n─── CONTEXTO ADICIONAL ───
${JSON.stringify(extraContext, null, 2)}`)
  }

  // Analysis-specific instructions
  if (analysisType === 'weekly') {
    parts.push(`\n─── INSTRUCCIONES PARA ANÁLISIS SEMANAL ───
Enfocate en:
1. Cómo estuvo la adherencia esta semana vs la anterior
2. Patrones de energía/sueño/hambre y cómo correlacionan con el rendimiento
3. Si la nutrición estuvo alineada con los objetivos de la fase
4. Progreso en los ejercicios principales
5. Sugerencias concretas para la próxima semana
6. Si hay señales de que se necesita un deload o cambio de fase`)
  } else if (analysisType === 'progress') {
    parts.push(`\n─── INSTRUCCIONES PARA ANÁLISIS DE PROGRESO ───
Enfocate en:
1. Tendencias de peso/medidas a lo largo del tiempo
2. Progresión de cargas en ejercicios compuestos
3. Estado de los criterios de salida de la fase actual
4. Volumen acumulado vs objetivos de volumen
5. Recomendaciones sobre si mantener, ajustar o cambiar de fase
6. Comparación con las memorias previas para ver evolución`)
  } else if (analysisType === 'checkin') {
    parts.push(`\n─── INSTRUCCIONES PARA ANÁLISIS DE CHECKIN ───
Enfocate en:
1. Evaluación del checkin más reciente vs anteriores
2. Decisiones específicas: subir/mantener/bajar volumen por grupo muscular
3. Ajustes nutricionales si corresponden
4. Estado anímico y de recuperación
5. Próximos pasos concretos para la semana que viene`)
  }

  return parts.join('\n')
}

// ─── POST handler ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CoachRequest
    const { userId, analysisType, context: extraContext } = body

    if (!userId || !analysisType) {
      return NextResponse.json(
        { error: 'Se requiere userId y analysisType' },
        { status: 400 }
      )
    }

    if (!['weekly', 'progress', 'checkin'].includes(analysisType)) {
      return NextResponse.json(
        { error: 'analysisType debe ser "weekly", "progress" o "checkin"' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // 1. Gather all user data
    const userData = await gatherUserData(supabase, userId)

    if (!userData.profile) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // 2. Build system prompt
    const systemPrompt = buildSystemPrompt(userData, analysisType, extraContext)

    // 3. Call Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analizá mis datos y dame tu análisis de tipo "${analysisType}". Hoy es ${new Date().toISOString().split('T')[0]}.`,
        },
      ],
    })

    // Extract text response
    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No se recibió respuesta de texto del modelo')
    }

    // Parse JSON response
    let coachResponse: CoachResponse
    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      let jsonStr = textBlock.text.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }
      coachResponse = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse coach response:', textBlock.text)
      throw new Error('El modelo no devolvió un JSON válido')
    }

    // 4. Save analysis to coach_analyses
    const { error: analysisError } = await supabase.from('coach_analyses').insert({
      user_id: userId,
      analysis_type: analysisType,
      prompt_context: {
        phase_id: userData.activePhase?.id ?? null,
        daily_logs_count: userData.dailyLogs.length,
        sessions_count: userData.executedSessions.length,
        checkins_count: userData.weeklyCheckins.length,
        extra_context: extraContext ?? null,
      },
      response: JSON.stringify(coachResponse),
    })

    if (analysisError) {
      console.error('Error saving coach analysis:', analysisError)
    }

    // 5. Save new memories
    if (coachResponse.newMemories && coachResponse.newMemories.length > 0) {
      const memoriesToInsert = coachResponse.newMemories.map((mem) => ({
        user_id: userId,
        memory_type: mem.type,
        content: mem.content,
        context: {
          phase_id: userData.activePhase?.id ?? null,
          source: analysisType,
        },
      }))

      const { error: memoriesError } = await supabase
        .from('coach_memories')
        .insert(memoriesToInsert)

      if (memoriesError) {
        console.error('Error saving coach memories:', memoriesError)
      }
    }

    return NextResponse.json(coachResponse)
  } catch (err) {
    console.error('Coach API error:', err)
    const message = err instanceof Error ? err.message : 'Error interno del coach'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
