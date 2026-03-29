'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { ScoreRing } from '@/components/ui/score-ring'
import { RightPanel } from '@/components/layout/right-panel'
import { useActivePhase } from '@/lib/hooks/useActivePhase'
import { useWeeklyData } from '@/lib/hooks/useWeeklyData'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache } from '@/lib/cache'
import type { Insight } from '@/lib/supabase/types'

const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export default function DashboardPage() {
  const { phase, loading: phaseLoading } = useActivePhase()
  const { data: weeklyData, loading: weeklyLoading } = useWeeklyData(phase?.id)
  const [insights, setInsights] = useState<Insight[]>([])
  const [, setSeeding] = useState(false)
  const [, setSeedDone] = useState(false)

  const fetchInsights = useCallback(async () => {
    if (!phase) return
    try {
      // Check cache first
      const cacheKey = `dashboard:insights:${phase.id}`
      const cached = getCached<Insight[]>(cacheKey)
      if (cached) {
        setInsights(cached)
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'
      const { data } = await supabase
        .from('insights')
        .select('*')
        .eq('user_id', userId)
        .eq('phase_id', phase.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) {
        setInsights(data)
        setCache(cacheKey, data)
      }
    } catch {
      // ignore
    }
  }, [phase])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  async function handleSeed() {
    setSeeding(true)
    try {
      // Try to get the current user ID
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id ?? undefined }),
      })
      const result = await res.json()
      if (result.seeded || result.skipped) {
        setSeedDone(true)
        window.location.reload()
      }
    } catch (err) {
      console.error('Error seeding:', err)
    } finally {
      setSeeding(false)
    }
  }

  const loading = phaseLoading || weeklyLoading

  // Compute derived data
  const logs = weeklyData?.logs ?? []
  const averages = weeklyData?.averages
  const checkin = weeklyData?.checkin

  // Current week info
  const weekStart = getWeekStart(new Date())
  let weekNumber = 1
  let totalWeeks = 6
  let phaseName = ''
  let phaseObjective = ''
  let phaseGoal = ''

  if (phase) {
    phaseName = phase.name
    phaseObjective = phase.objective ?? ''
    phaseGoal = phase.goal
    totalWeeks = phase.duration_weeks
    if (phase.start_date) {
      const startDate = new Date(phase.start_date)
      const now = new Date()
      weekNumber = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)))
    }
  }

  const logCount = logs.length
  const phaseProgress = phase ? Math.round((weekNumber / totalWeeks) * 100) : 0

  // Build daily table
  const dayLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
  const logsByDay: Record<string, typeof logs[0] | null> = {}
  if (weekStart) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().split('T')[0]
      logsByDay[dayLabels[i]] = logs.find((l) => l.log_date === key) ?? null
    }
  }

  const formatSteps = (s: number | null) => s ? `${(s / 1000).toFixed(1)}k` : null

  // Score data
  const score = checkin?.weekly_score ?? null
  const scoreBreakdown = checkin?.score_breakdown as Record<string, number> | null

  // Top insight
  const topInsight = insights.find((i) => i.severity === 'warning') ?? insights[0] ?? null

  // ─── No data: show onboarding ────────────────────────────────────
  if (!loading && !phase) {
    return (
      <>
        <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
          <div className="mb-7">
            <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Inicio</h1>
            <p className="text-gray-500 text-[.9rem] mt-1">Tu semana de un vistazo</p>
          </div>

          <div className="bg-gradient-to-br from-[#1d9be2] to-[#1aafcf] text-white rounded-[var(--radius)] p-[40px_30px] text-center fade-in">
            <div className="text-[2rem] mb-3">{'\uD83D\uDCAA'}</div>
            <div className="font-extrabold text-[1.3rem] mb-2">Bienvenida a FitOS!</div>
            <div className="text-[.95rem] opacity-90 mb-6 max-w-[400px] mx-auto">
              Para empezar, crea tu primera fase de entrenamiento. Despues vas a poder loguear sesiones, hacer check-ins y ver tu progreso.
            </div>
            <Link
              href="/plan"
              className="inline-block py-3 px-8 rounded-[var(--radius-sm)] bg-white text-primary-dark font-bold text-[.95rem] border-none cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,.15)] transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,.2)] hover:-translate-y-px no-underline"
            >
              Crear mi primera fase
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
            <div className="bg-card rounded-[var(--radius)] p-5 shadow-[var(--shadow)] text-center fade-in" style={{ animationDelay: '.1s' }}>
              <div className="text-[1.5rem] mb-2">{'\uD83D\uDCCB'}</div>
              <div className="font-bold text-[.9rem] text-gray-800 mb-1">1. Crea una fase</div>
              <div className="text-[.82rem] text-gray-400">Define objetivo, duracion y rutinas</div>
            </div>
            <div className="bg-card rounded-[var(--radius)] p-5 shadow-[var(--shadow)] text-center fade-in" style={{ animationDelay: '.15s' }}>
              <div className="text-[1.5rem] mb-2">{'\uD83D\uDCDD'}</div>
              <div className="font-bold text-[.9rem] text-gray-800 mb-1">2. Logueá tus dias</div>
              <div className="text-[.82rem] text-gray-400">Calorias, proteina, pasos, energia y sueno</div>
            </div>
            <div className="bg-card rounded-[var(--radius)] p-5 shadow-[var(--shadow)] text-center fade-in" style={{ animationDelay: '.2s' }}>
              <div className="text-[1.5rem] mb-2">{'\uD83D\uDCCA'}</div>
              <div className="font-bold text-[.9rem] text-gray-800 mb-1">3. Revisa tu progreso</div>
              <div className="text-[.82rem] text-gray-400">Check-ins semanales con analisis de IA</div>
            </div>
          </div>
        </main>
        <RightPanel>
          <div className="text-center py-10 text-gray-400 text-[.9rem]">
            Crea tu primera fase para empezar
          </div>
        </RightPanel>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
          <div className="mb-7">
            <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Inicio</h1>
            <p className="text-gray-500 text-[.9rem] mt-1">Tu semana de un vistazo</p>
          </div>
          {/* Skeleton: Week Status Bar */}
          <div className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-[120px] mb-[18px]" />
          {/* Skeleton: Next Session */}
          <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px]">
            <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-36 mb-3" />
            <div className="flex justify-between items-center">
              <div>
                <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-44 mb-2" />
                <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-28" />
              </div>
              <div className="bg-gray-200 animate-pulse rounded-full h-5 w-20" />
            </div>
          </div>
          {/* Skeleton: Metrics */}
          <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
                <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-16 mx-auto mb-2" />
                <div className="bg-gray-200 animate-pulse rounded-[6px] h-6 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </main>
        <RightPanel>
          <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-5">
            <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-32 mb-3" />
            <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-full mb-2" />
            <div className="bg-gray-200 animate-pulse rounded-[6px] h-2 w-full" />
          </div>
        </RightPanel>
      </>
    )
  }

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {/* Page Header */}
        <div className="mb-7">
          <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Inicio</h1>
          <p className="text-gray-500 text-[.9rem] mt-1">Tu semana de un vistazo</p>
        </div>

        {/* A. Week Status Bar */}
        <div className="bg-gradient-to-br from-[#1d9be2] to-[#1aafcf] text-white rounded-[var(--radius)] p-[26px_30px] mb-[18px] fade-in">
          <div className="flex justify-between items-center flex-wrap gap-2.5">
            <div>
              <div className="font-extrabold text-[1.15rem]">Semana {weekNumber} de {totalWeeks}</div>
              <div className="opacity-85 text-[.87rem]">{phaseName}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 py-[5px] px-3 rounded-full text-[.78rem] font-medium bg-white/20">
                {'\uD83D\uDCDD'} {logCount}/7 registros diarios
              </span>
              <span className="inline-flex items-center gap-1 py-[5px] px-3 rounded-full text-[.78rem] font-medium bg-white/20">
                {'\uD83D\uDCCA'} Check-in: {checkin ? 'completado' : 'pendiente'}
              </span>
            </div>
          </div>
          <div className="mt-4 flex gap-3.5">
            <div className="flex-1">
              <div className="text-[.72rem] opacity-70 mb-[5px]">Registros</div>
              <div className="h-1.5 rounded-lg overflow-hidden bg-white/20">
                <div className="h-full rounded-lg bg-white" style={{ width: `${Math.round((logCount / 7) * 100)}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[.72rem] opacity-70 mb-[5px]">Check-in</div>
              <div className="h-1.5 rounded-lg overflow-hidden bg-white/20">
                <div className="h-full rounded-lg bg-white" style={{ width: checkin ? '100%' : '0%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* B. Next Session */}
        {phase && phase.routines.length > 0 && (
          <div className="fade-in" style={{ animationDelay: '.05s' }}>
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px]">
              <div className="font-bold text-[1.08rem] text-gray-800 mb-2 flex items-center gap-2">
                {'\uD83D\uDCC5'} Proxima Sesion
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[.94rem]">{phase.routines[phase.routines.length - 1]?.name}</div>
                  <div className="text-[.84rem] text-gray-400">Sugerido: manana</div>
                </div>
                <Badge variant="blue">{phase.routines.length} rutinas</Badge>
              </div>
            </div>
          </div>
        )}

        {/* C. Key Metrics */}
        {checkin && (
          <div className="grid grid-cols-3 gap-4 fade-in max-sm:grid-cols-1" style={{ animationDelay: '.1s' }}>
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
              <div className="text-[.77rem] text-gray-400 mb-0.5">Peso</div>
              <div className="text-[1.25rem] font-extrabold text-gray-800">{checkin.weight_kg ?? '--'} kg</div>
            </div>
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
              <div className="text-[.77rem] text-gray-400 mb-0.5">Cintura</div>
              <div className="text-[1.25rem] font-extrabold text-gray-800">{checkin.waist_cm ?? '--'} cm</div>
            </div>
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
              <div className="text-[.77rem] text-gray-400 mb-0.5">Adherencia</div>
              <div className="text-[1.25rem] font-extrabold text-gray-800">{checkin.training_adherence ? `${Math.round(checkin.training_adherence)}%` : '--'}</div>
              {checkin.training_sets_executed != null && checkin.training_sets_planned != null && (
                <div className="text-[.8rem] text-success font-semibold">{checkin.training_sets_executed}/{checkin.training_sets_planned} series</div>
              )}
            </div>
          </div>
        )}

        {/* D. Top Insight */}
        {topInsight && (
          <div className="fade-in" style={{ animationDelay: '.15s' }}>
            <div className={`bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] border-l-4 ${topInsight.severity === 'warning' ? 'border-l-warning' : 'border-l-primary'}`}>
              <div className="font-semibold text-[.9rem] text-gray-800">
                {topInsight.severity === 'warning' ? '\u26A0\uFE0F' : '\u2139\uFE0F'} {topInsight.title}
              </div>
              <div className="text-[.84rem] text-gray-400 mt-2">
                {topInsight.body}
              </div>
              <Link
                href="/plan"
                className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-gray-200 text-gray-600 bg-card mt-4 transition-all duration-200 hover:border-primary hover:text-primary no-underline"
              >
                Corregir en Plan
              </Link>
            </div>
          </div>
        )}

        {/* Check-in CTA */}
        {!checkin && (
          <div
            className="bg-gradient-to-br from-[#0f4d6e] to-[#175563] text-white rounded-[var(--radius)] p-[26px_30px] mb-[18px] flex items-center justify-between gap-4 fade-in max-sm:flex-col max-sm:items-start"
            style={{ animationDelay: '.18s' }}
          >
            <div>
              <div className="font-bold text-base">{'\uD83D\uDCCB'} Check-in Semanal</div>
              <div className="text-[.84rem] opacity-80 mt-1">Semana {weekNumber} — Sin completar</div>
            </div>
            <Link href="/checkin" className="py-2.5 px-5 rounded-[var(--radius-sm)] bg-white text-primary-dark font-bold whitespace-nowrap border-none cursor-pointer text-[.9rem] no-underline">
              Hacer Check-in
            </Link>
          </div>
        )}

        {/* E. Daily Averages Table */}
        <div
          className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px] overflow-x-auto fade-in"
          style={{ animationDelay: '.2s' }}
        >
          <div className="font-bold text-[1.08rem] text-gray-800 mb-2.5 flex items-center gap-2">
            {'\uD83D\uDCCA'} Registros Diarios de la Semana
          </div>
          <table className="w-full text-[.8rem] border-collapse">
            <thead>
              <tr>
                <th className="py-[7px] px-2 text-center text-gray-400 font-semibold text-[.72rem] uppercase"></th>
                {dayLabels.map((d) => (
                  <th key={d} className="py-[7px] px-2 text-center text-gray-400 font-semibold text-[.72rem] uppercase">{d}</th>
                ))}
                <th className="py-[7px] px-2 text-center text-primary font-semibold text-[.72rem] uppercase">Prom</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-b border-gray-50">
                <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">Cal</td>
                {dayLabels.map((d) => (
                  <td key={d} className="py-[7px] px-2 text-center">{logsByDay[d]?.calories ?? '\u2014'}</td>
                ))}
                <td className="py-[7px] px-2 text-center font-bold text-gray-800">{averages?.avg_calories ?? '\u2014'}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">Prot</td>
                {dayLabels.map((d) => (
                  <td key={d} className="py-[7px] px-2 text-center">{logsByDay[d]?.protein_g ?? '\u2014'}</td>
                ))}
                <td className="py-[7px] px-2 text-center font-bold text-gray-800">{averages?.avg_protein ? `${averages.avg_protein}g` : '\u2014'}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">Pasos</td>
                {dayLabels.map((d) => (
                  <td key={d} className="py-[7px] px-2 text-center">{formatSteps(logsByDay[d]?.steps ?? null) ?? '\u2014'}</td>
                ))}
                <td className="py-[7px] px-2 text-center font-bold text-gray-800">{formatSteps(averages?.avg_steps ?? null) ?? '\u2014'}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">Energia</td>
                {dayLabels.map((d) => (
                  <td key={d} className="py-[7px] px-2 text-center">{logsByDay[d]?.energy ?? '\u2014'}</td>
                ))}
                <td className="py-[7px] px-2 text-center font-bold text-gray-800">{averages?.avg_energy ?? '\u2014'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      {/* Right Panel */}
      <RightPanel>
        {/* Phase Card */}
        {phase && (
          <div className="border-l-4 border-l-success p-[18px_22px] bg-card rounded-r-[var(--radius)] shadow-[var(--shadow)] mb-5 cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-[.95rem] text-gray-800">{phaseName}</div>
                  <Badge variant="green" className="text-[.66rem]">En camino</Badge>
                </div>
                {phaseObjective && (
                  <div className="mt-1.5 text-[.8rem] text-gray-500 italic leading-snug">
                    {'\uD83C\uDFAF'} {phaseObjective}
                  </div>
                )}
              </div>
              <span className="text-gray-300 text-[.9rem] ml-2">&rsaquo;</span>
            </div>
            <div className="mt-2.5">
              <div className="flex justify-between text-[.76rem] text-gray-500 mb-1">
                <span>Semana {weekNumber} de {totalWeeks}</span>
                <span>{phaseProgress}%</span>
              </div>
              <ProgressBar value={phaseProgress} variant="blue" />
            </div>
          </div>
        )}

        {/* Weekly Score */}
        {score != null && (
          <div className="bg-gradient-to-br from-[#0f4d6e] to-[#175563] text-white rounded-[var(--radius)] p-[26px] mx-[-4px]">
            <div className="text-center">
              <div className="mx-auto mb-3">
                <ScoreRing score={score} />
              </div>
              <div className="font-extrabold text-[1.02rem]">{score >= 85 ? 'Gran semana!' : score >= 70 ? 'Buena semana' : 'Semana regular'}</div>
              <div className="text-[.8rem] opacity-70 mt-1">Puntaje Semanal</div>
            </div>
            {scoreBreakdown && (
              <div className="mt-[18px] grid grid-cols-2 gap-2">
                {[
                  { label: 'Entrenamiento', key: 'training' },
                  { label: 'Nutricion', key: 'nutrition' },
                  { label: 'Pasos', key: 'steps' },
                  { label: 'Sueno', key: 'sleep' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="text-center bg-white/[.08] rounded-[10px] p-2.5"
                  >
                    <div className="text-[.7rem] opacity-60">{item.label}</div>
                    <div className="font-extrabold text-[1.05rem]">{scoreBreakdown[item.key] != null ? `${scoreBreakdown[item.key]}%` : '--'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Tips from insights */}
        {insights.length > 0 && (
          <div className="border-l-4 border-l-success p-[18px_22px] bg-card rounded-r-[var(--radius)] shadow-[var(--shadow)] mt-6">
            <div className="flex justify-between items-center mb-3.5">
              <div className="font-bold text-base text-gray-800">{'\uD83D\uDCA1'} Tips</div>
            </div>
            <div className="flex flex-col gap-2.5">
              {insights.slice(0, 4).map((insight) => (
                <div
                  key={insight.id}
                  className={`p-[10px_12px] rounded-[var(--radius-xs)] text-[.84rem] ${
                    insight.severity === 'warning' ? 'bg-warning-light' : 'bg-success-light'
                  }`}
                >
                  <div className={`font-semibold mb-0.5 ${
                    insight.severity === 'warning' ? 'text-[#92400E]' : 'text-[#065F46]'
                  }`}>
                    {insight.title}
                  </div>
                  {insight.suggestion && (
                    <div className={`opacity-80 ${
                      insight.severity === 'warning' ? 'text-[#92400E]' : 'text-[#065F46]'
                    }`}>
                      {insight.suggestion}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </RightPanel>
    </>
  )
}
