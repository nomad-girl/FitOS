'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RightPanel } from '@/components/layout/right-panel'
import { dateToLocal } from '@/lib/date-utils'
import type { Milestone } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────

interface PRRecord {
  exerciseName: string
  weight: number
  reps: number
  date: string
}

interface WeeklyScoreData {
  score: number
  breakdown: {
    adherencia: number
    calorias: number
    proteina: number
    pasos: number
    sueno: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

const weekDayMap: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function getWeekStartDate(date: Date, weekStartDay: string): string {
  const target = weekDayMap[weekStartDay] ?? 6
  const d = new Date(date)
  const current = d.getDay()
  const diff = (current - target + 7) % 7
  d.setDate(d.getDate() - diff)
  return dateToLocal(d)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// Calculate weekly score from daily logs vs profile targets
function computeWeeklyScore(
  logs: { calories: number | null; protein_g: number | null; steps: number | null; sleep_hours: number | null }[],
  targets: { calorie_target: number | null; protein_target: number | null; step_goal: number | null; sleep_goal: number | null },
  adherence: { done: number; planned: number } | null,
): WeeklyScoreData | null {
  if (logs.length === 0) return null

  const daysWithData = logs.length

  // Adherence score (0-100) — weight: 30
  let adherenciaScore = 0
  if (adherence && adherence.planned > 0) {
    adherenciaScore = Math.min(Math.round((adherence.done / adherence.planned) * 100), 100)
  }

  // Calorie score (0-100) — how close to target, penalize over AND under — weight: 20
  let caloriasScore = 0
  if (targets.calorie_target) {
    const cals = logs.filter(l => l.calories != null).map(l => l.calories!)
    if (cals.length > 0) {
      const avg = cals.reduce((a, b) => a + b, 0) / cals.length
      const ratio = avg / targets.calorie_target
      // Perfect = 1.0, penalize deviation
      caloriasScore = Math.max(0, Math.round(100 - Math.abs(1 - ratio) * 200))
    }
  } else {
    caloriasScore = 50 // no target set, neutral
  }

  // Protein score (0-100) — weight: 20
  let proteinaScore = 0
  if (targets.protein_target) {
    const prots = logs.filter(l => l.protein_g != null).map(l => l.protein_g!)
    if (prots.length > 0) {
      const avg = prots.reduce((a, b) => a + b, 0) / prots.length
      const ratio = avg / targets.protein_target
      proteinaScore = Math.min(Math.round(ratio * 100), 100)
    }
  } else {
    proteinaScore = 50
  }

  // Steps score (0-100) — weight: 15
  let pasosScore = 0
  if (targets.step_goal) {
    const steps = logs.filter(l => l.steps != null).map(l => l.steps!)
    if (steps.length > 0) {
      const avg = steps.reduce((a, b) => a + b, 0) / steps.length
      const ratio = avg / targets.step_goal
      pasosScore = Math.min(Math.round(ratio * 100), 100)
    }
  } else {
    pasosScore = 50
  }

  // Sleep score (0-100) — weight: 15
  let suenoScore = 0
  if (targets.sleep_goal) {
    const sleeps = logs.filter(l => l.sleep_hours != null).map(l => l.sleep_hours!)
    if (sleeps.length > 0) {
      const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length
      const ratio = avg / targets.sleep_goal
      // Perfect = 1.0, penalize under-sleeping more than over
      suenoScore = ratio >= 1 ? 100 : Math.round(ratio * 100)
    }
  } else {
    suenoScore = 50
  }

  // Weighted total
  const score = Math.round(
    adherenciaScore * 0.30 +
    caloriasScore * 0.20 +
    proteinaScore * 0.20 +
    pasosScore * 0.15 +
    suenoScore * 0.15
  )

  return {
    score,
    breakdown: {
      adherencia: adherenciaScore,
      calorias: caloriasScore,
      proteina: proteinaScore,
      pasos: pasosScore,
      sueno: suenoScore,
    },
  }
}

// ─── Main component ───────────────────────────────────────────────

export default function ProgressPage() {
  const [loading, setLoading] = useState(true)

  // Data state
  const [prRecords, setPrRecords] = useState<PRRecord[]>([])
  const [gymAdherence, setGymAdherence] = useState<{ done: number; planned: number; percentage: number } | null>(null)
  const [weeklyScore, setWeeklyScore] = useState<WeeklyScoreData | null>(null)

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDate, setNewDate] = useState(dateToLocal(new Date()))
  const [savingMilestone, setSavingMilestone] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // ─── Profile (week_start_day, targets) ─────
      const { data: profile } = await supabase
        .from('profiles')
        .select('week_start_day, training_days_per_week, calorie_target, protein_target, step_goal, sleep_goal')
        .eq('id', userId)
        .single()

      const weekStartDay = profile?.week_start_day ?? 'saturday'
      const trainingDays = profile?.training_days_per_week ?? 3

      // Week start based on profile setting
      const now = new Date()
      const thisWeekStartStr = getWeekStartDate(now, weekStartDay)

      // ─── Sessions this week (for adherence) ────
      const { data: thisWeekSessions } = await supabase
        .from('executed_sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('session_date', thisWeekStartStr)

      const done = thisWeekSessions?.length ?? 0
      const adherenceData = { done, planned: trainingDays, percentage: Math.round((done / trainingDays) * 100) }
      setGymAdherence(adherenceData)

      // ─── Daily logs this week (for live weekly score) ──
      const { data: weekLogs } = await supabase
        .from('daily_logs')
        .select('calories, protein_g, steps, sleep_hours')
        .eq('user_id', userId)
        .gte('log_date', thisWeekStartStr)

      const scoreData = computeWeeklyScore(
        weekLogs ?? [],
        {
          calorie_target: profile?.calorie_target ?? null,
          protein_target: profile?.protein_target ?? null,
          step_goal: profile?.step_goal ?? null,
          sleep_goal: profile?.sleep_goal ?? null,
        },
        adherenceData,
      )
      setWeeklyScore(scoreData)

      // ─── PRs (all-time bests) ──────────────────
      const { data: allSessions } = await supabase
        .from('executed_sessions')
        .select(`
          id, session_date,
          executed_exercises (
            id,
            exercise_name,
            exercise_id,
            exercises ( name ),
            executed_sets ( set_number, weight_kg, reps, duration_seconds )
          )
        `)
        .eq('user_id', userId)
        .order('session_date', { ascending: true })

      if (allSessions && allSessions.length > 0) {
        const exerciseHistory: Record<string, { date: string; bestWeight: number; bestReps: number }[]> = {}

        for (const session of allSessions) {
          for (const ex of (session.executed_exercises ?? []) as any[]) {
            // Use exercise_name (from Hevy) or fallback to exercises.name
            const exName = ex.exercise_name || ex.exercises?.name
            if (!exName) continue
            if (!exerciseHistory[exName]) exerciseHistory[exName] = []

            const sets = (ex.executed_sets ?? []) as any[]
            let bestWeight = 0
            let bestReps = 0

            for (const s of sets) {
              const w = s.weight_kg ?? 0
              const r = s.reps ?? 0
              if (w > bestWeight || (w === bestWeight && r > bestReps)) {
                bestWeight = w
                bestReps = r
              }
            }

            exerciseHistory[exName].push({ date: session.session_date, bestWeight, bestReps })
          }
        }

        const prs: PRRecord[] = []
        for (const [name, history] of Object.entries(exerciseHistory)) {
          if (history.length === 0) continue
          const best = history.reduce((a, b) => {
            if (b.bestWeight > a.bestWeight || (b.bestWeight === a.bestWeight && b.bestReps > a.bestReps)) return b
            return a
          }, history[0])
          if (best.bestWeight > 0) {
            prs.push({ exerciseName: name, weight: best.bestWeight, reps: best.bestReps, date: best.date })
          }
        }
        prs.sort((a, b) => b.weight - a.weight)
        setPrRecords(prs)
      }

      // ─── Milestones ────────────────────────────
      const { data: milestonesData } = await supabase
        .from('milestones')
        .select('*')
        .eq('user_id', userId)
        .order('milestone_date', { ascending: false })

      if (milestonesData) setMilestones(milestonesData)

    } catch (err) {
      console.error('Error fetching progress data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveMilestone() {
    if (!newTitle.trim()) return
    setSavingMilestone(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) return

      const { error } = await supabase.from('milestones').insert({
        user_id: userId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        milestone_date: newDate,
      })

      if (error) {
        console.error('Error saving milestone:', error)
      } else {
        setNewTitle('')
        setNewDescription('')
        setNewDate(dateToLocal(new Date()))
        setShowAddMilestone(false)
        fetchData()
      }
    } catch (err) {
      console.error('Error saving milestone:', err)
    } finally {
      setSavingMilestone(false)
    }
  }

  async function deleteMilestone(id: string) {
    const supabase = createClient()
    await supabase.from('milestones').delete().eq('id', id)
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  const breakdownLabels: Record<string, string> = {
    adherencia: 'Gym',
    calorias: 'Cal',
    proteina: 'Prot',
    pasos: 'Pasos',
    sueno: 'Sueno',
  }

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {loading ? (
          <div>
            <div className="mb-7">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-7 w-32 mb-2" />
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-56" />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                  <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-24 mb-2" />
                  <div className="bg-gray-200 animate-pulse rounded-[6px] h-8 w-16" />
                </div>
              ))}
            </div>
            <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-6">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-5 w-32 mb-4" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-200 animate-pulse rounded-[6px] h-10 w-full mb-2" />
              ))}
            </div>
          </div>
        ) : (
          <div className="fade-in">
            {/* Header */}
            <div className="mb-7">
              <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Progreso</h1>
              <p className="text-gray-500 text-[.9rem] mt-1">Adherencia, records y logros personales</p>
            </div>

            {/* Top Cards: Adherence + Weekly Score */}
            <div className="grid grid-cols-2 gap-4 mb-6 max-sm:grid-cols-1">
              {/* Gym Adherence */}
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                <div className="text-[.78rem] font-semibold text-gray-500 uppercase mb-2">Adherencia al Gym</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-[2rem] font-extrabold ${gymAdherence && gymAdherence.percentage >= 100 ? 'text-success' : gymAdherence && gymAdherence.percentage >= 50 ? 'text-primary' : 'text-danger'}`}>
                    {gymAdherence?.percentage ?? 0}%
                  </span>
                  <span className="text-[.88rem] text-gray-400">{gymAdherence?.done ?? 0}/{gymAdherence?.planned ?? 0} esta semana</span>
                </div>
                <div className="h-2.5 rounded-lg overflow-hidden bg-gray-100">
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${
                      gymAdherence && gymAdherence.done >= gymAdherence.planned ? 'bg-success' : gymAdherence && gymAdherence.done > 0 ? 'bg-primary' : 'bg-gray-300'
                    }`}
                    style={{ width: `${Math.min(gymAdherence?.percentage ?? 0, 100)}%` }}
                  />
                </div>
                <div className="text-[.75rem] text-gray-400 mt-1.5">
                  {gymAdherence && gymAdherence.done >= gymAdherence.planned
                    ? 'Objetivo cumplido!'
                    : gymAdherence ? `Faltan ${gymAdherence.planned - gymAdherence.done} sesion${gymAdherence.planned - gymAdherence.done > 1 ? 'es' : ''}` : ''}
                </div>
              </div>

              {/* Weekly Score */}
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                <div className="text-[.78rem] font-semibold text-gray-500 uppercase mb-2">Puntaje Semanal</div>
                {weeklyScore ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className={`text-[2rem] font-extrabold ${weeklyScore.score >= 80 ? 'text-success' : weeklyScore.score >= 60 ? 'text-primary' : weeklyScore.score >= 40 ? 'text-warning' : 'text-danger'}`}>
                        {weeklyScore.score}
                      </span>
                      <span className="text-[.88rem] text-gray-400">/ 100</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(weeklyScore.breakdown).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[.72rem] text-gray-400 w-10">{breakdownLabels[key] ?? key}</span>
                          <div className="flex-1 h-1.5 rounded-lg overflow-hidden bg-gray-100">
                            <div
                              className={`h-full rounded-lg ${val >= 80 ? 'bg-success' : val >= 60 ? 'bg-primary' : val >= 40 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${val}%` }}
                            />
                          </div>
                          <span className="text-[.72rem] text-gray-500 font-semibold w-7 text-right">{val}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-[.88rem] text-gray-400">Sin datos esta semana</div>
                )}
              </div>
            </div>

            {/* Records */}
            <div className="mb-6">
              <div className="text-[1.08rem] font-bold text-gray-800 mb-4 flex items-center gap-2">
                Records Personales
                <span className="text-[.77rem] text-gray-400 font-normal">{prRecords.length > 0 ? `${prRecords.length} ejercicios` : 'Mejores marcas de Hevy'}</span>
              </div>
              {prRecords.length > 0 ? (
                <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden">
                  <table className="w-full border-collapse text-[.88rem]">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="py-2.5 px-4 font-semibold text-[.78rem] text-gray-500 uppercase">Ejercicio</th>
                        <th className="py-2.5 px-3 font-semibold text-[.78rem] text-gray-500 uppercase">Record</th>
                        <th className="py-2.5 px-3 font-semibold text-[.78rem] text-gray-500 uppercase text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prRecords.map((pr) => (
                        <tr key={pr.exerciseName} className="border-b border-gray-100">
                          <td className="py-3 px-4 font-semibold">{pr.exerciseName}</td>
                          <td className="py-3 px-3 text-primary font-bold">{pr.weight}kg x {pr.reps}</td>
                          <td className="py-3 px-3 text-right text-gray-400 text-[.82rem]">{formatDate(pr.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-card rounded-[var(--radius)] p-6 shadow-[var(--shadow)] text-center text-gray-400 text-[.9rem]">
                  Sin records todavia. Entrena y sincroniza con Hevy!
                </div>
              )}
            </div>

            {/* Milestones */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <div className="text-[1.08rem] font-bold text-gray-800">
                  Hitos Personales
                </div>
                <button
                  onClick={() => setShowAddMilestone(!showAddMilestone)}
                  className="text-[.82rem] font-semibold text-primary cursor-pointer bg-transparent border-none hover:underline"
                >
                  {showAddMilestone ? 'Cancelar' : '+ Nuevo Hito'}
                </button>
              </div>

              {/* Add milestone form — simplified, no category */}
              {showAddMilestone && (
                <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-4 fade-in">
                  <div className="mb-3">
                    <label className="text-[.77rem] text-gray-400 block mb-1">Titulo</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ej: Primera dominada sin asistencia"
                      className="w-full border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.88rem] outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-3 mb-3">
                    <div>
                      <label className="text-[.77rem] text-gray-400 block mb-1">Descripcion (opcional)</label>
                      <input
                        type="text"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Ej: Despues de 3 meses de progresion"
                        className="w-full border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.88rem] outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[.77rem] text-gray-400 block mb-1">Fecha</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.88rem] outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <button
                    onClick={saveMilestone}
                    disabled={!newTitle.trim() || savingMilestone}
                    className="w-full py-2.5 bg-primary text-white font-semibold text-[.88rem] rounded-[var(--radius-sm)] cursor-pointer border-none hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {savingMilestone ? 'Guardando...' : 'Guardar Hito'}
                  </button>
                </div>
              )}

              {/* Milestones list */}
              {milestones.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {milestones.map((m) => (
                    <div key={m.id} className="bg-card rounded-[var(--radius)] p-[14px_18px] shadow-[var(--shadow)] flex items-start gap-3">
                      <span className="text-[1.2rem] mt-0.5">{'\uD83C\uDFC6'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[.92rem] text-gray-800">{m.title}</div>
                        {m.description && (
                          <div className="text-[.82rem] text-gray-500 mt-0.5">{m.description}</div>
                        )}
                        <div className="text-[.75rem] text-gray-400 mt-1">{formatDate(m.milestone_date)}</div>
                      </div>
                      <button
                        onClick={() => deleteMilestone(m.id)}
                        className="text-gray-300 hover:text-danger text-[.8rem] cursor-pointer bg-transparent border-none shrink-0 mt-1"
                        title="Eliminar"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : !showAddMilestone ? (
                <div className="bg-card rounded-[var(--radius)] p-6 shadow-[var(--shadow)] text-center text-gray-400 text-[.9rem]">
                  Registra tus logros personales: primera dominada, medidas, habilidades...
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {/* Right Panel */}
      <RightPanel>
        <div className="font-bold text-base text-gray-800 mb-[18px]">Resumen</div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Adherencia Gym</div>
          <div className={`font-extrabold text-[1.1rem] ${gymAdherence && gymAdherence.percentage >= 100 ? 'text-success' : 'text-primary'}`}>
            {gymAdherence ? `${gymAdherence.percentage}%` : '--'}
          </div>
        </div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Puntaje Semanal</div>
          <div className={`font-extrabold text-[1.1rem] ${weeklyScore && weeklyScore.score >= 80 ? 'text-success' : 'text-primary'}`}>
            {weeklyScore?.score ?? '--'}
          </div>
        </div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-[22px]">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Records</div>
          <div className="font-extrabold text-[1.1rem] text-primary">{prRecords.length}</div>
        </div>

        {/* Recent milestones in sidebar */}
        <div className="font-bold text-base text-gray-800 mb-[14px]">Ultimos Hitos</div>
        <div className="flex flex-col gap-2.5">
          {milestones.length > 0 ? (
            milestones.slice(0, 5).map((m) => (
              <div key={m.id} className="p-[10px_12px] bg-primary-light rounded-[var(--radius-xs)] text-[.84rem]">
                <div className="font-semibold text-primary-dark">{'\uD83C\uDFC6'} {m.title}</div>
                <div className="text-primary-dark opacity-80 text-[.78rem]">{formatDate(m.milestone_date)}</div>
              </div>
            ))
          ) : (
            <div className="p-[10px_12px] bg-gray-50 rounded-[var(--radius-xs)] text-[.84rem] text-gray-400">
              Sin hitos registrados
            </div>
          )}
        </div>
      </RightPanel>
    </>
  )
}
