'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { dateToLocal } from '@/lib/date-utils'
import { RightPanel } from '@/components/layout/right-panel'
import type { Milestone } from '@/lib/supabase/types'

import { TimeFrameSelector } from './_components/time-frame-selector'
import { KPISummaryStrip } from './_components/kpi-summary-strip'
import { ExportButton } from './_components/export-report'
import { BodyCompositionChart } from './_components/charts/body-composition-chart'
import { BodyCompCard } from './_components/body-comp-card'
import { NutritionChart } from './_components/charts/nutrition-chart'
import { TrainingChart } from './_components/charts/training-chart'
import { WellbeingChart } from './_components/charts/wellbeing-chart'
import { RecoveryChart } from './_components/charts/recovery-chart'
import { CorrelationScatter } from './_components/charts/correlation-scatter'
import { AdherenceHeatmap } from './_components/charts/adherence-heatmap'
import { WeeklyScoreChart } from './_components/charts/weekly-score-chart'
import { useAnalyticsData, getTimeRange } from './_hooks/use-analytics-data'

// ─── Helpers ──────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

interface PRRecord {
  exerciseName: string
  weight: number
  reps: number
  date: string
}

// ─── Collapsible Section ──────────────────────────────────
function Section({ title, subtitle, children, defaultOpen = true }: { title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 cursor-pointer bg-transparent border-none text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[1.05rem] font-bold text-gray-800">{title}</span>
          {subtitle && <span className="text-[.75rem] text-gray-400 font-normal">{subtitle}</span>}
        </div>
        <span className="text-gray-400 text-[.8rem] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
          &#9660;
        </span>
      </button>
      {open && (
        <div className="bg-card rounded-[var(--radius)] p-[14px_16px] shadow-[var(--shadow)] fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────
export default function ProgressPage() {
  const [period, setPeriod] = useState('3M')
  const range = getTimeRange(period)
  const data = useAnalyticsData(range)
  const reportRef = useRef<HTMLDivElement>(null)

  // PRs (fetched separately since they need all-time data)
  const [prRecords, setPrRecords] = useState<PRRecord[]>([])
  const [prsLoaded, setPrsLoaded] = useState(false)

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDate, setNewDate] = useState(dateToLocal(new Date()))
  const [savingMilestone, setSavingMilestone] = useState(false)

  // Fetch PRs + milestones once
  const fetchExtras = useCallback(async () => {
    try {
      const supabase = createClient()
      const userId = await getUserId()

      const [sessionsRes, milestonesRes] = await Promise.all([
        supabase
          .from('executed_sessions')
          .select(`
            id, session_date,
            executed_exercises (
              id, exercise_name,
              exercises ( name ),
              executed_sets ( weight_kg, reps )
            )
          `)
          .eq('user_id', userId)
          .order('session_date', { ascending: true }),
        supabase
          .from('milestones')
          .select('*')
          .eq('user_id', userId)
          .order('milestone_date', { ascending: false }),
      ])

      if (milestonesRes.data) setMilestones(milestonesRes.data)

      const allSessions = sessionsRes.data
      if (allSessions && allSessions.length > 0) {
        const exerciseHistory: Record<string, { date: string; bestWeight: number; bestReps: number }[]> = {}

        for (const session of allSessions) {
          for (const ex of (session.executed_exercises ?? []) as any[]) {
            const exName = ex.exercise_name || ex.exercises?.name
            if (!exName) continue
            if (!exerciseHistory[exName]) exerciseHistory[exName] = []

            let bestWeight = 0
            let bestReps = 0
            for (const s of (ex.executed_sets ?? []) as any[]) {
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
          const best = history.reduce((a, b) =>
            (b.bestWeight > a.bestWeight || (b.bestWeight === a.bestWeight && b.bestReps > a.bestReps)) ? b : a
          , history[0])
          if (best.bestWeight > 0) prs.push({ exerciseName: name, weight: best.bestWeight, reps: best.bestReps, date: best.date })
        }
        prs.sort((a, b) => b.weight - a.weight)
        setPrRecords(prs)
      }
      setPrsLoaded(true)
    } catch (err) {
      console.error('Error fetching extras:', err)
      setPrsLoaded(true)
    }
  }, [])

  useEffect(() => { fetchExtras() }, [fetchExtras])

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
      if (!error) {
        setNewTitle('')
        setNewDescription('')
        setNewDate(dateToLocal(new Date()))
        setShowAddMilestone(false)
        fetchExtras()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSavingMilestone(false)
    }
  }

  async function deleteMilestone(id: string) {
    const supabase = createClient()
    await supabase.from('milestones').delete().eq('id', id)
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  const { dailyLogs, weeklyCheckins, sessions, recoverySnapshots, profile, timeline, loading } = data

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {loading && dailyLogs.length === 0 ? (
          <div>
            <div className="mb-7">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-7 w-48 mb-2" />
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-64" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-[180px] mb-5" />
            ))}
          </div>
        ) : (
          <div className="fade-in">
            {/* Header + Time Frame + Export */}
            <div className="mb-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-[1.5rem] font-extrabold text-gray-900 tracking-tight">Analytics</h1>
                  <p className="text-gray-400 text-[.84rem] mt-0.5">{range.label}</p>
                </div>
                <ExportButton containerRef={reportRef} timeLabel={range.label} />
              </div>
              <TimeFrameSelector selected={period} onChange={setPeriod} />
            </div>

            {/* Exportable container */}
            <div ref={reportRef}>
              {/* KPI Strip */}
              <div className="mb-5">
                <KPISummaryStrip dailyLogs={dailyLogs} weeklyCheckins={weeklyCheckins} sessions={sessions} />
              </div>

              {/* Body composition card — FFMI, lean mass, ratios */}
              {weeklyCheckins.length > 0 && (
                <BodyCompCard
                  latestCheckin={weeklyCheckins[weeklyCheckins.length - 1] as {
                    weight_kg: number | null
                    body_fat_pct: number | null
                    waist_cm: number | null
                    hip_cm: number | null
                  }}
                  heightCm={(profile as { height_cm: number | null } | null)?.height_cm ?? null}
                />
              )}

              {/* Body Composition */}
              {weeklyCheckins.length >= 2 && (
                <Section title="Composicion Corporal" subtitle={`${weeklyCheckins.length} check-ins`}>
                  <BodyCompositionChart checkins={weeklyCheckins} />
                </Section>
              )}

              {/* Nutrition */}
              {dailyLogs.some(l => l.calories != null) && (
                <Section title="Nutricion">
                  <NutritionChart
                    dailyLogs={dailyLogs}
                    calorieTarget={profile?.calorie_target ?? null}
                    proteinTarget={profile?.protein_target ?? null}
                  />
                </Section>
              )}

              {/* Training */}
              {dailyLogs.some(l => l.training_volume_kg != null) && (
                <Section title="Entrenamiento">
                  <TrainingChart dailyLogs={dailyLogs} />
                </Section>
              )}

              {/* Wellbeing */}
              {dailyLogs.some(l => l.energy != null || l.mood != null || l.sleep_hours != null) && (
                <Section title="Bienestar">
                  <WellbeingChart dailyLogs={dailyLogs} />
                </Section>
              )}

              {/* Recovery */}
              {recoverySnapshots.length >= 2 && (
                <Section title="Recuperacion" subtitle="Readiness score">
                  <RecoveryChart snapshots={recoverySnapshots} />
                </Section>
              )}

              {/* Weekly Score */}
              {weeklyCheckins.some(c => c.weekly_score != null) && (
                <Section title="Score Semanal">
                  <WeeklyScoreChart checkins={weeklyCheckins} />
                </Section>
              )}

              {/* Adherence Heatmap */}
              {sessions.length > 0 && (
                <Section title="Adherencia">
                  <AdherenceHeatmap sessions={sessions} from={range.from} to={range.to} />
                </Section>
              )}

              {/* Correlation */}
              <Section title="Correlaciones" subtitle="Cruza variables" defaultOpen={false}>
                <CorrelationScatter timeline={timeline} weeklyCheckins={weeklyCheckins} />
              </Section>
            </div>

            {/* PRs */}
            <Section title="Records Personales" subtitle={prRecords.length > 0 ? `${prRecords.length} ejercicios` : ''}>
              {prRecords.length > 0 ? (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full border-collapse text-[.86rem] min-w-[320px]">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="py-2 px-4 font-semibold text-[.75rem] text-gray-500 uppercase">Ejercicio</th>
                        <th className="py-2 px-3 font-semibold text-[.75rem] text-gray-500 uppercase">Record</th>
                        <th className="py-2 px-3 font-semibold text-[.75rem] text-gray-500 uppercase text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prRecords.map(pr => (
                        <tr key={pr.exerciseName} className="border-b border-gray-100">
                          <td className="py-2.5 px-4 font-semibold text-[.84rem]">{pr.exerciseName}</td>
                          <td className="py-2.5 px-3 text-primary font-bold">{pr.weight}kg x {pr.reps}</td>
                          <td className="py-2.5 px-3 text-right text-gray-400 text-[.8rem]">{formatDate(pr.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : !prsLoaded ? (
                <div className="text-center text-gray-400 py-4 text-[.86rem]">Cargando records...</div>
              ) : (
                <div className="text-center text-gray-400 py-4 text-[.86rem]">Sin records. Entrena y sincroniza con Hevy!</div>
              )}
            </Section>

            {/* Milestones */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[1.05rem] font-bold text-gray-800">Hitos Personales</span>
                <button
                  onClick={() => setShowAddMilestone(!showAddMilestone)}
                  className="text-[.78rem] font-bold text-white bg-primary px-3.5 py-1.5 rounded-full cursor-pointer border-none hover:opacity-90 transition-opacity"
                >
                  {showAddMilestone ? 'Cancelar' : '+ Hito'}
                </button>
              </div>

              {showAddMilestone && (
                <div className="bg-card rounded-[var(--radius)] p-[16px_18px] shadow-[var(--shadow)] mb-3 fade-in border-2 border-primary/20">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Ej: Primera dominada sin asistencia"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[.88rem] font-semibold outline-none focus:border-primary mb-2"
                    autoFocus
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                    <input
                      type="text"
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      placeholder="Descripcion (opcional)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-[.82rem] outline-none focus:border-primary"
                    />
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-[.82rem] outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={saveMilestone}
                    disabled={!newTitle.trim() || savingMilestone}
                    className="w-full py-2 bg-primary text-white font-semibold text-[.86rem] rounded-lg cursor-pointer border-none disabled:opacity-50"
                  >
                    {savingMilestone ? 'Guardando...' : 'Guardar Hito'}
                  </button>
                </div>
              )}

              {milestones.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {milestones.map(m => (
                    <div key={m.id} className="bg-card rounded-[var(--radius)] p-[12px_16px] shadow-[var(--shadow)] flex items-start gap-3 border-l-4 border-l-primary">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[.9rem] text-gray-800">{m.title}</div>
                        {m.description && <div className="text-[.8rem] text-gray-500 mt-0.5">{m.description}</div>}
                        <div className="text-[.72rem] text-gray-400 mt-1">{formatDate(m.milestone_date)}</div>
                      </div>
                      <button
                        onClick={() => deleteMilestone(m.id)}
                        className="text-gray-300 hover:text-danger text-[1rem] cursor-pointer bg-transparent border-none"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : !showAddMilestone && (
                <div className="bg-card rounded-[var(--radius)] p-6 shadow-[var(--shadow)] text-center">
                  <div className="text-[1.3rem] mb-1">{'\uD83C\uDFC6'}</div>
                  <div className="text-[.9rem] font-semibold text-gray-700">Registra tu primer hito</div>
                  <div className="text-[.8rem] text-gray-400">Primera dominada, nuevo PR, gluteos +1cm...</div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <RightPanel>
        <div className="font-bold text-base text-gray-800 mb-[18px]">Resumen</div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Periodo</div>
          <div className="font-extrabold text-[1rem] text-gray-800">{range.label}</div>
        </div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Sesiones</div>
          <div className="font-extrabold text-[1.1rem] text-primary">{sessions.length}</div>
        </div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Dias con datos</div>
          <div className="font-extrabold text-[1.1rem] text-primary">{dailyLogs.length}</div>
        </div>

        <div className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] mb-3">
          <div className="text-[.77rem] text-gray-400 mb-0.5">Records</div>
          <div className="font-extrabold text-[1.1rem] text-primary">{prRecords.length}</div>
        </div>

        <div className="font-bold text-base text-gray-800 mb-[14px] mt-5">Hitos</div>
        <div className="flex flex-col gap-2.5">
          {milestones.length > 0 ? (
            milestones.slice(0, 5).map(m => (
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
