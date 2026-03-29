'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { RightPanel } from '@/components/layout/right-panel'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import type { Phase, WeeklyCheckin, WeeklyDecision, DailyLog } from '@/lib/supabase/types'

type BadgeVariant = 'blue' | 'green' | 'yellow' | 'gray' | 'red'
type TabId = 'decisiones' | 'registros'

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

interface DayEntry {
  date: string
  log: DailyLog | null
}

interface LogFormData {
  calories: string
  protein_g: string
  steps: string
  sleep_hours: string
  energy: string
  hunger: string
  fatigue_level: string
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const d = new Date(dateStr + 'T00:00:00')
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
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

function getLast30Days(): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function emptyFormData(): LogFormData {
  return { calories: '', protein_g: '', steps: '', sleep_hours: '', energy: '', hunger: '', fatigue_level: '' }
}

function logToFormData(log: DailyLog): LogFormData {
  return {
    calories: log.calories != null ? String(log.calories) : '',
    protein_g: log.protein_g != null ? String(log.protein_g) : '',
    steps: log.steps != null ? String(log.steps) : '',
    sleep_hours: log.sleep_hours != null ? String(log.sleep_hours) : '',
    energy: log.energy != null ? String(log.energy) : '',
    hunger: log.hunger != null ? String(log.hunger) : '',
    fatigue_level: log.fatigue_level != null ? String(log.fatigue_level) : '',
  }
}

function ratingDots(value: number | null, max: number = 5): string {
  if (value == null) return '-'
  const filled = Math.min(Math.max(Math.round(value), 0), max)
  return '\u25CF'.repeat(filled) + '\u25CB'.repeat(max - filled)
}

// ─── Component ────────────────────────────────────────────────────────

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState<TabId>('decisiones')
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [phaseCards, setPhaseCards] = useState<PhaseCard[]>([])
  const [summaryStats, setSummaryStats] = useState<{ label: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Daily logs state
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [formData, setFormData] = useState<LogFormData>(emptyFormData())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchDecisionsData = useCallback(async () => {
    try {
      // Check cache first
      type JournalCacheData = {
        timelineItems: TimelineItem[]
        phaseCards: PhaseCard[]
        summaryStats: { label: string; value: string }[]
      }
      const cached = getCached<JournalCacheData>('journal:decisions')
      if (cached) {
        setTimelineItems(cached.timelineItems)
        setPhaseCards(cached.phaseCards)
        setSummaryStats(cached.summaryStats)
        setLoading(false)
      } else {
        setLoading(true)
      }

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

      // Cache the fetched data
      setCache('journal:decisions', { timelineItems: items, phaseCards: cards, summaryStats: summary } as JournalCacheData)
    } catch (err) {
      console.error('Error fetching journal data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDailyLogs = useCallback(async () => {
    try {
      // Check cache first
      const cachedEntries = getCached<DayEntry[]>('journal:dailylogs')
      if (cachedEntries) {
        setDayEntries(cachedEntries)
        setLogsLoading(false)
      } else {
        setLogsLoading(true)
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const days = getLast30Days()
      const fromDate = days[days.length - 1]
      const toDate = days[0]

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', fromDate)
        .lte('log_date', toDate)
        .order('log_date', { ascending: false })

      const logMap = new Map<string, DailyLog>()
      if (logs) {
        logs.forEach((l) => logMap.set(l.log_date, l))
      }

      const entries: DayEntry[] = days.map((date) => ({
        date,
        log: logMap.get(date) ?? null,
      }))

      setDayEntries(entries)
      setCache('journal:dailylogs', entries)
    } catch (err) {
      console.error('Error fetching daily logs:', err)
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDecisionsData()
  }, [fetchDecisionsData])

  useEffect(() => {
    if (activeTab === 'registros') {
      fetchDailyLogs()
    }
  }, [activeTab, fetchDailyLogs])

  const handleExpand = (date: string) => {
    if (expandedDate === date) {
      setExpandedDate(null)
      setFormData(emptyFormData())
    } else {
      setExpandedDate(date)
      const entry = dayEntries.find((e) => e.date === date)
      setFormData(entry?.log ? logToFormData(entry.log) : emptyFormData())
    }
  }

  const handleFormChange = (field: keyof LogFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async (date: string) => {
    try {
      setSaving(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const parseNum = (v: string) => v.trim() === '' ? null : Number(v)

      const { error } = await supabase
        .from('daily_logs')
        .upsert(
          {
            user_id: userId,
            log_date: date,
            calories: parseNum(formData.calories),
            protein_g: parseNum(formData.protein_g),
            steps: parseNum(formData.steps),
            sleep_hours: parseNum(formData.sleep_hours),
            energy: parseNum(formData.energy),
            hunger: parseNum(formData.hunger),
            fatigue_level: parseNum(formData.fatigue_level),
          },
          { onConflict: 'user_id,log_date' }
        )

      if (error) {
        console.error('Error saving daily log:', error)
        return
      }

      // Invalidate cache and refresh logs
      invalidateCache('journal:')
      await fetchDailyLogs()
      setExpandedDate(null)
      setFormData(emptyFormData())
    } catch (err) {
      console.error('Error saving daily log:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (date: string) => {
    const entry = dayEntries.find((e) => e.date === date)
    if (!entry?.log) return

    const confirmed = window.confirm(`Eliminar registro del ${formatDateShort(date)}?`)
    if (!confirmed) return

    try {
      setDeleting(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Delete associated fatigue_entries first
      await supabase
        .from('fatigue_entries')
        .delete()
        .eq('daily_log_id', entry.log.id)

      // Delete the daily_log row
      const { error } = await supabase
        .from('daily_logs')
        .delete()
        .eq('id', entry.log.id)
        .eq('user_id', userId)

      if (error) {
        console.error('Error deleting daily log:', error)
        return
      }

      // Invalidate cache and refresh logs
      invalidateCache('journal:')
      await fetchDailyLogs()
      setExpandedDate(null)
      setFormData(emptyFormData())
    } catch (err) {
      console.error('Error deleting daily log:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {/* Page Header */}
        <div className="mb-7">
          <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Diario</h1>
          <p className="text-gray-500 text-[.9rem] mt-1">Tus decisiones de coaching e historial de fases</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-[var(--radius)] p-1 w-fit">
          <button
            onClick={() => setActiveTab('decisiones')}
            className={`px-4 py-2 rounded-[calc(var(--radius)-2px)] text-[.88rem] font-semibold transition-all ${
              activeTab === 'decisiones'
                ? 'bg-card text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Decisiones
          </button>
          <button
            onClick={() => setActiveTab('registros')}
            className={`px-4 py-2 rounded-[calc(var(--radius)-2px)] text-[.88rem] font-semibold transition-all ${
              activeTab === 'registros'
                ? 'bg-card text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Registros Diarios
          </button>
        </div>

        {/* ─── Decisiones Tab ─── */}
        {activeTab === 'decisiones' && (
          <>
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Historial de Decisiones</div>

            {/* Loading Skeleton */}
            {loading && (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="relative pl-7 pb-7 ml-2 border-l-2 border-gray-200">
                    <div className="absolute -left-[7px] top-[2px] w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
                    <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-32 mb-2" />
                    <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)]">
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-48 mb-3" />
                      <div className="flex gap-2 mb-3">
                        <div className="bg-gray-200 animate-pulse rounded-full h-5 w-24" />
                        <div className="bg-gray-200 animate-pulse rounded-full h-5 w-20" />
                      </div>
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
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
          </>
        )}

        {/* ─── Registros Diarios Tab ─── */}
        {activeTab === 'registros' && (
          <>
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Ultimos 30 dias</div>

            {logsLoading && (
              <div className="flex flex-col gap-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-card rounded-[var(--radius)] p-[14px_18px] shadow-[var(--shadow)]">
                    <div className="flex items-center justify-between">
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-28" />
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-16" />
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-16" />
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-14" />
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-18" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!logsLoading && dayEntries.length === 0 && (
              <div className="bg-card rounded-[var(--radius)] p-8 shadow-[var(--shadow)] text-center">
                <p className="text-gray-400 text-[.9rem]">
                  No se encontraron registros. Toca un dia para agregar tu primer registro.
                </p>
              </div>
            )}

            {!logsLoading && (
              <div className="flex flex-col gap-2.5">
                {dayEntries.map((entry) => {
                  const hasLog = entry.log !== null
                  const isExpanded = expandedDate === entry.date
                  const today = isToday(entry.date)

                  return (
                    <div key={entry.date}>
                      {/* Day Card */}
                      <button
                        onClick={() => handleExpand(entry.date)}
                        className={`w-full text-left rounded-[var(--radius)] p-[14px_18px] shadow-[var(--shadow)] transition-all ${
                          hasLog
                            ? 'bg-card hover:shadow-md'
                            : 'bg-gray-50 hover:bg-gray-100'
                        } ${isExpanded ? 'rounded-b-none' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[.88rem] font-semibold text-gray-800">
                              {formatDateShort(entry.date)}
                            </span>
                            {today && <Badge variant="blue" className="text-[.66rem]">Hoy</Badge>}
                          </div>
                          {hasLog ? (
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          ) : (
                            <span className="text-[.77rem] text-gray-400 italic">Sin registro</span>
                          )}
                        </div>

                        {/* Summary row for existing logs */}
                        {hasLog && !isExpanded && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[.8rem] text-gray-500">
                            {entry.log!.calories != null && (
                              <span><strong>{entry.log!.calories}</strong> kcal</span>
                            )}
                            {entry.log!.protein_g != null && (
                              <span><strong>{entry.log!.protein_g}g</strong> prot</span>
                            )}
                            {entry.log!.steps != null && (
                              <span><strong>{entry.log!.steps.toLocaleString()}</strong> pasos</span>
                            )}
                            {entry.log!.sleep_hours != null && (
                              <span><strong>{entry.log!.sleep_hours}h</strong> sueno</span>
                            )}
                            {entry.log!.energy != null && (
                              <span>Energia {ratingDots(entry.log!.energy)}</span>
                            )}
                            {entry.log!.hunger != null && (
                              <span>Hambre {ratingDots(entry.log!.hunger)}</span>
                            )}
                            {entry.log!.fatigue_level != null && (
                              <span>Fatiga {ratingDots(entry.log!.fatigue_level)}</span>
                            )}
                          </div>
                        )}
                      </button>

                      {/* Expanded Edit Form */}
                      {isExpanded && (
                        <div className="bg-card rounded-b-[var(--radius)] shadow-[var(--shadow)] border-t border-gray-100 p-[18px_22px]">
                          <div className="grid grid-cols-2 max-md:grid-cols-1 gap-x-5 gap-y-3.5">
                            {/* Calories */}
                            <div>
                              <label className="block text-[.77rem] font-semibold text-gray-500 mb-1">Calorias (kcal)</label>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={formData.calories}
                                onChange={(e) => handleFormChange('calories', e.target.value)}
                                placeholder="ej. 2200"
                                className="w-full rounded-[var(--radius)] border border-gray-200 bg-gray-50 px-3 py-2 text-[.88rem] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              />
                            </div>

                            {/* Protein */}
                            <div>
                              <label className="block text-[.77rem] font-semibold text-gray-500 mb-1">Proteina (g)</label>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={formData.protein_g}
                                onChange={(e) => handleFormChange('protein_g', e.target.value)}
                                placeholder="ej. 160"
                                className="w-full rounded-[var(--radius)] border border-gray-200 bg-gray-50 px-3 py-2 text-[.88rem] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              />
                            </div>

                            {/* Steps */}
                            <div>
                              <label className="block text-[.77rem] font-semibold text-gray-500 mb-1">Pasos</label>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={formData.steps}
                                onChange={(e) => handleFormChange('steps', e.target.value)}
                                placeholder="ej. 8000"
                                className="w-full rounded-[var(--radius)] border border-gray-200 bg-gray-50 px-3 py-2 text-[.88rem] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              />
                            </div>

                            {/* Sleep */}
                            <div>
                              <label className="block text-[.77rem] font-semibold text-gray-500 mb-1">Sueno (horas)</label>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                value={formData.sleep_hours}
                                onChange={(e) => handleFormChange('sleep_hours', e.target.value)}
                                placeholder="ej. 7.5"
                                className="w-full rounded-[var(--radius)] border border-gray-200 bg-gray-50 px-3 py-2 text-[.88rem] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              />
                            </div>

                            {/* Energy */}
                            <div>
                              <label className="block text-[.77rem] font-semibold text-gray-500 mb-1">Energia (1-5)</label>
                              <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleFormChange('energy', formData.energy === String(v) ? '' : String(v))}
                                    className={`flex-1 py-2 rounded-[var(--radius)] text-[.84rem] font-semibold border transition-all ${
                                      formData.energy === String(v)
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Hunger */}
                            <div>
                              <label className="block text-[.77rem] font-semibold text-gray-500 mb-1">Hambre (1-5)</label>
                              <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleFormChange('hunger', formData.hunger === String(v) ? '' : String(v))}
                                    className={`flex-1 py-2 rounded-[var(--radius)] text-[.84rem] font-semibold border transition-all ${
                                      formData.hunger === String(v)
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Fatigue */}
                            <div className="col-span-2 max-md:col-span-1">
                              <label className="block text-[.77rem] font-semibold text-gray-500 mb-1">Nivel de Fatiga (1-5)</label>
                              <div className="flex gap-1.5 max-w-[50%] max-md:max-w-full">
                                {[1, 2, 3, 4, 5].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleFormChange('fatigue_level', formData.fatigue_level === String(v) ? '' : String(v))}
                                    className={`flex-1 py-2 rounded-[var(--radius)] text-[.84rem] font-semibold border transition-all ${
                                      formData.fatigue_level === String(v)
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex justify-between items-center mt-5">
                            {hasLog ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.date)}
                                disabled={deleting}
                                className="px-4 py-2 rounded-[var(--radius)] text-[.84rem] font-semibold text-danger hover:bg-danger-light disabled:opacity-50 transition-all"
                              >
                                {deleting ? 'Eliminando...' : 'Eliminar'}
                              </button>
                            ) : (
                              <div />
                            )}
                            <div className="flex gap-2.5">
                              <button
                                type="button"
                                onClick={() => { setExpandedDate(null); setFormData(emptyFormData()) }}
                                className="px-4 py-2 rounded-[var(--radius)] text-[.84rem] font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSave(entry.date)}
                                disabled={saving}
                                className="px-5 py-2 rounded-[var(--radius)] text-[.84rem] font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-all"
                              >
                                {saving ? 'Guardando...' : 'Guardar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
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
