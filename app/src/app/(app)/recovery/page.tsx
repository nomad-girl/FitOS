'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { todayLocal, dateToLocal } from '@/lib/date-utils'
import {
  computeRecovery,
  stimulusLabel,
  stimulusColor,
  type RecoveryInput,
  type RecoveryOutput,
  type Phase,
  type EnergyState,
} from '@/lib/recovery'
import { backfillTrainingData } from '@/lib/hevy/backfill'
import { syncHevyWorkouts } from '@/lib/hevy/sync'

// ── Visual Config ───────────────────────────────────────────────────

const phaseConfig: Record<Phase, { label: string; color: string; emoji: string }> = {
  accumulation: { label: 'Acumulacion', color: '#3B82F6', emoji: '\u2197\uFE0F' },
  peak:         { label: 'Peak',        color: '#10B981', emoji: '\u2600\uFE0F' },
  fatigue:      { label: 'Fatiga',      color: '#F59E0B', emoji: '\u2198\uFE0F' },
  deload:       { label: 'Deload',      color: '#8B5CF6', emoji: '\uD83C\uDF19' },
}

const energyConfig: Record<EnergyState, { label: string; color: string; pct: number }> = {
  high:       { label: 'Alto',       color: '#10B981', pct: 90 },
  sufficient: { label: 'Suficiente', color: '#3B82F6', pct: 70 },
  low:        { label: 'Bajo',       color: '#F59E0B', pct: 40 },
  very_low:   { label: 'Muy bajo',   color: '#EF4444', pct: 15 },
}

function readinessColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 65) return '#3B82F6'
  if (score >= 50) return '#F59E0B'
  return '#EF4444'
}

// ── Cycle Curve (fullscreen, smooth) ────────────────────────────────

function CycleCurve({ phase, score, label }: { phase: Phase; score: number; label: string }) {
  const w = 360
  const h = 90
  const pad = 30
  const curveTop = 14
  const curveBottom = h - 24

  // 4 points on a clean bell curve: deload(low) → accumulation(rising) → peak(top) → fatigue(falling) → deload(low)
  const xs = [pad, w * 0.25, w * 0.5, w * 0.75, w - pad]
  const ys = [curveBottom, curveTop + (curveBottom - curveTop) * 0.45, curveTop, curveTop + (curveBottom - curveTop) * 0.45, curveBottom]

  const phaseIdx: Record<Phase, number> = { deload: 0, accumulation: 1, peak: 2, fatigue: 3 }
  const idx = phaseIdx[phase]
  const dotX = xs[idx]
  const dotY = ys[idx]

  // Smooth bell curve: quadratic through all 5 points
  const path = `M ${xs[0]},${ys[0]} Q ${xs[1]},${curveTop - 4} ${xs[2]},${ys[2]} Q ${xs[3]},${curveTop - 4} ${xs[4]},${ys[4]}`
  const areaPath = `${path} L ${xs[4]},${h} L ${xs[0]},${h} Z`

  const color = phaseConfig[phase].color
  const labels = ['Deload', 'Acum.', 'Peak', 'Fatiga']

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full block">
        <defs>
          <linearGradient id={`curveGrad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#curveGrad-${label})`} />

        {/* Curve line */}
        <path d={path} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />

        {/* Phase labels */}
        {labels.map((lbl, i) => (
          <text key={i} x={xs[i]} y={h - 4} fill={i === idx ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'} fontSize="8" fontWeight={i === idx ? '700' : '500'} textAnchor="middle">{lbl}</text>
        ))}

        {/* Dot with glow */}
        <circle cx={dotX} cy={dotY} r="8" fill={color} fillOpacity="0.15" filter={`url(#glow-${label})`} />
        <circle cx={dotX} cy={dotY} r="4.5" fill={color} stroke="white" strokeWidth="1.5" />
        <text x={dotX} y={dotY - 10} fill="white" fontSize="10" fontWeight="700" textAnchor="middle">{score}</text>
      </svg>
    </div>
  )
}

// ── Readiness Arc ───────────────────────────────────────────────────

function ReadinessArc({ score, size = 120, label, phase }: { score: number; size?: number; label: string; phase: Phase }) {
  const r = (size - 16) / 2
  const circ = Math.PI * r // half circle
  const offset = circ - (score / 100) * circ
  const color = readinessColor(score)
  const cx = size / 2
  const cy = size / 2 + 10

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} className="block overflow-visible">
        {/* Track */}
        <path
          d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        {/* Score */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize={size * 0.25} fontWeight="900">{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="500">{label}</text>
      </svg>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[.85rem]">{phaseConfig[phase].emoji}</span>
        <span className="text-[.82rem] font-semibold text-white/80">{phaseConfig[phase].label}</span>
      </div>
    </div>
  )
}

// ── Recent Training Card ────────────────────────────────────────────

interface RecentTraining {
  log_date: string
  training_name: string | null
  training_stimulus: string | null
  training_volume_kg: number | null
  training_rpe_avg: number | null
  training_muscle_groups: string[] | null
}

// ── Swipe tabs ──────────────────────────────────────────────────────

const TABS = ['Global', 'Upper', 'Lower'] as const
type Tab = typeof TABS[number]

// ── Main Page ───────────────────────────────────────────────────────

export default function RecoveryPage() {
  const [recovery, setRecovery] = useState<RecoveryOutput | null>(null)
  const [recentTraining, setRecentTraining] = useState<RecentTraining[]>([])
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<{ date: string; global: number; upper: number; lower: number }[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('Global')
  const [backfilled, setBackfilled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Touch swipe handling
  const touchStart = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      const idx = TABS.indexOf(activeTab)
      if (diff > 0 && idx < TABS.length - 1) setActiveTab(TABS[idx + 1])
      if (diff < 0 && idx > 0) setActiveTab(TABS[idx - 1])
    }
    touchStart.current = null
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const userId = await getUserId()
      const today = todayLocal()

      // One-time volume fix: re-sync from Hevy to get correct totals
      const volumeFixKey = 'fitos:volume-fix-v4'
      if (!backfilled && !localStorage.getItem(volumeFixKey)) {
        syncHevyWorkouts(userId).then(() => {
          localStorage.setItem(volumeFixKey, Date.now().toString())
          // Then backfill to enrich any remaining gaps
          return backfillTrainingData(userId)
        }).catch(() => {})
        setBackfilled(true)
      }

      // Fetch last 14 days of logs
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', dateToLocal(fourteenDaysAgo))
        .lte('log_date', today)
        .order('log_date', { ascending: false })

      const todayLog = logs?.find(l => l.log_date === today)
      const yesterdayDate = new Date()
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterdayLog = logs?.find(l => l.log_date === dateToLocal(yesterdayDate))

      const validLogs = logs ?? []
      const last7 = validLogs.filter(l => {
        const d = new Date(l.log_date + 'T12:00:00')
        const daysAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
        return daysAgo <= 7
      })
      const avg = (vals: (number | null | undefined)[]) => {
        const v = vals.filter((x): x is number => x != null)
        return v.length > 0 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
      }

      const caloriesAvg7d = avg(last7.map(l => l.calories))
      const stepsAvg7d = avg(last7.map(l => l.steps))

      let consecutiveDays = 0
      for (const log of validLogs) {
        if (log.training_name || log.training_variant) consecutiveDays++
        else break
      }

      const upperMuscles = ['chest', 'shoulders', 'biceps', 'triceps', 'upper back', 'lats', 'traps']
      const lowerMuscles = ['quadriceps', 'hamstrings', 'glutes', 'calves']

      const upperSessions = validLogs.filter(l => l.training_muscle_groups?.some((mg: string) => upperMuscles.includes(mg.toLowerCase())))
      const lowerSessions = validLogs.filter(l => l.training_muscle_groups?.some((mg: string) => lowerMuscles.includes(mg.toLowerCase())))

      const getTrend = (sessions: typeof validLogs): 'up' | 'same' | 'down' => {
        if (sessions.length < 2) return 'same'
        const recent = sessions[0].training_volume_kg ?? 0
        const prev = sessions[1].training_volume_kg ?? 0
        if (prev === 0) return 'same'
        const pct = ((recent - prev) / prev) * 100
        if (pct > 5) return 'up'
        if (pct < -5) return 'down'
        return 'same'
      }

      const yesterdayMuscles: string[] = yesterdayLog?.training_muscle_groups ?? []

      // Use most recent log with subjective data if today has none
      const subjectiveLog = todayLog?.energy != null ? todayLog
        : validLogs.find(l => l.energy != null)

      const input: RecoveryInput = {
        energy: subjectiveLog?.energy ?? null,
        hunger: subjectiveLog?.hunger ?? null,
        mood: subjectiveLog?.mood ?? null,
        sleepHours: subjectiveLog?.sleep_hours ?? null,
        fatigueGlobal: subjectiveLog?.fatigue_level ?? null,
        fatigueUpper: subjectiveLog?.fatigue_upper ?? null,
        fatigueLower: subjectiveLog?.fatigue_lower ?? null,
        caloriesToday: todayLog?.calories ?? subjectiveLog?.calories ?? null,
        caloriesAvg7d,
        stepsToday: todayLog?.steps ?? subjectiveLog?.steps ?? null,
        stepsAvg7d,
        performanceUpper: getTrend(upperSessions),
        performanceLower: getTrend(lowerSessions),
        trainedYesterday: !!(yesterdayLog?.training_name || yesterdayLog?.training_variant),
        consecutiveTrainingDays: consecutiveDays,
        daysUntilNextTraining: null,
        trainedUpperYesterday: yesterdayMuscles.some((mg: string) => upperMuscles.includes(mg.toLowerCase())),
        trainedLowerYesterday: yesterdayMuscles.some((mg: string) => lowerMuscles.includes(mg.toLowerCase())),
      }

      const result = computeRecovery(input)
      setRecovery(result)

      // Show training immediately (don't wait for snapshot queries)
      const trainedLogs = last7.filter(l => l.training_name || l.training_stimulus)
      setRecentTraining(trainedLogs.map(l => ({
        log_date: l.log_date,
        training_name: l.training_name,
        training_stimulus: l.training_stimulus,
        training_volume_kg: l.training_volume_kg,
        training_rpe_avg: l.training_rpe_avg,
        training_muscle_groups: l.training_muscle_groups,
      })))

      // Save snapshot + fetch history in parallel (non-blocking for UI)
      const [, { data: snapshots }] = await Promise.all([
        supabase.from('recovery_snapshots').upsert({
          user_id: userId,
          snapshot_date: today,
          readiness_global: result.readinessGlobal,
          readiness_upper: result.readinessUpper,
          readiness_lower: result.readinessLower,
          energy_score: result.energyScore,
          phase_global: result.phaseGlobal,
          phase_upper: result.phaseUpper,
          phase_lower: result.phaseLower,
          energy_state: result.energyState,
          system_reading: result.systemReading,
          recommendation: result.recommendation,
          input_data: input as unknown as Record<string, unknown>,
        }, { onConflict: 'user_id,snapshot_date' }),
        supabase
          .from('recovery_snapshots')
          .select('snapshot_date, readiness_global, readiness_upper, readiness_lower')
          .eq('user_id', userId)
          .gte('snapshot_date', dateToLocal(fourteenDaysAgo))
          .order('snapshot_date', { ascending: true }),
      ])

      if (snapshots) {
        setHistory(snapshots.map(s => ({
          date: s.snapshot_date,
          global: s.readiness_global ?? 0,
          upper: s.readiness_upper ?? 0,
          lower: s.readiness_lower ?? 0,
        })))
      }
    } catch (err) {
      console.error('Recovery fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [backfilled])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener('daily-log-saved', handler)
    return () => window.removeEventListener('daily-log-saved', handler)
  }, [fetchData])

  if (loading) {
    return (
      <main className="flex-1 max-md:pb-[90px] bg-[#0a1628] min-h-screen">
        <div className="p-6 pt-8 space-y-4">
          <div className="h-8 w-32 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-[200px] bg-white/5 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-[120px] bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-[120px] bg-white/5 rounded-2xl animate-pulse" />
          </div>
        </div>
      </main>
    )
  }

  if (!recovery) {
    return (
      <main className="flex-1 max-md:pb-[90px] bg-[#0a1628] min-h-screen flex items-center justify-center">
        <div className="text-center px-8">
          <div className="text-[3rem] mb-4">{'\uD83D\uDCCA'}</div>
          <div className="text-white font-bold text-lg mb-2">Sin datos suficientes</div>
          <div className="text-white/50 text-[.88rem]">Completa tu registro diario para ver tu ciclo de recovery</div>
        </div>
      </main>
    )
  }

  const tabData: Record<Tab, { score: number; phase: Phase; label: string; fatigueLabel: string }> = {
    Global: { score: recovery.readinessGlobal, phase: recovery.phaseGlobal, label: 'Readiness Global', fatigueLabel: 'Global' },
    Upper:  { score: recovery.readinessUpper,  phase: recovery.phaseUpper,  label: 'Tren Superior',    fatigueLabel: '\uD83D\uDCAA Upper' },
    Lower:  { score: recovery.readinessLower,  phase: recovery.phaseLower,  label: 'Tren Inferior',    fatigueLabel: '\uD83E\uDDB5 Lower' },
  }
  const current = tabData[activeTab]
  const energySt = energyConfig[recovery.energyState]

  // History line for current tab
  const historyKey = activeTab === 'Global' ? 'global' : activeTab === 'Upper' ? 'upper' : 'lower'

  return (
    <main className="flex-1 max-md:pb-[90px] bg-[#0a1628] min-h-screen overflow-x-hidden" ref={scrollRef}>
      {/* Header */}
      <div className="px-6 pt-7 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-[1.4rem] font-extrabold text-white tracking-tight">Recovery</h1>
          <p className="text-white/40 text-[.78rem]">Ciclo fisiologico</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[.06] rounded-full p-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-full text-[.75rem] font-semibold border-none cursor-pointer transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-white/15 text-white'
                  : 'bg-transparent text-white/35 hover:text-white/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Swipeable main area */}
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="px-5">
        {/* Arc + Phase */}
        <div className="text-center pt-2 pb-1">
          <ReadinessArc score={current.score} size={120} label={current.label} phase={current.phase} />
        </div>

        {/* Cycle Curve */}
        <div className="bg-white/[.04] rounded-xl px-3 py-2 mb-3">
          <CycleCurve phase={current.phase} score={current.score} label={activeTab} />
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {TABS.map(tab => {
            const d = tabData[tab]
            const isActive = tab === activeTab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl p-3 text-center border-none cursor-pointer transition-all duration-300 ${
                  isActive ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/[.04]'
                }`}
              >
                <div className="text-[.65rem] text-white/40 mb-0.5">{tab === 'Global' ? '\uD83C\uDF10' : tab === 'Upper' ? '\uD83D\uDCAA' : '\uD83E\uDDB5'} {tab}</div>
                <div className="text-[1.3rem] font-extrabold" style={{ color: readinessColor(d.score) }}>{d.score}</div>
                <div className="text-[.6rem] font-medium" style={{ color: phaseConfig[d.phase].color }}>{phaseConfig[d.phase].label}</div>
              </button>
            )
          })}
        </div>

        {/* Energy bar */}
        <div className="bg-white/[.04] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[.8rem] font-semibold text-white/70">{'\u26A1'} Estado Energetico</span>
            <span className="text-[.78rem] font-bold" style={{ color: energySt.color }}>{energySt.label} ({recovery.energyScore})</span>
          </div>
          <div className="h-2 rounded-full bg-white/[.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${energySt.pct}%`, backgroundColor: energySt.color }} />
          </div>
        </div>

        {/* System Reading */}
        <div className="bg-white/[.04] rounded-xl p-4 mb-4">
          <div className="text-[.78rem] font-semibold text-white/60 mb-2">{'\uD83D\uDCCB'} Lectura del Sistema</div>
          <p className="text-[.84rem] text-white/80 leading-relaxed">{recovery.systemReading}</p>
        </div>

        {/* Recommendation */}
        <div className="rounded-xl p-4 mb-4" style={{ background: `linear-gradient(135deg, ${readinessColor(current.score)}15, ${readinessColor(current.score)}08)`, border: `1px solid ${readinessColor(current.score)}30` }}>
          <div className="text-[.78rem] font-semibold mb-2" style={{ color: readinessColor(current.score) }}>{'\uD83D\uDCA1'} Recomendacion</div>
          <p className="text-[.84rem] text-white/80 leading-relaxed">{recovery.recommendation}</p>
        </div>

        {/* History mini chart */}
        {history.length > 1 && (
          <div className="bg-white/[.04] rounded-xl p-4 mb-4">
            <div className="text-[.78rem] font-semibold text-white/60 mb-3">{'\uD83D\uDCC8'} Historial ({activeTab})</div>
            <div className="flex items-end gap-1" style={{ height: 60 }}>
              {history.map((h, i) => {
                const val = h[historyKey]
                const d = new Date(h.date + 'T12:00:00')
                const dayLabel = d.toLocaleDateString('es-AR', { weekday: 'narrow' })
                const isLast = i === history.length - 1
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    {isLast && <span className="text-[.6rem] font-bold text-white/60 mb-0.5">{val}</span>}
                    <div
                      className="w-full rounded-t-[3px] transition-all duration-500 min-h-[3px]"
                      style={{
                        height: `${Math.max(val * 0.5, 3)}px`,
                        backgroundColor: isLast ? readinessColor(val) : 'rgba(255,255,255,0.12)',
                      }}
                    />
                    <span className="text-[.55rem] text-white/25">{dayLabel}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent Training */}
        {recentTraining.length > 0 && (
          <div className="bg-white/[.04] rounded-xl p-4 mb-6">
            <div className="text-[.78rem] font-semibold text-white/60 mb-3">{'\uD83C\uDFCB\uFE0F'} Entrenamientos Recientes</div>
            <div className="space-y-2">
              {recentTraining.map((t, i) => {
                const d = new Date(t.log_date + 'T12:00:00')
                const dayLabel = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
                const stim = t.training_stimulus as keyof typeof stimulusLabel | null
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[.04] last:border-b-0">
                    <div className="w-10 text-center">
                      <div className="text-[.65rem] text-white/30 uppercase">{dayLabel}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[.82rem] text-white/80 truncate">{t.training_name || 'Entrenamiento'}</div>
                      {t.training_muscle_groups && t.training_muscle_groups.length > 0 && (
                        <div className="text-[.65rem] text-white/30 truncate">{t.training_muscle_groups.join(', ')}</div>
                      )}
                    </div>
                    <div className="text-right">
                      {t.training_volume_kg != null && (
                        <div className="text-[.72rem] text-white/50 font-medium">{Math.round(t.training_volume_kg / 100) / 10}t</div>
                      )}
                      {t.training_rpe_avg != null && (
                        <div className="text-[.6rem] text-white/30">RPE {t.training_rpe_avg}</div>
                      )}
                    </div>
                    {stim && (
                      <span
                        className="text-[.6rem] font-bold px-2 py-0.5 rounded-full text-white/90 whitespace-nowrap"
                        style={{ backgroundColor: stimulusColor[stim] || '#6B7280' }}
                      >
                        {stimulusLabel[stim] || stim}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
