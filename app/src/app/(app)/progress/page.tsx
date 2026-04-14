'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { RightPanel } from '@/components/layout/right-panel'
import { dateToLocal } from '@/lib/date-utils'
import { computeWeeklyScore } from '@/lib/weekly-score'
import type { WeeklyScoreData } from '@/lib/weekly-score'
import type { Milestone } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────

interface PRRecord {
  exerciseName: string
  weight: number
  reps: number
  date: string
}

interface CheckinPoint {
  date: string
  label: string
  weight_kg: number | null
  waist_cm: number | null
  hip_cm: number | null
  thigh_cm: number | null
  low_hip_cm: number | null
  resting_hr: number | null
  hrv: number | null
  avg_calories: number | null
  avg_protein: number | null
  avg_steps: number | null
  avg_sleep_hours: number | null
  weekly_score: number | null
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

// SVG circular progress ring
function ScoreRingLarge({ score, size = 140 }: { score: number | null; size?: number }) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = score !== null ? Math.min(score, 100) / 100 : 0
  const dashOffset = circumference * (1 - progress)

  const color = score === null ? 'rgba(255,255,255,0.2)'
    : score >= 80 ? '#34D399' : score >= 60 ? '#60A5FA' : score >= 40 ? '#FBBF24' : '#F87171'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block mx-auto">
      {/* Background ring */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
      {/* Progress ring */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      {/* Score text */}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill="white" fontSize={score !== null ? '2.2rem' : '1.8rem'} fontWeight="800">
        {score !== null ? score : '- -'}
      </text>
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────

export default function ProgressPage() {
  const [loading, setLoading] = useState(true)

  // Data state
  const [prRecords, setPrRecords] = useState<PRRecord[]>([])
  const [gymAdherence, setGymAdherence] = useState<{ done: number; planned: number; percentage: number } | null>(null)
  const [weeklyScore, setWeeklyScore] = useState<WeeklyScoreData | null>(null)

  // Check-in chart
  const [checkinData, setCheckinData] = useState<CheckinPoint[]>([])
  const [checkinVars, setCheckinVars] = useState<Record<string, boolean>>({ weight_kg: true, waist_cm: true })
  const [checkinTooltip, setCheckinTooltip] = useState<{ x: number; y: number; label: string; values: { name: string; value: string; color: string }[] } | null>(null)

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
      const userId = await getUserId()

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

      // ─── Weekly Check-ins (for charts) ─────────
      const { data: checkins } = await supabase
        .from('weekly_checkins')
        .select('checkin_date, weight_kg, waist_cm, hip_cm, thigh_cm, low_hip_cm, resting_hr, hrv, avg_calories, avg_protein, avg_steps, avg_sleep_hours, weekly_score')
        .eq('user_id', userId)
        .order('checkin_date', { ascending: true })
        .limit(52)

      if (checkins && checkins.length > 0) {
        setCheckinData(checkins.map(c => {
          const d = new Date(c.checkin_date + 'T12:00:00')
          return {
            ...c,
            date: c.checkin_date,
            label: `${d.getDate()}/${d.getMonth() + 1}`,
          }
        }))
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
      const userId = await getUserId()

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

  const scoreStatus = weeklyScore?.status === 'completo' ? 'Completo'
    : weeklyScore?.status === 'parcial' ? 'Parcial' : 'Pendiente'

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {loading ? (
          <div>
            <div className="mb-7">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-7 w-32 mb-2" />
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-56" />
            </div>
            <div className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-48 mb-6" />
            <div className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-[280px] mb-6" />
          </div>
        ) : (
          <div className="fade-in">
            {/* Header */}
            <div className="mb-7">
              <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Progreso</h1>
              <p className="text-gray-500 text-[.9rem] mt-1">Tus logros, adherencia y records</p>
            </div>

            {/* ═══ 1. MILESTONES (prominent, first) ═══ */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <div className="text-[1.15rem] font-extrabold text-gray-800">
                  Hitos Personales
                </div>
                <button
                  onClick={() => setShowAddMilestone(!showAddMilestone)}
                  className="text-[.84rem] font-bold text-white bg-primary px-4 py-1.5 rounded-[var(--radius-sm)] cursor-pointer border-none hover:opacity-90 transition-opacity"
                >
                  {showAddMilestone ? 'Cancelar' : '+ Nuevo Hito'}
                </button>
              </div>

              {showAddMilestone && (
                <div className="bg-card rounded-[var(--radius)] p-[20px_22px] shadow-[var(--shadow)] mb-4 fade-in border-2 border-primary/20">
                  <div className="mb-3">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ej: Primera dominada sin asistencia"
                      className="w-full border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2.5 text-[.92rem] font-semibold outline-none focus:border-primary transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-3 mb-3">
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Descripcion (opcional)"
                      className="w-full border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.86rem] outline-none focus:border-primary transition-colors"
                    />
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.86rem] outline-none focus:border-primary"
                    />
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

              {milestones.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {milestones.map((m) => (
                    <div key={m.id} className="bg-card rounded-[var(--radius)] p-[16px_20px] shadow-[var(--shadow)] flex items-start gap-3 border-l-4 border-l-primary">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[.95rem] text-gray-800">{m.title}</div>
                        {m.description && (
                          <div className="text-[.84rem] text-gray-500 mt-1">{m.description}</div>
                        )}
                        <div className="text-[.75rem] text-gray-400 mt-1.5">{formatDate(m.milestone_date)}</div>
                      </div>
                      <button
                        onClick={() => deleteMilestone(m.id)}
                        className="text-gray-300 hover:text-danger text-[1rem] cursor-pointer bg-transparent border-none shrink-0"
                        title="Eliminar"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : !showAddMilestone ? (
                <div className="bg-card rounded-[var(--radius)] p-8 shadow-[var(--shadow)] text-center">
                  <div className="text-[1.5rem] mb-2">{'\uD83C\uDFC6'}</div>
                  <div className="text-[.95rem] font-semibold text-gray-700 mb-1">Registra tu primer hito</div>
                  <div className="text-[.84rem] text-gray-400">Primera dominada, gluteos +1cm, nuevo PR...</div>
                </div>
              ) : null}
            </div>

            {/* ═══ 2. WEEKLY SCORE (dark card with ring) ═══ */}
            <div className="bg-gradient-to-br from-[#0f4d6e] to-[#1a3a4a] rounded-[var(--radius)] p-[28px_26px] shadow-[var(--shadow)] mb-6">
              <div className="mb-5">
                <ScoreRingLarge score={weeklyScore?.score ?? null} />
              </div>
              <div className="text-center mb-5">
                <div className="font-extrabold text-[1.15rem] text-white">{scoreStatus}</div>
                <div className="text-[.84rem] text-white/60">Puntaje Semanal</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['entrenamiento', 'nutricion', 'pasos', 'sueno'] as const).map((key) => {
                  const val = weeklyScore?.breakdown[key]
                  const labels: Record<string, string> = { entrenamiento: 'Entrenamiento', nutricion: 'Nutricion', pasos: 'Pasos', sueno: 'Sueno' }
                  return (
                    <div key={key} className="bg-white/10 rounded-[var(--radius-sm)] p-[12px_14px] text-center">
                      <div className="text-[.78rem] text-white/60 mb-1">{labels[key]}</div>
                      <div className="font-extrabold text-[1.15rem] text-white">{val !== null ? val : '- -'}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ═══ 3. GYM ADHERENCE ═══ */}
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-6">
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
                  : gymAdherence && gymAdherence.planned - gymAdherence.done > 0 ? `Faltan ${gymAdherence.planned - gymAdherence.done} sesion${gymAdherence.planned - gymAdherence.done > 1 ? 'es' : ''}` : ''}
              </div>
            </div>

            {/* ═══ 4. WEEKLY CHECK-IN CHARTS ═══ */}
            {checkinData.length >= 2 && (() => {
              const varDefs = [
                { key: 'weight_kg', label: 'Peso', color: '#0EA5E9', unit: 'kg', getValue: (c: CheckinPoint) => c.weight_kg },
                { key: 'waist_cm', label: 'Cintura', color: '#F97316', unit: 'cm', getValue: (c: CheckinPoint) => c.waist_cm },
                { key: 'hip_cm', label: 'Cadera', color: '#EC4899', unit: 'cm', getValue: (c: CheckinPoint) => c.hip_cm },
                { key: 'thigh_cm', label: 'Muslo', color: '#8B5CF6', unit: 'cm', getValue: (c: CheckinPoint) => c.thigh_cm },
                { key: 'low_hip_cm', label: 'Cadera baja', color: '#14B8A6', unit: 'cm', getValue: (c: CheckinPoint) => c.low_hip_cm },
                { key: 'resting_hr', label: 'FC reposo', color: '#EF4444', unit: 'bpm', getValue: (c: CheckinPoint) => c.resting_hr },
                { key: 'hrv', label: 'HRV', color: '#6366F1', unit: 'ms', getValue: (c: CheckinPoint) => c.hrv },
                { key: 'avg_calories', label: 'Cal prom', color: '#F59E0B', unit: 'kcal', getValue: (c: CheckinPoint) => c.avg_calories },
                { key: 'avg_protein', label: 'Prot prom', color: '#A855F7', unit: 'g', getValue: (c: CheckinPoint) => c.avg_protein },
                { key: 'avg_steps', label: 'Pasos prom', color: '#06B6D4', unit: '', getValue: (c: CheckinPoint) => c.avg_steps },
                { key: 'avg_sleep_hours', label: 'Sueño prom', color: '#3B82F6', unit: 'h', getValue: (c: CheckinPoint) => c.avg_sleep_hours },
                { key: 'weekly_score', label: 'Score', color: '#10B981', unit: 'pts', getValue: (c: CheckinPoint) => c.weekly_score },
              ]

              // Only show vars that have at least 2 data points
              const availableVars = varDefs.filter(v => checkinData.filter(c => v.getValue(c) != null).length >= 2)
              const activeVars = availableVars.filter(v => checkinVars[v.key])

              const numPoints = checkinData.length
              const svgW = Math.max(350, numPoints * 40)
              const svgH = 200
              const colW = (svgW - 20) / numPoints

              // For each active var, compute min/max for scaling
              const varScales = activeVars.map(v => {
                const values = checkinData.map(c => v.getValue(c)).filter((x): x is number => x != null)
                const min = Math.min(...values)
                const max = Math.max(...values)
                const range = max - min || 1
                return { ...v, min, max, range }
              })

              const handleTap = (idx: number, cx: number) => {
                const c = checkinData[idx]
                if (checkinTooltip && checkinTooltip.label === c.label) { setCheckinTooltip(null); return }
                const values: { name: string; value: string; color: string }[] = []
                let minY = svgH
                for (const vs of varScales) {
                  const raw = vs.getValue(c)
                  if (raw != null) {
                    values.push({ name: vs.label, value: `${raw}${vs.unit ? ' ' + vs.unit : ''}`, color: vs.color })
                    const y = svgH - 30 - ((raw - vs.min) / vs.range) * (svgH - 50)
                    if (y < minY) minY = y
                  }
                }
                if (values.length === 0) { setCheckinTooltip(null); return }
                setCheckinTooltip({ x: cx, y: minY, label: c.label, values })
              }

              return (
                <div className="mb-6">
                  <div className="text-[1.08rem] font-bold text-gray-800 mb-4 flex items-center gap-2">
                    Evolucion Semanal
                    <span className="text-[.77rem] text-gray-400 font-normal">{checkinData.length} check-ins</span>
                  </div>

                  {/* Variable toggles */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {availableVars.map(v => (
                      <button
                        key={v.key}
                        onClick={() => setCheckinVars(prev => ({ ...prev, [v.key]: !prev[v.key] }))}
                        className="text-[.72rem] font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-all flex items-center gap-1"
                        style={{
                          borderColor: checkinVars[v.key] ? v.color : '#E5E7EB',
                          backgroundColor: checkinVars[v.key] ? `${v.color}15` : 'transparent',
                          color: checkinVars[v.key] ? v.color : '#9CA3AF',
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: checkinVars[v.key] ? v.color : '#D1D5DB' }} />
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {activeVars.length === 0 ? (
                    <div className="bg-card rounded-[var(--radius)] p-6 shadow-[var(--shadow)] text-center text-gray-400 text-[.88rem]">
                      Selecciona al menos una variable para ver el grafico
                    </div>
                  ) : (
                    <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] p-[14px_16px]">
                      <div className="relative overflow-x-auto" style={{ height: `${svgH + 40}px` }} onScroll={() => setCheckinTooltip(null)}>
                        <svg width={svgW} height={svgH + 30} viewBox={`0 0 ${svgW} ${svgH + 30}`} className="overflow-visible">
                          {/* Grid lines */}
                          {[0, 1, 2, 3].map(i => (
                            <line key={i} x1="10" y1={10 + i * ((svgH - 30) / 3)} x2={svgW - 10} y2={10 + i * ((svgH - 30) / 3)} stroke="#F3F4F6" strokeWidth="0.5" />
                          ))}

                          {/* Day labels */}
                          {checkinData.map((c, i) => {
                            const cx = 10 + i * colW + colW / 2
                            const showLabel = numPoints <= 20 || i % Math.ceil(numPoints / 15) === 0 || i === numPoints - 1
                            return showLabel ? (
                              <text key={i} x={cx} y={svgH + 20} textAnchor="middle" fill="#9CA3AF" fontSize={numPoints > 20 ? '7' : '8'} fontWeight="600">{c.label}</text>
                            ) : null
                          })}

                          {/* Tap columns */}
                          {checkinData.map((_, i) => {
                            const cx = 10 + i * colW + colW / 2
                            return (
                              <rect key={`t-${i}`} x={cx - colW / 2} y="0" width={colW} height={svgH} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => handleTap(i, cx)} />
                            )
                          })}

                          {/* Vertical highlight */}
                          {checkinTooltip && (
                            <line x1={checkinTooltip.x} y1="5" x2={checkinTooltip.x} y2={svgH - 10} stroke="#D1D5DB" strokeWidth="1" strokeDasharray="3,3" />
                          )}

                          {/* Lines + dots for each active variable */}
                          {varScales.map(vs => {
                            const points: { x: number; y: number; val: number }[] = []
                            checkinData.forEach((c, i) => {
                              const raw = vs.getValue(c)
                              if (raw != null) {
                                const normalized = (raw - vs.min) / vs.range
                                points.push({
                                  x: 10 + i * colW + colW / 2,
                                  y: svgH - 30 - normalized * (svgH - 50),
                                  val: raw,
                                })
                              }
                            })
                            if (points.length < 2) return null

                            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

                            // Delta badge: first vs last
                            const first = points[0].val
                            const last = points[points.length - 1].val
                            const delta = last - first
                            const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)

                            return (
                              <g key={vs.key}>
                                <path d={pathD} fill="none" stroke={vs.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                                {points.map((p, i) => (
                                  <circle key={i} cx={p.x} cy={p.y} r={numPoints <= 14 ? 3.5 : 2.5} fill={vs.color} stroke="white" strokeWidth="1.5" />
                                ))}
                                {/* Value labels for <= 14 points */}
                                {numPoints <= 14 && points.map((p, i) => (
                                  <text key={`v-${i}`} x={p.x} y={p.y - 8} textAnchor="middle" fill={vs.color} fontSize="7" fontWeight="600">
                                    {vs.key === 'avg_steps' ? `${(p.val / 1000).toFixed(1)}k` : Number.isInteger(p.val) ? p.val : p.val.toFixed(1)}
                                  </text>
                                ))}
                                {/* Delta label at end of line */}
                                <text x={points[points.length - 1].x + 6} y={points[points.length - 1].y + 3} fill={delta <= 0 && (vs.key === 'weight_kg' || vs.key.includes('cm') || vs.key === 'resting_hr') ? '#10B981' : delta > 0 && (vs.key === 'hrv' || vs.key === 'weekly_score') ? '#10B981' : delta === 0 ? '#9CA3AF' : '#EF4444'} fontSize="8" fontWeight="700" textAnchor="start">
                                  {deltaStr}
                                </text>
                              </g>
                            )
                          })}
                        </svg>

                        {/* Floating tooltip */}
                        {checkinTooltip && (
                          <div
                            className="absolute z-10 pointer-events-none"
                            style={{
                              left: `${Math.min(Math.max(checkinTooltip.x - 60, 8), svgW - 128)}px`,
                              top: `${Math.max(checkinTooltip.y - 12, 0)}px`,
                              transform: 'translateY(-100%)',
                            }}
                          >
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 min-w-[120px]">
                              <p className="text-[10px] font-bold text-gray-500 mb-1">{checkinTooltip.label}</p>
                              {checkinTooltip.values.map((v, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] leading-[18px]">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />
                                  <span className="text-gray-500">{v.name}:</span>
                                  <span className="font-semibold text-gray-800 ml-auto">{v.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ═══ 5. RECORDS ═══ */}
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
          <div className={`font-extrabold text-[1.1rem] ${weeklyScore?.score != null && weeklyScore.score >= 80 ? 'text-success' : 'text-primary'}`}>
            {weeklyScore?.score ?? '--'}
          </div>
        </div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-[22px]">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Records</div>
          <div className="font-extrabold text-[1.1rem] text-primary">{prRecords.length}</div>
        </div>

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
