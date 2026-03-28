'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { PhaseWizard } from '@/components/shared/phase-wizard'
import { createClient } from '@/lib/supabase/client'
import type { Phase, RoutineWithExercises } from '@/lib/supabase/types'

type PlanTab = 'routines' | 'phase' | 'macro'

// Hardcoded fallbacks for demo UI when DB data shapes don't have all display fields
const exerciseIcons: Record<string, string> = {
  compound: '\uD83C\uDFCB\uFE0F',
  isolation: '\uD83D\uDCAA',
  core: '\uD83E\uDDD8',
}

const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export default function PlanPage() {
  const [activeTab, setActiveTab] = useState<PlanTab>('routines')
  const [selectedRoutine, setSelectedRoutine] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create')

  // Data state
  const [phases, setPhases] = useState<Phase[]>([])
  const [activePhase, setActivePhase] = useState<Phase | null>(null)
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Fetch all phases
      const { data: phasesData } = await supabase
        .from('phases')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true })

      if (phasesData) {
        setPhases(phasesData)
        const active = phasesData.find((p) => p.status === 'active') ?? null
        setActivePhase(active)

        // Fetch routines for active phase
        if (active) {
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
            .eq('phase_id', active.id)
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
          }
        }
      }
    } catch (err) {
      console.error('Error fetching plan data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openRoutine = selectedRoutine ? routines.find((r) => r.id === selectedRoutine) : null

  function openWizard(mode: 'create' | 'edit') {
    setWizardMode(mode)
    setWizardOpen(true)
  }

  // Computed values
  const completedPhases = phases.filter((p) => p.status === 'completed')
  const plannedPhases = phases.filter((p) => p.status === 'planned')

  let weekNumber = 1
  let totalWeeks = activePhase?.duration_weeks ?? 6
  if (activePhase?.start_date) {
    const startDate = new Date(activePhase.start_date)
    const now = new Date()
    weekNumber = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)))
  }
  const phaseProgress = Math.round((weekNumber / totalWeeks) * 100)

  const goalLabel: Record<string, string> = {
    build: 'Build / Volumen',
    cut: 'Cut / Define',
    maintain: 'Mantenimiento',
    strength: 'Fuerza',
  }

  const borderColors = ['border-l-primary', 'border-l-accent', 'border-l-success', 'border-l-warning']

  if (loading) {
    return (
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        <div className="text-gray-400 text-[.9rem]">Cargando plan...</div>
      </main>
    )
  }

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {/* Sub-tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="inline-flex gap-1 bg-gray-100 rounded-[var(--radius-sm)] p-[3px]">
            {[
              { id: 'routines' as const, label: 'Rutinas' },
              { id: 'phase' as const, label: 'Fase Actual' },
              { id: 'macro' as const, label: 'Macrociclo' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedRoutine(null) }}
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

        {/* ROUTINES VIEW */}
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
                    onClick={() => openWizard('edit')}
                    className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-gray-200 text-gray-600 bg-card transition-all duration-200 hover:border-primary hover:text-primary cursor-pointer"
                  >
                    {'\u270F\uFE0F'} Editar
                  </button>
                </div>
              </div>
            )}

            {/* Routines Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-[1.08rem] font-bold text-gray-800">Rutinas ({routines.length})</div>
              <button className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px cursor-pointer border-none">
                + Agregar Rutina
              </button>
            </div>

            {routines.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                No hay rutinas todavia. Crea una fase activa y agrega rutinas.
              </div>
            )}

            {/* Routine Cards */}
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

            {/* Exercise Blocks */}
            {openRoutine.routine_exercises?.map((re) => (
              <div key={re.id} className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] mb-3.5 overflow-hidden">
                {/* Exercise Header */}
                <div className="flex items-center gap-3 p-[18px_20px_12px]">
                  <div className="w-11 h-11 rounded-[10px] bg-gray-50 flex items-center justify-center text-[1.2rem] shrink-0">
                    {exerciseIcons[re.exercise?.category ?? ''] ?? '\uD83C\uDFCB\uFE0F'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[.97rem] text-gray-800">{re.exercise?.name ?? 'Ejercicio'}</div>
                    <div className="text-[.77rem] text-gray-400 mt-px">{re.exercise?.equipment ?? ''}</div>
                  </div>
                  <button className="w-8 h-8 rounded-full bg-transparent border-none cursor-pointer text-gray-400 text-[1.2rem] flex items-center justify-center hover:bg-gray-100 hover:text-gray-600">
                    &middot;&middot;&middot;
                  </button>
                </div>

                {/* Set Table */}
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
                        <th className="w-7 pb-2"></th>
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
                              className="w-16 max-w-[64px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none focus:shadow-[0_0_0_2px_rgba(14,165,233,.12)]"
                            />
                          </td>
                          <td className="py-[3px] text-center">
                            <div className="flex items-center gap-[3px] justify-center">
                              <input
                                type="number"
                                defaultValue={s.rep_range_low ?? ''}
                                className="w-12 max-w-[48px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none focus:shadow-[0_0_0_2px_rgba(14,165,233,.12)]"
                              />
                              {s.rep_range_low !== s.rep_range_high && (
                                <>
                                  <span className="text-[.82rem] text-gray-400">-</span>
                                  <input
                                    type="number"
                                    defaultValue={s.rep_range_high ?? ''}
                                    className="w-12 max-w-[48px] py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 text-center bg-white focus:border-primary focus:outline-none focus:shadow-[0_0_0_2px_rgba(14,165,233,.12)]"
                                  />
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-[3px] text-center">
                            <select
                              defaultValue={s.target_rpe ?? 8}
                              className="py-[7px] px-1.5 border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] text-[.87rem] font-semibold text-gray-700 bg-white cursor-pointer w-16 text-center focus:border-primary focus:outline-none"
                            >
                              {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-[3px] text-center">
                            <button className="w-7 h-7 rounded-full bg-transparent border-none cursor-pointer text-gray-300 text-[.9rem] flex items-center justify-center hover:bg-danger-light hover:text-danger">
                              &times;
                            </button>
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

            {/* Add Exercise Button */}
            <button className="w-full py-3.5 border-2 border-dashed border-gray-200 rounded-[var(--radius-sm)] text-gray-400 font-semibold text-[.9rem] text-center cursor-pointer transition-all duration-200 hover:border-primary hover:text-primary bg-transparent">
              + Agregar Ejercicio
            </button>
          </div>
        )}

        {/* PHASE VIEW */}
        {activeTab === 'phase' && (
          <div className="fade-in">
            {activePhase ? (
              <>
                {/* Active Phase Card */}
                <div className="bg-gradient-to-br from-primary-light to-[#E0F7FA] border-2 border-primary rounded-[var(--radius)] p-[26px_28px] mb-[18px] relative">
                  <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <Badge variant="blue" className="text-[.8rem] py-1 px-3.5">Fase Activa</Badge>
                      </div>
                      <div className="font-extrabold text-[1.3rem] text-gray-900 mb-1">{activePhase.name}</div>
                      <div className="flex gap-2 flex-wrap mb-3">
                        <Badge variant="yellow">{goalLabel[activePhase.goal] ?? activePhase.goal}</Badge>
                        <Badge variant="gray">{activePhase.frequency}x/semana</Badge>
                        {activePhase.focus_muscles?.length > 0 && (
                          <Badge variant="gray">{activePhase.focus_muscles.join(', ')}</Badge>
                        )}
                        {activePhase.calorie_target && activePhase.protein_target && (
                          <Badge variant="gray">{activePhase.calorie_target} kcal / {activePhase.protein_target}g P</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openWizard('edit')}
                        className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-gray-200 text-gray-600 bg-card cursor-pointer"
                      >
                        {'\u270F\uFE0F'} Editar
                      </button>
                      <button className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] border-[1.5px] border-danger text-danger bg-transparent cursor-pointer hover:bg-danger-light">
                        Finalizar Fase
                      </button>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex justify-between text-[.84rem] text-gray-600 mb-1.5">
                      <span>Semana {weekNumber} de {totalWeeks}</span>
                      <span className="font-bold">{phaseProgress}% completo</span>
                    </div>
                    <ProgressBar value={phaseProgress} variant="blue" height="8px" />
                    {activePhase.start_date && (
                      <div className="flex justify-between mt-2 text-[.78rem] text-gray-500">
                        <span>Inicio: {new Date(activePhase.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {activePhase.end_date && (
                          <span>Fin: {new Date(activePhase.end_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {activePhase.objective && (
                    <div className="mt-5 pt-4 border-t border-primary/20">
                      <div className="font-bold text-[.9rem] text-gray-800 mb-2.5">Objetivo</div>
                      <div className="text-[.84rem] text-gray-600">{activePhase.objective}</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <div className="text-[1.5rem] mb-2">{'\uD83D\uDCCB'}</div>
                No hay fase activa. Crea una nueva fase para empezar.
              </div>
            )}

            {/* Past Phases */}
            <div className="flex justify-between items-center mt-6 mb-4">
              <div className="text-[1.08rem] font-bold text-gray-800">Fases Anteriores</div>
              <button
                onClick={() => openWizard('create')}
                className="inline-flex items-center justify-center gap-2 py-[7px] px-3.5 rounded-[var(--radius-sm)] font-semibold text-[.82rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none"
              >
                + Nueva Fase
              </button>
            </div>

            {completedPhases.length === 0 && (
              <div className="text-[.84rem] text-gray-400">No hay fases completadas todavia.</div>
            )}

            {completedPhases.map((phase, i) => (
              <div
                key={phase.id}
                className="bg-card border-[1.5px] border-gray-200 rounded-[var(--radius)] p-[20px_24px] mb-3 transition-all duration-200 hover:shadow-[var(--shadow-md)] cursor-pointer"
                style={{ opacity: i > 0 ? 0.85 : 1 }}
              >
                <div className="flex justify-between items-center mb-2.5">
                  <div>
                    <div className="font-bold text-[1.02rem] text-gray-800">{phase.name}</div>
                    <div className="text-[.77rem] text-gray-400 mt-1">
                      {goalLabel[phase.goal] ?? phase.goal} &middot; {phase.duration_weeks} semanas
                      {phase.start_date && <> &middot; {new Date(phase.start_date).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}</>}
                    </div>
                  </div>
                  <Badge variant="green">Completada</Badge>
                </div>
                {phase.outcome_notes && (
                  <div className="text-[.82rem] text-gray-500 italic">{phase.outcome_notes}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MACROCYCLE VIEW */}
        {activeTab === 'macro' && (
          <div className="fade-in">
            <div className="mb-7">
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Macrociclo 2026</h1>
                  <p className="text-gray-500 text-[.9rem] mt-1">Plan anual — vista general de fases</p>
                </div>
              </div>
            </div>

            {/* Phase List */}
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Fases del Macrociclo</div>
            <div className="flex flex-col gap-3">
              {phases.map((phase) => (
                <div
                  key={phase.id}
                  onClick={() => { if (phase.status === 'active') setActiveTab('phase') }}
                  className={`bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] cursor-pointer transition-all duration-200 hover:shadow-[var(--shadow-md)] border-l-4 ${
                    phase.status === 'completed'
                      ? 'border-l-success opacity-70 hover:opacity-100'
                      : phase.status === 'active'
                      ? 'border-l-primary'
                      : 'border-l-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className={`font-semibold ${phase.status === 'planned' ? 'text-gray-500' : ''}`}>{phase.name}</div>
                      <div className="text-[.77rem] text-gray-400">
                        {goalLabel[phase.goal] ?? phase.goal} &middot; {phase.duration_weeks} semanas
                        {phase.start_date && <> &middot; {new Date(phase.start_date).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {phase.status === 'completed' && <Badge variant="green">Completada</Badge>}
                      {phase.status === 'active' && <Badge variant="blue">Activa — Sem {weekNumber}</Badge>}
                      {phase.status === 'planned' && <Badge variant="gray">Planificada</Badge>}
                      <span className="text-gray-300">&rsaquo;</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Macro Summary */}
            <div className="grid grid-cols-3 gap-4 mt-6 max-sm:grid-cols-1">
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
                <div className="text-[.77rem] text-gray-400 mb-0.5">Fases Planificadas</div>
                <div className="text-[1.25rem] font-extrabold">{phases.length}</div>
                <div className="text-[.77rem] text-gray-400">
                  {phases.filter((p) => p.status === 'active').length} activa, {completedPhases.length} completas, {plannedPhases.length} futuras
                </div>
              </div>
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
                <div className="text-[.77rem] text-gray-400 mb-0.5">Semanas Totales</div>
                <div className="text-[1.25rem] font-extrabold">{phases.reduce((a, p) => a + p.duration_weeks, 0)}</div>
                <div className="text-[.77rem] text-gray-400">de 52 del ano</div>
              </div>
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] mb-[18px] text-center">
                <div className="text-[.77rem] text-gray-400 mb-0.5">Distribucion</div>
                <div className="text-[1.25rem] font-extrabold">
                  {phases.filter((p) => p.goal === 'build').length} Vol / {phases.filter((p) => p.goal === 'cut').length} Def
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Phase Wizard Modal */}
      <PhaseWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); fetchData() }}
        mode={wizardMode}
        existingPhase={wizardMode === 'edit' ? activePhase : undefined}
      />
    </>
  )
}
