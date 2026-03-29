'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Phase } from '@/lib/supabase/types'

const muscleGroups = ['Glutes', 'Back', 'Quads', 'Hamstrings', 'Chest', 'Shoulders', 'Arms', 'Core', 'Calves']

const defaultVolume: Record<string, { mev: number; mav: number; mrv: number }> = {
  Glutes: { mev: 8, mav: 16, mrv: 22 },
  Back: { mev: 8, mav: 14, mrv: 20 },
  Quads: { mev: 6, mav: 12, mrv: 18 },
  Hamstrings: { mev: 4, mav: 10, mrv: 16 },
  Chest: { mev: 6, mav: 12, mrv: 18 },
  Shoulders: { mev: 6, mav: 12, mrv: 20 },
  Arms: { mev: 4, mav: 10, mrv: 16 },
  Core: { mev: 0, mav: 6, mrv: 12 },
  Calves: { mev: 6, mav: 10, mrv: 16 },
}

const exitCriteria = [
  { id: 'performance', title: 'Rendimiento en baja', sub: 'Fuerza baja por 3+ semanas consecutivas', defaultOn: true },
  { id: 'energy', title: 'Energia muy baja', sub: 'Energia \u2264 2/5 por 2+ semanas', defaultOn: true },
  { id: 'hunger', title: 'Hambre muy alto', sub: 'Hambre \u2265 4/5 por 3+ semanas', defaultOn: true },
  { id: 'weight', title: 'Peso estancado', sub: 'Sin cambio de peso por 2+ semanas a pesar de la adherencia', defaultOn: false },
  { id: 'goal', title: 'Objetivo alcanzado', sub: 'Peso o medida objetivo logrado', defaultOn: false },
]

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

export function PhaseWizard({ open, onClose, mode = 'create', existingPhase, macrocycleId }: PhaseWizardProps) {
  const isEdit = mode === 'edit' && existingPhase
  const [step, setStep] = useState(1)
  const [name, setName] = useState(isEdit ? existingPhase.name : '')
  const [objective, setObjective] = useState(isEdit ? (existingPhase.objective ?? '') : '')
  const [goal, setGoal] = useState(isEdit ? (goalMapReverse[existingPhase.goal] ?? 'Build / Volume') : 'Build / Volume')
  const [duration, setDuration] = useState(isEdit ? String(existingPhase.duration_weeks) : '6')
  const [frequency, setFrequency] = useState(isEdit ? String(existingPhase.frequency) : '3')
  const [split, setSplit] = useState('Full Body')
  const [focusMuscles, setFocusMuscles] = useState<string[]>(isEdit ? (existingPhase.focus_muscles ?? []) : [])
  const [volume, setVolume] = useState(defaultVolume)
  const [cal, setCal] = useState(isEdit && existingPhase.calorie_target ? String(existingPhase.calorie_target) : '')
  const [prot, setProt] = useState(isEdit && existingPhase.protein_target ? String(existingPhase.protein_target) : '')
  const [carbs, setCarbs] = useState(isEdit && existingPhase.carbs_target ? String(existingPhase.carbs_target) : '')
  const [fat, setFat] = useState(isEdit && existingPhase.fat_target ? String(existingPhase.fat_target) : '')
  const [protPct, setProtPct] = useState(30)
  const [carbsPct, setCarbsPct] = useState(40)
  const [fatPct, setFatPct] = useState(30)
  const [steps, setSteps] = useState(isEdit && existingPhase.step_goal ? String(existingPhase.step_goal) : '')
  const [sleep, setSleep] = useState(isEdit && existingPhase.sleep_goal ? String(existingPhase.sleep_goal) : '')
  const [exitStates, setExitStates] = useState<Record<string, boolean>>(
    Object.fromEntries(exitCriteria.map((c) => [c.id, c.defaultOn]))
  )
  const [exitNote, setExitNote] = useState(isEdit ? (existingPhase.custom_exit_notes ?? '') : '')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const stepLabels = ['Datos', 'Volumen', 'Nutricion', 'Salida', 'Revisar']

  function toggleFocus(muscle: string) {
    setFocusMuscles((prev) => prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle])
  }

  function updateVolume(muscle: string, field: 'mev' | 'mav' | 'mrv', value: string) {
    setVolume((prev) => ({ ...prev, [muscle]: { ...prev[muscle], [field]: parseInt(value) || 0 } }))
  }

  function toggleExit(id: string) {
    setExitStates((prev) => ({ ...prev, [id]: !prev[id] }))
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
        exit_criteria: exitCriteria.filter((c) => exitStates[c.id]).map((c) => c.id),
        custom_exit_notes: exitNote || null,
        volume_targets: volume,
      }

      if (isEdit) {
        const { error } = await supabase
          .from('phases')
          .update({ ...phaseData, updated_at: new Date().toISOString() })
          .eq('id', existingPhase.id)

        if (error) {
          console.error('Error updating phase:', error)
          alert('Error actualizando fase: ' + error.message)
          return
        }
      } else {
        // Deactivate existing active phases
        await supabase
          .from('phases')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('status', 'active')

        const { error } = await supabase
          .from('phases')
          .insert({
            ...phaseData,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          })

        if (error) {
          console.error('Error creating phase:', error)
          alert('Error creando fase: ' + error.message)
          return
        }
      }

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

  function back() {
    if (step > 1) setStep(step - 1)
    else onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[500] flex justify-center items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card rounded-[var(--radius)] w-[580px] max-w-[95vw] max-h-[85vh] p-[24px_28px] shadow-[var(--shadow-lg)] fade-scale flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-1.5 shrink-0">
          <h2 className="text-[1.1rem] font-extrabold">{mode === 'edit' ? 'Editar Fase' : 'Nueva Fase'}</h2>
          <button onClick={onClose} className="text-[1.3rem] text-gray-400 p-1 cursor-pointer bg-transparent border-none hover:text-gray-600">&times;</button>
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
                  <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none bg-card">
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

          {/* STEP 4: Exit Criteria */}
          {step === 4 && (
            <div className="fade-in">
              <h3 className="text-[.95rem] font-bold mb-1">Criterios de Salida</h3>
              <p className="text-[.77rem] text-gray-400 mb-4">Cuando deberia FitOS sugerir terminar esta fase?</p>

              <div className="flex flex-col gap-2">
                {exitCriteria.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-[12px_14px] bg-gray-50 rounded-[var(--radius-sm)]">
                    <button
                      onClick={() => toggleExit(c.id)}
                      className={`w-10 h-[22px] rounded-[11px] relative cursor-pointer border-none shrink-0 transition-colors duration-200 ${exitStates[c.id] ? 'bg-primary' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full transition-transform duration-200 ${exitStates[c.id] ? 'translate-x-[18px]' : ''}`} />
                    </button>
                    <div className="flex-1">
                      <div className="font-semibold text-[.85rem]">{c.title}</div>
                      <div className="text-[.78rem] text-gray-500">{c.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-[.77rem] text-gray-400 block mb-1">Nota de salida personalizada (opcional)</label>
                <textarea
                  value={exitNote}
                  onChange={(e) => setExitNote(e.target.value)}
                  placeholder="Ej: Terminar si la cintura baja de 66cm..."
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.87rem] text-gray-600 resize-y min-h-[60px] focus:border-primary focus:outline-none font-[inherit]"
                />
              </div>
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
                <h4 className="text-[.8rem] text-gray-500 uppercase tracking-wider mb-2">Criterios de Salida</h4>
                <div className="flex flex-col gap-1">
                  {exitCriteria.filter((c) => exitStates[c.id]).map((c) => (
                    <div key={c.id} className="text-[.85rem] text-gray-600">{'\u2705'} {c.title}</div>
                  ))}
                  {exitNote && <div className="text-[.85rem] text-gray-600 mt-1">{'\uD83D\uDCDD'} {exitNote}</div>}
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
