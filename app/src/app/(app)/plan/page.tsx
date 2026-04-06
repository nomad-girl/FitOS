'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { PhaseWizard } from '@/components/shared/phase-wizard'
import { MacrocycleWizard } from '@/components/shared/macrocycle-wizard'
import { createClient } from '@/lib/supabase/client'
import { RightPanel } from '@/components/layout/right-panel'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import type { Phase, RoutineWithExercises } from '@/lib/supabase/types'

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

type HevyTemplate = {
  id: string
  title: string
  type: string
  primary_muscle_group: string
  secondary_muscle_groups: string[]
  equipment?: string
  is_custom: boolean
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
  const [addingExercise, setAddingExercise] = useState(false)

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

  async function activatePhase(phase: Phase) {
    if (!confirm(`Activar fase "${phase.name}"? La fase activa actual se pausara.`)) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

    // Pause current active phase
    await supabase
      .from('phases')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active')

    // Activate the selected phase
    const { error } = await supabase
      .from('phases')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', phase.id)

    if (error) { console.error('Error activating phase:', error); return }
    invalidateCache('plan:')
    fetchData()
  }

  async function finishPhase(phase: Phase) {
    if (!confirm(`Finalizar fase "${phase.name}"? Se marcara como completada.`)) return
    const supabase = createClient()
    const { error } = await supabase
      .from('phases')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', phase.id)

    if (error) { console.error('Error finishing phase:', error); return }
    invalidateCache('plan:')
    fetchData()
  }

  async function addExerciseToRoutine(tmpl: HevyTemplate) {
    if (!openRoutine) return
    setAddingExercise(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Upsert exercise into local exercises table
      let exerciseId: string
      const { data: existing } = await supabase
        .from('exercises')
        .select('id')
        .eq('name', tmpl.title)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (existing) {
        exerciseId = existing.id
      } else {
        const { data: newEx, error: exErr } = await supabase
          .from('exercises')
          .insert({
            user_id: userId,
            name: tmpl.title,
            exercise_type: tmpl.type === 'weight_reps' ? 'compound' : 'isolation',
            is_custom: tmpl.is_custom,
          })
          .select()
          .single()
        if (exErr || !newEx) throw exErr ?? new Error('Error creating exercise')
        exerciseId = newEx.id
      }

      // Create routine_exercise
      const nextOrder = (openRoutine.routine_exercises?.length ?? 0)
      const { data: re, error: reErr } = await supabase
        .from('routine_exercises')
        .insert({
          routine_id: openRoutine.id,
          exercise_id: exerciseId,
          display_order: nextOrder,
          rest_seconds: 90,
        })
        .select()
        .single()

      if (reErr || !re) throw reErr ?? new Error('Error adding exercise')

      // Create 3 default sets
      const setsToInsert = Array.from({ length: 3 }, (_, j) => ({
        routine_exercise_id: re.id,
        set_number: j + 1,
        rep_range_low: 8,
        rep_range_high: 12,
        target_weight: null,
        target_rpe: 8,
      }))
      await supabase.from('routine_sets').insert(setsToInsert)

      // Refresh routines
      invalidateCache('plan:routines')
      if (activePhase) {
        await fetchRoutines(supabase, activePhase.id)
      }
    } catch (err) {
      console.error('Error adding exercise to routine:', err)
    } finally {
      setAddingExercise(false)
    }
  }

  async function addSetToExercise(routineExerciseId: string) {
    try {
      const supabase = createClient()
      // Get current sets count
      const { data: existingSets } = await supabase
        .from('routine_sets')
        .select('set_number')
        .eq('routine_exercise_id', routineExerciseId)
        .order('set_number', { ascending: false })
        .limit(1)

      const nextSetNum = (existingSets?.[0]?.set_number ?? 0) + 1

      await supabase.from('routine_sets').insert({
        routine_exercise_id: routineExerciseId,
        set_number: nextSetNum,
        rep_range_low: 8,
        rep_range_high: 12,
        target_weight: null,
        target_rpe: 8,
      })

      // Refresh
      invalidateCache('plan:routines')
      if (activePhase) {
        await fetchRoutines(supabase, activePhase.id)
      }
    } catch (err) {
      console.error('Error adding set:', err)
    }
  }

  async function deleteExerciseFromRoutine(routineExerciseId: string) {
    if (!confirm('Eliminar este ejercicio de la rutina?')) return
    try {
      const supabase = createClient()
      // Delete sets first, then the routine_exercise
      await supabase.from('routine_sets').delete().eq('routine_exercise_id', routineExerciseId)
      await supabase.from('routine_exercises').delete().eq('id', routineExerciseId)
      invalidateCache('plan:routines')
      if (activePhase) {
        await fetchRoutines(supabase, activePhase.id)
      }
    } catch (err) {
      console.error('Error deleting exercise:', err)
    }
  }

  async function deleteSetFromExercise(setId: string) {
    try {
      const supabase = createClient()
      await supabase.from('routine_sets').delete().eq('id', setId)
      invalidateCache('plan:routines')
      if (activePhase) {
        await fetchRoutines(supabase, activePhase.id)
      }
    } catch (err) {
      console.error('Error deleting set:', err)
    }
  }

  async function updateSet(setId: string, field: string, value: number | null) {
    try {
      const supabase = createClient()
      await supabase.from('routine_sets').update({ [field]: value }).eq('id', setId)
      // Update local state without full refetch for snappy UX
      setRoutines((prev) =>
        prev.map((r) => ({
          ...r,
          routine_exercises: r.routine_exercises?.map((re) => ({
            ...re,
            routine_sets: re.routine_sets?.map((s) =>
              s.id === setId ? { ...s, [field]: value } : s
            ),
          })),
        })) as RoutineWithExercises[]
      )
    } catch (err) {
      console.error('Error updating set:', err)
    }
  }

  async function updateRestSeconds(routineExerciseId: string, restSeconds: number) {
    try {
      const supabase = createClient()
      await supabase.from('routine_exercises').update({ rest_seconds: restSeconds }).eq('id', routineExerciseId)
      setRoutines((prev) =>
        prev.map((r) => ({
          ...r,
          routine_exercises: r.routine_exercises?.map((re) =>
            re.id === routineExerciseId ? { ...re, rest_seconds: restSeconds } : re
          ),
        })) as RoutineWithExercises[]
      )
    } catch (err) {
      console.error('Error updating rest seconds:', err)
    }
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
                const progress = Math.round(((wk - 1) / phase.duration_weeks) * 100)
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
                        {phase.status === 'paused' && <Badge variant="yellow">Pausada</Badge>}
                        {phase.status === 'draft' && <Badge variant="gray">Borrador</Badge>}
                        {!phase.macrocycle_id && <Badge variant="yellow">Sin macrociclo</Badge>}
                        {/* Activate button for non-active phases */}
                        {!isActive && phase.status !== 'completed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); activatePhase(phase) }}
                            className="py-1 px-2.5 rounded-[var(--radius-xs)] text-[.75rem] font-semibold bg-primary-light text-primary border-none cursor-pointer hover:bg-primary hover:text-white transition-all duration-200"
                            title="Activar esta fase"
                          >
                            Activar
                          </button>
                        )}
                        {/* Finish button for active phase */}
                        {isActive && (
                          <button
                            onClick={(e) => { e.stopPropagation(); finishPhase(phase) }}
                            className="py-1 px-2.5 rounded-[var(--radius-xs)] text-[.75rem] font-semibold border-[1.5px] border-warning text-warning bg-transparent cursor-pointer hover:bg-warning-light transition-all duration-200"
                            title="Finalizar esta fase"
                          >
                            Finalizar
                          </button>
                        )}
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
                    <div className="mt-2">
                      {isActive && <ProgressBar value={Math.min(progress, 100)} variant="blue" height="4px" />}
                      {(phase.start_date || phase.end_date) && (
                        <div className="flex justify-between mt-2 text-[.75rem] text-gray-400">
                          {phase.start_date && <span>Inicio: {new Date(phase.start_date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                          {phase.end_date && <span>Fin: {new Date(phase.end_date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        </div>
                      )}
                    </div>
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
              const progress = Math.round(((wk - 1) / phase.duration_weeks) * 100)

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
                              {exerciseIcons[re.exercise?.exercise_type ?? ''] ?? '\uD83C\uDFCB\uFE0F'}
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
            {/* Breadcrumb + saved status */}
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
              <button
                onClick={() => setSelectedRoutine(null)}
                className="text-gray-500 font-semibold text-[.9rem] cursor-pointer hover:text-primary transition-colors bg-transparent border-none py-1.5 px-3 -ml-2"
              >
                &larr; Volver
              </button>
              <span className="text-gray-300 text-[.8rem]">/</span>
              <span className="text-gray-500 text-[.84rem]">{activePhase?.name ?? 'Fase'}</span>
              <span className="text-gray-300 text-[.8rem]">/</span>
              <span className="text-gray-700 font-semibold text-[.84rem]">{openRoutine.name}</span>
              <span className="ml-auto text-[.77rem] text-success font-medium">{'\u2714'} Guardado</span>
            </div>

            {/* Session switcher pills */}
            <div className="flex gap-1.5 mb-5 flex-wrap">
              {routines.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoutine(r.id)}
                  className={`py-[7px] px-4 rounded-full border-[1.5px] text-[.84rem] font-semibold cursor-pointer transition-all duration-200 ${
                    r.id === selectedRoutine
                      ? 'bg-primary border-primary text-white'
                      : 'border-gray-200 text-gray-500 bg-card hover:border-primary hover:text-primary'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>

            {/* Editable Routine Title */}
            <input
              type="text"
              defaultValue={openRoutine.name}
              onBlur={async (e) => {
                const newName = e.target.value.trim()
                if (newName && newName !== openRoutine.name) {
                  const supabase = createClient()
                  await supabase.from('routines').update({ name: newName }).eq('id', openRoutine.id)
                  invalidateCache('plan:routines')
                  if (activePhase) await fetchRoutines(supabase, activePhase.id)
                }
              }}
              className="text-[1.4rem] font-extrabold text-gray-900 border-none py-2 bg-transparent tracking-tight w-full mb-2 focus:border-b-2 focus:border-b-primary focus:outline-none"
            />

            <div className="flex gap-2 mb-5">
              <span className="inline-flex items-center py-1 px-3 rounded-full bg-gray-100 text-[.77rem] font-semibold text-gray-500">
                Ejercicios: {openRoutine.routine_exercises?.length ?? 0}
              </span>
              <span className="inline-flex items-center py-1 px-3 rounded-full bg-gray-100 text-[.77rem] font-semibold text-gray-500">
                Series: {openRoutine.routine_exercises?.reduce((a, re) => a + (re.routine_sets?.length ?? 0), 0) ?? 0}
              </span>
              {openRoutine.estimated_duration_min && (
                <span className="inline-flex items-center py-1 px-3 rounded-full bg-gray-100 text-[.77rem] font-semibold text-gray-500">
                  ~{openRoutine.estimated_duration_min} min
                </span>
              )}
            </div>

            {/* RPE toggle */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-11 h-6 rounded-full bg-primary relative cursor-pointer">
                <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 right-0.5 shadow-[var(--shadow)]" />
              </div>
              <span className="text-[.87rem] font-semibold text-gray-700">RPE Objetivo</span>
              <span className="text-[.82rem] text-gray-400 cursor-help" title="Escala de Esfuerzo Percibido">{'\u24D8'}</span>
            </div>

            {/* Exercise Blocks */}
            {openRoutine.routine_exercises?.map((re) => (
              <div key={re.id} className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] mb-3.5 overflow-hidden">
                <div className="flex items-center gap-3 p-[18px_20px_12px]">
                  <div className="w-11 h-11 rounded-[10px] bg-gray-50 flex items-center justify-center text-[1.2rem] shrink-0">
                    {exerciseIcons[re.exercise?.exercise_type ?? ''] ?? '\uD83C\uDFCB\uFE0F'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[.97rem] text-gray-800">{re.exercise?.name ?? 'Ejercicio'}</div>
                    <div className="text-[.77rem] text-gray-400 mt-px">{re.exercise?.exercise_type ?? ''}</div>
                  </div>
                  <span className="cursor-grab text-gray-300 text-[.9rem] mr-0.5" title="Arrastra para reordenar">{'\u2630'}</span>
                  <button
                    onClick={() => deleteExerciseFromRoutine(re.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer bg-transparent border-none text-[1.2rem]"
                    title="Eliminar ejercicio"
                  >
                    {'\u22EE'}
                  </button>
                </div>

                <div className="px-5 pb-4">
                  {/* Note per exercise */}
                  <textarea
                    placeholder="Agregar nota fija"
                    defaultValue={re.notes ?? ''}
                    onBlur={async (e) => {
                      const supabase = createClient()
                      await supabase.from('routine_exercises').update({ notes: e.target.value || null }).eq('id', re.id)
                    }}
                    className="w-full py-2 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.82rem] text-gray-600 mb-2.5 resize-none h-[34px] focus:outline-none focus:border-primary placeholder:text-gray-300"
                  />

                  {/* Rest timer */}
                  <div className="flex items-center gap-2 mb-3 text-[.82rem] text-gray-500">
                    <span>Descanso:</span>
                    <select
                      value={re.rest_seconds ?? 90}
                      onChange={(e) => updateRestSeconds(re.id, parseInt(e.target.value))}
                      className="py-1.5 px-2.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.84rem] font-semibold text-gray-700 bg-white cursor-pointer focus:border-primary focus:outline-none"
                    >
                      <option value={60}>01:00</option>
                      <option value={90}>01:30</option>
                      <option value={120}>02:00</option>
                      <option value={150}>02:30</option>
                      <option value={180}>03:00</option>
                    </select>
                  </div>

                  {/* Set table */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-[.7rem] font-bold uppercase tracking-[.5px] text-gray-400 text-left pb-2 w-10">SERIE</th>
                        <th className="text-[.7rem] font-bold uppercase tracking-[.5px] text-gray-400 text-center pb-2">KG</th>
                        <th className="text-[.7rem] font-bold uppercase tracking-[.5px] text-gray-400 text-center pb-2">RANGO REPS</th>
                        <th className="text-[.7rem] font-bold uppercase tracking-[.5px] text-gray-400 text-center pb-2">RPE OBJETIVO</th>
                        <th className="w-6"></th>
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
                              type="text"
                              defaultValue={s.target_weight ?? ''}
                              placeholder="--"
                              onBlur={(e) => updateSet(s.id, 'target_weight', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-16 max-w-[64px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-[3px] text-center">
                            <div className="flex items-center gap-[3px] justify-center">
                              <input
                                type="number"
                                defaultValue={s.rep_range_low ?? ''}
                                onBlur={(e) => updateSet(s.id, 'rep_range_low', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-12 max-w-[48px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                              />
                              <span className="text-[.82rem] text-gray-400">-</span>
                              <input
                                type="number"
                                defaultValue={s.rep_range_high ?? ''}
                                onBlur={(e) => updateSet(s.id, 'rep_range_high', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-12 max-w-[48px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="py-[3px] text-center">
                            <select
                              value={s.target_rpe ?? 8}
                              onChange={(e) => updateSet(s.id, 'target_rpe', parseFloat(e.target.value))}
                              className="py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 bg-white cursor-pointer w-16 text-center focus:border-primary focus:outline-none"
                            >
                              {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-[3px]">
                            <button
                              onClick={() => deleteSetFromExercise(s.id)}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 cursor-pointer bg-transparent border-none text-[.75rem]"
                              title="Eliminar serie"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button
                    onClick={() => addSetToExercise(re.id)}
                    className="block w-full py-2 bg-transparent border-none text-primary font-semibold text-[.84rem] cursor-pointer mt-1 rounded-[var(--radius-xs)] hover:bg-primary-light"
                  >
                    + Agregar serie
                  </button>
                </div>
              </div>
            ))}

            {/* Add exercise hint */}
            <button
              onClick={() => {/* Exercise library is in the right panel */}}
              className="w-full py-3.5 border-2 border-dashed border-gray-200 rounded-[var(--radius-sm)] text-gray-400 font-semibold text-[.9rem] text-center cursor-default transition-all duration-200 bg-transparent"
            >
              {addingExercise ? 'Agregando...' : '+ Agregar Ejercicio (usa el panel derecho →)'}
            </button>
            <div className="h-10" />
          </div>
        )}
      </main>

      {/* Right Panel: only on Rutinas tab */}
      {activeTab === 'routines' && (
        <RightPanel>
          {selectedRoutine && openRoutine ? (
            /* Exercise Library when editing a routine (like Hevy Coach) */
            <ExerciseLibraryPanel
              onAddExercise={addExerciseToRoutine}
            />
          ) : (
            /* Volume Summary when viewing routine list */
            <VolumeSummaryPanel routines={routines} />
          )}
        </RightPanel>
      )}

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
          onCreated={(routineId) => {
            // Open the newly created routine in session editor
            setActiveTab('routines')
            setSelectedRoutine(routineId)
            invalidateCache('plan:')
            fetchData()
          }}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   VOLUME SUMMARY PANEL — shows series per muscle group + movement patterns
   ═══════════════════════════════════════════════════════════════════════ */

function VolumeSummaryPanel({ routines }: { routines: RoutineWithExercises[] }) {
  const [statsTab, setStatsTab] = useState<'muscles' | 'patterns'>('muscles')

  // Calculate total exercises and sets
  const totalExercises = routines.reduce((a, r) => a + (r.routine_exercises?.length ?? 0), 0)
  const totalSets = routines.reduce((a, r) =>
    a + (r.routine_exercises?.reduce((b, re) => b + (re.routine_sets?.length ?? 0), 0) ?? 0), 0)

  // Calculate sets per muscle group (using exercise name heuristics since we don't have full muscle data)
  const muscleVolume: Record<string, number> = {}
  const patternVolume: Record<string, number> = {}
  for (const r of routines) {
    for (const re of r.routine_exercises ?? []) {
      const sets = re.routine_sets?.length ?? 0
      const name = (re.exercise?.name ?? '').toLowerCase()
      const type = re.exercise?.exercise_type ?? ''

      // Pattern detection
      if (/squat|lunge|leg press|split squat/i.test(name)) patternVolume['Squat'] = (patternVolume['Squat'] ?? 0) + sets
      else if (/deadlift|hip thrust|rdl|good morning|kickback/i.test(name)) patternVolume['Hinge'] = (patternVolume['Hinge'] ?? 0) + sets
      else if (/bench|push.?up|fly|press.*chest/i.test(name)) patternVolume['H. Push'] = (patternVolume['H. Push'] ?? 0) + sets
      else if (/row|pull.*down|pulldown|pull.?up|lat /i.test(name)) patternVolume['H. Pull'] = (patternVolume['H. Pull'] ?? 0) + sets
      else if (/overhead|shoulder|oh press|lateral raise/i.test(name)) patternVolume['V. Push'] = (patternVolume['V. Push'] ?? 0) + sets
      else if (/chin.?up|face pull/i.test(name)) patternVolume['V. Pull'] = (patternVolume['V. Pull'] ?? 0) + sets
      else patternVolume['Isolation'] = (patternVolume['Isolation'] ?? 0) + sets

      // Muscle group detection (heuristic)
      if (/glut|hip thrust|kickback|abduct/i.test(name)) muscleVolume['Gluteos'] = (muscleVolume['Gluteos'] ?? 0) + sets
      if (/quad|squat|lunge|leg press|leg ext/i.test(name)) muscleVolume['Cuadriceps'] = (muscleVolume['Cuadriceps'] ?? 0) + sets
      if (/hamstring|curl.*leg|rdl|deadlift|leg curl/i.test(name)) muscleVolume['Femorales'] = (muscleVolume['Femorales'] ?? 0) + sets
      if (/lat |row|pull.*down|pulldown|pull.?up|back ext/i.test(name)) muscleVolume['Espalda'] = (muscleVolume['Espalda'] ?? 0) + sets
      if (/bench|fly|push.?up|chest/i.test(name)) muscleVolume['Pecho'] = (muscleVolume['Pecho'] ?? 0) + sets
      if (/shoulder|lateral|oh press|face pull|delt/i.test(name)) muscleVolume['Hombros'] = (muscleVolume['Hombros'] ?? 0) + sets
      if (/bicep|curl.*bicep|hammer/i.test(name)) muscleVolume['Biceps'] = (muscleVolume['Biceps'] ?? 0) + sets
      if (/tricep|pushdown|skull|dip/i.test(name)) muscleVolume['Triceps'] = (muscleVolume['Triceps'] ?? 0) + sets
      if (/plank|ab |crunch|core|woodchop/i.test(name)) muscleVolume['Core'] = (muscleVolume['Core'] ?? 0) + sets
      if (/calf|calves|raise.*calf/i.test(name)) muscleVolume['Pantorrillas'] = (muscleVolume['Pantorrillas'] ?? 0) + sets

      // If nothing matched, try exercise_type
      if (Object.keys(muscleVolume).length === 0 && type === 'compound') {
        muscleVolume['Otro'] = (muscleVolume['Otro'] ?? 0) + sets
      }
    }
  }

  // Target volumes per muscle (MEV-MAV range)
  const muscleTargets: Record<string, number> = {
    Gluteos: 14, Cuadriceps: 12, Femorales: 10, Espalda: 14, Pecho: 8,
    Hombros: 8, Biceps: 6, Triceps: 6, Core: 6, Pantorrillas: 4,
  }

  const maxPattern = Math.max(...Object.values(patternVolume), 1)

  return (
    <>
      <div className="font-bold text-base text-gray-800 mb-[18px]">Resumen</div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-card rounded-[var(--radius)] p-[14px] shadow-[var(--shadow)] text-center">
          <div className="text-[.77rem] text-gray-400">Ejercicios</div>
          <div className="text-[1.3rem] font-extrabold text-gray-900">{totalExercises}</div>
        </div>
        <div className="bg-card rounded-[var(--radius)] p-[14px] shadow-[var(--shadow)] text-center">
          <div className="text-[.77rem] text-gray-400">Series Totales</div>
          <div className="text-[1.3rem] font-extrabold text-gray-900">{totalSets}</div>
        </div>
      </div>

      {/* Tabs: Muscles / Patterns */}
      <div className="inline-flex gap-1 bg-gray-100 rounded-[var(--radius-sm)] p-[3px] mb-4 w-full">
        <button
          onClick={() => setStatsTab('muscles')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-[.82rem] cursor-pointer border-none transition-all duration-200 ${
            statsTab === 'muscles' ? 'bg-card text-gray-800 shadow-[var(--shadow)]' : 'text-gray-500 bg-transparent'
          }`}
        >
          Musculos
        </button>
        <button
          onClick={() => setStatsTab('patterns')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-[.82rem] cursor-pointer border-none transition-all duration-200 ${
            statsTab === 'patterns' ? 'bg-card text-gray-800 shadow-[var(--shadow)]' : 'text-gray-500 bg-transparent'
          }`}
        >
          Patrones
        </button>
      </div>

      {statsTab === 'muscles' && (
        <div>
          <table className="w-full text-[.84rem]">
            <tbody>
              {Object.entries(muscleTargets).map(([muscle, target]) => {
                const actual = muscleVolume[muscle] ?? 0
                const ratio = target > 0 ? actual / target : 0
                const dotColor = actual === 0 ? 'bg-gray-300' : ratio >= 0.85 ? 'bg-success' : ratio >= 0.6 ? 'bg-warning' : 'bg-danger'
                const textColor = actual === 0 ? '' : ratio >= 0.85 ? '' : ratio >= 0.6 ? 'text-warning' : 'text-danger'

                return (
                  <tr key={muscle} className="border-b border-gray-50 last:border-b-0">
                    <td className="py-1.5 w-3"><span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} /></td>
                    <td className="py-1.5 font-medium text-gray-700">{muscle}</td>
                    <td className={`py-1.5 text-right font-bold ${textColor}`}>{actual} / {target}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Warnings */}
          {Object.entries(muscleTargets).map(([muscle, target]) => {
            const actual = muscleVolume[muscle] ?? 0
            const diff = target - actual
            if (diff > 3 && actual > 0) return (
              <div key={muscle} className="mt-2 p-2.5 bg-warning-light rounded-[var(--radius-xs)] text-[.78rem] text-gray-700 font-semibold">
                {'\u26A0\uFE0F'} {muscle}: {diff} series debajo del objetivo
              </div>
            )
            if (diff > 3 && actual === 0) return null
            return null
          })}
        </div>
      )}

      {statsTab === 'patterns' && (
        <div className="flex flex-col gap-2.5">
          {Object.entries(patternVolume).sort((a, b) => b[1] - a[1]).map(([pattern, count]) => (
            <div key={pattern}>
              <div className="flex justify-between text-[.82rem] mb-1">
                <span className="font-semibold text-gray-600">{pattern}</span>
                <span className="font-bold text-gray-800">{count}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(count / maxPattern) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {Object.keys(patternVolume).length === 0 && (
            <div className="text-[.82rem] text-gray-400 text-center py-4">Sin ejercicios para analizar</div>
          )}
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   EXERCISE LIBRARY PANEL — sidebar for adding exercises to a routine
   ═══════════════════════════════════════════════════════════════════════ */

function ExerciseLibraryPanel({ onAddExercise }: { onAddExercise: (tmpl: HevyTemplate) => void }) {
  const [templates, setTemplates] = useState<HevyTemplate[]>([])
  const [search, setSearch] = useState('')
  const [filterEquip, setFilterEquip] = useState('')
  const [filterMuscle, setFilterMuscle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/hevy/exercises?all=true')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.exercise_templates ?? [])
        }
      } catch (err) {
        console.error('Error loading exercises:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = templates.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterEquip && t.equipment !== filterEquip) return false
    if (filterMuscle && t.primary_muscle_group !== filterMuscle && !t.secondary_muscle_groups?.includes(filterMuscle)) return false
    return true
  })

  const availableEquipment = [...new Set(templates.map((t) => t.equipment).filter(Boolean))] as string[]
  const availableMuscles = [...new Set(templates.map((t) => t.primary_muscle_group))].sort()

  return (
    <>
      <div className="font-bold text-base text-gray-800 mb-3">Libreria de Ejercicios</div>

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        <select
          value={filterEquip}
          onChange={(e) => setFilterEquip(e.target.value)}
          className="flex-1 py-2 px-2.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.8rem] text-gray-600 bg-white focus:border-primary focus:outline-none"
        >
          <option value="">Equipamiento</option>
          {availableEquipment.map((eq) => (
            <option key={eq} value={eq}>{eq}</option>
          ))}
        </select>
        <select
          value={filterMuscle}
          onChange={(e) => setFilterMuscle(e.target.value)}
          className="flex-1 py-2 px-2.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.8rem] text-gray-600 bg-white focus:border-primary focus:outline-none"
        >
          <option value="">Musculos</option>
          {availableMuscles.map((m) => (
            <option key={m} value={m}>{muscleGroupLabel[m] ?? m}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[.85rem]">{'\uD83D\uDD0D'}</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ejercicios..."
          className="w-full py-2 pl-9 pr-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.84rem] focus:border-primary focus:outline-none"
        />
      </div>

      {/* Exercise list */}
      <div className="text-[.72rem] font-bold uppercase tracking-wider text-gray-400 mb-2">
        {loading ? 'Cargando...' : `${filtered.length} ejercicios`}
      </div>
      <div className="flex flex-col gap-0.5 max-h-[calc(100vh-320px)] overflow-y-auto">
        {filtered.slice(0, 50).map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => onAddExercise(tmpl)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-xs)] text-left cursor-pointer border-none bg-transparent hover:bg-primary-light transition-colors group"
          >
            <span className="w-6 h-6 rounded-full bg-primary-light text-primary flex items-center justify-center text-[.75rem] font-bold shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">+</span>
            <span className="text-[.9rem] shrink-0">{muscleGroupIcon[tmpl.primary_muscle_group] ?? '\uD83C\uDFCB\uFE0F'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[.82rem] font-semibold text-gray-700 truncate">{tmpl.title}</div>
              <div className="text-[.7rem] text-gray-400">{muscleGroupLabel[tmpl.primary_muscle_group] ?? tmpl.primary_muscle_group}</div>
            </div>
          </button>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-[.82rem]">No se encontraron ejercicios</div>
        )}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTINE WIZARD — modal for creating a new routine with exercises
   Uses Hevy exercise templates for the exercise library
   ═══════════════════════════════════════════════════════════════════════ */

const muscleGroupLabel: Record<string, string> = {
  glutes: 'Gluteos', hamstrings: 'Femorales', quadriceps: 'Cuadriceps', shoulders: 'Hombros',
  triceps: 'Triceps', abdominals: 'Abdominales', lats: 'Dorsales', biceps: 'Biceps',
  upper_back: 'Espalda Alta', chest: 'Pecho', adductors: 'Aductores', abductors: 'Abductores',
  forearms: 'Antebrazos', lower_back: 'Lumbar', calves: 'Pantorrillas', traps: 'Trapecios',
  cardio: 'Cardio', other: 'Otro', full_body: 'Cuerpo Completo', core: 'Core', neck: 'Cuello',
}

const muscleGroupIcon: Record<string, string> = {
  glutes: '\uD83C\uDF51', hamstrings: '\uD83E\uDDB5', quadriceps: '\uD83E\uDDB5', shoulders: '\uD83D\uDCAA',
  triceps: '\uD83D\uDCAA', abdominals: '\uD83E\uDDD8', lats: '\uD83D\uDCAA', biceps: '\uD83D\uDCAA',
  upper_back: '\uD83D\uDCAA', chest: '\uD83C\uDFCB\uFE0F', calves: '\uD83E\uDDB5', traps: '\uD83D\uDCAA',
  core: '\uD83E\uDDD8',
}

function RoutineWizard({
  phases,
  defaultPhaseId,
  onClose,
  onCreated,
}: {
  phases: Phase[]
  defaultPhaseId: string | null
  onClose: () => void
  onCreated?: (routineId: string) => void
}) {
  const [name, setName] = useState('')
  const [phaseId, setPhaseId] = useState(defaultPhaseId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) { setError('Ingresa un nombre para la rutina'); return }
    if (!phaseId) { setError('Selecciona una fase'); return }

    setSaving(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const { data: routine, error: routineErr } = await supabase
        .from('routines')
        .insert({ user_id: userId, phase_id: phaseId, name: name.trim(), display_order: 0 })
        .select()
        .single()

      if (routineErr || !routine) throw routineErr ?? new Error('No se pudo crear la rutina')

      // Open the routine in the session editor so user can add exercises via right panel
      if (onCreated) onCreated(routine.id)
      onClose()
    } catch (err) {
      console.error('Error saving routine:', err)
      setError('Error al guardar la rutina.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-[var(--radius)] shadow-[0_8px_40px_rgba(0,0,0,.18)] w-full max-w-[420px] mx-4"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-extrabold text-[1.15rem] text-gray-900">Nueva Rutina</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer bg-transparent border-none text-[1.1rem]">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-danger-light text-danger rounded-[var(--radius-sm)] text-[.85rem] font-semibold">{error}</div>
          )}
          <div>
            <label className="block text-[.82rem] font-semibold text-gray-600 mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Dia A: Fuerza, Tren Superior..."
              className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] text-gray-800 bg-white focus:border-primary focus:outline-none"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') save() }}
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
                <option key={p.id} value={p.id}>{p.name} {p.status === 'active' ? '(Activa)' : ''}</option>
              ))}
            </select>
          </div>
          <p className="text-[.78rem] text-gray-400">Despues de crear la rutina, agrega ejercicios desde la libreria en el panel derecho.</p>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3 rounded-[var(--radius-sm)] font-bold text-[.92rem] bg-gradient-to-br from-primary to-accent text-white cursor-pointer border-none disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear Rutina'}
          </button>
        </div>
      </div>
    </div>
  )
}
