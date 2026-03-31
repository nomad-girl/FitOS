'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { RightPanel } from '@/components/layout/right-panel'
import { dateToLocal } from '@/lib/date-utils'

// ─── Types for processed data ──────────────────────────────────────

interface ExerciseProgression {
  name: string
  best: string
  trend: 'up' | 'stall' | 'maintain'
  trendLabel: string
  change: string
  changeColor: string
  highlight?: boolean
}

interface SessionCard {
  id: string
  name: string
  date: string
  duration: string
  setsCompleted: number
  setsPlanned: number
  badge: 'green' | 'yellow' | 'red'
  borderColor: string
}

interface ComparisonExercise {
  name: string
  plan: string
  actual: string
  status: string
  statusColor: string
}

interface ComparisonData {
  exercises: ComparisonExercise[]
  warning?: string
}

interface QuickStat {
  label: string
  value: string
  color?: string
}

interface PRRecord {
  exerciseName: string
  weight: number
  reps: number
  date: string
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return `${h}h ${m > 0 ? m + 'min' : ''}`
}

function sparklinePoints(values: number[], width: number, height: number, padding: number = 10): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (width - padding * 2) / Math.max(values.length - 1, 1)
  return values
    .map((v, i) => {
      const x = padding + i * step
      const y = height - padding - ((v - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
}

function sparklineArea(values: number[], width: number, height: number, padding: number = 10): string {
  const pts = sparklinePoints(values, width, height, padding)
  if (!pts) return ''
  const firstX = padding
  const lastX = padding + (values.length - 1) * ((width - padding * 2) / Math.max(values.length - 1, 1))
  return `${pts} ${lastX},${height - padding} ${firstX},${height - padding}`
}

// ─── Main component ────────────────────────────────────────────────

export default function ProgressPage() {
  const [comparisonSession, setComparisonSession] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Data state
  const [exerciseData, setExerciseData] = useState<ExerciseProgression[]>([])
  const [sessions, setSessions] = useState<SessionCard[]>([])
  const [comparisonData, setComparisonData] = useState<Record<string, ComparisonData>>({})
  const [quickStats, setQuickStats] = useState<QuickStat[]>([])
  const [prRecords, setPrRecords] = useState<PRRecord[]>([])

  // Sparkline data
  const [weightData, setWeightData] = useState<{ values: number[]; current: number | null; change: number | null }>({ values: [], current: null, change: null })
  const [waistData, setWaistData] = useState<{ values: number[]; current: number | null; change: number | null }>({ values: [], current: null, change: null })
  const [volumeData, setVolumeData] = useState<{ values: number[]; current: number | null; trending: boolean }>({ values: [], current: null, trending: false })

  // Streak
  const [streakWeeks, setStreakWeeks] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // ─── 1. Fetch recent sessions (last 2 weeks) ────────────
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      const twoWeeksStr = dateToLocal(twoWeeksAgo)

      const { data: recentSessions } = await supabase
        .from('executed_sessions')
        .select(`
          *,
          routines ( name ),
          executed_exercises (
            id,
            display_order,
            exercise_id,
            routine_exercise_id,
            exercises ( name ),
            executed_sets ( id, set_number, weight_kg, reps, rpe, duration_seconds ),
            routine_exercises (
              exercises ( name ),
              routine_sets ( set_number, rep_range_low, rep_range_high, target_weight, target_rpe, duration_seconds )
            )
          )
        `)
        .eq('user_id', userId)
        .gte('session_date', twoWeeksStr)
        .order('session_date', { ascending: false })
        .limit(10)

      // ─── 2. Fetch ALL sessions for exercise progression (last 8 weeks) ─
      const eightWeeksAgo = new Date()
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
      const eightWeeksStr = dateToLocal(eightWeeksAgo)

      const fourWeeksAgo = new Date()
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
      const fourWeeksStr = dateToLocal(fourWeeksAgo)

      const { data: allSessions } = await supabase
        .from('executed_sessions')
        .select(`
          id, session_date, duration_minutes,
          executed_exercises (
            id,
            exercise_id,
            exercises ( name ),
            executed_sets ( set_number, weight_kg, reps, rpe, duration_seconds )
          )
        `)
        .eq('user_id', userId)
        .gte('session_date', eightWeeksStr)
        .order('session_date', { ascending: true })

      // ─── 3. Fetch weekly checkins (last 6) for sparklines ────
      const { data: checkins } = await supabase
        .from('weekly_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('checkin_date', { ascending: true })
        .limit(6)

      // ─── 4. Fetch weekly set volume (from executed_sessions) ─
      const sixWeeksAgo = new Date()
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42)
      const sixWeeksStr = dateToLocal(sixWeeksAgo)

      const { data: volumeSessions } = await supabase
        .from('executed_sessions')
        .select(`
          session_date,
          executed_exercises ( executed_sets ( id ) )
        `)
        .eq('user_id', userId)
        .gte('session_date', sixWeeksStr)

      // ──────────────────────────────────────────────────────────
      // PROCESS: Trend sparklines from weekly_checkins
      // ──────────────────────────────────────────────────────────
      if (checkins && checkins.length > 0) {
        const weights = checkins.filter(c => c.weight_kg != null).map(c => c.weight_kg as number)
        if (weights.length > 0) {
          const current = weights[weights.length - 1]
          const first = weights[0]
          setWeightData({ values: weights, current, change: +(current - first).toFixed(1) })
        }

        const waists = checkins.filter(c => c.waist_cm != null).map(c => c.waist_cm as number)
        if (waists.length > 0) {
          const current = waists[waists.length - 1]
          const first = waists[0]
          setWaistData({ values: waists, current, change: +(current - first).toFixed(1) })
        }
      }

      // Volume per week
      if (volumeSessions && volumeSessions.length > 0) {
        const weekBuckets: Record<string, number> = {}
        for (const s of volumeSessions) {
          const d = new Date(s.session_date + 'T00:00:00')
          const day = d.getDay()
          const diff = d.getDate() - day + (day === 0 ? -6 : 1)
          const weekStart = new Date(d)
          weekStart.setDate(diff)
          const key = dateToLocal(weekStart)
          const setCount = (s.executed_exercises as any[])?.reduce(
            (acc: number, ex: any) => acc + ((ex.executed_sets as any[])?.length ?? 0), 0
          ) ?? 0
          weekBuckets[key] = (weekBuckets[key] ?? 0) + setCount
        }
        const sortedWeeks = Object.keys(weekBuckets).sort()
        const volValues = sortedWeeks.map(k => weekBuckets[k])
        const current = volValues[volValues.length - 1] ?? 0
        const prev = volValues.length > 1 ? volValues[volValues.length - 2] : current
        setVolumeData({ values: volValues, current, trending: current >= prev })
      }

      // ──────────────────────────────────────────────────────────
      // PROCESS: Exercise progressions
      // ──────────────────────────────────────────────────────────
      let prs: PRRecord[] = []
      let progressions: ExerciseProgression[] = []

      if (allSessions && allSessions.length > 0) {
        // Group best sets per exercise per session date
        const exerciseHistory: Record<string, { date: string; bestWeight: number; bestReps: number; bestDuration: number | null }[]> = {}

        for (const session of allSessions) {
          for (const ex of (session.executed_exercises ?? []) as any[]) {
            const exName = ex.exercises?.name
            if (!exName) continue
            if (!exerciseHistory[exName]) exerciseHistory[exName] = []

            const sets = (ex.executed_sets ?? []) as any[]
            let bestWeight = 0
            let bestReps = 0
            let bestDuration: number | null = null

            for (const s of sets) {
              const w = s.weight_kg ?? 0
              const r = s.reps ?? 0
              if (w > bestWeight || (w === bestWeight && r > bestReps)) {
                bestWeight = w
                bestReps = r
              }
              if (s.duration_seconds && (bestDuration === null || s.duration_seconds > bestDuration)) {
                bestDuration = s.duration_seconds
              }
            }

            exerciseHistory[exName].push({
              date: session.session_date,
              bestWeight,
              bestReps,
              bestDuration,
            })
          }
        }

        // Calculate progressions
        progressions = []
        prs = []

        for (const [name, history] of Object.entries(exerciseHistory)) {
          if (history.length === 0) continue

          // Overall best
          const best = history.reduce((a, b) => {
            if (b.bestWeight > a.bestWeight || (b.bestWeight === a.bestWeight && b.bestReps > a.bestReps)) return b
            return a
          }, history[0])

          // Entries from last 4 weeks vs previous 4 weeks
          const recentEntries = history.filter(h => h.date >= fourWeeksStr)
          const olderEntries = history.filter(h => h.date < fourWeeksStr && h.date >= eightWeeksStr)

          const recentBest = recentEntries.length > 0
            ? recentEntries.reduce((a, b) => (b.bestWeight > a.bestWeight ? b : a), recentEntries[0])
            : null
          const olderBest = olderEntries.length > 0
            ? olderEntries.reduce((a, b) => (b.bestWeight > a.bestWeight ? b : a), olderEntries[0])
            : null

          let trend: 'up' | 'stall' | 'maintain' = 'maintain'
          let trendLabel = 'Manteniendo'
          let change = '--'
          let changeColor = 'text-gray-400'
          let highlight = false

          if (recentBest && olderBest) {
            const diff = recentBest.bestWeight - olderBest.bestWeight
            if (diff > 0) {
              trend = 'up'
              trendLabel = 'Progresando'
              change = `+${diff % 1 === 0 ? diff : diff.toFixed(1)} kg`
              changeColor = 'text-success'
            } else if (diff < 0) {
              trend = 'stall'
              trendLabel = 'Bajando'
              change = `${diff % 1 === 0 ? diff : diff.toFixed(1)} kg`
              changeColor = 'text-danger'
              highlight = true
            } else {
              // Same weight — check if stuck for 3+ weeks
              const lastThreeWeeks = history.filter(h => {
                const d = new Date(h.date)
                const threeWeeksAgo = new Date()
                threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)
                return d >= threeWeeksAgo
              })
              const allSameWeight = lastThreeWeeks.length >= 2 && lastThreeWeeks.every(h => h.bestWeight === lastThreeWeeks[0].bestWeight)
              if (allSameWeight && lastThreeWeeks.length >= 3) {
                trend = 'stall'
                trendLabel = `Estancado ${lastThreeWeeks.length}sem`
                change = '0 kg'
                highlight = true
              } else {
                change = '0 kg'
              }
            }
          }

          // Format best display
          const isDuration = best.bestWeight === 0 && best.bestDuration
          const bestStr = isDuration
            ? `${best.bestDuration}s x ${best.bestReps || history.filter(h => h.bestDuration).length}`
            : `${best.bestWeight}kg x ${best.bestReps}`

          progressions.push({ name, best: bestStr, trend, trendLabel, change, changeColor, highlight })

          // Detect PRs (best set in last 2 weeks that's an all-time best)
          const twoWeekEntries = history.filter(h => h.date >= twoWeeksStr)
          if (twoWeekEntries.length > 0) {
            const twoWeekBest = twoWeekEntries.reduce((a, b) => (b.bestWeight > a.bestWeight || (b.bestWeight === a.bestWeight && b.bestReps > a.bestReps) ? b : a), twoWeekEntries[0])
            const isAllTimeBest = twoWeekBest.bestWeight >= best.bestWeight && twoWeekBest.bestReps >= best.bestReps
            if (isAllTimeBest && twoWeekBest.bestWeight > 0) {
              prs.push({ exerciseName: name, weight: twoWeekBest.bestWeight, reps: twoWeekBest.bestReps, date: twoWeekBest.date })
            }
          }
        }

        // Sort: progressing first, then stalled, then maintaining
        progressions.sort((a, b) => {
          const order = { up: 0, stall: 1, maintain: 2 }
          return order[a.trend] - order[b.trend]
        })

        setExerciseData(progressions)
        setPrRecords(prs)
      }

      // ──────────────────────────────────────────────────────────
      // PROCESS: Session cards + comparison data
      // ──────────────────────────────────────────────────────────
      if (recentSessions && recentSessions.length > 0) {
        const cards: SessionCard[] = []
        const comparisons: Record<string, ComparisonData> = {}

        for (const session of recentSessions) {
          const routineName = (session.routines as any)?.name ?? 'Sesion sin rutina'
          const exList = (session.executed_exercises ?? []) as any[]

          // Count completed sets vs planned
          let setsCompleted = 0
          let setsPlanned = 0
          const compExercises: ComparisonExercise[] = []
          let skippedSets = 0

          for (const ex of exList) {
            const executedSets = (ex.executed_sets ?? []) as any[]
            const exName = ex.exercises?.name ?? ex.routine_exercises?.exercises?.name ?? 'Ejercicio'
            setsCompleted += executedSets.length

            // Get planned sets from routine_exercises
            const plannedSets = (ex.routine_exercises?.routine_sets ?? []) as any[]
            setsPlanned += plannedSets.length > 0 ? plannedSets.length : executedSets.length

            // Build comparison row
            let planStr = '--'
            let actualStr = '--'
            let status = 'OK'
            let statusColor = 'text-gray-500'

            if (plannedSets.length > 0) {
              const pSet = plannedSets[0]
              const repRange = pSet.rep_range_low && pSet.rep_range_high
                ? `${pSet.rep_range_low}-${pSet.rep_range_high}`
                : pSet.duration_seconds ? `${pSet.duration_seconds}s` : '--'
              const tw = pSet.target_weight ? ` @ ${pSet.target_weight}kg` : ''
              planStr = `${plannedSets.length}x${repRange}${tw}`
            }

            if (executedSets.length > 0) {
              // Find the most common reps and highest weight
              const avgReps = Math.round(executedSets.reduce((a: number, s: any) => a + (s.reps ?? 0), 0) / executedSets.length)
              const maxWeight = Math.max(...executedSets.map((s: any) => s.weight_kg ?? 0))
              const hasDuration = executedSets.some((s: any) => s.duration_seconds)

              if (hasDuration) {
                const maxDur = Math.max(...executedSets.map((s: any) => s.duration_seconds ?? 0))
                actualStr = `${executedSets.length}x${maxDur}s`
              } else {
                actualStr = maxWeight > 0
                  ? `${executedSets.length}x${avgReps} @ ${maxWeight}kg`
                  : `${executedSets.length}x${avgReps}`
              }

              // Determine status
              if (plannedSets.length > 0) {
                const pSet = plannedSets[0]
                const diff = executedSets.length - plannedSets.length

                if (diff < 0) {
                  skippedSets += Math.abs(diff)
                  status = 'Salteo'
                  statusColor = 'text-danger'
                } else if (maxWeight > (pSet.target_weight ?? 0) && pSet.target_weight) {
                  status = 'PR'
                  statusColor = 'text-success'
                } else if (maxWeight > (pSet.target_weight ?? 0) * 0.99 || !pSet.target_weight) {
                  // Check if reps exceeded range
                  if (pSet.rep_range_high && avgReps > pSet.rep_range_high) {
                    status = 'Subida'
                    statusColor = 'text-success'
                  }
                } else if (avgReps < (pSet.rep_range_low ?? 0) && pSet.rep_range_low) {
                  status = 'Fallo'
                  statusColor = 'text-warning'
                }
              }
            }

            compExercises.push({ name: exName, plan: planStr, actual: actualStr, status, statusColor })
          }

          // If no planned sets info, use completed as planned
          if (setsPlanned === 0) setsPlanned = setsCompleted

          const completionRatio = setsPlanned > 0 ? setsCompleted / setsPlanned : 1
          let badge: 'green' | 'yellow' | 'red' = 'green'
          let borderColor = 'border-l-success'
          if (completionRatio < 0.8) {
            badge = 'red'
            borderColor = 'border-l-danger'
          } else if (completionRatio < 1) {
            badge = 'yellow'
            borderColor = 'border-l-warning'
          }

          cards.push({
            id: session.id,
            name: routineName,
            date: formatDate(session.session_date),
            duration: formatDuration(session.duration_minutes),
            setsCompleted,
            setsPlanned,
            badge,
            borderColor,
          })

          const comparison: ComparisonData = { exercises: compExercises }
          if (skippedSets > 0) {
            comparison.warning = `${skippedSets} serie${skippedSets > 1 ? 's fueron salteadas' : ' fue salteada'} en esta sesion`
          }
          comparisons[session.id] = comparison
        }

        setSessions(cards)
        setComparisonData(comparisons)

        // ── Quick stats ──
        let totalRpe = 0
        let rpeCount = 0
        let totalDuration = 0
        let durationCount = 0
        const stalledCount = progressions.filter(e => e.trend === 'stall').length

        for (const session of recentSessions) {
          if (session.duration_minutes) {
            totalDuration += session.duration_minutes
            durationCount++
          }
          for (const ex of (session.executed_exercises ?? []) as any[]) {
            for (const s of (ex.executed_sets ?? []) as any[]) {
              if (s.rpe != null) {
                totalRpe += s.rpe
                rpeCount++
              }
            }
          }
        }

        const avgRpe = rpeCount > 0 ? (totalRpe / rpeCount).toFixed(1) : '--'
        const avgDuration = durationCount > 0 ? `${Math.round(totalDuration / durationCount)} min` : '--'

        setQuickStats([
          { label: 'RPE Prom.', value: String(avgRpe) },
          { label: 'Duracion', value: avgDuration },
          { label: 'PRs recientes', value: String(prs.length), color: 'text-primary' },
          { label: 'Estancados', value: String(stalledCount), color: stalledCount > 0 ? 'text-warning' : '' },
        ])
      }

      // ─── Streak calculation (consecutive weeks with sessions) ──
      if (allSessions && allSessions.length > 0) {
        const sessionWeeks = new Set<string>()
        for (const s of allSessions) {
          const d = new Date(s.session_date + 'T00:00:00')
          const day = d.getDay()
          const diff = d.getDate() - day + (day === 0 ? -6 : 1)
          const ws = new Date(d)
          ws.setDate(diff)
          sessionWeeks.add(dateToLocal(ws))
        }
        // Count backwards from current week
        let streak = 0
        const now = new Date()
        const currentDay = now.getDay()
        const currentDiff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1)
        const currentWeekStart = new Date(now)
        currentWeekStart.setDate(currentDiff)

        let checkDate = new Date(currentWeekStart)
        while (sessionWeeks.has(dateToLocal(checkDate))) {
          streak++
          checkDate.setDate(checkDate.getDate() - 7)
        }
        setStreakWeeks(streak)
      }

    } catch (err) {
      console.error('Error fetching progress data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // After exerciseData loads, recalculate quick stats stalled count
  useEffect(() => {
    if (quickStats.length > 0 && exerciseData.length > 0) {
      const stalledCount = exerciseData.filter(e => e.trend === 'stall').length
      setQuickStats(prev => prev.map(s => s.label === 'Estancados' ? { ...s, value: String(stalledCount), color: stalledCount > 0 ? 'text-warning' : '' } : s))
    }
  }, [exerciseData])

  const currentComparison = comparisonSession ? comparisonData[comparisonSession] : null
  const currentSessionName = sessions.find((s) => s.id === comparisonSession)?.name

  const hasNoData = !loading && sessions.length === 0 && exerciseData.length === 0

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {loading ? (
          <div>
            <div className="mb-7">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-7 w-32 mb-2" />
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-56" />
            </div>
            {/* Skeleton: Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-[18px] max-sm:grid-cols-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] text-center">
                  <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-16 mx-auto mb-2" />
                  <div className="bg-gray-200 animate-pulse rounded-[6px] h-6 w-20 mx-auto" />
                </div>
              ))}
            </div>
            {/* Skeleton: Chart card */}
            <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-5 w-48 mb-4" />
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-[180px] w-full" />
            </div>
            {/* Skeleton: Table card */}
            <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-5 w-40 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between">
                    <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-32" />
                    <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : hasNoData ? (
          <div className="fade-in">
            <div className="mb-7">
              <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Progreso</h1>
              <p className="text-gray-500 text-[.9rem] mt-1">Tendencias, progresion de ejercicios e historial</p>
            </div>
            <div className="bg-card rounded-[var(--radius)] p-10 shadow-[var(--shadow)] text-center">
              <div className="text-[1.1rem] font-semibold text-gray-700 mb-2">Sin datos todavia</div>
              <p className="text-gray-400 text-[.9rem] max-w-md mx-auto">
                Todavia no hay sesiones registradas. Empe&shy;za a loguear tus entrenamientos para ver tu progreso aca.
              </p>
            </div>
          </div>
        ) : !comparisonSession ? (
          <div className="fade-in">
            {/* Page Header */}
            <div className="mb-7">
              <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Progreso</h1>
              <p className="text-gray-500 text-[.9rem] mt-1">Tendencias, progresion de ejercicios e historial</p>
            </div>

            {/* Trend Sparklines */}
            {(weightData.current != null || waistData.current != null || volumeData.current != null) && (
              <>
                <div className="text-[1.08rem] font-bold text-gray-800 mb-4 flex items-center gap-2">
                  Tendencias <span className="text-[.77rem] text-gray-400 font-normal">Ultimas 6 semanas</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6 max-sm:grid-cols-1 fade-in" style={{ animationDelay: '.05s' }}>
                  {/* Weight */}
                  {weightData.current != null && (
                    <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[.84rem] font-bold">Peso</span>
                        <span className="font-extrabold text-base">{weightData.current} kg</span>
                      </div>
                      <div className="py-1">
                        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="w-full h-[60px]">
                          <defs>
                            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
                              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {weightData.values.length > 1 && (
                            <>
                              <polyline fill="url(#weightGrad)" stroke="none" points={sparklineArea(weightData.values, 200, 60)} />
                              <polyline fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={sparklinePoints(weightData.values, 200, 60)} />
                              {(() => {
                                const pts = sparklinePoints(weightData.values, 200, 60)
                                const lastPt = pts.split(' ').pop()?.split(',')
                                return lastPt ? <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill="var(--primary)" /> : null
                              })()}
                            </>
                          )}
                        </svg>
                      </div>
                      <div className="flex justify-between text-[.72rem] text-gray-400">
                        <span>{weightData.values.length > 0 ? weightData.values[0] : '--'}</span>
                        {weightData.change != null && (
                          <span className={`font-semibold ${weightData.change <= 0 ? 'text-success' : 'text-warning'}`}>
                            {weightData.change <= 0 ? '\u2193' : '\u2191'} {Math.abs(weightData.change)} kg
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Waist */}
                  {waistData.current != null && (
                    <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[.84rem] font-bold">Cintura</span>
                        <span className="font-extrabold text-base">{waistData.current} cm</span>
                      </div>
                      <div className="py-1">
                        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="w-full h-[60px]">
                          <defs>
                            <linearGradient id="waistGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {waistData.values.length > 1 && (
                            <>
                              <polyline fill="url(#waistGrad)" stroke="none" points={sparklineArea(waistData.values, 200, 60)} />
                              <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={sparklinePoints(waistData.values, 200, 60)} />
                              {(() => {
                                const pts = sparklinePoints(waistData.values, 200, 60)
                                const lastPt = pts.split(' ').pop()?.split(',')
                                return lastPt ? <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill="var(--accent)" /> : null
                              })()}
                            </>
                          )}
                        </svg>
                      </div>
                      <div className="flex justify-between text-[.72rem] text-gray-400">
                        <span>{waistData.values.length > 0 ? waistData.values[0] : '--'}</span>
                        {waistData.change != null && (
                          <span className={`font-semibold ${waistData.change <= 0 ? 'text-success' : 'text-warning'}`}>
                            {waistData.change <= 0 ? '\u2193' : '\u2191'} {Math.abs(waistData.change)} cm
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Volume */}
                  {volumeData.current != null && (
                    <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[.84rem] font-bold">Volumen</span>
                        <span className="font-extrabold text-base">{volumeData.current} series</span>
                      </div>
                      <div className="py-1">
                        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="w-full h-[60px]">
                          {volumeData.values.map((v, i) => {
                            const maxV = Math.max(...volumeData.values, 1)
                            const barW = Math.min(22, (200 - 20) / volumeData.values.length - 8)
                            const gap = (200 - 20) / volumeData.values.length
                            const h = (v / maxV) * 45
                            const x = 12 + i * gap
                            const isRecent = i >= volumeData.values.length - 2
                            return (
                              <rect
                                key={i}
                                x={x}
                                y={60 - h - 2}
                                width={barW}
                                height={h}
                                rx="3"
                                fill={isRecent ? 'var(--primary)' : 'var(--gray-200)'}
                                opacity={isRecent ? (i === volumeData.values.length - 1 ? 0.6 : 0.35) : 1}
                              />
                            )
                          })}
                        </svg>
                      </div>
                      <div className="flex justify-between text-[.72rem] text-gray-400">
                        <span>W-{volumeData.values.length}</span>
                        <span className={`font-semibold ${volumeData.trending ? 'text-primary' : 'text-gray-400'}`}>
                          {volumeData.trending ? '\u2191 En alza' : '\u2194 Estable'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Exercise Progression Table */}
            {exerciseData.length > 0 && (
              <>
                <div className="text-[1.08rem] font-bold text-gray-800 mb-4 mt-6">Progresion de Ejercicios</div>
                <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] mb-6 overflow-hidden fade-in" style={{ animationDelay: '.1s' }}>
                  <table className="w-full border-collapse text-[.88rem]">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="py-2.5 px-4 font-semibold text-[.78rem] text-gray-500 uppercase">Ejercicio</th>
                        <th className="py-2.5 px-3 font-semibold text-[.78rem] text-gray-500 uppercase">Mejor</th>
                        <th className="py-2.5 px-3 font-semibold text-[.78rem] text-gray-500 uppercase">Tendencia</th>
                        <th className="py-2.5 px-3 font-semibold text-[.78rem] text-gray-500 uppercase text-right">Cambio 4sem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exerciseData.map((ex) => (
                        <tr key={ex.name} className={`border-b border-gray-100 ${ex.highlight ? 'bg-warning-light' : ''}`}>
                          <td className="py-3 px-4 font-semibold">{ex.name}</td>
                          <td className="py-3 px-3">{ex.best}</td>
                          <td className="py-3 px-3">
                            <span className={`font-semibold ${ex.trend === 'up' ? 'text-success' : ex.trend === 'stall' ? 'text-warning' : 'text-primary'}`}>
                              {ex.trend === 'up' ? '\u2191' : ex.trend === 'stall' ? '\u26A0\uFE0F' : '\u2194'} {ex.trendLabel}
                            </span>
                          </td>
                          <td className={`py-3 px-3 text-right font-semibold ${ex.changeColor}`}>{ex.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Sessions of the Week */}
            {sessions.length > 0 && (
              <>
                <div className="text-[1.08rem] font-bold text-gray-800 mb-4 mt-6">Sesiones Recientes</div>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setComparisonSession(session.id)}
                    className={`bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-3.5 cursor-pointer border-l-4 ${session.borderColor} transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-px`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-[.92rem]">{session.name}</div>
                        <div className="text-[.77rem] text-gray-400 mt-1">{session.date} &middot; {session.duration}</div>
                      </div>
                      <Badge variant={session.badge}>
                        {session.badge === 'green' ? '\u2705' : session.badge === 'yellow' ? '\u26A0\uFE0F' : '\u274C'} {session.setsCompleted}/{session.setsPlanned}
                      </Badge>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* Comparison View */
          <div className="fade-in">
            <button
              onClick={() => setComparisonSession(null)}
              className="text-gray-500 font-semibold text-[.82rem] mb-4 cursor-pointer hover:text-primary transition-colors bg-transparent border-none -ml-2 py-1 px-2"
            >
              &larr; Volver a Progreso
            </button>

            <div className="mb-7">
              <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">{currentSessionName}</h1>
              <p className="text-gray-500 text-[.9rem] mt-1">Comparacion Plan vs Real</p>
            </div>

            {currentComparison?.warning && (
              <div className="p-[14px_18px] rounded-[var(--radius-sm)] bg-warning-light text-[#92400E] text-[.84rem] font-medium mb-4">
                {'\u26A0\uFE0F'} {currentComparison.warning}
              </div>
            )}

            <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] overflow-x-auto">
              <table className="w-full text-[.87rem] border-collapse">
                <thead>
                  <tr>
                    <th className="py-2.5 px-3 text-left text-gray-400 font-semibold text-[.77rem] uppercase border-b-2 border-gray-100">Ejercicio</th>
                    <th className="py-2.5 px-3 text-left text-gray-400 font-semibold text-[.77rem] uppercase border-b-2 border-gray-100">Plan</th>
                    <th className="py-2.5 px-3 text-left text-gray-400 font-semibold text-[.77rem] uppercase border-b-2 border-gray-100">Real</th>
                    <th className="py-2.5 px-3 text-left text-gray-400 font-semibold text-[.77rem] uppercase border-b-2 border-gray-100">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {currentComparison?.exercises.map((ex, i) => (
                    <tr key={`${ex.name}-${i}`} className="border-b border-gray-50">
                      <td className="py-2.5 px-3 font-semibold">{ex.name}</td>
                      <td className="py-2.5 px-3 text-gray-600">{ex.plan}</td>
                      <td className="py-2.5 px-3 text-gray-600">{ex.actual}</td>
                      <td className={`py-2.5 px-3 font-semibold ${ex.statusColor}`}>{ex.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Right Panel */}
      <RightPanel>
        <div className="font-bold text-base text-gray-800 mb-[18px]">Estadisticas Rapidas</div>

        <div className="grid grid-cols-2 gap-2.5 mb-[22px]">
          {(quickStats.length > 0 ? quickStats : [
            { label: 'RPE Prom.', value: '--' },
            { label: 'Duracion', value: '--' },
            { label: 'PRs recientes', value: '0', color: 'text-primary' },
            { label: 'Estancados', value: '0' },
          ]).map((stat) => (
            <div key={stat.label} className="bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] text-center">
              <div className="text-[.77rem] text-gray-400 mb-0.5">{stat.label}</div>
              <div className={`font-extrabold text-[1.1rem] ${stat.color || ''}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="font-bold text-base text-gray-800 mb-[18px]">{'\uD83C\uDFC6'} Logros & Records</div>
        <div className="flex flex-col gap-2.5 mb-[22px]">
          {prRecords.length > 0 ? (
            prRecords.map((pr, i) => (
              <div key={i} className="p-[10px_12px] bg-success-light rounded-[var(--radius-xs)] text-[.84rem]">
                <div className="font-semibold text-[#065F46]">{'\uD83C\uDFC5'} Nuevo PR: {pr.exerciseName}</div>
                <div className="text-[#065F46] opacity-80 text-[.78rem]">{pr.weight}kg x {pr.reps} reps — {formatDate(pr.date)}</div>
              </div>
            ))
          ) : (
            <div className="p-[10px_12px] bg-gray-50 rounded-[var(--radius-xs)] text-[.84rem] text-gray-400">
              Sin PRs recientes
            </div>
          )}

          {streakWeeks > 0 && (
            <div className="p-[10px_12px] bg-primary-light rounded-[var(--radius-xs)] text-[.84rem]">
              <div className="font-semibold text-primary-dark">{'\uD83D\uDD25'} Racha: {streakWeeks} semana{streakWeeks > 1 ? 's' : ''}</div>
              <div className="text-primary-dark opacity-80 text-[.78rem]">Sin faltar ninguna semana de entrenamiento</div>
            </div>
          )}

          {sessions.length > 0 && (() => {
            const perfectSessions = sessions.filter(s => s.setsCompleted === s.setsPlanned && s.setsPlanned > 0)
            if (perfectSessions.length === 0) return null
            return perfectSessions.map(s => (
              <div key={s.id} className="p-[10px_12px] bg-warning-light rounded-[var(--radius-xs)] text-[.84rem]">
                <div className="font-semibold text-[#92400E]">{'\uD83D\uDCAA'} 100% adherencia {s.name}</div>
                <div className="text-[#92400E] opacity-80 text-[.78rem]">{s.setsCompleted}/{s.setsPlanned} series completadas</div>
              </div>
            ))
          })()}
        </div>
      </RightPanel>
    </>
  )
}
