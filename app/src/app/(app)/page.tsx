'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { ScoreRing } from '@/components/ui/score-ring'
import { RightPanel } from '@/components/layout/right-panel'
import { useActivePhase } from '@/lib/hooks/useActivePhase'
import { useWeeklyData } from '@/lib/hooks/useWeeklyData'
import { useProfile } from '@/lib/hooks/useProfile'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import { dateToLocal, parseLocalDate } from '@/lib/date-utils'
import { computeWeeklyScore } from '@/lib/weekly-score'
import type { Insight } from '@/lib/supabase/types'

const allDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const weekDayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

function getWeekStartDate(date: Date, weekStartDay: string): string {
  const target = weekDayMap[weekStartDay] ?? 6
  const d = new Date(date)
  const current = d.getDay()
  const diff = (current - target + 7) % 7
  d.setDate(d.getDate() - diff)
  return dateToLocal(d)
}

export default function DashboardPage() {
  const { profile } = useProfile()
  const weekStartDay = profile?.week_start_day ?? 'saturday'
  const { phase, loading: phaseLoading } = useActivePhase()
  const [tableWeekOffset, setTableWeekOffset] = useState(0)
  const { data: weeklyData, loading: weeklyLoading, refetch: refetchWeekly } = useWeeklyData(phase?.id, weekStartDay)
  const { data: tableWeekData, refetch: refetchTable } = useWeeklyData(tableWeekOffset !== 0 ? phase?.id : undefined, weekStartDay, tableWeekOffset)
  const { data: prevWeekData } = useWeeklyData(phase?.id ?? undefined, weekStartDay, tableWeekOffset - 1)
  const [insights, setInsights] = useState<Insight[]>([])
  const [recentWorkouts, setRecentWorkouts] = useState<{ id: string; session_date: string; notes: string | null; duration_minutes: number | null; total_volume_kg: number | null }[]>([])
  const [liveScore, setLiveScore] = useState<import('@/lib/weekly-score').WeeklyScoreData | null>(null)
  const [scoreContext, setScoreContext] = useState<{ sessionsDone: number; sessionsPlanned: number; avgCal: number | null; avgProt: number | null; avgSteps: number | null; avgSleep: number | null; calTarget: number | null; protTarget: number | null; stepGoal: number | null; sleepGoal: number | null } | null>(null)
  const [prevCheckin, setPrevCheckin] = useState<import('@/lib/supabase/types').WeeklyCheckin | null>(null)
  const [, setSeeding] = useState(false)
  const [, setSeedDone] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [expandedScoreKey, setExpandedScoreKey] = useState<string | null>(null)
  const [chartVars, setChartVars] = useState<Record<string, boolean>>({
    calories: true,
    protein: true,
    energy: true,
    hunger: true,
    fatigue: false,
    steps: false,
    sleep: false,
    training: false,
  })

  // Refresh dashboard data when a daily log is saved from the drawer
  useEffect(() => {
    const handler = () => {
      invalidateCache('dashboard:')
      refetchWeekly()
      refetchTable()
    }
    window.addEventListener('daily-log-saved', handler)
    return () => window.removeEventListener('daily-log-saved', handler)
  }, [refetchWeekly, refetchTable])

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
      const userId = await getUserId()
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

  // Fetch recent Hevy workouts
  const fetchRecentWorkouts = useCallback(async () => {
    try {
      const supabase = createClient()
      const userId = await getUserId()
      const { data } = await supabase
        .from('executed_sessions')
        .select('id, session_date, notes, duration_minutes, total_volume_kg')
        .eq('user_id', userId)
        .order('session_date', { ascending: false })
        .limit(3)
      if (data && data.length > 0) {
        setRecentWorkouts(data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchRecentWorkouts()
  }, [fetchRecentWorkouts])

  // Compute live weekly score from daily_logs + sessions
  const fetchLiveScore = useCallback(async () => {
    try {
      const supabase = createClient()
      const userId = await getUserId()
      const ws = profile?.week_start_day ?? 'saturday'
      const trainingDays = profile?.training_days_per_week ?? 3
      const thisWeekStart = getWeekStartDate(new Date(), ws)

      const [{ data: weekLogs }, { data: weekSessions }] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('calories, protein_g, steps, sleep_hours')
          .eq('user_id', userId)
          .gte('log_date', thisWeekStart),
        supabase
          .from('executed_sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('session_date', thisWeekStart),
      ])

      const targets = {
        calorie_target: phase?.calorie_target ?? profile?.calorie_target ?? null,
        protein_target: phase?.protein_target ?? profile?.protein_target ?? null,
        step_goal: profile?.step_goal ?? null,
        sleep_goal: profile?.sleep_goal ?? null,
      }
      const sessionsDone = weekSessions?.length ?? 0
      const wl = weekLogs ?? []

      const scoreData = computeWeeklyScore(wl, targets, { done: sessionsDone, planned: trainingDays })
      setLiveScore(scoreData)

      // Store context for actionable messages
      const avg = (vals: (number | null)[]) => {
        const v = vals.filter((x): x is number => x != null)
        return v.length > 0 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
      }
      setScoreContext({
        sessionsDone,
        sessionsPlanned: trainingDays,
        avgCal: avg(wl.map((l) => l.calories)),
        avgProt: avg(wl.map((l) => l.protein_g)),
        avgSteps: avg(wl.map((l) => l.steps)),
        avgSleep: avg(wl.map((l) => l.sleep_hours)),
        calTarget: targets.calorie_target,
        protTarget: targets.protein_target,
        stepGoal: targets.step_goal,
        sleepGoal: targets.sleep_goal,
      })
    } catch {
      // ignore
    }
  }, [profile, phase])

  useEffect(() => {
    if (profile) fetchLiveScore()
  }, [profile, phase, fetchLiveScore])

  async function handleSeed() {
    setSeeding(true)
    try {
      const userId = await getUserId()

      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
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

  // Check if there's a recent check-in (within the last 7 days) to suppress the banner
  const [recentCheckin, setRecentCheckin] = useState<import('@/lib/supabase/types').WeeklyCheckin | null>(null)

  useEffect(() => {
    if (!phase?.id) return
    ;(async () => {
      const supabase = createClient()
      const userId = await getUserId()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { data } = await supabase
        .from('weekly_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('phase_id', phase.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      setRecentCheckin(data as import('@/lib/supabase/types').WeeklyCheckin | null)
    })()
  }, [phase?.id])

  // Compute derived data
  const logs = weeklyData?.logs ?? []
  const averages = weeklyData?.averages
  // Use the current week's check-in, or fall back to any recent check-in (last 7 days)
  const checkin = weeklyData?.checkin ?? recentCheckin

  // Fetch previous weekly check-in for delta comparison
  useEffect(() => {
    if (!phase?.id || !checkin) return
    ;(async () => {
      try {
        const supabase = createClient()
        const userId = await getUserId()
        const { data } = await supabase
          .from('weekly_checkins')
          .select('*')
          .eq('user_id', userId)
          .eq('phase_id', phase.id)
          .lt('checkin_date', checkin.checkin_date)
          .order('checkin_date', { ascending: false })
          .limit(1)
          .single()
        if (data) setPrevCheckin(data as import('@/lib/supabase/types').WeeklyCheckin)
      } catch {
        // no previous checkin — that's fine
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase?.id, checkin?.checkin_date])

  // Current week info
  const weekStart = getWeekStartDate(new Date(), weekStartDay)
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
  const phaseProgress = phase ? Math.round(((weekNumber - 1) / totalWeeks) * 100) : 0

  // Build daily table (supports week navigation)
  const tableLogs = tableWeekOffset !== 0 ? (tableWeekData?.logs ?? []) : logs
  const tableAverages = tableWeekOffset !== 0 ? tableWeekData?.averages : averages
  const prevAverages = prevWeekData?.averages

  // Week-over-week delta for PROM column
  const WoW = ({ current, previous, inverse }: { current: number | null | undefined; previous: number | null | undefined; inverse?: boolean }) => {
    if (current == null || previous == null || previous === 0) return null
    const pct = Math.round(((current - previous) / Math.abs(previous)) * 100)
    if (pct === 0) return null
    const isUp = pct > 0
    const isGood = inverse ? !isUp : isUp
    return (
      <div className="text-[.62rem] font-medium leading-tight" style={{ color: isGood ? '#10B981' : '#EF4444' }}>
        {isUp ? '\u2191' : '\u2193'}{Math.abs(pct)}%
      </div>
    )
  }

  const tableBaseDate = new Date()
  if (tableWeekOffset !== 0) tableBaseDate.setDate(tableBaseDate.getDate() + tableWeekOffset * 7)
  const tableWeekStart = getWeekStartDate(tableBaseDate, weekStartDay)

  const startIdx = weekDayMap[weekStartDay] ?? 6
  const dayLabels = Array.from({ length: 7 }, (_, i) => allDays[(startIdx + i) % 7])
  const logsByDay: Record<string, typeof tableLogs[0] | null> = {}
  if (tableWeekStart) {
    for (let i = 0; i < 7; i++) {
      const d = parseLocalDate(tableWeekStart)
      d.setDate(d.getDate() + i)
      const key = dateToLocal(d)
      logsByDay[dayLabels[i]] = tableLogs.find((l) => l.log_date === key) ?? null
    }
  }

  // Find which day label corresponds to the check-in date
  const checkinDayLabel: string | null = (() => {
    if (!checkin?.checkin_date || !tableWeekStart) return null
    for (let i = 0; i < 7; i++) {
      const d = parseLocalDate(tableWeekStart)
      d.setDate(d.getDate() + i)
      if (dateToLocal(d) === checkin.checkin_date) return dayLabels[i]
    }
    return null
  })()

  // Format table week range for display
  const tableWeekEnd = parseLocalDate(tableWeekStart)
  tableWeekEnd.setDate(tableWeekEnd.getDate() + 6)
  const formatShortDate = (dateStr: string) => {
    const d = parseLocalDate(dateStr)
    return `${d.getDate()}/${d.getMonth() + 1}`
  }
  const tableWeekLabel = `${formatShortDate(tableWeekStart)} – ${formatShortDate(dateToLocal(tableWeekEnd))}`

  const formatSteps = (s: number | null) => s ? `${(s / 1000).toFixed(1)}k` : null

  // Battery bar for 1-5 scale metrics
  const BatteryBar = ({ value, color, inverse }: { value: number | null | undefined; color: string; inverse?: boolean }) => {
    if (value == null) return <span className="text-gray-300">{'\u2014'}</span>
    const v = Math.round(value)
    const displayColor = inverse ? (v <= 2 ? '#10B981' : v <= 3 ? '#F59E0B' : '#EF4444') : (v >= 4 ? '#10B981' : v >= 3 ? '#F59E0B' : '#EF4444')
    return (
      <div className="flex items-center justify-center gap-[2px]" title={`${value}/5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-[5px] rounded-[1px]"
            style={{
              height: `${8 + i * 2}px`,
              backgroundColor: i <= v ? displayColor : '#E5E7EB',
            }}
          />
        ))}
      </div>
    )
  }

  // Score data (live computation)
  const score = liveScore?.score ?? null
  const scoreBreakdown: Record<string, number | null> | null = liveScore ? {
    training: liveScore.breakdown.entrenamiento,
    nutrition: liveScore.breakdown.nutricion,
    steps: liveScore.breakdown.pasos,
    sleep: liveScore.breakdown.sueno,
  } : null

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

        {/* B. Next Session — removed */}

        {/* C. Key Metrics */}
        {checkin && (
          <div className="grid grid-cols-3 gap-4 fade-in max-sm:grid-cols-1" style={{ animationDelay: '.1s' }}>
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
              <div className="text-[.77rem] text-gray-400 mb-0.5">Peso</div>
              <div className="text-[1.25rem] font-extrabold text-gray-800">{checkin.weight_kg ?? '--'} kg</div>
              {checkin.weight_kg != null && prevCheckin?.weight_kg != null && (
                <div className={`text-[.75rem] font-semibold mt-0.5 ${checkin.weight_kg - prevCheckin.weight_kg < 0 ? 'text-success' : checkin.weight_kg - prevCheckin.weight_kg > 0 ? 'text-warning' : 'text-gray-400'}`}>
                  {checkin.weight_kg - prevCheckin.weight_kg > 0 ? '▲' : checkin.weight_kg - prevCheckin.weight_kg < 0 ? '▼' : '='} {Math.abs(Math.round((checkin.weight_kg - prevCheckin.weight_kg) * 10) / 10)} kg
                </div>
              )}
            </div>
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
              <div className="text-[.77rem] text-gray-400 mb-0.5">Cintura</div>
              <div className="text-[1.25rem] font-extrabold text-gray-800">{checkin.waist_cm ?? '--'} cm</div>
              {checkin.waist_cm != null && prevCheckin?.waist_cm != null && (
                <div className={`text-[.75rem] font-semibold mt-0.5 ${checkin.waist_cm - prevCheckin.waist_cm < 0 ? 'text-success' : checkin.waist_cm - prevCheckin.waist_cm > 0 ? 'text-warning' : 'text-gray-400'}`}>
                  {checkin.waist_cm - prevCheckin.waist_cm > 0 ? '▲' : checkin.waist_cm - prevCheckin.waist_cm < 0 ? '▼' : '='} {Math.abs(Math.round((checkin.waist_cm - prevCheckin.waist_cm) * 10) / 10)} cm
                </div>
              )}
            </div>
            <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
              <div className="text-[.77rem] text-gray-400 mb-0.5">Adherencia</div>
              <div className="text-[1.25rem] font-extrabold text-gray-800">
                {(() => {
                  // Live calculation from scoreContext, fallback to checkin data
                  if (scoreContext && scoreContext.sessionsPlanned > 0) {
                    return `${Math.round((scoreContext.sessionsDone / scoreContext.sessionsPlanned) * 100)}%`
                  }
                  if (checkin.training_adherence) return `${Math.round(checkin.training_adherence)}%`
                  return '--'
                })()}
              </div>
              {scoreContext && scoreContext.sessionsPlanned > 0 && (
                <div className="text-[.8rem] text-success font-semibold">{scoreContext.sessionsDone}/{scoreContext.sessionsPlanned} sesiones</div>
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

        {/* Mobile Score Card (hidden on lg where RightPanel is visible) */}
        <div className="lg:hidden bg-gradient-to-br from-[#0f4d6e] to-[#175563] text-white rounded-[var(--radius)] p-[22px] mb-[18px] fade-in" style={{ animationDelay: '.15s' }}>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <ScoreRing score={score ?? 0} label={score == null ? '--' : undefined} />
            </div>
            <div className="flex-1">
              <div className="font-extrabold text-[1rem]">
                {score != null
                  ? score >= 85 ? '\u00A1Gran semana!' : score >= 70 ? 'Buena semana' : 'Semana regular'
                  : 'Pendiente'}
              </div>
              <div className="text-[.78rem] opacity-70">Puntaje Semanal</div>
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {([
                  { label: 'Entreno', key: 'training', emoji: '\uD83C\uDFCB\uFE0F' },
                  { label: 'Nutri', key: 'nutrition', emoji: '\uD83C\uDF4E' },
                  { label: 'Pasos', key: 'steps', emoji: '\uD83D\uDEB6' },
                  { label: 'Sueno', key: 'sleep', emoji: '\uD83D\uDE34' },
                ] as const).map((item) => {
                  const val = scoreBreakdown && scoreBreakdown[item.key] != null ? scoreBreakdown[item.key] : null
                  return (
                    <div key={item.key} className="text-center bg-white/[.08] rounded-[8px] py-1.5 px-1">
                      <div className="text-[.6rem] opacity-60">{item.emoji}</div>
                      <div className="font-extrabold text-[.9rem]">{val != null ? `${val}%` : '--'}</div>
                      <div className="text-[.55rem] opacity-50">{item.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* E. Daily Averages Table + Chart */}
        <div
          className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px] overflow-x-auto fade-in"
          style={{ animationDelay: '.2s' }}
        >
          <div className="flex justify-between items-center mb-2.5">
            <div className="font-bold text-[1.08rem] text-gray-800 flex items-center gap-2">
              {'\uD83D\uDCCA'} Registros Diarios
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTableWeekOffset(tableWeekOffset - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full border-[1.5px] border-gray-200 text-gray-500 hover:border-primary hover:text-primary cursor-pointer transition-all duration-200 text-[.8rem]"
                >
                  ‹
                </button>
                <span className="text-[.75rem] text-gray-500 font-medium min-w-[90px] text-center">
                  {tableWeekOffset === 0 ? 'Esta semana' : tableWeekLabel}
                </span>
                <button
                  onClick={() => setTableWeekOffset(tableWeekOffset + 1)}
                  disabled={tableWeekOffset >= 0}
                  className={`w-7 h-7 flex items-center justify-center rounded-full border-[1.5px] cursor-pointer transition-all duration-200 text-[.8rem] ${
                    tableWeekOffset >= 0
                      ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                  }`}
                >
                  ›
                </button>
              </div>
              <button
                onClick={() => setShowChart(!showChart)}
                className={`py-1.5 px-3 rounded-[var(--radius-xs)] text-[.78rem] font-semibold cursor-pointer border-[1.5px] transition-all duration-200 ${
                  showChart
                    ? 'bg-primary text-white border-primary'
                    : 'bg-transparent text-gray-500 border-gray-200 hover:border-primary hover:text-primary'
                }`}
              >
                {showChart ? '📋 Tabla' : '📈 Grafico'}
              </button>
            </div>
          </div>

          {!showChart ? (
            /* ── TABLE VIEW ── */
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
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\uD83D\uDD25'} Cal</td>
                  {dayLabels.map((d) => (
                    <td key={d} className="py-[7px] px-2 text-center">{logsByDay[d]?.calories ?? '\u2014'}</td>
                  ))}
                  <td className="py-[7px] px-2 text-center font-bold text-gray-800">
                    {tableAverages?.avg_calories ?? '\u2014'}
                    <WoW current={tableAverages?.avg_calories} previous={prevAverages?.avg_calories} />
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\uD83E\uDD69'} Prot</td>
                  {dayLabels.map((d) => (
                    <td key={d} className="py-[7px] px-2 text-center">{logsByDay[d]?.protein_g ?? '\u2014'}</td>
                  ))}
                  <td className="py-[7px] px-2 text-center font-bold text-gray-800">
                    {tableAverages?.avg_protein ? `${tableAverages.avg_protein}g` : '\u2014'}
                    <WoW current={tableAverages?.avg_protein} previous={prevAverages?.avg_protein} />
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\uD83D\uDEB6'} Pasos</td>
                  {dayLabels.map((d) => (
                    <td key={d} className="py-[7px] px-2 text-center">{formatSteps(logsByDay[d]?.steps ?? null) ?? '\u2014'}</td>
                  ))}
                  <td className="py-[7px] px-2 text-center font-bold text-gray-800">
                    {formatSteps(tableAverages?.avg_steps ?? null) ?? '\u2014'}
                    <WoW current={tableAverages?.avg_steps} previous={prevAverages?.avg_steps} />
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\uD83D\uDCA4'} Sueno</td>
                  {dayLabels.map((d) => (
                    <td key={d} className="py-[7px] px-2 text-center">{logsByDay[d]?.sleep_hours ?? '\u2014'}</td>
                  ))}
                  <td className="py-[7px] px-2 text-center font-bold text-gray-800">
                    {tableAverages?.avg_sleep_hours ? `${tableAverages.avg_sleep_hours}h` : '\u2014'}
                    <WoW current={tableAverages?.avg_sleep_hours} previous={prevAverages?.avg_sleep_hours} />
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\u26A1'} Energia</td>
                  {dayLabels.map((d) => (
                    <td key={d} className="py-[7px] px-2 text-center"><BatteryBar value={logsByDay[d]?.energy} color="#10B981" /></td>
                  ))}
                  <td className="py-[7px] px-2 text-center">
                    <BatteryBar value={tableAverages?.avg_energy} color="#10B981" />
                    <WoW current={tableAverages?.avg_energy} previous={prevAverages?.avg_energy} />
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\uD83C\uDF7D\uFE0F'} Hambre</td>
                  {dayLabels.map((d) => (
                    <td key={d} className="py-[7px] px-2 text-center"><BatteryBar value={logsByDay[d]?.hunger} color="#F59E0B" inverse /></td>
                  ))}
                  <td className="py-[7px] px-2 text-center">
                    <BatteryBar value={tableAverages?.avg_hunger} color="#F59E0B" inverse />
                    <WoW current={tableAverages?.avg_hunger} previous={prevAverages?.avg_hunger} inverse />
                  </td>
                </tr>
                <tr>
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\uD83E\uDDD8'} Fatiga</td>
                  {dayLabels.map((d) => (
                    <td key={d} className="py-[7px] px-2 text-center"><BatteryBar value={logsByDay[d]?.fatigue_level} color="#EF4444" inverse /></td>
                  ))}
                  <td className="py-[7px] px-2 text-center">
                    <BatteryBar value={tableAverages?.avg_fatigue} color="#EF4444" inverse />
                    <WoW current={tableAverages?.avg_fatigue} previous={prevAverages?.avg_fatigue} inverse />
                  </td>
                </tr>
                <tr>
                  <td className="py-[7px] px-2 text-left font-semibold text-gray-500 text-[.72rem]">{'\uD83C\uDFCB\uFE0F'} Entreno</td>
                  {dayLabels.map((d) => {
                    const log = logsByDay[d]
                    if (!log?.training_variant) return <td key={d} className="py-[7px] px-2 text-center text-gray-300">{'\u2014'}</td>
                    return (
                      <td key={d} className="py-[7px] px-2 text-center">
                        <span className="font-bold text-primary text-[.75rem]">{log.training_variant}</span>
                        {log.training_volume_kg ? <span className="text-gray-500 text-[.68rem] block">{(log.training_volume_kg / 1000).toFixed(1)}t</span> : null}
                        {log.pr_count ? <span className="text-green-600 text-[.68rem] block">{log.pr_count}PR</span> : null}
                      </td>
                    )
                  })}
                  <td className="py-[7px] px-2 text-center font-bold text-gray-800 text-[.72rem]">
                    {(() => {
                      const trainDays = dayLabels.filter((d) => logsByDay[d]?.training_variant)
                      const totalVol = trainDays.reduce((sum, d) => sum + (logsByDay[d]?.training_volume_kg ?? 0), 0)
                      const totalPrs = trainDays.reduce((sum, d) => sum + (logsByDay[d]?.pr_count ?? 0), 0)
                      if (trainDays.length === 0) return '\u2014'
                      return (
                        <>
                          <span>{trainDays.length}d</span>
                          {totalVol > 0 && <span className="block text-[.68rem] text-gray-500">{(totalVol / 1000).toFixed(1)}t</span>}
                          {totalPrs > 0 && <span className="block text-[.68rem] text-green-600">{totalPrs}PR</span>}
                        </>
                      )
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            /* ── CHART VIEW ── */
            <div className="fade-in">
              {/* Variable toggles */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {([
                  { key: 'calories', label: 'Cal', color: '#0EA5E9' },
                  { key: 'protein', label: 'Prot', color: '#8B5CF6' },
                  { key: 'energy', label: 'Energia', color: '#10B981' },
                  { key: 'hunger', label: 'Hambre', color: '#F59E0B' },
                  { key: 'fatigue', label: 'Fatiga', color: '#EF4444' },
                  { key: 'steps', label: 'Pasos', color: '#06B6D4' },
                  { key: 'sleep', label: 'Sueno', color: '#6366F1' },
                  { key: 'training', label: 'Entreno', color: '#F97316' },
                ] as const).map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setChartVars((prev) => ({ ...prev, [v.key]: !prev[v.key] }))}
                    className={`py-1 px-2.5 rounded-full text-[.72rem] font-semibold cursor-pointer border-[1.5px] transition-all duration-200 flex items-center gap-1`}
                    style={{
                      borderColor: chartVars[v.key] ? v.color : '#E5E7EB',
                      backgroundColor: chartVars[v.key] ? `${v.color}15` : 'transparent',
                      color: chartVars[v.key] ? v.color : '#9CA3AF',
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartVars[v.key] ? v.color : '#D1D5DB' }} />
                    {v.label}
                  </button>
                ))}
              </div>

              {/* SVG Line Chart */}
              <div className="relative h-[200px] w-full">
                <svg width="100%" height="100%" viewBox="0 0 350 200" preserveAspectRatio="xMidYMid meet" className="overflow-visible">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line key={i} x1="5" y1={10 + i * 42} x2="345" y2={10 + i * 42} stroke="#F3F4F6" strokeWidth="0.5" />
                  ))}
                  {/* Day labels */}
                  {dayLabels.map((d, i) => {
                    const cx = 5 + i * (340 / 7) + (340 / 14)
                    const isCheckinDay = d === checkinDayLabel
                    return (
                      <g key={d}>
                        <text x={cx} y="198" textAnchor="middle" fill={isCheckinDay ? '#0EA5E9' : '#9CA3AF'} fontSize="9" fontWeight={isCheckinDay ? '700' : '600'}>{d}</text>
                        {isCheckinDay && (
                          <>
                            <line x1={cx} y1="10" x2={cx} y2="178" stroke="#0EA5E9" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.35" />
                            <text x={cx} y="190" textAnchor="middle" fill="#0EA5E9" fontSize="7" fontWeight="600">{'\u2713'} check-in</text>
                          </>
                        )}
                      </g>
                    )
                  })}

                  {/* Plot each enabled variable */}
                  {([
                    { key: 'calories', color: '#0EA5E9', getValue: (log: typeof logs[0] | null) => log?.calories, scale: (v: number) => Math.min(v / 3000, 1) },
                    { key: 'protein', color: '#8B5CF6', getValue: (log: typeof logs[0] | null) => log?.protein_g, scale: (v: number) => Math.min(v / 250, 1) },
                    { key: 'energy', color: '#10B981', getValue: (log: typeof logs[0] | null) => log?.energy, scale: (v: number) => v / 5 },
                    { key: 'hunger', color: '#F59E0B', getValue: (log: typeof logs[0] | null) => log?.hunger, scale: (v: number) => v / 5 },
                    { key: 'fatigue', color: '#EF4444', getValue: (log: typeof logs[0] | null) => log?.fatigue_level, scale: (v: number) => v / 5 },
                    { key: 'steps', color: '#06B6D4', getValue: (log: typeof logs[0] | null) => log?.steps, scale: (v: number) => Math.min(v / 20000, 1) },
                    { key: 'sleep', color: '#6366F1', getValue: (log: typeof logs[0] | null) => log?.sleep_hours, scale: (v: number) => Math.min(v / 10, 1) },
                    { key: 'training', color: '#F97316', getValue: (log: typeof logs[0] | null) => log?.training_volume_kg, scale: (v: number) => Math.min(v / 15000, 1) },
                  ] as const).filter((v) => chartVars[v.key]).map((variable) => {
                    const colW = 340 / 7
                    const points: { x: number; y: number; value: number }[] = []
                    dayLabels.forEach((d, i) => {
                      const log = logsByDay[d]
                      const raw = variable.getValue(log)
                      if (raw != null) {
                        const normalized = variable.scale(raw)
                        points.push({
                          x: 5 + i * colW + colW / 2,
                          y: 170 - normalized * 160,
                          value: raw,
                        })
                      }
                    })

                    if (points.length < 1) return null

                    const pathD = points.length === 1
                      ? ''
                      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

                    return (
                      <g key={variable.key}>
                        {points.length > 1 && (
                          <path d={pathD} fill="none" stroke={variable.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                        )}
                        {points.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="3" fill={variable.color} stroke="white" strokeWidth="1.5" />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fill={variable.color} fontSize="7" fontWeight="600">
                              {variable.key === 'calories' ? p.value : variable.key === 'steps' ? `${(p.value / 1000).toFixed(1)}k` : variable.key === 'sleep' ? `${p.value}h` : variable.key === 'protein' ? `${p.value}g` : variable.key === 'training' ? `${(p.value / 1000).toFixed(1)}t` : p.value}
                            </text>
                          </g>
                        ))}
                      </g>
                    )
                  })}
                </svg>
              </div>

              <div className="mt-2 text-[.72rem] text-gray-400 text-center">
                Cada variable se normaliza a su escala (cal: 0-3000, 1-5 para energia/hambre/fatiga, pasos: 0-20k)
              </div>
            </div>
          )}
        </div>

        {/* Coach: insights appear in Progress page */}
      </main>

      {/* Right Panel */}
      <RightPanel>
        {/* 1. Fase Activa — border-card */}
        {phase ? (
          <Link href="/plan" className="block mb-5 no-underline">
            <div className="border border-gray-200 p-[18px_22px] bg-card rounded-[var(--radius)] cursor-pointer hover:border-gray-300 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-[.95rem] text-gray-800">{phaseName}</div>
                    <span className="text-[.66rem] font-semibold text-primary bg-primary-light px-2 py-0.5 rounded-full">Activa</span>
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
          </Link>
        ) : (
          <Link href="/plan" className="block mb-5 no-underline">
            <div className="bg-gradient-to-br from-[#1d9be2] to-[#1aafcf] text-white rounded-[var(--radius)] p-[22px] text-center">
              <div className="text-[1.5rem] mb-2">{'\uD83D\uDE80'}</div>
              <div className="font-bold text-[.95rem] mb-1">Crea tu primera fase</div>
              <div className="text-[.82rem] opacity-80">Define objetivo, duracion y rutinas para empezar a trackear</div>
            </div>
          </Link>
        )}

        {/* 2. Puntaje Semanal — gradient-card-dark (always visible) */}
        <div className="bg-gradient-to-br from-[#0f4d6e] to-[#175563] text-white rounded-[var(--radius)] p-[26px] mx-[-4px] mb-5">
          <div className="text-center">
            <div className="mx-auto mb-3">
              <ScoreRing score={score ?? 0} label={score == null ? '--' : undefined} />
            </div>
            <div className="font-extrabold text-[1.02rem]">
              {score != null
                ? score >= 85 ? '\u00A1Gran semana!' : score >= 70 ? 'Buena semana' : 'Semana regular'
                : 'Pendiente'}
            </div>
            <div className="text-[.8rem] opacity-70 mt-1">Puntaje Semanal</div>
          </div>
          <div className="mt-[18px] grid grid-cols-2 gap-2">
            {(() => {
              const ctx = scoreContext
              const getMsg = (key: string): string => {
                if (!ctx) return ''
                switch (key) {
                  case 'training': {
                    const left = ctx.sessionsPlanned - ctx.sessionsDone
                    if (left <= 0) return 'Completaste todas las sesiones!'
                    return `Te ${left === 1 ? 'falta' : 'faltan'} ${left} de ${ctx.sessionsPlanned} sesiones`
                  }
                  case 'nutrition': {
                    const parts: string[] = []
                    if (ctx.calTarget && ctx.avgCal != null) {
                      const diff = ctx.avgCal - ctx.calTarget
                      if (Math.abs(diff) < 50) parts.push('Calorias en objetivo')
                      else if (diff > 0) parts.push(`+${diff} cal sobre objetivo`)
                      else parts.push(`${Math.abs(diff)} cal bajo objetivo`)
                    }
                    if (ctx.protTarget && ctx.avgProt != null) {
                      const diff = ctx.avgProt - ctx.protTarget
                      if (diff >= 0) parts.push('Proteina OK')
                      else parts.push(`Faltan ${Math.abs(diff)}g de proteina`)
                    }
                    return parts.length > 0 ? parts.join('. ') : 'Sin objetivos configurados'
                  }
                  case 'steps': {
                    if (ctx.stepGoal && ctx.avgSteps != null) {
                      const pct = Math.round((ctx.avgSteps / ctx.stepGoal) * 100)
                      if (pct >= 100) return `${(ctx.avgSteps / 1000).toFixed(1)}k promedio. Objetivo cumplido!`
                      return `${(ctx.avgSteps / 1000).toFixed(1)}k de ${(ctx.stepGoal / 1000).toFixed(0)}k objetivo`
                    }
                    return ctx.avgSteps ? `${(ctx.avgSteps / 1000).toFixed(1)}k promedio` : 'Sin datos'
                  }
                  case 'sleep': {
                    if (ctx.sleepGoal && ctx.avgSleep != null) {
                      if (ctx.avgSleep >= ctx.sleepGoal) return `${ctx.avgSleep}h promedio. Objetivo cumplido!`
                      const diff = (ctx.sleepGoal - ctx.avgSleep).toFixed(1)
                      return `${ctx.avgSleep}h de ${ctx.sleepGoal}h objetivo (-${diff}h)`
                    }
                    return ctx.avgSleep ? `${ctx.avgSleep}h promedio` : 'Sin datos'
                  }
                  default: return ''
                }
              }

              return ([
                { label: 'Entrenamiento', key: 'training', emoji: '\uD83C\uDFCB\uFE0F' },
                { label: 'Nutricion', key: 'nutrition', emoji: '\uD83C\uDF4E' },
                { label: 'Pasos', key: 'steps', emoji: '\uD83D\uDEB6' },
                { label: 'Sueno', key: 'sleep', emoji: '\uD83D\uDE34' },
              ] as const).map((item) => {
                const val = scoreBreakdown && scoreBreakdown[item.key] != null ? scoreBreakdown[item.key] : null
                const msg = getMsg(item.key)
                return (
                  <div
                    key={item.key}
                    className="text-center bg-white/[.08] rounded-[10px] p-2.5"
                  >
                    <div className="text-[.7rem] opacity-60">{item.emoji} {item.label}</div>
                    <div className="font-extrabold text-[1.05rem]">
                      {val != null ? `${val}%` : '--'}
                    </div>
                    {msg && (
                      <div className="text-[.65rem] opacity-50 mt-1 leading-snug">
                        {msg}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </div>

        {/* 3. Tips para la Proxima Sesion — border-card with colored tip cards */}
        {insights.length > 0 && (
          <div className="border border-gray-200 bg-card rounded-[var(--radius)] p-[18px_22px]">
            <div className="flex justify-between items-center mb-3.5">
              <div className="font-bold text-[.95rem] text-gray-800">{'\uD83D\uDCA1'} Tips para la Proxima Sesion</div>
            </div>
            <div className="flex flex-col gap-2.5">
              {insights.map((insight) => {
                // Color mapping: progression -> green, stall/warning -> yellow, info/focus -> blue
                const isProgression = insight.insight_type === 'progression' && insight.severity === 'info'
                const isWarning = insight.severity === 'warning'
                // Default to blue (focus) for other info-type insights
                const bgClass = isProgression
                  ? 'bg-success-light'
                  : isWarning
                    ? 'bg-warning-light'
                    : 'bg-primary-light'
                const textClass = isProgression
                  ? 'text-[#065F46]'
                  : isWarning
                    ? 'text-[#92400E]'
                    : 'text-[var(--primary-dark)]'
                const icon = isProgression
                  ? '\u2B06'
                  : isWarning
                    ? '\u23F8'
                    : '\uD83C\uDFAF'

                return (
                  <div
                    key={insight.id}
                    className={`p-[10px_12px] rounded-[var(--radius-xs)] text-[.84rem] ${bgClass}`}
                  >
                    <div className={`font-semibold mb-0.5 ${textClass}`}>
                      {icon} {insight.title}
                    </div>
                    {insight.body && (
                      <div className={`opacity-80 ${textClass}`}>
                        {insight.body}
                      </div>
                    )}
                    {insight.suggestion && (
                      <div className={`mt-1 text-[.78rem] font-medium opacity-90 ${textClass}`}>
                        {insight.suggestion}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </RightPanel>
    </>
  )
}
