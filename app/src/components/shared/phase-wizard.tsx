'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayLocal } from '@/lib/date-utils'
import type { Phase } from '@/lib/supabase/types'

const muscleGroups = [
  'Glutes', 'Hamstrings', 'Quadriceps', 'Shoulders', 'Triceps',
  'Abdominals', 'Lats', 'Biceps', 'Upper Back', 'Abductors',
  'Chest', 'Adductors', 'Forearms', 'Lower Back', 'Calves',
]

const defaultVolume: Record<string, { mev: number; mav: number; mrv: number }> = {
  Glutes: { mev: 8, mav: 16, mrv: 22 },
  Hamstrings: { mev: 4, mav: 10, mrv: 16 },
  Quadriceps: { mev: 6, mav: 12, mrv: 18 },
  Shoulders: { mev: 6, mav: 12, mrv: 20 },
  Triceps: { mev: 4, mav: 8, mrv: 14 },
  Abdominals: { mev: 0, mav: 6, mrv: 12 },
  Lats: { mev: 6, mav: 12, mrv: 18 },
  Biceps: { mev: 4, mav: 8, mrv: 14 },
  'Upper Back': { mev: 6, mav: 12, mrv: 18 },
  Abductors: { mev: 0, mav: 6, mrv: 12 },
  Chest: { mev: 6, mav: 12, mrv: 18 },
  Adductors: { mev: 0, mav: 6, mrv: 10 },
  Forearms: { mev: 2, mav: 6, mrv: 10 },
  'Lower Back': { mev: 0, mav: 4, mrv: 8 },
  Calves: { mev: 6, mav: 10, mrv: 16 },
}

// ── Goal-specific criteria defaults ──────────────────────────────────
type CriterionItem = { id: string; label: string; detail: string; defaultOn: boolean }

const entryCriteriaByGoal: Record<string, CriterionItem[]> = {
  build: [
    { id: 'weight_stable', label: 'Peso estable 2+ semanas', detail: 'Sin fluctuaciones >0.5kg entre semanas', defaultOn: true },
    { id: 'deload_done', label: 'Deload completado', detail: 'Semana de descarga previa realizada', defaultOn: true },
    { id: 'energy_ok', label: 'Energia ≥ 3/5', detail: 'Nivel de energia adecuado para volumen alto', defaultOn: true },
    { id: 'hunger_low', label: 'Hambre controlado', detail: 'Hambre ≤ 3/5, sin ansiedad alimentaria', defaultOn: false },
    { id: 'metrics_baselined', label: 'Medidas base tomadas', detail: 'Peso, cintura, fotos registradas como baseline', defaultOn: true },
    { id: 'performance_baseline', label: 'Rendimiento base registrado', detail: 'Marcas actuales de fuerza documentadas', defaultOn: false },
  ],
  cut: [
    { id: 'bulk_completed', label: 'Fase de volumen completada', detail: 'Se gano masa suficiente, momento de definir', defaultOn: true },
    { id: 'bf_elevated', label: 'Grasa corporal elevada', detail: 'Body fat % por encima del rango deseado', defaultOn: true },
    { id: 'energy_ok', label: 'Energia ≥ 3/5', detail: 'Energia suficiente para sostener deficit', defaultOn: true },
    { id: 'metrics_baselined', label: 'Medidas base tomadas', detail: 'Peso, cintura, fotos registradas como baseline', defaultOn: true },
    { id: 'adherence_ready', label: 'Adherencia preparada', detail: 'Plan de comidas y tracking listos', defaultOn: false },
  ],
  strength: [
    { id: 'recovery_good', label: 'Recuperacion optima', detail: 'Sin lesiones, sin fatiga acumulada', defaultOn: true },
    { id: 'muscle_base', label: 'Base muscular adecuada', detail: 'Suficiente masa para expresar fuerza', defaultOn: true },
    { id: 'technique_solid', label: 'Tecnica consolidada', detail: 'Patrones de movimiento dominados', defaultOn: false },
    { id: 'metrics_baselined', label: '1RM / PRs documentados', detail: 'Marcas maximas actuales registradas', defaultOn: true },
  ],
  maintain: [
    { id: 'post_phase', label: 'Transicion post-fase', detail: 'Viene de cut o bulk, necesita estabilizar', defaultOn: true },
    { id: 'metrics_stable', label: 'Metricas estables', detail: 'Peso y composicion corporal en rango deseado', defaultOn: true },
    { id: 'recovery_needed', label: 'Necesita recuperacion', detail: 'Fatiga acumulada de fase anterior', defaultOn: false },
  ],
}

const progressCriteriaByGoal: Record<string, { targets: CriterionItem[]; warnings: CriterionItem[] }> = {
  build: {
    targets: [
      { id: 'weight_gain', label: 'Ganancia de peso', detail: '+0.2 a 0.5 kg/semana', defaultOn: true },
      { id: 'strength_up', label: 'Fuerza subiendo', detail: 'Progresion en cargas o reps cada 1-2 semanas', defaultOn: true },
      { id: 'energy_stable', label: 'Energia estable ≥ 3/5', detail: 'Sin caidas sostenidas de energia', defaultOn: true },
      { id: 'waist_controlled', label: 'Cintura controlada', detail: 'Cintura no sube mas de 1cm/mes', defaultOn: true },
      { id: 'sleep_quality', label: 'Sueno ≥ 7h', detail: 'Descanso adecuado para recuperacion', defaultOn: false },
    ],
    warnings: [
      { id: 'weight_too_fast', label: 'Ganancia muy rapida', detail: '>0.7kg/semana = demasiada grasa', defaultOn: true },
      { id: 'waist_spike', label: 'Cintura subiendo rapido', detail: '+2cm en un mes = exceso calorico', defaultOn: true },
      { id: 'energy_drop', label: 'Energia baja sostenida', detail: '≤ 2/5 por 2+ semanas', defaultOn: true },
      { id: 'digestion_issues', label: 'Problemas digestivos', detail: 'Hinchazón, malestar constante', defaultOn: false },
    ],
  },
  cut: {
    targets: [
      { id: 'weight_loss', label: 'Perdida de peso', detail: '-0.3 a -0.7 kg/semana', defaultOn: true },
      { id: 'strength_maintain', label: 'Fuerza mantenida', detail: 'Sin perdida >5% en levantamientos principales', defaultOn: true },
      { id: 'waist_decreasing', label: 'Cintura bajando', detail: 'Reduccion progresiva de cintura', defaultOn: true },
      { id: 'adherence_high', label: 'Adherencia alta', detail: '≥ 85% de adherencia a plan nutricional', defaultOn: true },
      { id: 'energy_adequate', label: 'Energia tolerable ≥ 2/5', detail: 'Energia suficiente para entrenar', defaultOn: true },
    ],
    warnings: [
      { id: 'strength_drop', label: 'Fuerza cayendo', detail: 'Perdida >10% en levantamientos principales', defaultOn: true },
      { id: 'energy_crash', label: 'Energia muy baja', detail: '≤ 1/5 por 2+ semanas', defaultOn: true },
      { id: 'hunger_extreme', label: 'Hambre extremo', detail: '≥ 4/5 por 3+ semanas', defaultOn: true },
      { id: 'weight_stall', label: 'Peso estancado', detail: 'Sin cambio por 2+ semanas con adherencia', defaultOn: true },
      { id: 'sleep_disrupted', label: 'Sueno disrumpido', detail: '<6h o despertares frecuentes', defaultOn: false },
      { id: 'mood_low', label: 'Animo bajo sostenido', detail: 'Irritabilidad, desmotivacion constante', defaultOn: false },
    ],
  },
  strength: {
    targets: [
      { id: 'load_progression', label: 'Progresion de carga', detail: 'Aumento progresivo en lifts principales', defaultOn: true },
      { id: 'rpe_appropriate', label: 'RPE apropiado', detail: 'RPE 7-9 en series de trabajo', defaultOn: true },
      { id: 'recovery_adequate', label: 'Recuperacion adecuada', detail: 'Sin dolor articular, sueno ok', defaultOn: true },
      { id: 'technique_improving', label: 'Tecnica mejorando', detail: 'Movimientos mas limpios y eficientes', defaultOn: false },
    ],
    warnings: [
      { id: 'joint_pain', label: 'Dolor articular', detail: 'Dolor persistente en articulaciones', defaultOn: true },
      { id: 'rpe_too_high', label: 'RPE constantemente alto', detail: 'RPE 9.5+ en la mayoria de series', defaultOn: true },
      { id: 'sleep_bad', label: 'Sueno malo', detail: '<6h o calidad muy baja', defaultOn: true },
      { id: 'plateau_extended', label: 'Meseta prolongada', detail: 'Sin progresion en 3+ semanas', defaultOn: false },
    ],
  },
  maintain: {
    targets: [
      { id: 'weight_stable', label: 'Peso estable', detail: '±0.5kg del peso objetivo', defaultOn: true },
      { id: 'strength_maintained', label: 'Fuerza mantenida', detail: 'Sin perdida significativa', defaultOn: true },
      { id: 'energy_good', label: 'Energia buena ≥ 3/5', detail: 'Sensacion general positiva', defaultOn: true },
      { id: 'habits_consistent', label: 'Habitos consistentes', detail: 'Adherencia a entrenamiento y nutricion', defaultOn: false },
    ],
    warnings: [
      { id: 'weight_drift', label: 'Peso desviandose', detail: '>1kg del objetivo por 2+ semanas', defaultOn: true },
      { id: 'motivation_drop', label: 'Motivacion baja', detail: 'Falta de ganas de entrenar', defaultOn: true },
      { id: 'boredom', label: 'Aburrimiento', detail: 'Rutina se siente monotona', defaultOn: false },
    ],
  },
}

const exitCriteriaByGoal: Record<string, CriterionItem[]> = {
  build: [
    { id: 'target_weight', label: 'Peso objetivo alcanzado', detail: 'Llegaste al peso meta de la fase', defaultOn: true },
    { id: 'bf_too_high', label: 'Grasa corporal demasiado alta', detail: 'Body fat sube por encima del limite aceptable', defaultOn: true },
    { id: 'waist_limit', label: 'Cintura en limite', detail: 'Cintura llego al maximo aceptable', defaultOn: true },
    { id: 'mrv_reached', label: 'MRV alcanzado', detail: 'Volumen de entrenamiento al maximo recuperable', defaultOn: false },
    { id: 'duration_complete', label: 'Duracion completada', detail: 'Se cumplieron las semanas planificadas', defaultOn: true },
    { id: 'diet_fatigue', label: 'Fatiga alimentaria', detail: 'Dificultad sostenida para comer en superavit', defaultOn: false },
  ],
  cut: [
    { id: 'target_weight', label: 'Peso objetivo alcanzado', detail: 'Llegaste al peso meta', defaultOn: true },
    { id: 'target_bf', label: 'Body fat objetivo', detail: 'Composicion corporal deseada alcanzada', defaultOn: true },
    { id: 'target_waist', label: 'Cintura objetivo', detail: 'Medida de cintura deseada alcanzada', defaultOn: true },
    { id: 'performance_compromised', label: 'Rendimiento comprometido', detail: 'Fuerza baja >15% sostenido', defaultOn: true },
    { id: 'metabolic_adaptation', label: 'Adaptacion metabolica', detail: 'Peso estancado a pesar de deficit maximo', defaultOn: true },
    { id: 'duration_complete', label: 'Duracion completada', detail: 'Se cumplieron las semanas planificadas', defaultOn: true },
    { id: 'mental_burnout', label: 'Agotamiento mental', detail: 'No se puede sostener el deficit emocionalmente', defaultOn: false },
  ],
  strength: [
    { id: 'strength_goal', label: 'Meta de fuerza alcanzada', detail: 'PRs o 1RMs objetivo logrados', defaultOn: true },
    { id: 'accumulated_fatigue', label: 'Fatiga acumulada', detail: 'Cuerpo necesita deload largo o transicion', defaultOn: true },
    { id: 'competition_done', label: 'Competencia realizada', detail: 'Evento o fecha objetivo completado', defaultOn: false },
    { id: 'injury_risk', label: 'Riesgo de lesion alto', detail: 'Molestias articulares persistentes', defaultOn: true },
    { id: 'duration_complete', label: 'Duracion completada', detail: 'Se cumplieron las semanas planificadas', defaultOn: true },
  ],
  maintain: [
    { id: 'ready_next_phase', label: 'Lista para siguiente fase', detail: 'Recuperada y motivada para nuevo objetivo', defaultOn: true },
    { id: 'duration_complete', label: 'Duracion completada', detail: 'Se cumplieron las semanas planificadas', defaultOn: true },
    { id: 'new_goal', label: 'Nuevo objetivo definido', detail: 'Decide empezar bulk, cut o fuerza', defaultOn: true },
    { id: 'metrics_drifting', label: 'Metricas desviandose', detail: 'Ya no se esta manteniendo, mejor cambiar', defaultOn: false },
  ],
}

const goalMap: Record<string, string> = {
  'Build / Volume': 'build',
  'Cut / Define': 'cut',
  'Strength': 'strength',
  'Maintenance': 'maintain',
}

const goalMapReverse: Record<string, string> = {
  build: 'Build / Volume',
  cut: 'Cut / Define',
  strength: 'Strength',
  maintain: 'Maintenance',
}

const splitMap: Record<string, string> = {
  'Full Body': 'full_body',
  'Upper / Lower': 'upper_lower',
  'Push / Pull / Legs': 'ppl',
  'Custom': 'custom',
}

interface PhaseWizardProps {
  open: boolean
  onClose: () => void
  mode?: 'create' | 'edit'
  existingPhase?: Phase | null
  macrocycleId?: string | null
}

const PHASE_DRAFT_KEY = 'fitos:phase-wizard-draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(PHASE_DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    // Expire drafts older than 24h
    if (draft._savedAt && Date.now() - draft._savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PHASE_DRAFT_KEY)
      return null
    }
    // Merge volume with current defaults so new muscle groups always appear
    if (draft.volume) {
      const merged: Record<string, { mev: number; mav: number; mrv: number }> = { ...defaultVolume }
      for (const key of muscleGroups) {
        if (draft.volume[key]) merged[key] = draft.volume[key]
      }
      draft.volume = merged
    }
    return draft
  } catch { return null }
}

export function PhaseWizard({ open, onClose, mode = 'create', existingPhase, macrocycleId }: PhaseWizardProps) {
  const isEdit = mode === 'edit' && existingPhase
  const draft = mode === 'create' ? loadDraft() : null
  const [step, setStep] = useState(draft?.step ?? 1)
  const [name, setName] = useState(isEdit ? existingPhase.name : (draft?.name ?? ''))
  const [objective, setObjective] = useState(isEdit ? (existingPhase.objective ?? '') : (draft?.objective ?? ''))
  const [goal, setGoal] = useState(isEdit ? (goalMapReverse[existingPhase.goal] ?? 'Build / Volume') : (draft?.goal ?? 'Build / Volume'))
  const [duration, setDuration] = useState(isEdit ? String(existingPhase.duration_weeks) : (draft?.duration ?? '6'))
  const [frequency, setFrequency] = useState(isEdit ? String(existingPhase.frequency) : (draft?.frequency ?? '3'))
  const [startDate, setStartDate] = useState(isEdit ? (existingPhase.start_date ?? '') : (draft?.startDate ?? todayLocal()))
  const [endDate, setEndDate] = useState(isEdit ? (existingPhase.end_date ?? '') : (draft?.endDate ?? ''))
  const splitMapReverse: Record<string, string> = { full_body: 'Full Body', upper_lower: 'Upper / Lower', ppl: 'Push / Pull / Legs', custom: 'Custom' }
  const [split, setSplit] = useState(isEdit ? (splitMapReverse[existingPhase.split_type ?? ''] ?? 'Full Body') : (draft?.split ?? 'Full Body'))
  const [focusMuscles, setFocusMuscles] = useState<string[]>(isEdit ? (existingPhase.focus_muscles ?? []) : (draft?.focusMuscles ?? []))
  const [volume, setVolume] = useState<Record<string, { mev: number; mav: number; mrv: number }>>(
    isEdit && existingPhase.volume_targets && typeof existingPhase.volume_targets === 'object'
      ? { ...defaultVolume, ...(existingPhase.volume_targets as Record<string, { mev: number; mav: number; mrv: number }>) }
      : (draft?.volume ?? defaultVolume)
  )
  const [cal, setCal] = useState(isEdit && existingPhase.calorie_target != null ? String(existingPhase.calorie_target) : (draft?.cal ?? ''))
  const [prot, setProt] = useState(isEdit && existingPhase.protein_target != null ? String(existingPhase.protein_target) : (draft?.prot ?? ''))
  const [carbs, setCarbs] = useState(isEdit && existingPhase.carbs_target != null ? String(existingPhase.carbs_target) : (draft?.carbs ?? ''))
  const [fat, setFat] = useState(isEdit && existingPhase.fat_target != null ? String(existingPhase.fat_target) : (draft?.fat ?? ''))
  const editCal = isEdit ? (existingPhase.calorie_target ?? 0) : 0
  const [protPct, setProtPct] = useState(isEdit && editCal > 0 && existingPhase.protein_target ? Math.round((existingPhase.protein_target * 4 / editCal) * 100) : (draft?.protPct ?? 30))
  const [carbsPct, setCarbsPct] = useState(isEdit && editCal > 0 && existingPhase.carbs_target ? Math.round((existingPhase.carbs_target * 4 / editCal) * 100) : (draft?.carbsPct ?? 40))
  const [fatPct, setFatPct] = useState(isEdit && editCal > 0 && existingPhase.fat_target ? Math.round((existingPhase.fat_target * 9 / editCal) * 100) : (draft?.fatPct ?? 30))
  const [steps, setSteps] = useState(isEdit && existingPhase.step_goal != null ? String(existingPhase.step_goal) : (draft?.steps ?? ''))
  const [sleep, setSleep] = useState(isEdit && existingPhase.sleep_goal != null ? String(existingPhase.sleep_goal) : (draft?.sleep ?? ''))
  // Criteria states — initialized from existing phase or goal-specific defaults
  const currentGoalKey = goalMap[goal] ?? 'build'

  function loadCriteriaStates(criteria: unknown, availableItems: CriterionItem[]): Record<string, boolean> {
    const saved = criteria as { conditions?: { id: string }[] } | null
    if (saved?.conditions) {
      const enabledIds = new Set(saved.conditions.map((c) => c.id))
      return Object.fromEntries(availableItems.map((c) => [c.id, enabledIds.has(c.id)]))
    }
    return Object.fromEntries(availableItems.map((c) => [c.id, c.defaultOn]))
  }

  function loadBodyComp(criteria: unknown): { weight_kg: string; body_fat_pct: string; waist_cm: string } {
    const saved = criteria as { body_comp?: { weight_kg?: number; body_fat_pct?: number; waist_cm?: number }; targets?: { weight_kg?: number; body_fat_pct?: number; waist_cm?: number } } | null
    const bc = saved?.body_comp ?? saved?.targets
    if (bc) return { weight_kg: bc.weight_kg ? String(bc.weight_kg) : '', body_fat_pct: bc.body_fat_pct ? String(bc.body_fat_pct) : '', waist_cm: bc.waist_cm ? String(bc.waist_cm) : '' }
    return { weight_kg: '', body_fat_pct: '', waist_cm: '' }
  }

  const [entryStates, setEntryStates] = useState<Record<string, boolean>>(() =>
    isEdit ? loadCriteriaStates(existingPhase.entry_criteria, entryCriteriaByGoal[currentGoalKey] ?? [])
    : (draft?.entryStates ?? Object.fromEntries((entryCriteriaByGoal[currentGoalKey] ?? []).map((c) => [c.id, c.defaultOn])))
  )
  const [entryBodyComp, setEntryBodyComp] = useState<{ weight_kg: string; body_fat_pct: string; waist_cm: string }>(
    isEdit ? loadBodyComp(existingPhase.entry_criteria) : (draft?.entryBodyComp ?? { weight_kg: '', body_fat_pct: '', waist_cm: '' })
  )
  const [entryNotes, setEntryNotes] = useState(
    isEdit ? ((existingPhase.entry_criteria as { custom_notes?: string } | null)?.custom_notes ?? '') : (draft?.entryNotes ?? '')
  )

  function loadProgressStates(criteria: unknown, items: CriterionItem[], key: 'targets' | 'warnings'): Record<string, boolean> {
    const saved = criteria as { weekly_targets?: { id: string }[]; warning_signs?: { id: string }[] } | null
    const list = key === 'targets' ? saved?.weekly_targets : saved?.warning_signs
    if (list) {
      const enabledIds = new Set(list.map((c) => c.id))
      return Object.fromEntries(items.map((c) => [c.id, enabledIds.has(c.id)]))
    }
    return Object.fromEntries(items.map((c) => [c.id, c.defaultOn]))
  }

  const [progressTargetStates, setProgressTargetStates] = useState<Record<string, boolean>>(() =>
    isEdit ? loadProgressStates(existingPhase.progress_criteria, progressCriteriaByGoal[currentGoalKey]?.targets ?? [], 'targets')
    : (draft?.progressTargetStates ?? Object.fromEntries((progressCriteriaByGoal[currentGoalKey]?.targets ?? []).map((c) => [c.id, c.defaultOn])))
  )
  const [progressWarningStates, setProgressWarningStates] = useState<Record<string, boolean>>(() =>
    isEdit ? loadProgressStates(existingPhase.progress_criteria, progressCriteriaByGoal[currentGoalKey]?.warnings ?? [], 'warnings')
    : (draft?.progressWarningStates ?? Object.fromEntries((progressCriteriaByGoal[currentGoalKey]?.warnings ?? []).map((c) => [c.id, c.defaultOn])))
  )
  const [progressNotes, setProgressNotes] = useState(
    isEdit ? ((existingPhase.progress_criteria as { custom_notes?: string } | null)?.custom_notes ?? '') : (draft?.progressNotes ?? '')
  )

  const [exitStates, setExitStates] = useState<Record<string, boolean>>(() =>
    isEdit ? loadCriteriaStates(existingPhase.exit_criteria, exitCriteriaByGoal[currentGoalKey] ?? [])
    : (draft?.exitStates ?? Object.fromEntries((exitCriteriaByGoal[currentGoalKey] ?? []).map((c) => [c.id, c.defaultOn])))
  )
  const [exitNote, setExitNote] = useState(isEdit ? (existingPhase.custom_exit_notes ?? '') : (draft?.exitNote ?? ''))
  const [exitTargets, setExitTargets] = useState<{ weight_kg: string; body_fat_pct: string; waist_cm: string }>(
    isEdit ? loadBodyComp(existingPhase.exit_criteria) : (draft?.exitTargets ?? { weight_kg: '', body_fat_pct: '', waist_cm: '' })
  )

  const [criteriaTab, setCriteriaTab] = useState<'entry' | 'progress' | 'exit'>('entry')
  const [phaseStatus, setPhaseStatus] = useState<'active' | 'planned'>(draft?.phaseStatus ?? 'planned')
  const [saving, setSaving] = useState(false)

  // Auto-calculate end date from start date + duration
  useEffect(() => {
    if (startDate && duration) {
      const start = new Date(startDate + 'T00:00:00')
      start.setDate(start.getDate() + parseInt(duration) * 7)
      setEndDate(start.toISOString().split('T')[0])
    }
  }, [startDate, duration])

  // Auto-save draft to localStorage (only in create mode)
  useEffect(() => {
    if (!open || isEdit) return
    const timer = setTimeout(() => {
      localStorage.setItem(PHASE_DRAFT_KEY, JSON.stringify({
        step, name, objective, goal, duration, frequency, startDate, endDate, split, focusMuscles, volume,
        cal, prot, carbs, fat, protPct, carbsPct, fatPct, steps, sleep, phaseStatus,
        entryStates, entryBodyComp, entryNotes,
        progressTargetStates, progressWarningStates, progressNotes,
        exitStates, exitNote, exitTargets,
        _savedAt: Date.now(),
      }))
    }, 500)
    return () => clearTimeout(timer)
  }, [open, isEdit, step, name, objective, goal, duration, frequency, startDate, endDate, split, focusMuscles, volume,
    cal, prot, carbs, fat, protPct, carbsPct, fatPct, steps, sleep, phaseStatus,
    entryStates, entryBodyComp, entryNotes,
    progressTargetStates, progressWarningStates, progressNotes,
    exitStates, exitNote, exitTargets])

  if (!open) return null

  const stepLabels = ['Datos', 'Volumen', 'Nutricion', 'Criterios', 'Revisar']

  // When goal changes, re-initialize criteria with new goal defaults
  function handleGoalChange(newGoal: string) {
    setGoal(newGoal)
    const gk = goalMap[newGoal] ?? 'build'
    setEntryStates(Object.fromEntries((entryCriteriaByGoal[gk] ?? []).map((c) => [c.id, c.defaultOn])))
    setProgressTargetStates(Object.fromEntries((progressCriteriaByGoal[gk]?.targets ?? []).map((c) => [c.id, c.defaultOn])))
    setProgressWarningStates(Object.fromEntries((progressCriteriaByGoal[gk]?.warnings ?? []).map((c) => [c.id, c.defaultOn])))
    setExitStates(Object.fromEntries((exitCriteriaByGoal[gk] ?? []).map((c) => [c.id, c.defaultOn])))
  }

  function toggleFocus(muscle: string) {
    setFocusMuscles((prev) => prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle])
  }

  function updateVolume(muscle: string, field: 'mev' | 'mav' | 'mrv', value: string) {
    setVolume((prev) => ({ ...prev, [muscle]: { ...prev[muscle], [field]: parseInt(value) || 0 } }))
  }

  // Auto-calculate macros from calories using current percentages
  function handleCalChange(value: string) {
    setCal(value)
    const kcal = parseInt(value)
    if (!kcal) return
    setProt(String(Math.round((kcal * protPct / 100) / 4)))
    setCarbs(String(Math.round((kcal * carbsPct / 100) / 4)))
    setFat(String(Math.round((kcal * fatPct / 100) / 9)))
  }

  // When grams change, recalculate percentages
  function handleGramChange(macro: 'prot' | 'carbs' | 'fat', value: string) {
    const setter = macro === 'prot' ? setProt : macro === 'carbs' ? setCarbs : setFat
    setter(value)
    const kcal = parseInt(cal)
    if (!kcal) return
    const g = parseInt(value) || 0
    const calFromMacro = macro === 'fat' ? g * 9 : g * 4
    const pct = Math.round((calFromMacro / kcal) * 100)
    if (macro === 'prot') setProtPct(pct)
    else if (macro === 'carbs') setCarbsPct(pct)
    else setFatPct(pct)
  }

  // When percentage changes, recalculate grams
  function handlePctChange(macro: 'prot' | 'carbs' | 'fat', value: number) {
    const kcal = parseInt(cal)
    if (macro === 'prot') {
      setProtPct(value)
      if (kcal) setProt(String(Math.round((kcal * value / 100) / 4)))
    } else if (macro === 'carbs') {
      setCarbsPct(value)
      if (kcal) setCarbs(String(Math.round((kcal * value / 100) / 4)))
    } else {
      setFatPct(value)
      if (kcal) setFat(String(Math.round((kcal * value / 100) / 9)))
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const phaseData = {
        user_id: userId,
        macrocycle_id: macrocycleId ?? existingPhase?.macrocycle_id ?? null,
        name: name || 'Nueva Fase',
        goal: goalMap[goal] ?? 'build',
        objective: objective || null,
        duration_weeks: parseInt(duration) || 6,
        frequency: parseInt(frequency) || 3,
        split_type: splitMap[split] ?? 'full_body',
        focus_muscles: focusMuscles,
        calorie_target: cal ? parseInt(cal) : null,
        protein_target: prot ? parseInt(prot) : null,
        carbs_target: carbs ? parseInt(carbs) : null,
        fat_target: fat ? parseInt(fat) : null,
        step_goal: steps ? parseInt(steps) : null,
        sleep_goal: sleep ? parseFloat(sleep) : null,
        entry_criteria: {
          conditions: (entryCriteriaByGoal[goalMap[goal] ?? 'build'] ?? []).filter((c) => entryStates[c.id]).map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
          body_comp: {
            weight_kg: entryBodyComp.weight_kg ? parseFloat(entryBodyComp.weight_kg) : null,
            body_fat_pct: entryBodyComp.body_fat_pct ? parseFloat(entryBodyComp.body_fat_pct) : null,
            waist_cm: entryBodyComp.waist_cm ? parseFloat(entryBodyComp.waist_cm) : null,
          },
          custom_notes: entryNotes || null,
        },
        progress_criteria: {
          weekly_targets: (progressCriteriaByGoal[goalMap[goal] ?? 'build']?.targets ?? []).filter((c) => progressTargetStates[c.id]).map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
          warning_signs: (progressCriteriaByGoal[goalMap[goal] ?? 'build']?.warnings ?? []).filter((c) => progressWarningStates[c.id]).map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
          custom_notes: progressNotes || null,
        },
        exit_criteria: {
          conditions: (exitCriteriaByGoal[goalMap[goal] ?? 'build'] ?? []).filter((c) => exitStates[c.id]).map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
          targets: {
            weight_kg: exitTargets.weight_kg ? parseFloat(exitTargets.weight_kg) : null,
            body_fat_pct: exitTargets.body_fat_pct ? parseFloat(exitTargets.body_fat_pct) : null,
            waist_cm: exitTargets.waist_cm ? parseFloat(exitTargets.waist_cm) : null,
          },
          custom_notes: exitNote || null,
        },
        custom_exit_notes: exitNote || null,
        volume_targets: volume,
      }

      if (isEdit) {
        const { error } = await supabase
          .from('phases')
          .update({ ...phaseData, start_date: startDate || null, end_date: endDate || null, updated_at: new Date().toISOString() })
          .eq('id', existingPhase.id)

        if (error) {
          console.error('Error updating phase:', error)
          alert('Error actualizando fase: ' + error.message)
          return
        }
      } else {
        // Only deactivate existing active phases if new phase is set to active
        if (phaseStatus === 'active') {
          await supabase
            .from('phases')
            .update({ status: 'paused', updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('status', 'active')
        }

        const { error } = await supabase
          .from('phases')
          .insert({
            ...phaseData,
            status: phaseStatus,
            start_date: startDate || todayLocal(),
            end_date: endDate || null,
          })

        if (error) {
          console.error('Error creating phase:', error)
          alert('Error creando fase: ' + error.message)
          return
        }
      }

      localStorage.removeItem(PHASE_DRAFT_KEY)
      onClose()
      setStep(1)
    } catch (err) {
      console.error('Error saving phase:', err)
      alert('Error guardando la fase')
    } finally {
      setSaving(false)
    }
  }

  function next() {
    if (step < 5) setStep(step + 1)
    else handleSave()
  }

  function handleClose() {
    const hasData = name || objective || cal || prot
    if (hasData && !isEdit) {
      if (!window.confirm('Tenes un borrador guardado. Podes volver cuando quieras y va a seguir ahi. Cerrar?')) return
    }
    onClose()
  }

  function back() {
    if (step > 1) setStep(step - 1)
    else handleClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[500] flex justify-center items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-card rounded-[var(--radius)] w-[580px] max-w-[95vw] max-h-[85vh] p-[24px_28px] shadow-[var(--shadow-lg)] fade-scale flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-1.5 shrink-0">
          <h2 className="text-[1.1rem] font-extrabold">{mode === 'edit' ? 'Editar Fase' : 'Nueva Fase'}</h2>
          <button onClick={handleClose} className="text-[1.3rem] text-gray-400 p-1 cursor-pointer bg-transparent border-none hover:text-gray-600">&times;</button>
        </div>

        {/* Step Indicators — clickeable */}
        <div className="flex items-center gap-0 mb-7">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <button type="button" onClick={() => setStep(i + 1)} className="text-center bg-transparent border-none cursor-pointer p-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[.8rem] font-bold border-2 shrink-0 transition-all duration-200 ${
                  step > i + 1 ? 'border-success bg-success text-white' :
                  step === i + 1 ? 'border-primary bg-primary-light text-primary' :
                  'border-gray-200 text-gray-400 bg-card'
                }`}>
                  {step > i + 1 ? '\u2713' : i + 1}
                </div>
                <div className={`text-[.7rem] mt-1 ${
                  step > i + 1 ? 'text-success' :
                  step === i + 1 ? 'text-primary font-semibold' :
                  'text-gray-400'
                }`}>
                  {label}
                </div>
              </button>
              {i < stepLabels.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 transition-colors duration-200 ${step > i + 1 ? 'bg-success' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content (scrollable) */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* STEP 1: Basics */}
          {step === 1 && (
            <div className="fade-in">
              <h3 className="text-[.95rem] font-bold mb-1">Datos Basicos</h3>
              <p className="text-[.77rem] text-gray-400 mb-4">Defini los datos base de tu fase de entrenamiento.</p>

              <div className="mb-4">
                <label className="text-[.77rem] text-gray-400 block mb-1">Nombre de la Fase</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: Volumen Q2 2026" className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Objetivo</label>
                  <select value={goal} onChange={(e) => handleGoalChange(e.target.value)} className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none bg-card">
                    <option>Build / Volume</option>
                    <option>Cut / Define</option>
                    <option>Strength</option>
                    <option>Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Duracion (semanas)</label>
                  <input type="number" min={1} max={52} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="ej: 6" className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Dias/Semana</label>
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none bg-card">
                    {[2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Tipo de Split</label>
                  <select value={split} onChange={(e) => setSplit(e.target.value)} className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none bg-card">
                    <option>Full Body</option>
                    <option>Upper / Lower</option>
                    <option>Push / Pull / Legs</option>
                    <option>Custom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Fecha Inicio</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none bg-card" />
                </div>
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Fecha Fin (auto)</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none bg-card text-gray-500" />
                </div>
              </div>

              {!isEdit && (
                <div className="mb-4">
                  <label className="text-[.77rem] text-gray-400 block mb-1">Estado Inicial</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPhaseStatus('planned')}
                      className={`flex-1 py-2.5 px-4 rounded-[var(--radius-sm)] border-[1.5px] text-[.85rem] font-semibold cursor-pointer transition-all duration-200 ${
                        phaseStatus === 'planned'
                          ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      Planificada
                    </button>
                    <button
                      onClick={() => setPhaseStatus('active')}
                      className={`flex-1 py-2.5 px-4 rounded-[var(--radius-sm)] border-[1.5px] text-[.85rem] font-semibold cursor-pointer transition-all duration-200 ${
                        phaseStatus === 'active'
                          ? 'bg-primary-light border-primary text-primary-dark'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      Activar Ahora
                    </button>
                  </div>
                  <p className="text-[.72rem] text-gray-400 mt-1">
                    {phaseStatus === 'planned'
                      ? 'La fase se crea como planificada. Podes activarla despues.'
                      : 'La fase se activa inmediatamente (la fase activa actual se pausa).'}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-[.77rem] text-gray-400 block mb-1">Objetivo de la Fase (siempre visible en Inicio)</label>
                <input type="text" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="ej: Llegar a 52.5kg, cintura <66cm." className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none" />
              </div>

              <div className="mb-4">
                <label className="text-[.77rem] text-gray-400 block mb-1">Musculos Foco (prioridad)</label>
                <div className="flex flex-wrap gap-1.5">
                  {muscleGroups.map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleFocus(m)}
                      className={`py-[7px] px-4 rounded-full border-[1.5px] text-[.84rem] font-medium cursor-pointer transition-all duration-200 ${
                        focusMuscles.includes(m)
                          ? 'bg-primary-light border-primary text-primary-dark'
                          : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Volume */}
          {step === 2 && (
            <div className="fade-in">
              <h3 className="text-[.95rem] font-bold mb-1">Objetivos de Volumen</h3>
              <p className="text-[.77rem] text-gray-400 mb-3">Setea las series semanales por grupo muscular. Los musculos foco se resaltan.</p>

              <div className="flex gap-2 mb-3">
                {['Principiante', 'Intermedio', 'Avanzado'].map((preset) => (
                  <button key={preset} className="text-gray-500 bg-transparent border-none py-1 px-2 text-[.78rem] font-semibold cursor-pointer hover:text-primary hover:bg-primary-light rounded-[var(--radius-sm)] transition-all duration-200">
                    {preset}
                  </button>
                ))}
              </div>

              {/* Headers */}
              <div className="flex gap-1 mb-2 px-0">
                <div className="w-[100px] text-[.7rem] text-gray-400 font-semibold">MUSCULO</div>
                <div className="flex gap-1.5 flex-1">
                  <div className="w-[60px] text-center text-[.7rem] text-gray-400 font-semibold">MEV</div>
                  <div className="w-[60px] text-center text-[.7rem] text-gray-400 font-semibold">MAV</div>
                  <div className="w-[60px] text-center text-[.7rem] text-gray-400 font-semibold">MRV</div>
                </div>
              </div>

              <div className="max-h-[280px] overflow-y-auto">
                {muscleGroups.map((muscle) => (
                  <div key={muscle} className={`flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0 ${focusMuscles.includes(muscle) ? 'bg-primary-light/50 -mx-2 px-2 rounded' : ''}`}>
                    <div className="w-[100px] font-semibold text-[.85rem]">{muscle}</div>
                    <div className="flex gap-1.5 flex-1">
                      {(['mev', 'mav', 'mrv'] as const).map((field) => (
                        <input
                          key={field}
                          type="number"
                          value={volume[muscle]?.[field] || ''}
                          onChange={(e) => updateVolume(muscle, field, e.target.value)}
                          className="w-[60px] py-1.5 px-2 text-center text-[.85rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-[10px_14px] bg-primary-light rounded-[var(--radius-xs)]">
                <span className="text-[.8rem] text-primary-dark">{'\uD83D\uDCA1'} <strong>MEV</strong> = minimum effective volume &middot; <strong>MAV</strong> = maximum adaptive volume &middot; <strong>MRV</strong> = max recoverable volume</span>
              </div>
            </div>
          )}

          {/* STEP 3: Nutrition */}
          {step === 3 && (
            <div className="fade-in">
              <h3 className="text-[.95rem] font-bold mb-1">Nutricion y Actividad</h3>
              <p className="text-[.77rem] text-gray-400 mb-4">Defini tus objetivos para esta fase. Al poner calorias, los macros se calculan automaticamente.</p>

              <div className="mb-4">
                <label className="text-[.77rem] text-gray-400 block mb-1">Calorias Diarias Objetivo</label>
                <input type="number" value={cal} onChange={(e) => handleCalChange(e.target.value)} placeholder="ej: 1700" className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none" />
              </div>

              <div className="mb-4">
                <label className="text-[.77rem] text-gray-400 block mb-2">Macros</label>

                {/* Macro rows: each shows label, grams input, percentage input, and visual bar */}
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Proteina', color: 'bg-blue-500', gram: prot, pct: protPct, macro: 'prot' as const, calPerG: 4, placeholder: '120' },
                    { label: 'Carbohidratos', color: 'bg-amber-500', gram: carbs, pct: carbsPct, macro: 'carbs' as const, calPerG: 4, placeholder: '170' },
                    { label: 'Grasa', color: 'bg-rose-400', gram: fat, pct: fatPct, macro: 'fat' as const, calPerG: 9, placeholder: '57' },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                        <span className="text-[.8rem] font-semibold text-gray-700 flex-1">{m.label}</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={m.gram}
                            onChange={(e) => handleGramChange(m.macro, e.target.value)}
                            placeholder={m.placeholder}
                            className="w-[70px] py-1.5 px-2 text-center text-[.85rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none"
                          />
                          <span className="text-[.75rem] text-gray-400">g</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={m.pct}
                            onChange={(e) => handlePctChange(m.macro, parseInt(e.target.value) || 0)}
                            className="w-[55px] py-1.5 px-2 text-center text-[.85rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none"
                          />
                          <span className="text-[.75rem] text-gray-400">%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${m.color} rounded-full transition-all duration-300`} style={{ width: `${Math.min(m.pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total percentage indicator */}
                {cal && (
                  <div className={`mt-2 text-[.78rem] font-medium ${
                    protPct + carbsPct + fatPct === 100 ? 'text-success' :
                    protPct + carbsPct + fatPct > 100 ? 'text-danger' : 'text-warning'
                  }`}>
                    Total: {protPct + carbsPct + fatPct}% {protPct + carbsPct + fatPct === 100 ? '\u2713' : `(${protPct + carbsPct + fatPct > 100 ? 'excede' : 'faltan'} ${Math.abs(100 - protPct - carbsPct - fatPct)}%)`}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Objetivo de Pasos Diarios</label>
                  <input type="number" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="8000" className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Objetivo de Sueno (horas)</label>
                  <input type="number" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="7.5" step="0.5" className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Criteria (Entry / Progress / Exit) */}
          {step === 4 && (
            <div className="fade-in">
              <h3 className="text-[.95rem] font-bold mb-1">Criterios de la Fase</h3>
              <p className="text-[.77rem] text-gray-400 mb-3">La IA usa estos criterios para evaluar tu progreso y darte sugerencias inteligentes.</p>

              {/* Sub-tabs */}
              <div className="flex gap-1 mb-4 bg-gray-50 p-1 rounded-[var(--radius-sm)]">
                {([
                  { key: 'entry' as const, label: '🚪 Entrada', desc: '¿Cuándo arranca?' },
                  { key: 'progress' as const, label: '📊 Progreso', desc: '¿Qué medir?' },
                  { key: 'exit' as const, label: '🏁 Salida', desc: '¿Cuándo termina?' },
                ]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setCriteriaTab(t.key)}
                    className={`flex-1 py-2 px-2 rounded-[var(--radius-xs)] text-center cursor-pointer border-none transition-all duration-200 ${
                      criteriaTab === t.key
                        ? 'bg-card shadow-[var(--shadow)] text-primary font-semibold'
                        : 'bg-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="text-[.82rem]">{t.label}</div>
                  </button>
                ))}
              </div>

              {/* ── ENTRY CRITERIA ── */}
              {criteriaTab === 'entry' && (
                <div className="fade-in">
                  <p className="text-[.78rem] text-gray-500 mb-3">¿Qué condiciones se tienen que cumplir para arrancar esta fase?</p>

                  {/* Body comp baseline */}
                  <div className="mb-4 p-3 bg-primary-light/50 rounded-[var(--radius-sm)]">
                    <div className="text-[.8rem] font-semibold text-primary-dark mb-2">📐 Composicion corporal de entrada (baseline)</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[.7rem] text-gray-400 block mb-0.5">Peso (kg)</label>
                        <input type="number" step="0.1" value={entryBodyComp.weight_kg} onChange={(e) => setEntryBodyComp(p => ({ ...p, weight_kg: e.target.value }))} placeholder="55" className="w-full py-1.5 px-2 text-[.82rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[.7rem] text-gray-400 block mb-0.5">Grasa (%)</label>
                        <input type="number" step="0.5" value={entryBodyComp.body_fat_pct} onChange={(e) => setEntryBodyComp(p => ({ ...p, body_fat_pct: e.target.value }))} placeholder="22" className="w-full py-1.5 px-2 text-[.82rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[.7rem] text-gray-400 block mb-0.5">Cintura (cm)</label>
                        <input type="number" step="0.5" value={entryBodyComp.waist_cm} onChange={(e) => setEntryBodyComp(p => ({ ...p, waist_cm: e.target.value }))} placeholder="68" className="w-full py-1.5 px-2 text-[.82rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Entry conditions */}
                  <div className="flex flex-col gap-1.5">
                    {(entryCriteriaByGoal[currentGoalKey] ?? []).map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-[10px_12px] bg-gray-50 rounded-[var(--radius-xs)]">
                        <button
                          onClick={() => setEntryStates(p => ({ ...p, [c.id]: !p[c.id] }))}
                          className={`w-9 h-5 rounded-[10px] relative cursor-pointer border-none shrink-0 transition-colors duration-200 ${entryStates[c.id] ? 'bg-primary' : 'bg-gray-200'}`}
                        >
                          <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${entryStates[c.id] ? 'translate-x-4' : ''}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[.82rem]">{c.label}</div>
                          <div className="text-[.73rem] text-gray-500 truncate">{c.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <textarea value={entryNotes} onChange={(e) => setEntryNotes(e.target.value)} placeholder="Notas adicionales de entrada (opcional)..." rows={2} className="w-full py-2 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.82rem] text-gray-600 resize-y min-h-[40px] focus:border-primary focus:outline-none font-[inherit]" />
                  </div>
                </div>
              )}

              {/* ── PROGRESS CRITERIA ── */}
              {criteriaTab === 'progress' && (
                <div className="fade-in">
                  <p className="text-[.78rem] text-gray-500 mb-3">¿Qué tiene que pasar cada semana para saber que vas bien? ¿Qué señales indican problemas?</p>

                  {/* Progress targets */}
                  <div className="mb-4">
                    <div className="text-[.8rem] font-semibold text-success mb-2">✅ Señales de progreso (check-in semanal)</div>
                    <div className="flex flex-col gap-1.5">
                      {(progressCriteriaByGoal[currentGoalKey]?.targets ?? []).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-[10px_12px] bg-success-light/50 rounded-[var(--radius-xs)]">
                          <button
                            onClick={() => setProgressTargetStates(p => ({ ...p, [c.id]: !p[c.id] }))}
                            className={`w-9 h-5 rounded-[10px] relative cursor-pointer border-none shrink-0 transition-colors duration-200 ${progressTargetStates[c.id] ? 'bg-success' : 'bg-gray-200'}`}
                          >
                            <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${progressTargetStates[c.id] ? 'translate-x-4' : ''}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[.82rem]">{c.label}</div>
                            <div className="text-[.73rem] text-gray-500">{c.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warning signs */}
                  <div className="mb-3">
                    <div className="text-[.8rem] font-semibold text-warning mb-2">⚠️ Señales de alerta (detectar problemas)</div>
                    <div className="flex flex-col gap-1.5">
                      {(progressCriteriaByGoal[currentGoalKey]?.warnings ?? []).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-[10px_12px] bg-warning-light/50 rounded-[var(--radius-xs)]">
                          <button
                            onClick={() => setProgressWarningStates(p => ({ ...p, [c.id]: !p[c.id] }))}
                            className={`w-9 h-5 rounded-[10px] relative cursor-pointer border-none shrink-0 transition-colors duration-200 ${progressWarningStates[c.id] ? 'bg-warning' : 'bg-gray-200'}`}
                          >
                            <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${progressWarningStates[c.id] ? 'translate-x-4' : ''}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[.82rem]">{c.label}</div>
                            <div className="text-[.73rem] text-gray-500">{c.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <textarea value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} placeholder="Notas adicionales sobre progreso (opcional)..." rows={2} className="w-full py-2 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.82rem] text-gray-600 resize-y min-h-[40px] focus:border-primary focus:outline-none font-[inherit]" />
                </div>
              )}

              {/* ── EXIT CRITERIA ── */}
              {criteriaTab === 'exit' && (
                <div className="fade-in">
                  <p className="text-[.78rem] text-gray-500 mb-3">¿Qué señales indican que esta fase tiene que terminar?</p>

                  {/* Exit targets */}
                  <div className="mb-4 p-3 bg-danger-light/50 rounded-[var(--radius-sm)]">
                    <div className="text-[.8rem] font-semibold text-danger mb-2">🎯 Metas de salida (numeros objetivo)</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[.7rem] text-gray-400 block mb-0.5">Peso objetivo (kg)</label>
                        <input type="number" step="0.1" value={exitTargets.weight_kg} onChange={(e) => setExitTargets(p => ({ ...p, weight_kg: e.target.value }))} placeholder="52" className="w-full py-1.5 px-2 text-[.82rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[.7rem] text-gray-400 block mb-0.5">Grasa obj. (%)</label>
                        <input type="number" step="0.5" value={exitTargets.body_fat_pct} onChange={(e) => setExitTargets(p => ({ ...p, body_fat_pct: e.target.value }))} placeholder="18" className="w-full py-1.5 px-2 text-[.82rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[.7rem] text-gray-400 block mb-0.5">Cintura obj. (cm)</label>
                        <input type="number" step="0.5" value={exitTargets.waist_cm} onChange={(e) => setExitTargets(p => ({ ...p, waist_cm: e.target.value }))} placeholder="64" className="w-full py-1.5 px-2 text-[.82rem] border-[1.5px] border-gray-200 rounded-[var(--radius-xs)] focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Exit conditions */}
                  <div className="flex flex-col gap-1.5 mb-3">
                    {(exitCriteriaByGoal[currentGoalKey] ?? []).map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-[10px_12px] bg-gray-50 rounded-[var(--radius-xs)]">
                        <button
                          onClick={() => setExitStates(p => ({ ...p, [c.id]: !p[c.id] }))}
                          className={`w-9 h-5 rounded-[10px] relative cursor-pointer border-none shrink-0 transition-colors duration-200 ${exitStates[c.id] ? 'bg-danger' : 'bg-gray-200'}`}
                        >
                          <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${exitStates[c.id] ? 'translate-x-4' : ''}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[.82rem]">{c.label}</div>
                          <div className="text-[.73rem] text-gray-500">{c.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <textarea value={exitNote} onChange={(e) => setExitNote(e.target.value)} placeholder="Notas de salida personalizadas (ej: terminar si cintura baja de 64cm)..." rows={2} className="w-full py-2 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.82rem] text-gray-600 resize-y min-h-[40px] focus:border-primary focus:outline-none font-[inherit]" />
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Review */}
          {step === 5 && (
            <div className="fade-in">
              <h3 className="text-[.95rem] font-bold mb-4">Revisar y {mode === 'edit' ? 'Guardar' : 'Crear'}</h3>

              <div className="mb-4">
                <h4 className="text-[.8rem] text-gray-500 uppercase tracking-wider mb-2">Datos Basicos</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {[
                    { label: 'Nombre', value: name || '--' },
                    { label: 'Objetivo', value: goal },
                    { label: 'Duracion', value: `${duration} semanas` },
                    { label: 'Frecuencia', value: `${frequency}x/semana` },
                    { label: 'Inicio', value: startDate || 'Hoy' },
                    { label: 'Fin', value: endDate || 'Auto' },
                    { label: 'Split', value: split },
                    { label: 'Foco', value: focusMuscles.join(', ') || '--' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500 text-[.85rem]">{item.label}</span>
                      <span className="font-semibold text-[.85rem]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-[.8rem] text-gray-500 uppercase tracking-wider mb-2">Nutricion</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {[
                    { label: 'Calorias', value: cal ? `${cal} kcal` : '--' },
                    { label: 'Proteina', value: prot ? `${prot}g` : '--' },
                    { label: 'Carbs', value: carbs ? `${carbs}g` : '--' },
                    { label: 'Grasa', value: fat ? `${fat}g` : '--' },
                    { label: 'Pasos', value: steps || '--' },
                    { label: 'Sueno', value: sleep ? `${sleep}h` : '--' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500 text-[.85rem]">{item.label}</span>
                      <span className="font-semibold text-[.85rem]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {objective && (
                <div className="mb-4">
                  <h4 className="text-[.8rem] text-gray-500 uppercase tracking-wider mb-2">Objetivo</h4>
                  <p className="text-[.85rem] text-gray-700">{objective}</p>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-[.8rem] text-gray-500 uppercase tracking-wider mb-2">Criterios de Entrada</h4>
                <div className="flex flex-col gap-0.5">
                  {(entryCriteriaByGoal[currentGoalKey] ?? []).filter((c) => entryStates[c.id]).map((c) => (
                    <div key={c.id} className="text-[.82rem] text-gray-600">🚪 {c.label}</div>
                  ))}
                  {(entryBodyComp.weight_kg || entryBodyComp.waist_cm) && (
                    <div className="text-[.82rem] text-gray-500 mt-1">📐 Baseline: {entryBodyComp.weight_kg ? `${entryBodyComp.weight_kg}kg` : ''} {entryBodyComp.body_fat_pct ? `${entryBodyComp.body_fat_pct}%bf` : ''} {entryBodyComp.waist_cm ? `${entryBodyComp.waist_cm}cm cintura` : ''}</div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-[.8rem] text-gray-500 uppercase tracking-wider mb-2">Progreso Semanal</h4>
                <div className="flex flex-col gap-0.5">
                  {(progressCriteriaByGoal[currentGoalKey]?.targets ?? []).filter((c) => progressTargetStates[c.id]).map((c) => (
                    <div key={c.id} className="text-[.82rem] text-gray-600">✅ {c.label}: {c.detail}</div>
                  ))}
                  {(progressCriteriaByGoal[currentGoalKey]?.warnings ?? []).filter((c) => progressWarningStates[c.id]).map((c) => (
                    <div key={c.id} className="text-[.82rem] text-warning">⚠️ {c.label}: {c.detail}</div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-[.8rem] text-gray-500 uppercase tracking-wider mb-2">Criterios de Salida</h4>
                <div className="flex flex-col gap-0.5">
                  {(exitCriteriaByGoal[currentGoalKey] ?? []).filter((c) => exitStates[c.id]).map((c) => (
                    <div key={c.id} className="text-[.82rem] text-gray-600">🏁 {c.label}</div>
                  ))}
                  {(exitTargets.weight_kg || exitTargets.waist_cm) && (
                    <div className="text-[.82rem] text-gray-500 mt-1">🎯 Metas: {exitTargets.weight_kg ? `${exitTargets.weight_kg}kg` : ''} {exitTargets.body_fat_pct ? `${exitTargets.body_fat_pct}%bf` : ''} {exitTargets.waist_cm ? `${exitTargets.waist_cm}cm cintura` : ''}</div>
                  )}
                  {exitNote && <div className="text-[.82rem] text-gray-600 mt-1">📝 {exitNote}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 shrink-0 pt-3.5 border-t border-gray-100 mt-auto">
          <button
            onClick={back}
            className="flex-1 inline-flex items-center justify-center py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] text-gray-500 bg-transparent cursor-pointer border-none hover:text-primary hover:bg-primary-light transition-all duration-200"
          >
            {step === 1 ? 'Cancelar' : '\u2190 Atras'}
          </button>
          <button
            onClick={next}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px disabled:opacity-60"
          >
            {step === 5 ? (saving ? 'Guardando...' : mode === 'edit' ? 'Guardar Cambios' : 'Crear Fase') : `Siguiente: ${stepLabels[step]} \u2192`}
          </button>
        </div>
      </div>
    </div>
  )
}
