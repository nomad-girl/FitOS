'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { RightPanel } from '@/components/layout/right-panel'
import { createClient } from '@/lib/supabase/client'
import type { Phase, WeeklyCheckin, WeeklyDecision } from '@/lib/supabase/types'

type BadgeVariant = 'blue' | 'green' | 'yellow' | 'gray' | 'red'

interface TimelineItem {
  date: string
  isCurrent: boolean
  title: string
  badges: { label: string; variant: BadgeVariant }[]
  context: string | null
  notes: string | null
  opacity: number
}

interface PhaseCard {
  name: string
  status: string
  statusVariant: BadgeVariant
  type: string
  detail: string
  stats: { label: string; value: string }[]
  opacity: number
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function goalLabel(goal: string): string {
  const map: Record<string, string> = {
    cut: 'Cut',
    bulk: 'Build',
    build: 'Build',
    maintenance: 'Mantenimiento',
    recomp: 'Recomp',
    strength: 'Fuerza',
  }
  return map[goal.toLowerCase()] ?? goal
}

function phaseStatusLabel(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'active':
      return { label: 'Activa', variant: 'blue' }
    case 'completed':
      return { label: 'Completada', variant: 'green' }
    case 'paused':
      return { label: 'Pausada', variant: 'yellow' }
    default:
      return { label: status, variant: 'gray' }
  }
}

function decisionBadges(decision: WeeklyDecision): { label: string; variant: BadgeVariant }[] {
  const badges: { label: string; variant: BadgeVariant }[] = []

  if (decision.volume_decisions?.length) {
    decision.volume_decisions.forEach((v) => {
      const isIncrease = /subir|aumentar|incrementar/i.test(v)
      const isDecrease = /bajar|reducir|disminuir|deload/i.test(v)
      badges.push({
        label: v,
        variant: isIncrease ? 'yellow' : isDecrease ? 'red' : 'green',
      })
    })
  }

  if (decision.nutrition_decisions?.length) {
    decision.nutrition_decisions.forEach((n) => {
      const isIncrease = /subir|aumentar|incrementar/i.test(n)
      const isDecrease = /bajar|reducir|disminuir/i.test(n)
      badges.push({
        label: n,
        variant: isIncrease ? 'yellow' : isDecrease ? 'red' : 'green',
      })
    })
  }

  if (decision.phase_decisions?.length) {
    decision.phase_decisions.forEach((p) => {
      const isEnd = /terminar|finalizar|cambiar/i.test(p)
      badges.push({
        label: p,
        variant: isEnd ? 'gray' : 'blue',
      })
    })
  }

  return badges
}

function buildContextString(checkin: WeeklyCheckin): string | null {
  const parts: string[] = []

  if (checkin.weight_kg != null) {
    parts.push(`Peso: ${checkin.weight_kg} kg`)
  }
  if (checkin.training_adherence != null) {
    parts.push(`${Math.round(checkin.training_adherence * 100)}% adherencia`)
  }
  if (checkin.avg_energy != null) {
    parts.push(`Energia: ${checkin.avg_energy.toFixed(1)}`)
  }
  if (checkin.performance_trend) {
    const trendMap: Record<string, string> = { up: 'subiendo', stable: 'estable', down: 'bajando' }
    parts.push(`Rendimiento ${trendMap[checkin.performance_trend] ?? checkin.performance_trend}`)
  }

  return parts.length > 0 ? parts.join(', ') + '.' : null
}

// ─── Component ────────────────────────────────────────────────────────

export default function JournalPage() {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [phaseCards, setPhaseCards] = useState<PhaseCard[]>([])
  const [summaryStats, setSummaryStats] = useState<{ label: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Fetch decisions with their checkins
      const { data: decisions } = await supabase
        .from('weekly_decisions')
        .select('*, weekly_checkins(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Fetch all phases for this user
      const { data: phases } = await supabase
        .from('phases')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true })

      // Build a phase lookup
      const phaseMap = new Map<string, Phase>()
      if (phases) {
        phases.forEach((p) => phaseMap.set(p.id, p))
      }

      // Build timeline items from decisions
      const items: TimelineItem[] = []
      if (decisions && decisions.length > 0) {
        decisions.forEach((dec, idx) => {
          const checkin = dec.weekly_checkins as unknown as WeeklyCheckin | null
          const phase = checkin?.phase_id ? phaseMap.get(checkin.phase_id) : null
          const phaseName = phase?.name ?? ''
          const weekNum = checkin?.week_number ?? 0
          const checkinDate = checkin?.checkin_date ?? dec.created_at.split('T')[0]

          items.push({
            date: `Semana ${weekNum} · ${formatDate(checkinDate)}`,
            isCurrent: idx === 0,
            title: phaseName ? `${phaseName} — Semana ${weekNum}` : `Semana ${weekNum}`,
            badges: decisionBadges(dec),
            context: checkin ? buildContextString(checkin) : null,
            notes: dec.notes || null,
            opacity: Math.max(0.5, 1 - idx * 0.1),
          })
        })
      }

      setTimelineItems(items)

      // Build phase cards for the right panel
      const cards: PhaseCard[] = []
      if (phases) {
        for (const phase of phases) {
          const { label: statusLabel, variant: statusVariant } = phaseStatusLabel(phase.status)

          // Count completed weeks for this phase
          const { count: weekCount } = await supabase
            .from('weekly_checkins')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('phase_id', phase.id)

          const stats: { label: string; value: string }[] = []

          if (phase.status === 'active' && weekCount != null) {
            stats.push({ label: 'Progreso', value: `Semana ${weekCount} de ${phase.duration_weeks}` })
          } else if (weekCount != null) {
            stats.push({ label: 'Duracion', value: `${weekCount} semanas` })
          }

          if (phase.frequency) {
            stats.push({ label: 'Frecuencia', value: `${phase.frequency} sesiones/sem` })
          }

          if (phase.calorie_target) {
            stats.push({ label: 'Calorias', value: `${phase.calorie_target} kcal` })
          }

          if (phase.focus_muscles?.length) {
            stats.push({ label: 'Foco', value: phase.focus_muscles.join(', ') })
          }

          cards.push({
            name: phase.name,
            status: statusLabel,
            statusVariant,
            type: goalLabel(phase.goal),
            detail: phase.status === 'active'
              ? `Semana ${weekCount ?? 0} de ${phase.duration_weeks}`
              : `${phase.duration_weeks} semanas`,
            stats,
            opacity: phase.status === 'active' ? 1 : phase.status === 'completed' ? 0.85 : 0.7,
          })
        }
      }

      setPhaseCards(cards)

      // Build summary stats
      const totalPhases = phases?.length ?? 0
      const activePhase = phases?.find((p) => p.status === 'active')
      const earliestPhase = phases?.length
        ? phases.reduce((earliest, p) => {
            const d = p.start_date ?? p.created_at
            const e = earliest.start_date ?? earliest.created_at
            return d < e ? p : earliest
          })
        : null
      const trainingSince = earliestPhase?.start_date
        ? formatDate(earliestPhase.start_date)
        : earliestPhase?.created_at
          ? formatDate(earliestPhase.created_at.split('T')[0])
          : '-'

      const summary: { label: string; value: string }[] = [
        { label: 'Fases totales', value: String(totalPhases) },
        { label: 'Entrenando desde', value: trainingSince },
      ]

      if (activePhase) {
        summary.push({ label: 'Fase actual', value: activePhase.name })
      }

      summary.push({ label: 'Decisiones registradas', value: String(decisions?.length ?? 0) })

      setSummaryStats(summary)
    } catch (err) {
      console.error('Error fetching journal data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {/* Page Header */}
        <div className="mb-7">
          <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Diario</h1>
          <p className="text-gray-500 text-[.9rem] mt-1">Tus decisiones de coaching e historial de fases</p>
        </div>

        <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Historial de Decisiones</div>

        {/* Loading */}
        {loading && (
          <div className="text-gray-400 text-[.9rem] py-8 text-center">Cargando...</div>
        )}

        {/* Empty State */}
        {!loading && timelineItems.length === 0 && (
          <div className="bg-card rounded-[var(--radius)] p-8 shadow-[var(--shadow)] text-center">
            <p className="text-gray-400 text-[.9rem]">
              No hay decisiones registradas todavia. Hace tu primer check-in semanal para empezar tu diario.
            </p>
          </div>
        )}

        {/* Timeline */}
        {!loading && timelineItems.map((item, i) => (
          <div
            key={i}
            className={`relative pl-7 pb-7 ml-2 ${i < timelineItems.length - 1 ? 'border-l-2 border-gray-200' : 'border-l-2 border-transparent'}`}
          >
            {/* Dot */}
            <div className={`absolute -left-[7px] top-[2px] w-3 h-3 rounded-full border-2 border-card ${item.isCurrent ? 'bg-primary' : 'bg-gray-300'}`} />

            {/* Date */}
            <div className="text-[.77rem] text-gray-400 font-semibold mb-1">
              {item.date}
              {item.isCurrent && <Badge variant="blue" className="ml-1.5 text-[.66rem]">Actual</Badge>}
            </div>

            {/* Card */}
            <div
              className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mt-1.5"
              style={{ opacity: item.opacity }}
            >
              <div className="font-semibold text-[.92rem] mb-2">{item.title}</div>

              {item.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {item.badges.map((b, bi) => (
                    <Badge key={bi} variant={b.variant}>{b.label}</Badge>
                  ))}
                </div>
              )}

              {item.context && (
                <div className="text-[.84rem] text-gray-400">
                  <strong>Contexto:</strong> {item.context}
                </div>
              )}

              {item.notes && (
                <div className="text-[.84rem] text-gray-400 mt-1">
                  <strong>Notas:</strong> {item.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Right Panel */}
      <RightPanel>
        <div className="font-bold text-base text-gray-800 mb-[18px]">Fases</div>

        {!loading && phaseCards.length === 0 && (
          <div className="text-gray-400 text-[.84rem]">No hay fases creadas.</div>
        )}

        {phaseCards.map((phase) => (
          <div
            key={phase.name}
            className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-3.5"
            style={{ opacity: phase.opacity }}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-[.92rem]">{phase.name}</div>
              <Badge variant={phase.statusVariant}>{phase.status}</Badge>
            </div>
            <div className="text-[.77rem] text-gray-400">{phase.type} &middot; {phase.detail}</div>
            <div className="mt-2.5 text-[.84rem] flex flex-col gap-1.5">
              {phase.stats.map((stat) => (
                <div key={stat.label} className="flex justify-between">
                  <span className="text-gray-400">{stat.label}</span>
                  <span className="font-semibold">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Phase Summary */}
        {summaryStats.length > 0 && (
          <>
            <div className="font-bold text-base text-gray-800 mt-6 mb-[18px]">Resumen</div>
            <div className="bg-gray-50 rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
              <div className="text-[.84rem] flex flex-col gap-2">
                {summaryStats.map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </RightPanel>
    </>
  )
}
