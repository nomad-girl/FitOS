// Aggregates everything needed for the "Cierre de Mesociclo" page:
// entry vs latest body comp, volume planned vs done, PRs in window, adherence.
// Pure data layer — UI lives in app/(app)/plan/cierre/[phaseId]/page.tsx.

import type { SupabaseClient } from '@supabase/supabase-js'
import { calcBodyComp, type BodyCompOutput } from '@/lib/body-comp'
import { getWeeklyVolumeByMuscle } from '@/lib/weekly-volume'
import { todayLocal } from '@/lib/date-utils'
import { targetSetsForWeek, resolveMesocycleWeek } from '@/lib/mesocycle'
import type { Phase } from '@/lib/supabase/types'

export interface BodyCompSnapshot {
  weight_kg: number | null
  body_fat_pct: number | null
  waist_cm: number | null
  hip_cm: number | null
  date: string | null
  // computed
  comp: BodyCompOutput
}

export interface BodyCompDelta {
  weightKg: number | null
  fatMassKg: number | null
  leanMassKg: number | null
  ffmi: number | null
  bodyFatPct: number | null
  waistCm: number | null
}

export interface VolumeRow {
  muscle: string
  planned: number       // sum of targetSetsForWeek across all completed weeks of the phase
  actual: number        // measured sets per muscle in the window
  diffPct: number | null
}

export interface PrRow {
  exerciseName: string
  weight: number
  reps: number
  date: string
  isNewPr: boolean      // true if this beat the all-time best before phase start
}

export interface CloseoutData {
  phase: Phase
  weeksCompleted: number
  weeksPlanned: number
  startDate: string
  endDate: string       // today if phase still active

  entry: BodyCompSnapshot | null
  latest: BodyCompSnapshot | null
  delta: BodyCompDelta | null

  volume: VolumeRow[]
  totalPlanned: number
  totalActual: number

  sessionsDone: number
  sessionsPlanned: number

  prs: PrRow[]          // top PRs in window, prioritising new all-time PRs

  // checked targets / warnings as evaluated context (raw — UI marks them)
  progressTargets: { id: string; label: string; detail: string }[]
  progressWarnings: { id: string; label: string; detail: string }[]
  exitCriteria: { id: string; label: string; detail: string }[]

  // suggestions for next phase (auto-generated heuristics)
  suggestions: string[]
}

// Read entry body comp from phase.entry_criteria.body_comp; if missing, use the
// earliest weekly check-in inside the phase window.
async function loadEntrySnapshot(
  supabase: SupabaseClient,
  phase: Phase,
  heightCm: number | null,
): Promise<BodyCompSnapshot | null> {
  const ec = phase.entry_criteria as { body_comp?: { weight_kg?: number | null; body_fat_pct?: number | null; waist_cm?: number | null; hip_cm?: number | null } } | null
  const bc = ec?.body_comp
  if (bc && (bc.weight_kg != null || bc.body_fat_pct != null || bc.waist_cm != null)) {
    return {
      weight_kg: bc.weight_kg ?? null,
      body_fat_pct: bc.body_fat_pct ?? null,
      waist_cm: bc.waist_cm ?? null,
      hip_cm: bc.hip_cm ?? null,
      date: phase.start_date,
      comp: calcBodyComp({
        weightKg: bc.weight_kg ?? null,
        heightCm,
        bodyFatPct: bc.body_fat_pct ?? null,
        waistCm: bc.waist_cm ?? null,
        hipCm: bc.hip_cm ?? null,
      }),
    }
  }
  // Fallback to first checkin inside the phase
  if (!phase.start_date) return null
  const { data } = await supabase
    .from('weekly_checkins')
    .select('checkin_date, weight_kg, body_fat_pct, waist_cm, hip_cm')
    .eq('phase_id', phase.id)
    .order('checkin_date', { ascending: true })
    .limit(1)
  const row = data?.[0]
  if (!row) return null
  return {
    weight_kg: row.weight_kg,
    body_fat_pct: row.body_fat_pct,
    waist_cm: row.waist_cm,
    hip_cm: row.hip_cm,
    date: row.checkin_date,
    comp: calcBodyComp({
      weightKg: row.weight_kg,
      heightCm,
      bodyFatPct: row.body_fat_pct,
      waistCm: row.waist_cm,
      hipCm: row.hip_cm,
    }),
  }
}

async function loadLatestSnapshot(
  supabase: SupabaseClient,
  phase: Phase,
  heightCm: number | null,
): Promise<BodyCompSnapshot | null> {
  const { data } = await supabase
    .from('weekly_checkins')
    .select('checkin_date, weight_kg, body_fat_pct, waist_cm, hip_cm')
    .eq('phase_id', phase.id)
    .order('checkin_date', { ascending: false })
    .limit(1)
  const row = data?.[0]
  if (!row) return null
  return {
    weight_kg: row.weight_kg,
    body_fat_pct: row.body_fat_pct,
    waist_cm: row.waist_cm,
    hip_cm: row.hip_cm,
    date: row.checkin_date,
    comp: calcBodyComp({
      weightKg: row.weight_kg,
      heightCm,
      bodyFatPct: row.body_fat_pct,
      waistCm: row.waist_cm,
      hipCm: row.hip_cm,
    }),
  }
}

function computeDelta(entry: BodyCompSnapshot | null, latest: BodyCompSnapshot | null): BodyCompDelta | null {
  if (!entry || !latest) return null
  const sub = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b != null ? Math.round((a - b) * 10) / 10 : null
  return {
    weightKg: sub(latest.weight_kg, entry.weight_kg),
    bodyFatPct: sub(latest.body_fat_pct, entry.body_fat_pct),
    waistCm: sub(latest.waist_cm, entry.waist_cm),
    fatMassKg: sub(latest.comp.fatMassKg, entry.comp.fatMassKg),
    leanMassKg: sub(latest.comp.leanMassKg, entry.comp.leanMassKg),
    ffmi: latest.comp.ffmi != null && entry.comp.ffmi != null
      ? Math.round((latest.comp.ffmi - entry.comp.ffmi) * 10) / 10
      : null,
  }
}

// Sum up weekly planned sets across all weeks the user has actually trained
// (capped to weeksCompleted, not phase.duration_weeks).
function plannedVolumeRows(
  phase: Phase,
  weeksCompleted: number,
  actual: Record<string, number>,
): VolumeRow[] {
  const vt = phase.volume_targets as Record<string, unknown> | null
  const plannedSum: Record<string, number> = {}
  for (let w = 1; w <= weeksCompleted; w++) {
    const plan = resolveMesocycleWeek(w)
    const target = targetSetsForWeek(vt, plan)
    for (const [muscle, sets] of Object.entries(target)) {
      plannedSum[muscle] = (plannedSum[muscle] ?? 0) + sets
    }
  }
  const allMuscles = new Set<string>([...Object.keys(plannedSum), ...Object.keys(actual)])
  const rows: VolumeRow[] = []
  for (const muscle of allMuscles) {
    const planned = plannedSum[muscle] ?? 0
    const real = actual[muscle] ?? 0
    const diffPct = planned > 0 ? Math.round(((real - planned) / planned) * 100) : null
    rows.push({ muscle, planned, actual: real, diffPct })
  }
  // Sort: muscles with target first, then by absolute |diff| descending
  rows.sort((a, b) => {
    if ((a.planned > 0) !== (b.planned > 0)) return a.planned > 0 ? -1 : 1
    return b.actual + b.planned - (a.actual + a.planned)
  })
  return rows
}

interface SessionLite {
  id: string
  session_date: string
  executed_exercises: Array<{
    exercise_name: string | null
    exercises: { name: string } | null
    executed_sets: Array<{ weight_kg: number | null; reps: number | null }>
  }>
}

function bestSetOfExercise(ex: SessionLite['executed_exercises'][number]): { weight: number; reps: number } {
  let bestW = 0
  let bestR = 0
  for (const s of ex.executed_sets ?? []) {
    const w = s.weight_kg ?? 0
    const r = s.reps ?? 0
    if (w > bestW || (w === bestW && r > bestR)) { bestW = w; bestR = r }
  }
  return { weight: bestW, reps: bestR }
}

async function loadPrs(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<PrRow[]> {
  const { data: allSessions } = await supabase
    .from('executed_sessions')
    .select(`
      id, session_date,
      executed_exercises (
        exercise_name,
        exercises ( name ),
        executed_sets ( weight_kg, reps )
      )
    `)
    .eq('user_id', userId)
    .order('session_date', { ascending: true })

  if (!allSessions) return []

  // All-time best per exercise BEFORE phase start
  const beforeBest: Record<string, number> = {}
  // Best per exercise INSIDE the phase window
  type In = { weight: number; reps: number; date: string }
  const insideBest: Record<string, In> = {}

  for (const session of allSessions as unknown as SessionLite[]) {
    const inWindow = session.session_date >= startDate && session.session_date <= endDate
    for (const ex of session.executed_exercises ?? []) {
      const name = ex.exercise_name || ex.exercises?.name
      if (!name) continue
      const best = bestSetOfExercise(ex)
      if (best.weight <= 0) continue
      if (session.session_date < startDate) {
        if (!(name in beforeBest) || best.weight > beforeBest[name]) beforeBest[name] = best.weight
      } else if (inWindow) {
        const cur = insideBest[name]
        if (!cur || best.weight > cur.weight || (best.weight === cur.weight && best.reps > cur.reps)) {
          insideBest[name] = { weight: best.weight, reps: best.reps, date: session.session_date }
        }
      }
    }
  }

  const rows: PrRow[] = []
  for (const [name, hit] of Object.entries(insideBest)) {
    const prevBest = beforeBest[name] ?? 0
    rows.push({
      exerciseName: name,
      weight: hit.weight,
      reps: hit.reps,
      date: hit.date,
      isNewPr: hit.weight > prevBest,
    })
  }
  // New PRs first, then by weight desc
  rows.sort((a, b) => {
    if (a.isNewPr !== b.isNewPr) return a.isNewPr ? -1 : 1
    return b.weight - a.weight
  })
  return rows
}

function buildSuggestions(args: {
  phase: Phase
  delta: BodyCompDelta | null
  weeksCompleted: number
  totalPlanned: number
  totalActual: number
  adherencePct: number
  newPrCount: number
}): string[] {
  const out: string[] = []
  const { phase, delta, totalPlanned, totalActual, adherencePct, newPrCount } = args

  // Adherence
  if (adherencePct < 70) {
    out.push(`Adherencia baja (${Math.round(adherencePct)}%). Para el próximo meso, considerá reducir la frecuencia semanal o acortar la duración.`)
  } else if (adherencePct >= 90) {
    out.push(`Adherencia excelente (${Math.round(adherencePct)}%). Podés mantener o subir la frecuencia.`)
  }

  // Volume
  if (totalPlanned > 0) {
    const ratio = totalActual / totalPlanned
    if (ratio < 0.8) {
      out.push(`Volumen real ${Math.round(ratio * 100)}% del planeado. Bajá los targets de series 10-15% o ajustá los ejercicios.`)
    } else if (ratio > 1.15) {
      out.push(`Hiciste ${Math.round(ratio * 100)}% del volumen planeado. Considerá subir los MAV/MRV en el próximo meso.`)
    }
  }

  // Body comp by goal
  if (delta) {
    const goal = phase.goal
    if (goal === 'build' && delta.weightKg != null) {
      if (delta.weightKg <= 0) {
        out.push(`En volumen no ganaste peso (${delta.weightKg} kg). Próxima fase: subí 100-150 kcal sobre el target actual.`)
      } else if (delta.weightKg > 2.5) {
        out.push(`Ganaste rápido (+${delta.weightKg} kg). Si la cintura subió mucho, cortá calorías 100-150 o pasá a recomp.`)
      }
      if (delta.fatMassKg != null && delta.leanMassKg != null && delta.fatMassKg > delta.leanMassKg) {
        out.push(`Ganaste más grasa que músculo. Para el próximo meso, considerá bajar el superávit y mantener volumen alto.`)
      }
    }
    if (goal === 'cut' && delta.weightKg != null) {
      if (delta.weightKg >= 0) {
        out.push(`En cut no bajaste peso. Revisá tracking de calorías o bajá 100-150 kcal el próximo bloque.`)
      } else if (delta.weightKg < -3) {
        out.push(`Bajaste rápido (${delta.weightKg} kg). Si la fuerza cayó, subí 100 kcal o frená en mantenimiento 1-2 semanas.`)
      }
      if (delta.leanMassKg != null && delta.leanMassKg < -0.5) {
        out.push(`Perdiste masa magra (${delta.leanMassKg} kg). Subí proteína a 2.2 g/kg y mantené entrenamiento pesado.`)
      }
    }
    if (delta.waistCm != null) {
      if (goal === 'build' && delta.waistCm > 2) out.push(`Cintura +${delta.waistCm} cm. Acercate a recomp o reducí superávit.`)
      if (goal === 'cut' && delta.waistCm > -1) out.push(`Cintura no bajó significativamente (${delta.waistCm} cm). El cut necesita más tiempo o más déficit.`)
    }
  }

  // PRs
  if (newPrCount === 0) {
    out.push(`Sin PRs nuevos. Próximo meso: reducí volumen 10% en semana de peak para llegar más fresca.`)
  } else if (newPrCount >= 5) {
    out.push(`${newPrCount} PRs nuevos. Subí los pesos de partida de los ejercicios principales 2.5-5%.`)
  }

  // Always end with a transition suggestion
  if (phase.goal === 'build' && delta?.bodyFatPct != null && delta.bodyFatPct > 2) {
    out.push(`Subió la grasa +${delta.bodyFatPct}%. Considerá un mini-cut de 4-6 semanas antes de seguir con volumen.`)
  }
  if (phase.goal === 'cut' && delta?.bodyFatPct != null && delta.bodyFatPct < -2) {
    out.push(`Bajó la grasa ${delta.bodyFatPct}%. Si llegaste al objetivo, transicioná a mantenimiento 2-3 semanas antes del próximo cut.`)
  }

  return out
}

export async function loadCloseoutData(
  supabase: SupabaseClient,
  phase: Phase,
  userId: string,
  heightCm: number | null,
): Promise<CloseoutData> {
  const startDate = phase.start_date ?? todayLocal()
  const endDate = phase.end_date && phase.status === 'completed' ? phase.end_date : todayLocal()

  // Weeks elapsed (capped to plan)
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const weeksElapsed = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
  const weeksCompleted = Math.min(phase.duration_weeks, weeksElapsed)

  const [entry, latest, actualVolume, sessionsRes, prs] = await Promise.all([
    loadEntrySnapshot(supabase, phase, heightCm),
    loadLatestSnapshot(supabase, phase, heightCm),
    getWeeklyVolumeByMuscle(supabase, userId, startDate, endDate),
    supabase
      .from('executed_sessions')
      .select('id', { count: 'exact', head: false })
      .eq('user_id', userId)
      .gte('session_date', startDate)
      .lte('session_date', endDate),
    loadPrs(supabase, userId, startDate, endDate),
  ])

  const delta = computeDelta(entry, latest)
  const volume = plannedVolumeRows(phase, weeksCompleted, actualVolume)
  const totalPlanned = volume.reduce((s, r) => s + r.planned, 0)
  const totalActual = volume.reduce((s, r) => s + r.actual, 0)

  const sessionsDone = sessionsRes.data?.length ?? 0
  const sessionsPlanned = phase.frequency * weeksCompleted

  const pc = phase.progress_criteria as { weekly_targets?: { id: string; label: string; detail: string }[]; warning_signs?: { id: string; label: string; detail: string }[] } | null
  const ec = phase.exit_criteria as { conditions?: { id: string; label: string; detail: string }[] } | null

  const adherencePct = sessionsPlanned > 0 ? (sessionsDone / sessionsPlanned) * 100 : 0
  const newPrCount = prs.filter((p) => p.isNewPr).length

  return {
    phase,
    weeksCompleted,
    weeksPlanned: phase.duration_weeks,
    startDate,
    endDate,
    entry,
    latest,
    delta,
    volume,
    totalPlanned,
    totalActual,
    sessionsDone,
    sessionsPlanned,
    prs,
    progressTargets: pc?.weekly_targets ?? [],
    progressWarnings: pc?.warning_signs ?? [],
    exitCriteria: ec?.conditions ?? [],
    suggestions: buildSuggestions({
      phase,
      delta,
      weeksCompleted,
      totalPlanned,
      totalActual,
      adherencePct,
      newPrCount,
    }),
  }
}
