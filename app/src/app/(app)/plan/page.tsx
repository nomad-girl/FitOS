'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { PhaseWizard } from '@/components/shared/phase-wizard'
import { MacrocycleWizard } from '@/components/shared/macrocycle-wizard'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import type { Phase, RoutineWithExercises, Exercise } from '@/lib/supabase/types'

type Macrocycle = {
  id: string
  user_id: string
  name: string
  year: number
  duration_months?: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

type PlanTab = 'routines' | 'phase' | 'macro'

const exerciseIcons: Record<string, string> = {
  compound: '\uD83C\uDFCB\uFE0F',
  isolation: '\uD83D\uDCAA',
  core: '\uD83E\uDDD8',
}

const goalLabel: Record<string, string> = {
  build: 'Build / Volumen',
  cut: 'Cut / Define',
  maintain: 'Mantenimiento',
  strength: 'Fuerza',
}

const borderColors = ['border-l-primary', 'border-l-accent', 'border-l-success', 'border-l-warning']

export default function PlanPage() {
  const [activeTab, setActiveTab] = useState<PlanTab>('macro')
  const [selectedRoutine, setSelectedRoutine] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create')
  const [macroWizardOpen, setMacroWizardOpen] = useState(false)
  const [editingMacro, setEditingMacro] = useState<Macrocycle | null>(null)
  const [routineWizardOpen, setRoutineWizardOpen] = useState(false)

  // Data state
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>([])
  const [activeMacro, setActiveMacro] = useState<Macrocycle | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [activePhase, setActivePhase] = useState<Phase | null>(null)
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      // Check cache first
      const cachedMacros = getCached<Macrocycle[]>('plan:macrocycles')
      const cachedPhases = getCached<Phase[]>('plan:phases')
      const cachedRoutines = getCached<RoutineWithExercises[]>('plan:routines')
      if (cachedMacros && cachedPhases) {
        setMacrocycles(cachedMacros)
        setActiveMacro(cachedMacros[0] ?? null)
        setPhases(cachedPhases)
        const active = cachedPhases.find((p) => p.status === 'active') ?? null
        setActivePhase(active)
        if (cachedRoutines) setRoutines(cachedRoutines)
        setLoading(false)
      } else {
        setLoading(true)
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Fetch macrocycles
      const { data: macrosData } = await supabase
        .from('macrocycles')
        .select('*')
        .eq('user_id', userId)
        .order('year', { ascending: false })

      if (macrosData) {
        setMacrocycles(macrosData)
        setCache('plan:macrocycles', macrosData)
        // Auto-select the most recent macrocycle
        const current = macrosData[0] ?? null
        setActiveMacro(current)

        // Fetch phases for active macrocycle AND orphan phases (macrocycle_id is null)
        if (current) {
          const { data: macroPhases } = await supabase
            .from('phases')
            .select('*')
            .eq('user_id', userId)
            .eq('macrocycle_id', current.id)
            .order('display_order', { ascending: true })

          const { data: orphanPhases } = await supabase
            .from('phases')
            .select('*')
            .eq('user_id', userId)
            .is('macrocycle_id', null)
            .order('display_order', { ascending: true })

          const allPhases = [...(macroPhases ?? []), ...(orphanPhases ?? [])]
          setPhases(allPhases)
          setCache('plan:phases', allPhases)
          const active = allPhases.find((p) => p.status === 'active') ?? null
          setActivePhase(active)
          if (active) fetchRoutines(supabase, active.id)
        } else {
          // No macrocycle — fetch all phases for this user
          const { data: phasesData } = await supabase
            .from('phases')
            .select('*')
            .eq('user_id', userId)
            .order('display_order', { ascending: true })

          if (phasesData) {
            setPhases(phasesData)
            setCache('plan:phases', phasesData)
            const active = phasesData.find((p) => p.status === 'active') ?? null
            setActivePhase(active)
            if (active) fetchRoutines(supabase, active.id)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching plan data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  async function fetchRoutines(supabase: ReturnType<typeof createClient>, phaseId: string) {
    const { data: routinesData } = await supabase
      .from('routines')
      .select(`
        *,
        routine_exercises (
          *,
          exercise:exercises (*),
          routine_sets (*)
        )
      `)
      .eq('phase_id', phaseId)
      .order('display_order', { ascending: true })

    if (routinesData) {
      const sorted = routinesData.map((r) => ({
        ...r,
        routine_exercises: (r.routine_exercises ?? [])
          .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
          .map((re: { routine_sets?: { set_number: number }[] }) => ({
            ...re,
            routine_sets: (re.routine_sets ?? []).sort(
              (a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number
            ),
          })),
      }))
      setRoutines(sorted as RoutineWithExercises[])
      setCache('plan:routines', sorted as RoutineWithExercises[])
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openRoutine = selectedRoutine ? routines.find((r) => r.id === selectedRoutine) : null
  const selectedPhase = selectedPhaseId ? phases.find((p) => p.id === selectedPhaseId) : null
  const completedPhases = phases.filter((p) => p.status === 'completed')

  function openPhaseWizard(mode: 'create' | 'edit', phase?: Phase | null) {
    setWizardMode(mode)
    if (mode === 'edit' && phase) setSelectedPhaseId(phase.id)
    setWizardOpen(true)
  }

  function getWeekNumber(phase: Phase) {
    if (!phase.start_date) return 1
    const startDate = new Date(phase.start_date)
    const now = new Date()
    return Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)))
  }

  async function deleteMacrocycle(macro: Macrocycle) {
    if (!confirm(`Eliminar macrociclo "${macro.name}"? Se eliminaran todas sus fases.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('macrocycles').delete().eq('id', macro.id)
    if (error) { console.error('Error deleting macrocycle:', error); return }
    invalidateCache('plan:')
    fetchData()
  }

  async function deletePhase(phase: Phase) {
    if (!confirm(`Eliminar fase "${phase.name}"? Se eliminaran todas sus rutinas.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('phases').delete().eq('id', phase.id)
    if (error) { console.error('Error deleting phase:', error); return }
    invalidateCache('plan:')
    fetchData()
  }

  if (loading) {
    return (
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        <div className="mb-7">
          <div className="bg-gray-200 animate-pulse rounded-[6px] h-7 w-32 mb-2" />
          <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-56" />
        </div>
        {/* Skeleton: Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-[var(--radius)] p-1 w-fit">
          <div className="bg-gray-200 animate-pulse rounded-[10px] h-9 w-24" />
          <div className="bg-gray-200 animate-pulse rounded-[10px] h-9 w-24" />
          <div className="bg-gray-200 animate-pulse rounded-[10px] h-9 w-28" />
        </div>
        {/* Skeleton: Cards */}
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
            <div className="flex justify-between items-center mb-3">
              <div className="bg-gray-200 animate-pulse rounded-[6px] h-5 w-40" />
              <div className="bg-gray-200 animate-pulse rounded-full h-5 w-16" />
            </div>
            <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-full mb-2" />
            <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-3/4 mb-2" />
            <div className="bg-gray-200 animate-pulse rounded-[6px] h-2 w-full mt-3" />
          </div>
        ))}
      </main>
    )
  }

  // If no macrocycle exists, show onboarding
  if (macrocycles.length === 0 && activeTab === 'macro') {
    return (
      <>
        <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="text-[3rem] mb-4">{'\uD83C\uDFAF'}</div>
            <h1 className="text-[1.5rem] font-extrabold text-gray-900 mb-3">Empeza tu Plan de Entrenamiento</h1>
            <p className="text-gray-500 text-[.92rem] mb-2 leading-relaxed">
              El primer paso es crear un <strong>Macrociclo</strong> — tu plan anual. Dentro vas a organizar las <strong>Fases</strong> (mesociclos) con sus objetivos, y en cada fase las <strong>Rutinas</strong> de entrenamiento.
            </p>
            <div className="flex items-center justify-center gap-3 my-6 text-[.85rem] text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-[.8rem]">1</span>
                <span className="font-semibold text-gray-600">Macrociclo</span>
              </div>
              <span className="text-gray-300">&rarr;</span>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-[.8rem]">2</span>
                <span>Fases</span>
              </div>
              <span className="text-gray-300">&rarr;</span>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-[.8rem]">3</span>
                <span>Rutinas</span>
              </div>
            </div>
            <button
              onClick={() => { setEditingMacro(null); setMacroWizardOpen(true) }}
              className="mt-4 inline-flex items-center justify-center gap-2 py-3 px-8 rounded-[var(--radius-sm)] font-bold text-[1rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_12px_rgba(14,165,233,.3)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_20px_rgba(14,165,233,.4)] hover:-translate-y-px"
            >
              + Crear Macrociclo
            </button>
          </div>
        </main>

        <MacrocycleWizard
          open={macroWizardOpen}
          onClose={() => { setMacroWizardOpen(false); setEditingMacro(null); invalidateCache('plan:'); fetchData() }}
          existingMacro={editingMacro}
        />
      </>
    )
  }

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {/* Sub-tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="inline-flex gap-1 bg-gray-100 rounded-[var(--radius-sm)] p-[3px]">
            {[
              { id: 'macro' as const, label: 'Macrociclo' },
              { id: 'phase' as const, label: 'Fase Actual' },
              { id: 'routines' as const, label: 'Rutinas' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedRoutine(null); setSelectedPhaseId(null) }}
                className={`py-2 px-[18px] rounded-lg font-semibold text-[.87rem] transition-all duration-200 cursor-pointer border-none ${
                  activeTab === tab.id
                    ? 'bg-card text-gray-800 shadow-[var(--shadow)]'
                    : 'text-gray-500 bg-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ======================== MACROCYCLE VIEW ======================== */}
        {activeTab === 'macro' && (
          <div className="fade-in">
            {/* Macro Header */}
            {activeMacro && (
              <div className="bg-card rounded-[var(--radius)] p-[24px_28px] shadow-[var(--shadow)] mb-6">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <h1 className="text-[1.4rem] font-extrabold text-gray-900 tracking-tight">{activeMacro.name}</h1>
                    <p className="text-gray-500 text-[.85rem] mt-1">{activeMacro.duration_months ? `${activeMacro.duration_months} meses` : 'Plan anual'} — {activeMacro.year} — {phases.length} fases planificadas</p>
                    {activeMacro.notes && (
                      <p className="text-gray-400 text-[.82rem] mt-2 italic">{activeMacro.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingMacro(activeMacro); setMacroWizardOpen(true) }}
                      className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-gray-200 text-gray-600 bg-card cursor-pointer hover:border-primary hover:text-primary transition-all duration-200"
                    >
                      {'\u270F\uFE0F'} Editar
                    </button>
                    <button
                      onClick={() => deleteMacrocycle(activeMacro)}
                      className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-danger text-danger bg-card cursor-pointer hover:bg-danger-light transition-all duration-200"
                    >
                      {'\uD83D\uDDD1\uFE0F'} Eliminar
                    </button>
                    {macrocycles.length > 1 && (
                      <select
                        value={activeMacro.id}
                        onChange={(e) => {
                          const m = macrocycles.find((mc) => mc.id === e.target.value)
                          if (m) { setActiveMacro(m); fetchData() }
                        }}
                        className="py-[7px] px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.82rem] font-semibold text-gray-600 bg-card cursor-pointer focus:border-primary focus:outline-none"
                      >
                        {macrocycles.map((mc) => (
                          <option key={mc.id} value={mc.id}>{mc.name} ({mc.duration_months ? `${mc.duration_months}m` : mc.year})</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Flow: Macrociclo → Fases */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-[1.08rem] font-bold text-gray-800">Fases del Macrociclo</div>
              <button
                onClick={() => openPhaseWizard('create')}
                className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px"
              >
                + Nueva Fase
              </button>
            </div>

            {phases.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-[var(--radius)] mb-6">
                <div className="text-[2rem] mb-2">{'\uD83D\uDCCB'}</div>
                <p className="text-gray-500 text-[.9rem] mb-3">Tu macrociclo esta vacio. Agrega la primera fase.</p>
                <button
                  onClick={() => openPhaseWizard('create')}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-[var(--radius-sm)] font-semibold text-[.85rem] bg-gradient-to-br from-primary to-accent text-white cursor-pointer border-none"
                >
                  + Crear Primera Fase
                </button>
              </div>
            )}

            {/* Phase Cards */}
            <div className="flex flex-col gap-3">
              {phases.map((phase, idx) => {
                const wk = getWeekNumber(phase)
                const progress = Math.round((wk / phase.duration_weeks) * 100)
                const isActive = phase.status === 'active'

                return (
                  <div
                    key={phase.id}
                    onClick={() => {
                      if (isActive) setActiveTab('phase')
                      else { setSelectedPhaseId(phase.id); setActiveTab('phase') }
                    }}
                    className={`bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] cursor-pointer transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-px border-l-4 ${
                      phase.status === 'completed'
                        ? 'border-l-success'
                        : isActive
                        ? 'border-l-primary'
                        : 'border-l-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div>
                        <div className="font-bold text-[1rem] text-gray-800">{phase.name}</div>
                        <div className="text-[.77rem] text-gray-400 mt-0.5">
                          {goalLabel[phase.goal] ?? phase.goal} &middot; {phase.duration_weeks} semanas &middot; {phase.frequency}x/sem
                          {phase.focus_muscles?.length > 0 && <> &middot; {phase.focus_muscles.join(', ')}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {phase.status === 'completed' && <Badge variant="green">Completada</Badge>}
                        {isActive && <Badge variant="blue">Activa — Sem {wk}</Badge>}
                        {phase.status === 'planned' && <Badge variant="gray">Planificada</Badge>}
                        {phase.status === 'draft' && <Badge variant="gray">Borrador</Badge>}
                        {!phase.macrocycle_id && <Badge variant="yellow">Sin macrociclo</Badge>}
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePhase(phase) }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-danger hover:bg-danger-light transition-all duration-200 cursor-pointer bg-transparent border-none text-[.85rem]"
                          title="Eliminar fase"
                        >
                          {'\uD83D\uDDD1\uFE0F'}
                        </button>
                        <span className="text-gray-300">&rsaquo;</span>
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-2">
                        <ProgressBar value={Math.min(progress, 100)} variant="blue" height="4px" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Gantt-like Timeline */}
            {phases.length > 0 && (
              <div className="mt-8 mb-4">
                <div className="text-[.95rem] font-bold text-gray-800 mb-3">Timeline</div>
                <div className="bg-card rounded-[var(--radius)] p-[20px_24px] shadow-[var(--shadow)]">
                  {/* Month headers */}
                  <div className="flex mb-3">
                    <div className="w-[120px] shrink-0" />
                    <div className="flex-1 flex">
                      {['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'].map((m) => (
                        <div key={m} className="flex-1 text-center text-[.68rem] text-gray-400 font-semibold">{m}</div>
                      ))}
                    </div>
                  </div>
                  {/* Phase bars */}
                  {phases.map((phase, idx) => {
                    const year = activeMacro?.year ?? new Date().getFullYear()
                    const start = phase.start_date ? new Date(phase.start_date) : null
                    const startWeek = start ? Math.floor((start.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) : idx * 8
                    const leftPct = (startWeek / 52) * 100
                    const widthPct = (phase.duration_weeks / 52) * 100
                    const colors = ['bg-primary', 'bg-accent', 'bg-success', 'bg-warning']

                    return (
                      <div key={phase.id} className="flex items-center mb-2">
                        <div className="w-[120px] shrink-0 text-[.78rem] font-semibold text-gray-600 truncate pr-2">{phase.name}</div>
                        <div className="flex-1 relative h-7 bg-gray-50 rounded">
                          <div
                            className={`absolute top-0 h-full ${colors[idx % colors.length]} rounded opacity-80 flex items-center justify-center text-[.68rem] text-white font-semibold`}
                            style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 3)}%` }}
                          >
                            {phase.duration_weeks}s
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Macro Summary */}
            <div className="grid grid-cols-3 gap-4 mt-4 max-sm:grid-cols-1">
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] text-center">
                <div className="text-[.77rem] text-gray-400 mb-0.5">Fases</div>
                <div className="text-[1.25rem] font-extrabold">{phases.length}</div>
                <div className="text-[.77rem] text-gray-400">
                  {phases.filter((p) => p.status === 'active').length} activa, {completedPhases.length} completas
                </div>
              </div>
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] text-center">
                <div className="text-[.77rem] text-gray-400 mb-0.5">Semanas Totales</div>
                <div className="text-[1.25rem] font-extrabold">{phases.reduce((a, p) => a + p.duration_weeks, 0)}</div>
                <div className="text-[.77rem] text-gray-400">de {activeMacro?.duration_months ? `${activeMacro.duration_months} meses` : '52 semanas'}</div>
              </div>
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] text-center">
                <div className="text-[.77rem] text-gray-400 mb-0.5">Distribucion</div>
                <div className="text-[1.25rem] font-extrabold">
                  {phases.filter((p) => p.goal === 'build').length}V / {phases.filter((p) => p.goal === 'cut').length}D / {phases.filter((p) => p.goal === 'strength').length}F
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================== PHASE VIEW ======================== */}
        {activeTab === 'phase' && (
          <div className="fade-in">
            {(activePhase || selectedPhase) ? (() => {
              const phase = selectedPhase ?? activePhase!
              const wk = getWeekNumber(phase)
              const progress = Math.round((wk / phase.duration_weeks) * 100)

              return (
                <>
                  {/* Back to Macrocycle */}
                  <button
                    onClick={() => { setActiveTab('macro'); setSelectedPhaseId(null) }}
                    className="text-gray-500 font-semibold text-[.82rem] mb-4 cursor-pointer hover:text-primary transition-colors bg-transparent border-none -ml-2 py-1 px-2"
                  >
                    &larr; Volver al Macrociclo
                  </button>

                  {/* Active Phase Card */}
                  <div className="bg-gradient-to-br from-primary-light to-[#E0F7FA] border-2 border-primary rounded-[var(--radius)] p-[26px_28px] mb-[18px] relative">
                    <div className="flex justify-between items-start flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <Badge variant="blue" className="text-[.8rem] py-1 px-3.5">
                            {phase.status === 'active' ? 'Fase Activa' : phase.status === 'completed' ? 'Completada' : 'Planificada'}
                          </Badge>
                        </div>
                        <div className="font-extrabold text-[1.3rem] text-gray-900 mb-1">{phase.name}</div>
                        <div className="flex gap-2 flex-wrap mb-3">
                          <Badge variant="yellow">{goalLabel[phase.goal] ?? phase.goal}</Badge>
                          <Badge variant="gray">{phase.frequency}x/semana</Badge>
                          {phase.focus_muscles?.length > 0 && (
                            <Badge variant="gray">{phase.focus_muscles.join(', ')}</Badge>
                          )}
                          {phase.calorie_target && phase.protein_target && (
                            <Badge variant="gray">{phase.calorie_target} kcal / {phase.protein_target}g P</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openPhaseWizard('edit', phase)}
                          className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-gray-200 text-gray-600 bg-card cursor-pointer"
                        >
                          {'\u270F\uFE0F'} Editar
                        </button>
                        {phase.status === 'active' && (
                          <button className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-danger text-danger bg-transparent cursor-pointer hover:bg-danger-light">
                            Finalizar Fase
                          </button>
                        )}
                      </div>
                    </div>

                    {phase.status === 'active' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[.84rem] text-gray-600 mb-1.5">
                          <span>Semana {wk} de {phase.duration_weeks}</span>
                          <span className="font-bold">{Math.min(progress, 100)}% completo</span>
                        </div>
                        <ProgressBar value={Math.min(progress, 100)} variant="blue" height="8px" />
                        {phase.start_date && (
                          <div className="flex justify-between mt-2 text-[.78rem] text-gray-500">
                            <span>Inicio: {new Date(phase.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {phase.objective && (
                      <div className="mt-5 pt-4 border-t border-primary/20">
                        <div className="font-bold text-[.9rem] text-gray-800 mb-2.5">Objetivo</div>
                        <div className="text-[.84rem] text-gray-600">{phase.objective}</div>
                      </div>
                    )}
                  </div>

                  {/* Routines for this phase */}
                  <div className="flex justify-between items-center mt-6 mb-4">
                    <div className="text-[1.08rem] font-bold text-gray-800">Rutinas de la Fase</div>
                    <button
                      onClick={() => setActiveTab('routines')}
                      className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none"
                    >
                      Ver Rutinas &rarr;
                    </button>
                  </div>

                  {routines.length === 0 && (
                    <div className="text-[.84rem] text-gray-400">No hay rutinas en esta fase todavia.</div>
                  )}

                  {routines.map((routine, idx) => (
                    <div key={routine.id} className={`bg-card rounded-[var(--radius)] shadow-[var(--shadow)] mb-3 overflow-hidden border-l-4 ${borderColors[idx % borderColors.length]} p-[16px_20px]`}>
                      <div className="font-semibold text-[.95rem] text-gray-800">{routine.name}</div>
                      <div className="text-[.77rem] text-gray-400">
                        {routine.routine_exercises?.length ?? 0} ejercicios &middot;{' '}
                        {routine.routine_exercises?.reduce((a, re) => a + (re.routine_sets?.length ?? 0), 0) ?? 0} series
                      </div>
                    </div>
                  ))}
                </>
              )
            })() : (
              <div className="text-center py-10 text-gray-400">
                <div className="text-[1.5rem] mb-2">{'\uD83D\uDCCB'}</div>
                <p className="mb-3">No hay fase activa.</p>
                <button
                  onClick={() => setActiveTab('macro')}
                  className="text-primary font-semibold text-[.85rem] bg-transparent border-none cursor-pointer hover:underline"
                >
                  Ir al Macrociclo para crear una &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================== ROUTINES VIEW ======================== */}
        {activeTab === 'routines' && !selectedRoutine && (
          <div className="fade-in">
            {/* Program Header */}
            {activePhase && (
              <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-6">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="font-extrabold text-[1.1rem] text-gray-900">{activePhase.name}</div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <Badge variant="yellow">{goalLabel[activePhase.goal] ?? activePhase.goal}</Badge>
                      {activePhase.calorie_target && <Badge variant="blue">{activePhase.calorie_target} kcal</Badge>}
                      {activePhase.protein_target && <Badge variant="blue">{activePhase.protein_target}g protein</Badge>}
                      <Badge variant="gray">{activePhase.frequency}x/semana</Badge>
                    </div>
                  </div>
                  <button
                    onClick={() => openPhaseWizard('edit', activePhase)}
                    className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-gray-200 text-gray-600 bg-card transition-all duration-200 hover:border-primary hover:text-primary cursor-pointer"
                  >
                    {'\u270F\uFE0F'} Editar
                  </button>
                </div>
              </div>
            )}

            {!activePhase && (
              <div className="text-center py-10 text-gray-400 mb-6">
                <p className="mb-3">Necesitas una fase activa para agregar rutinas.</p>
                <button
                  onClick={() => setActiveTab('macro')}
                  className="text-primary font-semibold text-[.85rem] bg-transparent border-none cursor-pointer hover:underline"
                >
                  Ir al Macrociclo &rarr;
                </button>
              </div>
            )}

            {activePhase && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-[1.08rem] font-bold text-gray-800">Rutinas ({routines.length})</div>
                  <button
                    onClick={() => setRoutineWizardOpen(true)}
                    className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px cursor-pointer border-none"
                  >
                    + Agregar Rutina
                  </button>
                </div>

                {routines.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    No hay rutinas todavia. Agrega tu primera rutina de entrenamiento.
                  </div>
                )}

                {routines.map((routine, idx) => {
                  const exCount = routine.routine_exercises?.length ?? 0
                  const setCount = routine.routine_exercises?.reduce(
                    (acc, re) => acc + (re.routine_sets?.length ?? 0), 0
                  ) ?? 0
                  const time = routine.estimated_duration_min ? `~${routine.estimated_duration_min} min` : ''

                  return (
                    <div
                      key={routine.id}
                      onClick={() => setSelectedRoutine(routine.id)}
                      className={`bg-card rounded-[var(--radius)] shadow-[var(--shadow)] mb-4 overflow-hidden cursor-pointer transition-all duration-200 border-l-4 ${borderColors[idx % borderColors.length]} hover:shadow-[var(--shadow-md)] hover:-translate-y-px`}
                    >
                      <div className="p-[20px_24px_12px] flex justify-between items-center">
                        <div>
                          <h3 className="text-base font-bold text-gray-800 mb-0.5">{routine.name}</h3>
                          <div className="text-[.77rem] text-gray-400">
                            {exCount} ejercicios &middot; {setCount} series {time && <>&middot; {time}</>}
                          </div>
                        </div>
                        <span className="text-gray-300 text-[1.1rem]">&rsaquo;</span>
                      </div>
                      <div className="px-6 pb-4">
                        {routine.routine_exercises?.map((re, i) => (
                          <div
                            key={re.id}
                            className="flex items-center gap-2.5 py-1.5 text-[.84rem] text-gray-600 border-b border-gray-50 last:border-b-0"
                          >
                            <div className="w-7 h-7 rounded-[6px] bg-gray-50 flex items-center justify-center text-[.8rem] shrink-0">
                              {exerciseIcons[re.exercise?.category ?? ''] ?? '\uD83C\uDFCB\uFE0F'}
                            </div>
                            <span className="flex-1 font-medium">{re.exercise?.name ?? `Ejercicio ${i + 1}`}</span>
                            <span className="text-gray-400 text-[.77rem] font-semibold">
                              {re.routine_sets?.length ?? 0}x{re.routine_sets?.[0]?.rep_range_low ?? ''}{re.routine_sets?.[0]?.rep_range_high && re.routine_sets[0].rep_range_high !== re.routine_sets[0].rep_range_low ? `-${re.routine_sets[0].rep_range_high}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* SESSION EDITOR VIEW */}
        {activeTab === 'routines' && selectedRoutine && openRoutine && (
          <div className="fade-in">
            <button
              onClick={() => setSelectedRoutine(null)}
              className="text-gray-500 font-semibold text-[.82rem] mb-4 cursor-pointer hover:text-primary transition-colors bg-transparent border-none -ml-2 py-1 px-2"
            >
              &larr; Volver a Rutinas
            </button>

            <div className="mb-6">
              <h2 className="text-[1.3rem] font-extrabold text-gray-900">{openRoutine.name}</h2>
              <p className="text-gray-400 text-[.84rem] mt-1">
                {openRoutine.routine_exercises?.length ?? 0} ejercicios &middot;{' '}
                {openRoutine.routine_exercises?.reduce((a, re) => a + (re.routine_sets?.length ?? 0), 0) ?? 0} series
                {openRoutine.estimated_duration_min && <> &middot; ~{openRoutine.estimated_duration_min} min</>}
              </p>
            </div>

            {openRoutine.routine_exercises?.map((re) => (
              <div key={re.id} className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] mb-3.5 overflow-hidden">
                <div className="flex items-center gap-3 p-[18px_20px_12px]">
                  <div className="w-11 h-11 rounded-[10px] bg-gray-50 flex items-center justify-center text-[1.2rem] shrink-0">
                    {exerciseIcons[re.exercise?.category ?? ''] ?? '\uD83C\uDFCB\uFE0F'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[.97rem] text-gray-800">{re.exercise?.name ?? 'Ejercicio'}</div>
                    <div className="text-[.77rem] text-gray-400 mt-px">{re.exercise?.equipment ?? ''}</div>
                  </div>
                </div>

                <div className="px-5 pb-4">
                  <div className="flex items-center gap-2 mb-3 text-[.82rem] text-gray-500">
                    <span>{'\u23F1\uFE0F'} Descanso:</span>
                    <select
                      defaultValue={re.rest_seconds ?? 90}
                      className="py-1.5 px-2.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.84rem] font-semibold text-gray-700 bg-white cursor-pointer focus:border-primary focus:outline-none"
                    >
                      <option value={60}>60s</option>
                      <option value={90}>90s</option>
                      <option value={120}>120s</option>
                      <option value={180}>180s</option>
                    </select>
                  </div>

                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-[.7rem] font-bold uppercase tracking-wider text-gray-400 text-left pb-2 w-10">SET</th>
                        <th className="text-[.7rem] font-bold uppercase tracking-wider text-gray-400 text-center pb-2">KG</th>
                        <th className="text-[.7rem] font-bold uppercase tracking-wider text-gray-400 text-center pb-2">REPS</th>
                        <th className="text-[.7rem] font-bold uppercase tracking-wider text-gray-400 text-center pb-2">RPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {re.routine_sets?.map((s) => (
                        <tr key={s.id}>
                          <td className="py-[3px] text-left">
                            <div className="w-8 h-8 rounded-full bg-gray-100 inline-flex items-center justify-center text-[.82rem] font-bold text-gray-600">
                              {s.set_number}
                            </div>
                          </td>
                          <td className="py-[3px] text-center">
                            <input
                              type="number"
                              defaultValue={s.target_weight ?? ''}
                              className="w-16 max-w-[64px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-[3px] text-center">
                            <div className="flex items-center gap-[3px] justify-center">
                              <input type="number" defaultValue={s.rep_range_low ?? ''} className="w-12 max-w-[48px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none" />
                              {s.rep_range_low !== s.rep_range_high && (
                                <>
                                  <span className="text-[.82rem] text-gray-400">-</span>
                                  <input type="number" defaultValue={s.rep_range_high ?? ''} className="w-12 max-w-[48px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none" />
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-[3px] text-center">
                            <select defaultValue={s.target_rpe ?? 8} className="py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 bg-white cursor-pointer w-16 text-center focus:border-primary focus:outline-none">
                              {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button className="block w-full py-2 bg-transparent border-none text-primary font-semibold text-[.84rem] cursor-pointer mt-1 rounded-[var(--radius-xs)] hover:bg-primary-light">
                    + Agregar Serie
                  </button>
                </div>
              </div>
            ))}

            <button className="w-full py-3.5 border-2 border-dashed border-gray-200 rounded-[var(--radius-sm)] text-gray-400 font-semibold text-[.9rem] text-center cursor-pointer transition-all duration-200 hover:border-primary hover:text-primary bg-transparent">
              + Agregar Ejercicio
            </button>
          </div>
        )}
      </main>

      {/* Wizards */}
      <MacrocycleWizard
        open={macroWizardOpen}
        onClose={() => { setMacroWizardOpen(false); setEditingMacro(null); invalidateCache('plan:'); fetchData() }}
        existingMacro={editingMacro}
      />
      <PhaseWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); invalidateCache('plan:'); fetchData() }}
        mode={wizardMode}
        existingPhase={wizardMode === 'edit' ? (selectedPhase ?? activePhase) : undefined}
        macrocycleId={activeMacro?.id}
      />
      {routineWizardOpen && (
        <RoutineWizard
          phases={phases}
          defaultPhaseId={activePhase?.id ?? phases[0]?.id ?? null}
          onClose={() => { setRoutineWizardOpen(false); invalidateCache('plan:'); fetchData() }}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTINE WIZARD — modal for creating a new routine with exercises
   ═══════════════════════════════════════════════════════════════════════ */

type SelectedExercise = {
  exercise: Exercise
  sets: number
  repsLow: number
  repsHigh: number
  weight: number | null
}

function RoutineWizard({
  phases,
  defaultPhaseId,
  onClose,
}: {
  phases: Phase[]
  defaultPhaseId: string | null
  onClose: () => void
}) {
  const [step, setStep] = useState<'info' | 'exercises' | 'saving'>('info')
  const [name, setName] = useState('')
  const [phaseId, setPhaseId] = useState(defaultPhaseId ?? '')
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [loadingExercises, setLoadingExercises] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Fetch exercises from Supabase
  useEffect(() => {
    async function load() {
      setLoadingExercises(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true })
      if (data) setAllExercises(data)
      setLoadingExercises(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (step === 'exercises' && searchRef.current) searchRef.current.focus()
  }, [step])

  const filtered = search.trim().length > 0
    ? allExercises.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.equipment ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allExercises

  function addExercise(ex: Exercise) {
    if (selectedExercises.find((se) => se.exercise.id === ex.id)) return
    setSelectedExercises((prev) => [...prev, { exercise: ex, sets: 3, repsLow: 8, repsHigh: 12, weight: null }])
    setSearch('')
  }

  function removeExercise(id: string) {
    setSelectedExercises((prev) => prev.filter((se) => se.exercise.id !== id))
  }

  function updateExercise(id: string, field: keyof Omit<SelectedExercise, 'exercise'>, value: number | null) {
    setSelectedExercises((prev) =>
      prev.map((se) => (se.exercise.id === id ? { ...se, [field]: value } : se))
    )
  }

  async function save() {
    if (!name.trim()) { setError('Ingresa un nombre para la rutina'); return }
    if (!phaseId) { setError('Selecciona una fase'); return }
    if (selectedExercises.length === 0) { setError('Agrega al menos un ejercicio'); return }

    setSaving(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // 1. Create routine
      const { data: routine, error: routineErr } = await supabase
        .from('routines')
        .insert({ user_id: userId, phase_id: phaseId, name: name.trim(), display_order: 0 })
        .select()
        .single()

      if (routineErr || !routine) throw routineErr ?? new Error('No se pudo crear la rutina')

      // 2. Create routine_exercises
      for (let i = 0; i < selectedExercises.length; i++) {
        const se = selectedExercises[i]

        const { data: re, error: reErr } = await supabase
          .from('routine_exercises')
          .insert({
            routine_id: routine.id,
            exercise_id: se.exercise.id,
            display_order: i,
          })
          .select()
          .single()

        if (reErr || !re) throw reErr ?? new Error('Error al agregar ejercicio')

        // 3. Create routine_sets for this exercise
        const setsToInsert = Array.from({ length: se.sets }, (_, j) => ({
          routine_exercise_id: re.id,
          set_number: j + 1,
          rep_range_low: se.repsLow,
          rep_range_high: se.repsHigh,
          target_weight: se.weight,
        }))

        const { error: setsErr } = await supabase.from('routine_sets').insert(setsToInsert)
        if (setsErr) throw setsErr
      }

      onClose()
    } catch (err) {
      console.error('Error saving routine:', err)
      setError('Error al guardar la rutina. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-[var(--radius)] shadow-[0_8px_40px_rgba(0,0,0,.18)] w-full max-w-[560px] max-h-[90vh] overflow-y-auto mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-extrabold text-[1.15rem] text-gray-900">
            {step === 'info' ? 'Nueva Rutina' : 'Agregar Ejercicios'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer bg-transparent border-none text-[1.1rem]"
          >
            &times;
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 bg-danger-light text-danger rounded-[var(--radius-sm)] text-[.85rem] font-semibold">
              {error}
            </div>
          )}

          {/* Step 1: Name & Phase */}
          {step === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[.82rem] font-semibold text-gray-600 mb-1.5">Nombre de la rutina</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Full Body A, Tren Superior, Push..."
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] text-gray-800 bg-white focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[.82rem] font-semibold text-gray-600 mb-1.5">Fase</label>
                <select
                  value={phaseId}
                  onChange={(e) => setPhaseId(e.target.value)}
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] text-gray-800 bg-white cursor-pointer focus:border-primary focus:outline-none"
                >
                  <option value="">Seleccionar fase...</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status === 'active' ? '(Activa)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  if (!name.trim()) { setError('Ingresa un nombre para la rutina'); return }
                  if (!phaseId) { setError('Selecciona una fase'); return }
                  setError('')
                  setStep('exercises')
                }}
                className="w-full py-3 rounded-[var(--radius-sm)] font-bold text-[.92rem] bg-gradient-to-br from-primary to-accent text-white cursor-pointer border-none mt-2"
              >
                Siguiente: Agregar Ejercicios &rarr;
              </button>
            </div>
          )}

          {/* Step 2: Exercises */}
          {step === 'exercises' && (
            <div>
              {/* Search */}
              <div className="relative mb-4">
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar ejercicio..."
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] text-gray-800 bg-white focus:border-primary focus:outline-none"
                />
                {search.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-gray-200 rounded-[var(--radius-sm)] shadow-[var(--shadow-md)] max-h-[200px] overflow-y-auto">
                    {loadingExercises && (
                      <div className="p-3 text-gray-400 text-[.85rem]">Cargando ejercicios...</div>
                    )}
                    {!loadingExercises && filtered.length === 0 && (
                      <div className="p-3 text-gray-400 text-[.85rem]">No se encontraron ejercicios</div>
                    )}
                    {filtered.slice(0, 20).map((ex) => {
                      const already = selectedExercises.some((se) => se.exercise.id === ex.id)
                      return (
                        <button
                          key={ex.id}
                          onClick={() => addExercise(ex)}
                          disabled={already}
                          className={`w-full text-left px-3.5 py-2.5 border-none text-[.87rem] cursor-pointer transition-colors ${
                            already
                              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                              : 'bg-transparent text-gray-700 hover:bg-primary-light'
                          }`}
                        >
                          <div className="font-semibold">{ex.name}</div>
                          <div className="text-[.75rem] text-gray-400">{ex.category} {ex.equipment ? `· ${ex.equipment}` : ''}</div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Selected exercises */}
              {selectedExercises.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-[.87rem]">
                  Busca y agrega ejercicios a tu rutina
                </div>
              )}

              <div className="space-y-3 mb-4">
                {selectedExercises.map((se, idx) => (
                  <div key={se.exercise.id} className="bg-gray-50 rounded-[var(--radius-sm)] p-3.5">
                    <div className="flex justify-between items-center mb-2.5">
                      <div>
                        <span className="text-[.78rem] text-gray-400 font-bold mr-2">{idx + 1}.</span>
                        <span className="font-semibold text-[.9rem] text-gray-800">{se.exercise.name}</span>
                      </div>
                      <button
                        onClick={() => removeExercise(se.exercise.id)}
                        className="text-gray-300 hover:text-danger text-[.82rem] cursor-pointer bg-transparent border-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <div>
                        <label className="block text-[.72rem] font-semibold text-gray-400 mb-1">SERIES</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={se.sets}
                          onChange={(e) => updateExercise(se.exercise.id, 'sets', parseInt(e.target.value) || 1)}
                          className="w-14 py-1.5 px-2 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.85rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[.72rem] font-semibold text-gray-400 mb-1">REPS MIN</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={se.repsLow}
                          onChange={(e) => updateExercise(se.exercise.id, 'repsLow', parseInt(e.target.value) || 1)}
                          className="w-14 py-1.5 px-2 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.85rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[.72rem] font-semibold text-gray-400 mb-1">REPS MAX</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={se.repsHigh}
                          onChange={(e) => updateExercise(se.exercise.id, 'repsHigh', parseInt(e.target.value) || 1)}
                          className="w-14 py-1.5 px-2 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.85rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[.72rem] font-semibold text-gray-400 mb-1">KG</label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={se.weight ?? ''}
                          onChange={(e) => updateExercise(se.exercise.id, 'weight', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="—"
                          className="w-16 py-1.5 px-2 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.85rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep('info')}
                  className="flex-1 py-3 rounded-[var(--radius-sm)] font-semibold text-[.87rem] border-[1.5px] border-gray-200 text-gray-600 bg-card cursor-pointer"
                >
                  &larr; Atras
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-[2] py-3 rounded-[var(--radius-sm)] font-bold text-[.92rem] bg-gradient-to-br from-primary to-accent text-white cursor-pointer border-none disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : `Guardar Rutina (${selectedExercises.length} ejercicios)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
