'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayLocal, dateToLocal } from '@/lib/date-utils'
import { stimulusLabel, stimulusColor } from '@/lib/recovery'

const hungerOptions = [
  { value: 1, label: '1 \u00B7 No tuve hambre / me cost\u00F3 comer' },
  { value: 2, label: '2 \u00B7 Hambre normal (solo en comidas)' },
  { value: 3, label: '3 \u00B7 Tuve hambre entre comidas' },
  { value: 4, label: '4 \u00B7 Hambre frecuente / dif\u00EDcil de ignorar' },
  { value: 5, label: '5 \u00B7 Hambre constante / muy intensa' },
]

const energyOptions = [
  { value: 5, label: '5 \u00B7 Muy alta (me sent\u00ED activa todo el d\u00EDa)' },
  { value: 4, label: '4 \u00B7 Buena (rend\u00ED bien)' },
  { value: 3, label: '3 \u00B7 Normal (d\u00EDa ok)' },
  { value: 2, label: '2 \u00B7 Baja (me cost\u00F3 funcionar)' },
  { value: 1, label: '1 \u00B7 Muy baja (agotada)' },
]

const fatigueOptions = [
  { value: 1, label: '1 \u00B7 Liviana / recuperada' },
  { value: 2, label: '2 \u00B7 Normal' },
  { value: 3, label: '3 \u00B7 Algo cargada' },
  { value: 4, label: '4 \u00B7 Cargada' },
  { value: 5, label: '5 \u00B7 Muy cargada / fatigada' },
]

const moodOptions = [
  { value: 5, label: '5 \u00B7 Excelente (motivada, positiva)' },
  { value: 4, label: '4 \u00B7 Bien' },
  { value: 3, label: '3 \u00B7 Normal' },
  { value: 2, label: '2 \u00B7 Baja (desmotivada, irritable)' },
  { value: 1, label: '1 \u00B7 Muy baja (ansiosa, abrumada)' },
]

const fatigueUpperOptions = [
  { value: 1, label: '1 \u00B7 Fresco' },
  { value: 2, label: '2 \u00B7 Normal' },
  { value: 3, label: '3 \u00B7 Algo cargado' },
  { value: 4, label: '4 \u00B7 Cargado' },
  { value: 5, label: '5 \u00B7 Muy cargado' },
]

const fatigueLowerOptions = [
  { value: 1, label: '1 \u00B7 Fresco' },
  { value: 2, label: '2 \u00B7 Normal' },
  { value: 3, label: '3 \u00B7 Algo cargado' },
  { value: 4, label: '4 \u00B7 Cargado' },
  { value: 5, label: '5 \u00B7 Muy cargado' },
]

interface TrainingInfo {
  name: string | null
  volume: number | null
  sets: number | null
  rpeAvg: number | null
  rpeMax: number | null
  stimulus: string | null
  muscleGroups: string[] | null
  prCount: number | null
}

const fatigueZoneOptions = [
  'Todo el cuerpo', 'Gluteos', 'Piernas', 'Espalda', 'Hombros', 'Pecho', 'Brazos', 'Core', 'Espalda baja', 'Rodillas',
]

interface QuickLogDrawerProps {
  open: boolean
  onClose: () => void
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return dateToLocal(d)
}

const LOG_DRAFT_KEY = 'fitos:quick-log-draft'

export function QuickLogDrawer({ open, onClose }: QuickLogDrawerProps) {
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [steps, setSteps] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [energy, setEnergy] = useState(3)
  const [hunger, setHunger] = useState(3)
  const [fatigue, setFatigue] = useState(0)
  const [fatigueZones, setFatigueZones] = useState<string[]>([])
  const [mood, setMood] = useState(3)
  const [fatigueUpper, setFatigueUpper] = useState(0)
  const [fatigueLower, setFatigueLower] = useState(0)
  const [trainingVariant, setTrainingVariant] = useState('')
  const [trainingVolume, setTrainingVolume] = useState('')
  const [prCount, setPrCount] = useState('')
  const [trainingInfo, setTrainingInfo] = useState<TrainingInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [existingLogId, setExistingLogId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const today = useMemo(() => todayLocal(), [])
  const [selectedDate, setSelectedDate] = useState(today)

  const isToday = selectedDate === today

  const selectedDateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00')
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }, [selectedDate])

  function resetFields() {
    setCalories('')
    setProtein('')
    setSteps('')
    setSleepHours('')
    setEnergy(3)
    setHunger(3)
    setMood(3)
    setFatigue(0)
    setFatigueUpper(0)
    setFatigueLower(0)
    setFatigueZones([])
    setTrainingVariant('')
    setTrainingVolume('')
    setPrCount('')
    setTrainingInfo(null)
    setExistingLogId(null)
  }

  function goToPrevDay() {
    setSelectedDate((prev) => addDays(prev, -1))
  }

  function goToNextDay() {
    setSelectedDate((prev) => {
      const next = addDays(prev, 1)
      if (next > today) return prev
      return next
    })
  }

  // Load existing log for selectedDate
  const loadExisting = useCallback(async () => {
    if (!open) return
    setLoading(true)
    resetFields()
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const { data } = await supabase
        .from('daily_logs')
        .select(`*, fatigue_entries (*)`)
        .eq('user_id', userId)
        .eq('log_date', selectedDate)
        .single()

      if (data) {
        setExistingLogId(data.id)
        if (data.calories != null) setCalories(String(data.calories))
        if (data.protein_g != null) setProtein(String(data.protein_g))
        if (data.steps != null) setSteps(String(data.steps))
        if (data.sleep_hours != null) setSleepHours(String(data.sleep_hours))
        if (data.energy != null) setEnergy(data.energy)
        if (data.hunger != null) setHunger(data.hunger)
        if (data.fatigue_level != null) setFatigue(data.fatigue_level)
        if (data.fatigue_entries && data.fatigue_entries.length > 0) {
          setFatigueZones(data.fatigue_entries.map((e: { zone: string }) => e.zone))
        }
        if (data.training_variant) setTrainingVariant(data.training_variant)
        if (data.training_volume_kg != null) setTrainingVolume(String(data.training_volume_kg))
        if (data.pr_count != null) setPrCount(String(data.pr_count))
        if (data.mood != null) setMood(data.mood)
        if (data.fatigue_upper != null) setFatigueUpper(data.fatigue_upper)
        if (data.fatigue_lower != null) setFatigueLower(data.fatigue_lower)

        // Load auto-detected training info
        if (data.training_name || data.training_stimulus) {
          setTrainingInfo({
            name: data.training_name,
            volume: data.training_volume_kg,
            sets: data.training_sets,
            rpeAvg: data.training_rpe_avg,
            rpeMax: data.training_rpe_max,
            stimulus: data.training_stimulus,
            muscleGroups: data.training_muscle_groups,
            prCount: data.pr_count,
          })
        }
      }
    } catch {
      // No existing log, that's fine
    } finally {
      setLoading(false)
    }
  }, [open, selectedDate])

  useEffect(() => {
    loadExisting()
  }, [loadExisting])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      resetFields()
      setSelectedDate(todayLocal())
      setHasUnsavedChanges(false)
    }
  }, [open])

  // Auto-save draft to localStorage when form has data and no existing log
  useEffect(() => {
    if (!open || existingLogId || loading) return
    const hasData = calories || protein || steps || sleepHours
    if (!hasData) return
    const timer = setTimeout(() => {
      localStorage.setItem(LOG_DRAFT_KEY, JSON.stringify({
        selectedDate, calories, protein, steps, sleepHours, energy, hunger, fatigue, fatigueZones,
        _savedAt: Date.now(),
      }))
    }, 500)
    return () => clearTimeout(timer)
  }, [open, existingLogId, loading, selectedDate, calories, protein, steps, sleepHours, energy, hunger, fatigue, fatigueZones])

  // Load draft on open if no existing log for today
  useEffect(() => {
    if (!open || loading || existingLogId) return
    try {
      const raw = localStorage.getItem(LOG_DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      // Only restore if same date and less than 24h old
      if (draft.selectedDate !== selectedDate) return
      if (draft._savedAt && Date.now() - draft._savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(LOG_DRAFT_KEY)
        return
      }
      if (draft.calories) setCalories(draft.calories)
      if (draft.protein) setProtein(draft.protein)
      if (draft.steps) setSteps(draft.steps)
      if (draft.sleepHours) setSleepHours(draft.sleepHours)
      if (draft.energy) setEnergy(draft.energy)
      if (draft.hunger) setHunger(draft.hunger)
      if (draft.fatigue) setFatigue(draft.fatigue)
      if (draft.fatigueZones) setFatigueZones(draft.fatigueZones)
    } catch { /* ignore */ }
  }, [open, loading, existingLogId, selectedDate])

  // Track unsaved changes
  const markChanged = useCallback(() => setHasUnsavedChanges(true), [])

  function handleClose() {
    if (hasUnsavedChanges) {
      if (!window.confirm('Tenes cambios sin guardar. Cerrar de todas formas?')) return
    }
    onClose()
  }

  function toggleZone(zone: string) {
    setFatigueZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const logData = {
        user_id: userId,
        log_date: selectedDate,
        calories: calories ? parseInt(calories) : null,
        protein_g: protein ? parseInt(protein) : null,
        steps: steps ? parseInt(steps) : null,
        sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
        energy,
        hunger,
        mood,
        fatigue_level: fatigue || null,
        fatigue_upper: fatigueUpper || null,
        fatigue_lower: fatigueLower || null,
        training_variant: trainingVariant || null,
        training_volume_kg: trainingVolume ? parseInt(trainingVolume) : null,
        pr_count: prCount ? parseInt(prCount) : null,
        updated_at: new Date().toISOString(),
      }

      const { data: savedLog, error } = await supabase
        .from('daily_logs')
        .upsert(logData, { onConflict: 'user_id,log_date' })
        .select()
        .single()

      if (error) {
        console.error('Error saving daily log:', error)
        alert('Error guardando el registro: ' + error.message)
        return
      }

      localStorage.removeItem(LOG_DRAFT_KEY)
      setHasUnsavedChanges(false)
      // Notify dashboard to refresh data
      window.dispatchEvent(new CustomEvent('daily-log-saved'))

      // Save fatigue entries if fatigue >= 3
      if (savedLog && fatigue >= 3 && fatigueZones.length > 0) {
        // Delete existing fatigue entries
        await supabase
          .from('fatigue_entries')
          .delete()
          .eq('daily_log_id', savedLog.id)

        // Insert new ones
        await supabase.from('fatigue_entries').insert(
          fatigueZones.map((zone) => ({
            daily_log_id: savedLog.id,
            zone,
          }))
        )
      } else if (savedLog && fatigue < 3) {
        // Clear fatigue entries if fatigue is low
        await supabase
          .from('fatigue_entries')
          .delete()
          .eq('daily_log_id', savedLog.id)
      }

      onClose()
    } catch (err) {
      console.error('Error saving:', err)
      alert('Error guardando el registro')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existingLogId) return
    const confirmed = window.confirm(`Eliminar registro del ${selectedDateLabel}?`)
    if (!confirmed) return

    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Delete associated fatigue_entries first
      await supabase
        .from('fatigue_entries')
        .delete()
        .eq('daily_log_id', existingLogId)

      // Delete the daily_log row
      const { error } = await supabase
        .from('daily_logs')
        .delete()
        .eq('id', existingLogId)
        .eq('user_id', userId)

      if (error) {
        console.error('Error deleting daily log:', error)
        alert('Error eliminando el registro: ' + error.message)
        return
      }

      onClose()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Error eliminando el registro')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/35 z-[400] flex justify-end items-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-card rounded-t-[var(--radius)] w-[420px] max-w-[100vw] max-h-[90vh] overflow-y-auto p-7 shadow-[0_-8px_30px_rgba(0,0,0,.12)] slide-up fixed bottom-0 right-7 max-md:right-0 max-md:w-full" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="font-extrabold text-[1.05rem] text-gray-800">Registro Diario Rapido</div>
          </div>
          <button onClick={handleClose} className="text-[1.3rem] text-gray-400 p-1 cursor-pointer bg-transparent border-none hover:text-gray-600">&times;</button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2 mb-[18px]">
          <button
            onClick={goToPrevDay}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] border-[1.5px] border-gray-200 text-gray-500 bg-transparent cursor-pointer hover:border-primary hover:text-primary transition-all duration-200 text-[1rem] font-bold"
            title="Dia anterior"
          >
            &#8249;
          </button>
          <div className="flex-1 text-center">
            <span className="text-[.82rem] text-gray-600 font-medium capitalize">{selectedDateLabel}</span>
            {isToday && (
              <span className="ml-2 inline-block py-0.5 px-2 bg-primary/15 text-primary text-[.7rem] font-semibold rounded-full">
                Hoy
              </span>
            )}
          </div>
          <button
            onClick={goToNextDay}
            disabled={isToday}
            className={`w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] border-[1.5px] border-gray-200 bg-transparent cursor-pointer transition-all duration-200 text-[1rem] font-bold ${
              isToday
                ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                : 'text-gray-500 hover:border-primary hover:text-primary'
            }`}
            title="Dia siguiente"
          >
            &#8250;
          </button>
        </div>

        {existingLogId && (
          <div className="mb-3 py-1.5 px-3 bg-primary-light rounded-[var(--radius-xs)] text-[.78rem] text-primary-dark font-medium">
            {isToday ? 'Editando registro existente de hoy' : 'Editando registro existente'}
          </div>
        )}

        {loading ? (
          <div className="py-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-16 mb-2" />
                  <div className="bg-gray-200 animate-pulse rounded-[var(--radius-sm)] h-10 w-full" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[1, 2].map((i) => (
                <div key={i}>
                  <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-16 mb-2" />
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="bg-gray-200 animate-pulse rounded-[var(--radius-sm)] w-9 h-9" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-200 animate-pulse rounded-[var(--radius-sm)] h-12 w-full" />
          </div>
        ) : (
          <>
            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Calorias</label>
                <input
                  type="number"
                  placeholder="1650"
                  value={calories}
                  onChange={(e) => { setCalories(e.target.value); markChanged() }}
                  className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Proteina (g)</label>
                <input
                  type="number"
                  placeholder="120"
                  value={protein}
                  onChange={(e) => { setProtein(e.target.value); markChanged() }}
                  className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Pasos</label>
                <input
                  type="number"
                  placeholder="10000"
                  value={steps}
                  onChange={(e) => { setSteps(e.target.value); markChanged() }}
                  className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Sueno (hrs)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="7.5"
                  value={sleepHours}
                  onChange={(e) => { setSleepHours(e.target.value); markChanged() }}
                  className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Entrenamiento (auto from Hevy or manual) */}
            {/* Auto-detected training from Hevy (read-only) */}
            {trainingInfo && (
              <div className="mb-[18px] rounded-[var(--radius)] border-[1.5px] border-gray-200 p-3.5 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[.77rem] text-gray-400">{'\uD83C\uDFCB\uFE0F'} Entrenamiento (Hevy)</label>
                  {trainingInfo.stimulus && (
                    <span
                      className="text-[.7rem] font-bold px-2.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: stimulusColor[trainingInfo.stimulus as keyof typeof stimulusColor] || '#6B7280' }}
                    >
                      {stimulusLabel[trainingInfo.stimulus as keyof typeof stimulusLabel] || trainingInfo.stimulus}
                    </span>
                  )}
                </div>
                {trainingInfo.name && (
                  <div className="font-semibold text-[.9rem] text-gray-800 mb-1.5">{trainingInfo.name}</div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[.65rem] text-gray-400">Volumen</div>
                    <div className="font-bold text-[.88rem] text-gray-700">
                      {trainingInfo.volume ? `${Math.round(trainingInfo.volume / 1000 * 10) / 10}t` : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[.65rem] text-gray-400">Sets</div>
                    <div className="font-bold text-[.88rem] text-gray-700">{trainingInfo.sets ?? '--'}</div>
                  </div>
                  <div>
                    <div className="text-[.65rem] text-gray-400">RPE avg/max</div>
                    <div className="font-bold text-[.88rem] text-gray-700">
                      {trainingInfo.rpeAvg ?? '--'}/{trainingInfo.rpeMax ?? '--'}
                    </div>
                  </div>
                </div>
                {trainingInfo.muscleGroups && trainingInfo.muscleGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {trainingInfo.muscleGroups.map((mg) => (
                      <span key={mg} className="text-[.65rem] bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full">{mg}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Estado de Animo */}
            <div className="mb-[18px]">
              <label className="text-[.77rem] text-gray-400 block mb-1">{'\uD83D\uDE0A'} Como fue tu animo hoy?</label>
              <div className="flex flex-col gap-1.5">
                {moodOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setMood(opt.value); markChanged() }}
                    className={`w-full text-left py-2 px-3 rounded-[var(--radius-sm)] border-[1.5px] text-[.82rem] font-medium cursor-pointer transition-all duration-200 ${
                      mood === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hambre - guided */}
            <div className="mb-[18px]">
              <label className="text-[.77rem] text-gray-400 block mb-1">{'\uD83C\uDF7D\uFE0F'} Como fue tu hambre hoy?</label>
              <div className="flex flex-col gap-1.5">
                {hungerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setHunger(opt.value); markChanged() }}
                    className={`w-full text-left py-2 px-3 rounded-[var(--radius-sm)] border-[1.5px] text-[.82rem] font-medium cursor-pointer transition-all duration-200 ${
                      hunger === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Energia - guided */}
            <div className="mb-[18px]">
              <label className="text-[.77rem] text-gray-400 block mb-1">{'\u26A1'} Como estuvo tu energia hoy?</label>
              <div className="flex flex-col gap-1.5">
                {energyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setEnergy(opt.value); markChanged() }}
                    className={`w-full text-left py-2 px-3 rounded-[var(--radius-sm)] border-[1.5px] text-[.82rem] font-medium cursor-pointer transition-all duration-200 ${
                      energy === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fatiga - guided */}
            <div className="mb-4">
              <label className="text-[.77rem] text-gray-400 block mb-1">{'\uD83E\uDDD8'} Como sentis el cuerpo hoy?</label>
              <div className="flex flex-col gap-1.5">
                {fatigueOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFatigue(opt.value); if (opt.value < 3) setFatigueZones([]); markChanged() }}
                    className={`w-full text-left py-2 px-3 rounded-[var(--radius-sm)] border-[1.5px] text-[.82rem] font-medium cursor-pointer transition-all duration-200 ${
                      fatigue === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fatigue Zones (appear when >= 3) */}
            {fatigue >= 3 && (
              <div className="mb-4 fade-in">
                <label className="text-[.77rem] text-gray-400 block mb-1.5">Donde sentis fatiga/dolor?</label>
                <div className="flex flex-wrap gap-1.5">
                  {fatigueZoneOptions.map((zone) => (
                    <button
                      key={zone}
                      onClick={() => toggleZone(zone)}
                      className={`py-[7px] px-4 rounded-full border-[1.5px] text-[.78rem] font-medium cursor-pointer transition-all duration-200 ${
                        fatigueZones.includes(zone)
                          ? 'bg-primary-light border-primary text-primary-dark'
                          : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                      }`}
                    >
                      {zone}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fatiga Tren Superior */}
            <div className="mb-[18px]">
              <label className="text-[.77rem] text-gray-400 block mb-1">{'\uD83D\uDCAA'} Fatiga tren superior</label>
              <div className="flex gap-1.5">
                {fatigueUpperOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFatigueUpper(opt.value); markChanged() }}
                    className={`flex-1 py-2 rounded-[var(--radius-sm)] border-[1.5px] text-[.78rem] font-medium cursor-pointer transition-all duration-200 ${
                      fatigueUpper === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {opt.value}
                  </button>
                ))}
              </div>
              {fatigueUpper > 0 && (
                <div className="text-[.72rem] text-gray-400 mt-1">{fatigueUpperOptions.find(o => o.value === fatigueUpper)?.label}</div>
              )}
            </div>

            {/* Fatiga Tren Inferior */}
            <div className="mb-4">
              <label className="text-[.77rem] text-gray-400 block mb-1">{'\uD83E\uDDB5'} Fatiga tren inferior</label>
              <div className="flex gap-1.5">
                {fatigueLowerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFatigueLower(opt.value); markChanged() }}
                    className={`flex-1 py-2 rounded-[var(--radius-sm)] border-[1.5px] text-[.78rem] font-medium cursor-pointer transition-all duration-200 ${
                      fatigueLower === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {opt.value}
                  </button>
                ))}
              </div>
              {fatigueLower > 0 && (
                <div className="text-[.72rem] text-gray-400 mt-1">{fatigueLowerOptions.find(o => o.value === fatigueLower)?.label}</div>
              )}
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar Registro'}
            </button>

            {/* Delete (only when editing an existing log) */}
            {existingLogId && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-2.5 rounded-[var(--radius-sm)] font-semibold text-[.84rem] text-danger bg-transparent border-[1.5px] border-danger/30 cursor-pointer transition-all duration-200 hover:bg-danger-light hover:border-danger disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {deleting ? 'Eliminando...' : 'Eliminar Registro'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
