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

// ─── Helpers ──────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

const MILESTONE_CATEGORIES = [
  { value: 'strength', label: 'Fuerza', icon: '\uD83D\uDCAA' },
  { value: 'body', label: 'Cuerpo', icon: '\uD83D\uDCCF' },
  { value: 'skill', label: 'Habilidad', icon: '\u2B50' },
  { value: 'general', label: 'General', icon: '\uD83C\uDFC6' },
]

function categoryIcon(cat: string): string {
  return MILESTONE_CATEGORIES.find(c => c.value === cat)?.icon ?? '\uD83C\uDFC6'
}

// ─── Main component ───────────────────────────────────────────────

export default function ProgressPage() {
  const [loading, setLoading] = useState(true)

  // Data state
  const [prRecords, setPrRecords] = useState<PRRecord[]>([])
  const [gymAdherence, setGymAdherence] = useState<{ done: number; planned: number; percentage: number } | null>(null)
  const [weeklyScore, setWeeklyScore] = useState<{ score: number | null; breakdown: any } | null>(null)

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [newDate, setNewDate] = useState(dateToLocal(new Date()))
  const [savingMilestone, setSavingMilestone] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // ─── Active phase for frequency ────────────
      const { data: activePhase } = await supabase
        .from('phases')
        .select('id, frequency, start_date, duration_weeks')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      // Current week start (Saturday-based)
      const now = new Date()
      const currentDay = now.getDay()
      const daysSinceSat = (currentDay + 1) % 7
      const thisWeekStart = new Date(now)
      thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceSat)
      const thisWeekStartStr = dateToLocal(thisWeekStart)

      // ─── Sessions this week (for adherence) ────
      const { data: thisWeekSessions } = await supabase
        .from('executed_sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('session_date', thisWeekStartStr)

      if (activePhase?.frequency) {
        const done = thisWeekSessions?.length ?? 0
        const planned = activePhase.frequency
        setGymAdherence({ done, planned, percentage: Math.round((done / planned) * 100) })
      }

      // ─── Latest weekly score ───────────────────
      const { data: latestCheckin } = await supabase
        .from('weekly_checkins')
        .select('weekly_score, score_breakdown, checkin_date')
        .eq('user_id', userId)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .single()

      if (latestCheckin?.weekly_score != null) {
        setWeeklyScore({
          score: latestCheckin.weekly_score,
          breakdown: latestCheckin.score_breakdown,
        })
      }

      // ─── PRs (all-time bests from last 8 weeks data) ──
      const eightWeeksAgo = new Date()
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
      const eightWeeksStr = dateToLocal(eightWeeksAgo)

      const { data: allSessions } = await supabase
        .from('executed_sessions')
        .select(`
          id, session_date,
          executed_exercises (
            id,
            exercise_id,
            exercises ( name ),
            executed_sets ( set_number, weight_kg, reps, duration_seconds )
          )
        `)
        .eq('user_id', userId)
        .gte('session_date', eightWeeksStr)
        .order('session_date', { ascending: true })

      if (allSessions && allSessions.length > 0) {
        const exerciseHistory: Record<string, { date: string; bestWeight: number; bestReps: number }[]> = {}

        for (const session of allSessions) {
          for (const ex of (session.executed_exercises ?? []) as any[]) {
            const exName = ex.exercises?.name
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

        // Find all-time best per exercise (these are records)
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
        // Sort by weight descending
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
        category: newCategory,
        milestone_date: newDate,
      })

      if (!error) {
        setNewTitle('')
        setNewDescription('')
        setNewCategory('general')
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
                {gymAdherence ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`text-[2rem] font-extrabold ${gymAdherence.percentage >= 100 ? 'text-success' : gymAdherence.percentage >= 50 ? 'text-primary' : 'text-danger'}`}>
                        {gymAdherence.percentage}%
                      </span>
                      <span className="text-[.88rem] text-gray-400">{gymAdherence.done}/{gymAdherence.planned} esta semana</span>
                    </div>
                    <div className="h-2.5 rounded-lg overflow-hidden bg-gray-100">
                      <div
                        className={`h-full rounded-lg transition-all duration-500 ${
                          gymAdherence.done >= gymAdherence.planned ? 'bg-success' : gymAdherence.done > 0 ? 'bg-primary' : 'bg-gray-300'
                        }`}
                        style={{ width: `${Math.min(gymAdherence.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="text-[.75rem] text-gray-400 mt-1.5">
                      {gymAdherence.done >= gymAdherence.planned
                        ? 'Objetivo cumplido!'
                        : `Faltan ${gymAdherence.planned - gymAdherence.done} sesion${gymAdherence.planned - gymAdherence.done > 1 ? 'es' : ''}`}
                    </div>
                  </>
                ) : (
                  <div className="text-[.88rem] text-gray-400">Sin fase activa</div>
                )}
              </div>

              {/* Weekly Score */}
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                <div className="text-[.78rem] font-semibold text-gray-500 uppercase mb-2">Weekly Score</div>
                {weeklyScore?.score != null ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`text-[2rem] font-extrabold ${weeklyScore.score >= 80 ? 'text-success' : weeklyScore.score >= 60 ? 'text-primary' : weeklyScore.score >= 40 ? 'text-warning' : 'text-danger'}`}>
                        {weeklyScore.score}
                      </span>
                      <span className="text-[.88rem] text-gray-400">/ 100</span>
                    </div>
                    {weeklyScore.breakdown && typeof weeklyScore.breakdown === 'object' && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[.75rem] text-gray-400">
                        {Object.entries(weeklyScore.breakdown as Record<string, number>).map(([key, val]) => (
                          <span key={key}>{key}: {val}</span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[.88rem] text-gray-400">Sin checkin reciente</div>
                )}
              </div>
            </div>

            {/* Records */}
            <div className="mb-6">
              <div className="text-[1.08rem] font-bold text-gray-800 mb-4 flex items-center gap-2">
                Records Personales
                <span className="text-[.77rem] text-gray-400 font-normal">Mejores marcas de Hevy</span>
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
                <div className="text-[1.08rem] font-bold text-gray-800 flex items-center gap-2">
                  Hitos Personales
                </div>
                <button
                  onClick={() => setShowAddMilestone(!showAddMilestone)}
                  className="text-[.82rem] font-semibold text-primary cursor-pointer bg-transparent border-none hover:underline"
                >
                  {showAddMilestone ? 'Cancelar' : '+ Nuevo Hito'}
                </button>
              </div>

              {/* Add milestone form */}
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
                  <div className="mb-3">
                    <label className="text-[.77rem] text-gray-400 block mb-1">Descripcion (opcional)</label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Ej: Despues de 3 meses de progresion"
                      className="w-full border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.88rem] outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[.77rem] text-gray-400 block mb-1">Categoria</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.88rem] outline-none focus:border-primary bg-white"
                      >
                        {MILESTONE_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                        ))}
                      </select>
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
                      <span className="text-[1.3rem] mt-0.5">{categoryIcon(m.category)}</span>
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

        {/* Adherence summary */}
        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Adherencia Gym</div>
          <div className={`font-extrabold text-[1.1rem] ${gymAdherence && gymAdherence.percentage >= 100 ? 'text-success' : 'text-primary'}`}>
            {gymAdherence ? `${gymAdherence.percentage}%` : '--'}
          </div>
        </div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Weekly Score</div>
          <div className={`font-extrabold text-[1.1rem] ${weeklyScore?.score != null && weeklyScore.score >= 80 ? 'text-success' : 'text-primary'}`}>
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
                <div className="font-semibold text-primary-dark">{categoryIcon(m.category)} {m.title}</div>
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
