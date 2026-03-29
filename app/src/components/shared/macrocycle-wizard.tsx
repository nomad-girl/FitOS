'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MacrocycleWizardProps {
  open: boolean
  onClose: () => void
  existingMacro?: { id: string; name: string; year: number; duration_months?: number | null; notes: string | null } | null
}

export function MacrocycleWizard({ open, onClose, existingMacro }: MacrocycleWizardProps) {
  const isEdit = !!existingMacro
  const [name, setName] = useState(existingMacro?.name ?? '')
  const [year, setYear] = useState(existingMacro?.year ?? new Date().getFullYear())
  const [durationMonths, setDurationMonths] = useState(existingMacro?.duration_months ?? 12)
  const [notes, setNotes] = useState(existingMacro?.notes ?? '')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSave() {
    if (!name.trim()) {
      alert('Ponele un nombre al macrociclo')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const data = {
        user_id: userId,
        name: name.trim(),
        year,
        duration_months: durationMonths || 12,
        notes: notes.trim() || null,
      }

      if (isEdit && existingMacro) {
        const { error } = await supabase
          .from('macrocycles')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', existingMacro.id)
        if (error) {
          alert('Error actualizando macrociclo: ' + error.message)
          return
        }
      } else {
        const { error } = await supabase
          .from('macrocycles')
          .insert(data)
        if (error) {
          alert('Error creando macrociclo: ' + error.message)
          return
        }
      }

      onClose()
    } catch (err) {
      console.error(err)
      alert('Error guardando macrociclo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[500] flex justify-center items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card rounded-[var(--radius)] w-[460px] max-w-[95vw] p-[28px_32px] shadow-[var(--shadow-lg)] fade-scale flex flex-col gap-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-[1.1rem] font-extrabold">{isEdit ? 'Editar Macrociclo' : 'Nuevo Macrociclo'}</h2>
          <button onClick={onClose} className="text-[1.3rem] text-gray-400 p-1 cursor-pointer bg-transparent border-none hover:text-gray-600">&times;</button>
        </div>

        <p className="text-[.82rem] text-gray-500 -mt-2">
          Tu plan de entrenamiento a largo plazo. Contiene las fases (mesociclos) que vas a ir recorriendo.
        </p>

        <div>
          <label className="text-[.77rem] text-gray-400 block mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej: Plan Abr-Dic 2026, Prep Competencia, etc."
            className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[.77rem] text-gray-400 block mb-1">Duracion (meses)</label>
            <input
              type="number"
              value={durationMonths}
              onChange={(e) => setDurationMonths(parseInt(e.target.value) || 12)}
              min={1}
              max={24}
              className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[.77rem] text-gray-400 block mb-1">Año de inicio</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              min={2020}
              max={2030}
              className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[.77rem] text-gray-400 block mb-1">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Objetivos generales, contexto, etc."
            rows={3}
            className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.87rem] text-gray-600 resize-y min-h-[60px] focus:border-primary focus:outline-none font-[inherit]"
          />
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] text-gray-500 bg-transparent cursor-pointer border-none hover:text-primary hover:bg-primary-light transition-all duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px disabled:opacity-60"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear Macrociclo'}
          </button>
        </div>
      </div>
    </div>
  )
}
