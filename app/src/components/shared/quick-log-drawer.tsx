'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const fatigueLabels = [
  { value: 1, label: '1 \uD83D\uDCAA' },
  { value: 2, label: '2 Bien' },
  { value: 3, label: '3 Cargada' },
  { value: 4, label: '4 Dolorida' },
  { value: 5, label: '5 \uD83D\uDED1' },
]

const fatigueZoneOptions = [
  'Todo el cuerpo', 'Gluteos', 'Piernas', 'Espalda', 'Hombros', 'Pecho', 'Brazos', 'Core', 'Espalda baja', 'Rodillas',
]

interface QuickLogDrawerProps {
  open: boolean
  onClose: () => void
}

export function QuickLogDrawer({ open, onClose }: QuickLogDrawerProps) {
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [steps, setSteps] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [energy, setEnergy] = useState(3)
  const [hunger, setHunger] = useState(3)
  const [fatigue, setFatigue] = useState(0)
  const [fatigueZones, setFatigueZones] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [existingLogId, setExistingLogId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  // Load today's existing log
  const loadExisting = useCallback(async () => {
    if (!open) return
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const { data } = await supabase
        .from('daily_logs')
        .select(`*, fatigue_entries (*)`)
        .eq('user_id', userId)
        .eq('log_date', today)
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
      }
    } catch {
      // No existing log, that's fine
    }
  }, [open, today])

  useEffect(() => {
    loadExisting()
  }, [loadExisting])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setCalories('')
      setProtein('')
      setSteps('')
      setSleepHours('')
      setEnergy(3)
      setHunger(3)
      setFatigue(0)
      setFatigueZones([])
      setExistingLogId(null)
    }
  }, [open])

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
        log_date: today,
        calories: calories ? parseInt(calories) : null,
        protein_g: protein ? parseInt(protein) : null,
        steps: steps ? parseInt(steps) : null,
        sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
        energy,
        hunger,
        fatigue_level: fatigue || null,
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/35 z-[400] flex justify-end items-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card rounded-t-[var(--radius)] w-[420px] max-w-[100vw] p-7 shadow-[0_-8px_30px_rgba(0,0,0,.12)] slide-up fixed bottom-0 right-7 max-md:right-0 max-md:w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-[18px]">
          <div>
            <div className="font-extrabold text-[1.05rem] text-gray-800">Registro Diario Rapido</div>
            <div className="text-[.77rem] text-gray-400 capitalize">{todayLabel}</div>
          </div>
          <button onClick={onClose} className="text-[1.3rem] text-gray-400 p-1 cursor-pointer bg-transparent border-none hover:text-gray-600">&times;</button>
        </div>

        {existingLogId && (
          <div className="mb-3 py-1.5 px-3 bg-primary-light rounded-[var(--radius-xs)] text-[.78rem] text-primary-dark font-medium">
            Editando registro existente de hoy
          </div>
        )}

        {/* Inputs Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[.77rem] text-gray-400 block mb-1">Calorias</label>
            <input
              type="number"
              placeholder="1650"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[.77rem] text-gray-400 block mb-1">Proteina (g)</label>
            <input
              type="number"
              placeholder="120"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[.77rem] text-gray-400 block mb-1">Pasos</label>
            <input
              type="number"
              placeholder="10000"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
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
              onChange={(e) => setSleepHours(e.target.value)}
              className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Energy & Hunger */}
        <div className="grid grid-cols-2 gap-3 mb-[18px]">
          <div>
            <label className="text-[.77rem] text-gray-400 block mb-1.5">Energia</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnergy(n)}
                  className={`w-9 h-9 rounded-[var(--radius-sm)] border-[1.5px] font-semibold text-[.82rem] flex items-center justify-center cursor-pointer transition-all duration-200 ${
                    energy === n
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[.77rem] text-gray-400 block mb-1.5">Hambre</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setHunger(n)}
                  className={`w-9 h-9 rounded-[var(--radius-sm)] border-[1.5px] font-semibold text-[.82rem] flex items-center justify-center cursor-pointer transition-all duration-200 ${
                    hunger === n
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fatigue */}
        <div className="mb-4">
          <label className="text-[.77rem] text-gray-400 block mb-1.5">{'\uD83E\uDDD8'} Como esta tu cuerpo hoy?</label>
          <div className="flex gap-1.5 flex-wrap">
            {fatigueLabels.map((f) => (
              <button
                key={f.value}
                onClick={() => { setFatigue(f.value); if (f.value < 3) setFatigueZones([]) }}
                className={`h-9 px-2.5 rounded-[var(--radius-sm)] border-[1.5px] font-semibold text-[.78rem] flex items-center justify-center cursor-pointer transition-all duration-200 ${
                  fatigue === f.value
                    ? 'bg-primary text-white border-primary'
                    : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                }`}
              >
                {f.label}
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

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar Registro'}
        </button>
      </div>
    </div>
  )
}
