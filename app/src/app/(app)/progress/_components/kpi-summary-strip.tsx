'use client'

import { METRIC_BY_KEY, deltaColor, formatMetricValue } from '../_lib/metric-definitions'

interface KPI {
  key: string
  label: string
  value: number | null
  delta: number | null
  color: string
}

function computeKPIs(
  dailyLogs: Record<string, any>[],
  weeklyCheckins: Record<string, any>[],
  sessions: any[],
): KPI[] {
  const kpis: KPI[] = []

  // Weight (from checkins)
  const weights = weeklyCheckins.map(c => c.weight_kg).filter((v: any): v is number => v != null)
  if (weights.length > 0) {
    const first = weights[0]
    const last = weights[weights.length - 1]
    kpis.push({ key: 'weight_kg', label: 'Peso', value: last, delta: last - first, color: '#0EA5E9' })
  }

  // Avg calories
  const cals = dailyLogs.map(l => l.calories).filter((v: any): v is number => v != null)
  if (cals.length > 0) {
    const avg = Math.round(cals.reduce((a: number, b: number) => a + b, 0) / cals.length)
    const half = Math.floor(cals.length / 2)
    const firstHalf = cals.slice(0, half)
    const secondHalf = cals.slice(half)
    const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length : avg
    const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length : avg
    kpis.push({ key: 'calories', label: 'Cal/dia', value: avg, delta: Math.round(avgSecond - avgFirst), color: '#0EA5E9' })
  }

  // Avg protein
  const prots = dailyLogs.map(l => l.protein_g).filter((v: any): v is number => v != null)
  if (prots.length > 0) {
    const avg = Math.round(prots.reduce((a: number, b: number) => a + b, 0) / prots.length)
    kpis.push({ key: 'protein_g', label: 'Prot/dia', value: avg, delta: null, color: '#8B5CF6' })
  }

  // Avg steps
  const steps = dailyLogs.map(l => l.steps).filter((v: any): v is number => v != null)
  if (steps.length > 0) {
    const avg = Math.round(steps.reduce((a: number, b: number) => a + b, 0) / steps.length)
    kpis.push({ key: 'steps', label: 'Pasos/dia', value: avg, delta: null, color: '#06B6D4' })
  }

  // Avg sleep
  const sleeps = dailyLogs.map(l => l.sleep_hours).filter((v: any): v is number => v != null)
  if (sleeps.length > 0) {
    const avg = Math.round(sleeps.reduce((a: number, b: number) => a + b, 0) / sleeps.length * 10) / 10
    kpis.push({ key: 'sleep_hours', label: 'Sueno/dia', value: avg, delta: null, color: '#6366F1' })
  }

  // Training sessions
  kpis.push({ key: 'sessions', label: 'Sesiones', value: sessions.length, delta: null, color: '#F97316' })

  // Weekly score avg
  const scores = weeklyCheckins.map(c => c.weekly_score).filter((v: any): v is number => v != null)
  if (scores.length > 0) {
    const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
    kpis.push({ key: 'weekly_score', label: 'Score prom', value: avg, delta: null, color: '#10B981' })
  }

  return kpis
}

interface Props {
  dailyLogs: Record<string, any>[]
  weeklyCheckins: Record<string, any>[]
  sessions: any[]
}

export function KPISummaryStrip({ dailyLogs, weeklyCheckins, sessions }: Props) {
  const kpis = computeKPIs(dailyLogs, weeklyCheckins, sessions)

  if (kpis.length === 0) return null

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
      {kpis.map(kpi => (
        <div
          key={kpi.key}
          className="min-w-[100px] bg-card rounded-[var(--radius)] p-[12px_14px] shadow-[var(--shadow)] flex-shrink-0"
        >
          <div className="text-[.72rem] font-semibold text-gray-400 mb-1">{kpi.label}</div>
          <div className="font-extrabold text-[1.15rem] text-gray-800">
            {kpi.value != null ? formatMetricValue(kpi.key, kpi.value) : '--'}
          </div>
          {kpi.delta != null && kpi.delta !== 0 && (
            <div className="text-[.72rem] font-bold mt-0.5" style={{ color: deltaColor(kpi.key, kpi.delta) }}>
              {kpi.delta > 0 ? '+' : ''}{kpi.key === 'weight_kg' ? kpi.delta.toFixed(1) : kpi.delta} {METRIC_BY_KEY[kpi.key]?.unit || ''}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
