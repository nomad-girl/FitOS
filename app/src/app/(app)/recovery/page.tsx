'use client'

import { useState, useEffect, useCallback } from 'react'
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

// ── Phase / energy visual config ────────────────────────────────────

const phaseConfig: Record<Phase, { label: string; color: string; icon: string; angle: number }> = {
  accumulation: { label: 'Acumulacion', color: '#3B82F6', icon: '\u2197\uFE0F', angle: 45 },
  peak:         { label: 'Peak',        color: '#10B981', icon: '\u2600\uFE0F', angle: 90 },
  fatigue:      { label: 'Fatiga',      color: '#F59E0B', icon: '\u2198\uFE0F', angle: 135 },
  deload:       { label: 'Deload',      color: '#8B5CF6', icon: '\uD83C\uDF19', angle: 180 },
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

// ── Cycle Curve SVG ─────────────────────────────────────────────────

function CycleCurve({ phase, score }: { phase: Phase; score: number }) {
  // Draw a smooth curve representing the cycle, with a dot at the current position
  const w = 320
  const h = 120
  const pad = 20

  // The curve: accumulation → peak → fatigue → deload
  const points = [
    { x: pad, y: h - pad },         // deload (bottom-left)
    { x: w * 0.25, y: h * 0.4 },    // accumulation (rising)
    { x: w * 0.5, y: pad },          // peak (top)
    { x: w * 0.75, y: h * 0.4 },    // fatigue (falling)
    { x: w - pad, y: h - pad },      // deload (bottom-right)
  ]

  // Position on curve based on phase
  const phasePositions: Record<Phase, number> = {
    deload: 0,
    accumulation: 1,
    peak: 2,
    fatigue: 3,
  }
  const idx = phasePositions[phase]
  const dot = points[idx]

  const path = `M ${points[0].x},${points[0].y} C ${points[0].x + 40},${points[0].y - 30} ${points[1].x - 20},${points[1].y} ${points[1].x},${points[1].y} S ${points[2].x - 30},${points[2].y} ${points[2].x},${points[2].y} S ${points[3].x - 20},${points[3].y} ${points[3].x},${points[3].y} S ${points[4].x - 40},${points[4].y + 30} ${points[4].x},${points[4].y}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxWidth: 320 }}>
      {/* Gradient background */}
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={phaseConfig[phase].color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={phaseConfig[phase].color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Phase labels */}
      <text x={pad} y={h - 4} fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="500">Deload</text>
      <text x={w * 0.22} y={h - 4} fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="500">Acum.</text>
      <text x={w * 0.46} y={h - 4} fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="500">Peak</text>
      <text x={w * 0.7} y={h - 4} fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="500">Fatiga</text>

      {/* Curve line */}
      <path d={path} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />

      {/* Current position dot */}
      <circle cx={dot.x} cy={dot.y} r="8" fill={phaseConfig[phase].color} stroke="white" strokeWidth="2.5" />
      <text x={dot.x} y={dot.y - 14} fill="white" fontSize="11" fontWeight="700" textAnchor="middle">{score}</text>
    </svg>
  )
}

// ── Readiness Ring ──────────────────────────────────────────────────

function ReadinessRing({ score, size = 72, label }: { score: number; size?: number; label: string }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = readinessColor(score)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="block">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={size * 0.28} fontWeight="800">
          {score}
        </text>
      </svg>
      <div className="text-[.72rem] text-white/60 mt-1">{label}</div>
    </div>
  )
}

// ── Training History Card ───────────────────────────────────────────

interface RecentTraining {
  log_date: string
  training_name: string | null
  training_stimulus: string | null
  training_volume_kg: number | null
  training_rpe_avg: number | null
  training_muscle_groups: string[] | null
}

// ── Main Page ───────────────────────────────────────────────────────

export default function RecoveryPage() {
  const [recovery, setRecovery] = useState<RecoveryOutput | null>(null)
  const [recentTraining, setRecentTraining] = useState<RecentTraining[]>([])
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<{ date: string; global: number; upper: number; lower: number }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const userId = await getUserId()
      const today = todayLocal()

      // Fetch last 7 days of logs
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', dateToLocal(sevenDaysAgo))
        .lte('log_date', today)
        .order('log_date', { ascending: false })

      const todayLog = logs?.find(l => l.log_date === today)
      const yesterdayDate = new Date()
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterdayLog = logs?.find(l => l.log_date === dateToLocal(yesterdayDate))

      // Compute 7-day averages
      const validLogs = logs ?? []
      const avg = (vals: (number | null | undefined)[]) => {
        const v = vals.filter((x): x is number => x != null)
        return v.length > 0 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
      }

      const caloriesAvg7d = avg(validLogs.map(l => l.calories))
      const stepsAvg7d = avg(validLogs.map(l => l.steps))

      // Consecutive training days
      let consecutiveDays = 0
      for (const log of validLogs) {
        if (log.training_name || log.training_variant) consecutiveDays++
        else break
      }

      // Performance trends (simplified: compare last 2 sessions' volume)
      const upperSessions = validLogs.filter(l => l.training_muscle_groups?.some((mg: string) =>
        ['chest', 'shoulders', 'biceps', 'triceps', 'upper back', 'lats', 'traps'].includes(mg.toLowerCase())
      ))
      const lowerSessions = validLogs.filter(l => l.training_muscle_groups?.some((mg: string) =>
        ['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(mg.toLowerCase())
      ))

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

      const yesterdayMuscles = yesterdayLog?.training_muscle_groups ?? []

      const input: RecoveryInput = {
        energy: todayLog?.energy ?? null,
        hunger: todayLog?.hunger ?? null,
        mood: todayLog?.mood ?? null,
        sleepHours: todayLog?.sleep_hours ?? null,
        fatigueGlobal: todayLog?.fatigue_level ?? null,
        fatigueUpper: todayLog?.fatigue_upper ?? null,
        fatigueLower: todayLog?.fatigue_lower ?? null,
        caloriesToday: todayLog?.calories ?? null,
        caloriesAvg7d,
        stepsToday: todayLog?.steps ?? null,
        stepsAvg7d,
        performanceUpper: getTrend(upperSessions),
        performanceLower: getTrend(lowerSessions),
        trainedYesterday: !!(yesterdayLog?.training_name || yesterdayLog?.training_variant),
        consecutiveTrainingDays: consecutiveDays,
        daysUntilNextTraining: null,
        trainedUpperYesterday: yesterdayMuscles.some((mg: string) =>
          ['chest', 'shoulders', 'biceps', 'triceps', 'upper back', 'lats', 'traps'].includes(mg.toLowerCase())
        ),
        trainedLowerYesterday: yesterdayMuscles.some((mg: string) =>
          ['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(mg.toLowerCase())
        ),
      }

      const result = computeRecovery(input)
      setRecovery(result)

      // Save snapshot
      await supabase.from('recovery_snapshots').upsert({
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
      }, { onConflict: 'user_id,snapshot_date' })

      // Fetch history (last 14 days of snapshots)
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const { data: snapshots } = await supabase
        .from('recovery_snapshots')
        .select('snapshot_date, readiness_global, readiness_upper, readiness_lower')
        .eq('user_id', userId)
        .gte('snapshot_date', dateToLocal(fourteenDaysAgo))
        .order('snapshot_date', { ascending: true })

      if (snapshots) {
        setHistory(snapshots.map(s => ({
          date: s.snapshot_date,
          global: s.readiness_global ?? 0,
          upper: s.readiness_upper ?? 0,
          lower: s.readiness_lower ?? 0,
        })))
      }

      // Recent training for list
      const trainedLogs = validLogs.filter(l => l.training_name || l.training_stimulus)
      setRecentTraining(trainedLogs.map(l => ({
        log_date: l.log_date,
        training_name: l.training_name,
        training_stimulus: l.training_stimulus,
        training_volume_kg: l.training_volume_kg,
        training_rpe_avg: l.training_rpe_avg,
        training_muscle_groups: l.training_muscle_groups,
      })))
    } catch (err) {
      console.error('Recovery fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Listen for daily log saves to refresh
  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener('daily-log-saved', handler)
    return () => window.removeEventListener('daily-log-saved', handler)
  }, [fetchData])

  if (loading) {
    return (
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">Recovery</h1>
          <p className="text-gray-500 text-[.88rem]">Ciclo fisiologico y readiness</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-40" />
          ))}
        </div>
      </main>
    )
  }

  if (!recovery) {
    return (
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">Recovery</h1>
          <p className="text-gray-500 text-[.88rem]">Ciclo fisiologico y readiness</p>
        </div>
        <div className="bg-gradient-to-br from-[#1d9be2] to-[#1aafcf] text-white rounded-[var(--radius)] p-6 text-center">
          <div className="text-[1.5rem] mb-2">{'\uD83D\uDCCA'}</div>
          <div className="font-bold mb-1">Sin datos suficientes</div>
          <div className="text-[.84rem] opacity-80">Completa tu registro diario para ver tu ciclo de recovery</div>
        </div>
      </main>
    )
  }

  const phaseGlobal = phaseConfig[recovery.phaseGlobal]
  const phaseUpper = phaseConfig[recovery.phaseUpper]
  const phaseLower = phaseConfig[recovery.phaseLower]
  const energySt = energyConfig[recovery.energyState]

  return (
    <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Recovery</h1>
        <p className="text-gray-500 text-[.88rem]">Ciclo fisiologico y readiness</p>
      </div>

      {/* 1. Global Readiness + Cycle Curve */}
      <div className="bg-gradient-to-br from-[#0f4d6e] to-[#175563] text-white rounded-[var(--radius)] p-6 mb-4 fade-in">
        <div className="text-center mb-4">
          <ReadinessRing score={recovery.readinessGlobal} size={90} label="Readiness Global" />
          <div className="font-bold text-[1rem] mt-2">{phaseGlobal.icon} {phaseGlobal.label}</div>
        </div>
        <CycleCurve phase={recovery.phaseGlobal} score={recovery.readinessGlobal} />
      </div>

      {/* 2. Upper / Lower Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4 fade-in" style={{ animationDelay: '.1s' }}>
        <div className="rounded-[var(--radius)] p-5 text-white text-center" style={{ background: `linear-gradient(135deg, ${phaseUpper.color}dd, ${phaseUpper.color}88)` }}>
          <div className="text-[.72rem] opacity-70 mb-1">{'\uD83D\uDCAA'} Tren Superior</div>
          <div className="text-[2rem] font-extrabold leading-tight">{recovery.readinessUpper}</div>
          <div className="text-[.8rem] font-semibold mt-1">{phaseUpper.icon} {phaseUpper.label}</div>
        </div>
        <div className="rounded-[var(--radius)] p-5 text-white text-center" style={{ background: `linear-gradient(135deg, ${phaseLower.color}dd, ${phaseLower.color}88)` }}>
          <div className="text-[.72rem] opacity-70 mb-1">{'\uD83E\uDDB5'} Tren Inferior</div>
          <div className="text-[2rem] font-extrabold leading-tight">{recovery.readinessLower}</div>
          <div className="text-[.8rem] font-semibold mt-1">{phaseLower.icon} {phaseLower.label}</div>
        </div>
      </div>

      {/* 3. Energy State */}
      <div className="bg-card rounded-[var(--radius)] border border-gray-200 p-5 mb-4 fade-in" style={{ animationDelay: '.15s' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[.82rem] font-semibold text-gray-700">{'\u26A1'} Estado Energetico</div>
          <span className="text-[.78rem] font-bold" style={{ color: energySt.color }}>{energySt.label}</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${energySt.pct}%`, backgroundColor: energySt.color }}
          />
        </div>
        <div className="text-[.72rem] text-gray-400 mt-1.5">Score: {recovery.energyScore}/100</div>
      </div>

      {/* 4. System Reading */}
      <div className="bg-card rounded-[var(--radius)] border border-gray-200 p-5 mb-4 fade-in" style={{ animationDelay: '.2s' }}>
        <div className="text-[.82rem] font-semibold text-gray-700 mb-2">{'\uD83D\uDCCB'} Lectura del Sistema</div>
        <p className="text-[.84rem] text-gray-600 leading-relaxed">{recovery.systemReading}</p>
      </div>

      {/* 5. Recommendation */}
      <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-[var(--radius)] border border-primary/20 p-5 mb-4 fade-in" style={{ animationDelay: '.25s' }}>
        <div className="text-[.82rem] font-semibold text-primary-dark mb-2">{'\uD83D\uDCA1'} Recomendacion del Dia</div>
        <p className="text-[.84rem] text-gray-700 leading-relaxed">{recovery.recommendation}</p>
      </div>

      {/* 6. Readiness History (mini chart) */}
      {history.length > 1 && (
        <div className="bg-card rounded-[var(--radius)] border border-gray-200 p-5 mb-4 fade-in" style={{ animationDelay: '.3s' }}>
          <div className="text-[.82rem] font-semibold text-gray-700 mb-3">{'\uD83D\uDCC8'} Readiness ultimos dias</div>
          <div className="flex items-end gap-1.5" style={{ height: 80 }}>
            {history.map((h, i) => {
              const d = new Date(h.date + 'T12:00:00')
              const dayLabel = d.toLocaleDateString('es-AR', { weekday: 'narrow' })
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t-[3px] transition-all duration-500"
                    style={{
                      height: `${Math.max(h.global * 0.7, 4)}px`,
                      backgroundColor: readinessColor(h.global),
                      opacity: i === history.length - 1 ? 1 : 0.6,
                    }}
                  />
                  <span className="text-[.6rem] text-gray-400">{dayLabel}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 7. Recent Training */}
      {recentTraining.length > 0 && (
        <div className="bg-card rounded-[var(--radius)] border border-gray-200 p-5 fade-in" style={{ animationDelay: '.35s' }}>
          <div className="text-[.82rem] font-semibold text-gray-700 mb-3">{'\uD83C\uDFCB\uFE0F'} Entrenamientos Recientes</div>
          <div className="space-y-2.5">
            {recentTraining.map((t, i) => {
              const d = new Date(t.log_date + 'T12:00:00')
              const dayLabel = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
              const stim = t.training_stimulus as keyof typeof stimulusLabel | null
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[.84rem] text-gray-800 truncate">{t.training_name || 'Entrenamiento'}</div>
                    <div className="text-[.72rem] text-gray-400">{dayLabel}</div>
                  </div>
                  {t.training_volume_kg && (
                    <div className="text-[.75rem] text-gray-500 font-medium">
                      {Math.round(t.training_volume_kg / 1000 * 10) / 10}t
                    </div>
                  )}
                  {stim && (
                    <span
                      className="text-[.65rem] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap"
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
    </main>
  )
}
