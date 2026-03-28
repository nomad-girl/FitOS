'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Phase, WeeklyCheckin, DailyLog } from '@/lib/supabase/types'

type PerformanceTrend = 'down' | 'stable' | 'up'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export default function CheckinPage() {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrend>('stable')
  const [volumeDecision, setVolumeDecision] = useState('Mantener actual')
  const [nutritionDecision, setNutritionDecision] = useState('Mantener calorias')
  const [phaseDecision, setPhaseDecision] = useState('Continuar')
  const [decisionNotes, setDecisionNotes] = useState('')
  const [checkinNotes, setCheckinNotes] = useState('')

  // Body measurements
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')
  const [thigh, setThigh] = useState('')

  // Data
  const [activePhase, setActivePhase] = useState<Phase | null>(null)
  const [weeklyLogs, setWeeklyLogs] = useState<DailyLog[]>([])
  const [existingCheckin, setExistingCheckin] = useState<WeeklyCheckin | null>(null)
  const [averages, setAverages] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingDecision, setSavingDecision] = useState(false)

  const weekStart = getWeekStart(new Date())

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Fetch active phase
      const { data: phaseData } = await supabase
        .from('phases')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (phaseData) {
        setActivePhase(phaseData)

        // Compute week number
        let weekNum = 1
        if (phaseData.start_date) {
          const startDate = new Date(phaseData.start_date)
          weekNum = Math.max(1, Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)))
        }

        // Fetch existing checkin
        const { data: checkinData } = await supabase
          .from('weekly_checkins')
          .select('*')
          .eq('user_id', userId)
          .eq('phase_id', phaseData.id)
          .eq('week_number', weekNum)
          .single()

        if (checkinData) {
          setExistingCheckin(checkinData)
          if (checkinData.weight_kg) setWeight(String(checkinData.weight_kg))
          if (checkinData.waist_cm) setWaist(String(checkinData.waist_cm))
          if (checkinData.hip_cm) setHip(String(checkinData.hip_cm))
          if (checkinData.thigh_cm) setThigh(String(checkinData.thigh_cm))
          if (checkinData.performance_trend) setPerformanceTrend(checkinData.performance_trend as PerformanceTrend)
          if (checkinData.notes) setCheckinNotes(checkinData.notes)
        }
      }

      // Fetch weekly logs
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', weekStart)
        .lte('log_date', weekEndStr)
        .order('log_date', { ascending: true })

      if (logs) {
        setWeeklyLogs(logs)
        // Compute averages
        const avg = (values: (number | null)[]) => {
          const valid = values.filter((v): v is number => v !== null)
          if (valid.length === 0) return null
          return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
        }

        setAverages({
          avg_calories: avg(logs.map((l) => l.calories)) !== null ? Math.round(avg(logs.map((l) => l.calories))!) : null,
          avg_protein: avg(logs.map((l) => l.protein_g)) !== null ? Math.round(avg(logs.map((l) => l.protein_g))!) : null,
          avg_steps: avg(logs.map((l) => l.steps)) !== null ? Math.round(avg(logs.map((l) => l.steps))!) : null,
          avg_sleep_hours: avg(logs.map((l) => l.sleep_hours)),
          avg_energy: avg(logs.map((l) => l.energy)),
          avg_hunger: avg(logs.map((l) => l.hunger)),
          avg_fatigue: avg(logs.map((l) => l.fatigue_level)),
        })
      }
    } catch (err) {
      console.error('Error fetching checkin data:', err)
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  let weekNumber = 1
  if (activePhase?.start_date) {
    const startDate = new Date(activePhase.start_date)
    weekNumber = Math.max(1, Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)))
  }

  async function handleSaveCheckin(showAnalysisAfter: boolean) {
    if (!activePhase) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const checkinData = {
        user_id: userId,
        phase_id: activePhase.id,
        week_number: weekNumber,
        checkin_date: weekStart,
        weight_kg: weight ? parseFloat(weight) : null,
        waist_cm: waist ? parseFloat(waist) : null,
        hip_cm: hip ? parseFloat(hip) : null,
        thigh_cm: thigh ? parseFloat(thigh) : null,
        performance_trend: performanceTrend,
        avg_calories: averages.avg_calories ?? null,
        avg_protein: averages.avg_protein ?? null,
        avg_steps: averages.avg_steps ?? null,
        avg_sleep_hours: averages.avg_sleep_hours ?? null,
        avg_energy: averages.avg_energy ?? null,
        avg_hunger: averages.avg_hunger ?? null,
        avg_fatigue: averages.avg_fatigue ?? null,
        notes: checkinNotes || null,
        updated_at: new Date().toISOString(),
      }

      const { data: savedCheckin, error } = await supabase
        .from('weekly_checkins')
        .upsert(checkinData, { onConflict: 'user_id,phase_id,week_number' })
        .select()
        .single()

      if (error) {
        console.error('Error saving checkin:', error)
        alert('Error guardando check-in: ' + error.message)
        return
      }

      setExistingCheckin(savedCheckin)
      if (showAnalysisAfter) setShowAnalysis(true)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDecision() {
    if (!existingCheckin) return
    setSavingDecision(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Delete existing decisions
      await supabase
        .from('weekly_decisions')
        .delete()
        .eq('checkin_id', existingCheckin.id)

      const { error } = await supabase
        .from('weekly_decisions')
        .insert({
          checkin_id: existingCheckin.id,
          user_id: userId,
          volume_decisions: [volumeDecision],
          nutrition_decisions: [nutritionDecision],
          phase_decisions: [phaseDecision],
          notes: decisionNotes || null,
          context_snapshot: {
            weight_kg: weight ? parseFloat(weight) : null,
            waist_cm: waist ? parseFloat(waist) : null,
            weekly_score: existingCheckin.weekly_score,
            week_number: weekNumber,
          },
        })

      if (error) {
        console.error('Error saving decision:', error)
        alert('Error guardando decision: ' + error.message)
        return
      }

      alert('Decision registrada!')
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setSavingDecision(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        <div className="text-gray-400 text-[.9rem]">Cargando check-in...</div>
      </main>
    )
  }

  const calGoal = activePhase?.calorie_target
  const protGoal = activePhase?.protein_target
  const stepGoal = activePhase?.step_goal
  const sleepGoal = activePhase?.sleep_goal

  return (
    <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
      {/* Page Header */}
      <div className="mb-7">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Check-in Semanal</h1>
            <p className="text-gray-500 text-[.9rem] mt-1">
              Semana {weekNumber} &middot; {activePhase?.name ?? 'Sin fase activa'}
            </p>
          </div>
        </div>
      </div>

      {!showAnalysis ? (
        <div className="fade-in">
          {/* 1. Body Measurements */}
          <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4 flex items-center gap-2">Medidas Corporales</div>
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="53.7"
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] font-medium focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Cintura (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                  placeholder="67.5"
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] font-medium focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Cadera (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hip}
                  onChange={(e) => setHip(e.target.value)}
                  placeholder="92.0"
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] font-medium focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Muslo (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={thigh}
                  onChange={(e) => setThigh(e.target.value)}
                  placeholder="54.5"
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] font-medium focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Weekly Averages */}
          <div className="bg-gray-50 rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4 flex items-center gap-2">
              Promedios Semanales
              <span className="inline-flex px-2.5 py-[3px] rounded-full text-[.7rem] font-semibold bg-gray-100 text-gray-600">
                Auto-calculado de {weeklyLogs.length} registros
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[.87rem] max-sm:grid-cols-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Calorias</span>
                <span>
                  <strong>{averages.avg_calories ?? '--'}</strong>
                  {calGoal && <span className="text-[.77rem] text-gray-400"> (objetivo: {calGoal})</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Proteina</span>
                <span>
                  <strong>{averages.avg_protein ?? '--'}g</strong>
                  {protGoal && <span className="text-[.77rem] text-gray-400"> (objetivo: {protGoal}g)</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pasos</span>
                <span>
                  <strong>{averages.avg_steps ? averages.avg_steps.toLocaleString() : '--'}</strong>
                  {stepGoal && <span className="text-[.77rem] text-gray-400"> ({Math.round(((averages.avg_steps ?? 0) / stepGoal) * 100)}%)</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sueno</span>
                <span>
                  <strong>{averages.avg_sleep_hours ?? '--'}h</strong>
                  {sleepGoal && <span className="text-[.77rem] text-gray-400"> ({Math.round(((averages.avg_sleep_hours ?? 0) / sleepGoal) * 100)}%)</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Energia</span>
                <span><strong>{averages.avg_energy ?? '--'}</strong> avg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Hambre</span>
                <span><strong>{averages.avg_hunger ?? '--'}</strong> avg</span>
              </div>
            </div>
          </div>

          {/* 3. Performance Trend */}
          <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Tendencia de Rendimiento</div>
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'down' as const, label: '\u2193 En baja' },
                { id: 'stable' as const, label: '\u2194\uFE0F Estable' },
                { id: 'up' as const, label: '\u2191 Mejorando' },
              ]).map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setPerformanceTrend(chip.id)}
                  className={`py-[7px] px-4 rounded-full border-[1.5px] text-[.84rem] font-medium cursor-pointer transition-all duration-200 ${
                    performanceTrend === chip.id
                      ? 'bg-primary-light border-primary text-primary-dark'
                      : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Notes */}
          <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Notas</div>
            <textarea
              className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.87rem] text-gray-600 resize-y min-h-[80px] focus:border-primary focus:outline-none font-[inherit]"
              placeholder="Como fue la semana? Algo notable?"
              value={checkinNotes}
              onChange={(e) => setCheckinNotes(e.target.value)}
            />
          </div>

          {/* 5. Actions */}
          <div className="flex gap-2.5">
            <button
              onClick={() => handleSaveCheckin(true)}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar y Ver Analisis'}
            </button>
            <button
              onClick={() => handleSaveCheckin(false)}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] text-gray-500 bg-transparent cursor-pointer border-none hover:text-primary hover:bg-primary-light transition-all duration-200 disabled:opacity-60"
            >
              Solo Guardar
            </button>
          </div>
        </div>
      ) : (
        /* Analysis View */
        <div className="fade-in">
          <button
            onClick={() => setShowAnalysis(false)}
            className="text-gray-500 font-semibold text-[.82rem] mb-4 cursor-pointer hover:text-primary transition-colors bg-transparent border-none -ml-2 py-1 px-2"
          >
            &larr; Volver al Check-in
          </button>

          {/* Summary Card */}
          <div className="bg-gray-50 border-[1.5px] border-gray-200 rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px] leading-[1.7]">
            <div className="font-extrabold text-[1.08rem] mb-4 text-gray-900">{'\uD83E\uDDE0'} Resumen Semanal</div>
            <div className="text-[.9rem] text-gray-700">
              <strong className="text-gray-900">Semana {weekNumber} — {activePhase?.name}</strong>
              <br /><br />
              {weight && <>{'\uD83D\uDCCA'} <strong>Peso:</strong> {weight} kg<br /></>}
              {waist && <>{'\uD83D\uDCCF'} <strong>Cintura:</strong> {waist} cm<br /></>}
              <br />
              {averages.avg_calories != null && <>{'\uD83C\uDF4E'} <strong>Calorias:</strong> Prom. {averages.avg_calories} kcal/dia{calGoal ? ` (${Math.round((averages.avg_calories / calGoal) * 100)}% del objetivo)` : ''}<br /></>}
              {averages.avg_protein != null && <>{'\uD83E\uDD69'} <strong>Proteina:</strong> Prom. {averages.avg_protein}g{protGoal ? ` (${Math.round((averages.avg_protein / protGoal) * 100)}% del objetivo)` : ''}<br /></>}
              <br />
              {averages.avg_energy != null && <>{'\u26A1'} <strong>Energia:</strong> {averages.avg_energy}/5<br /></>}
              {averages.avg_hunger != null && <>{'\uD83C\uDF54'} <strong>Hambre:</strong> {averages.avg_hunger}/5<br /></>}
              <br />
              <div className="mt-1 p-[12px_14px] bg-primary-light rounded-[var(--radius-xs)] border-l-[3px] border-primary">
                <strong className="text-primary-dark">Tendencia:</strong>{' '}
                <span className="text-gray-700">
                  {performanceTrend === 'up' ? 'Mejorando — buen progreso!' :
                   performanceTrend === 'down' ? 'En baja — considerar ajustes.' :
                   'Estable — mantener el rumbo.'}
                </span>
              </div>
            </div>
          </div>

          {/* Decisions */}
          <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-[18px]">
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Decisiones</div>

            <div className="mb-4">
              <div className="text-[.77rem] text-gray-400 mb-2 uppercase font-semibold">Volumen</div>
              <div className="flex flex-wrap gap-2">
                {['Mantener actual', '+ Volumen de gluteos', '- Volumen total', 'Cambiar ejercicios', 'Agregar deload'].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setVolumeDecision(chip)}
                    className={`py-[7px] px-4 rounded-full border-[1.5px] text-[.84rem] font-medium cursor-pointer transition-all duration-200 ${
                      volumeDecision === chip
                        ? 'bg-primary-light border-primary text-primary-dark'
                        : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[.77rem] text-gray-400 mb-2 uppercase font-semibold">Nutricion</div>
              <div className="flex flex-wrap gap-2">
                {['Mantener calorias', '- Calorias', '+ Calorias', 'Ajustar macros'].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setNutritionDecision(chip)}
                    className={`py-[7px] px-4 rounded-full border-[1.5px] text-[.84rem] font-medium cursor-pointer transition-all duration-200 ${
                      nutritionDecision === chip
                        ? 'bg-primary-light border-primary text-primary-dark'
                        : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[.77rem] text-gray-400 mb-2 uppercase font-semibold">Fase</div>
              <div className="flex flex-wrap gap-2">
                {['Continuar', 'Extender', 'Terminar antes', 'Semana deload'].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setPhaseDecision(chip)}
                    className={`py-[7px] px-4 rounded-full border-[1.5px] text-[.84rem] font-medium cursor-pointer transition-all duration-200 ${
                      phaseDecision === chip
                        ? 'bg-primary-light border-primary text-primary-dark'
                        : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[.77rem] text-gray-400 block mb-1">Por que?</label>
              <textarea
                className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.87rem] text-gray-600 resize-y min-h-[80px] focus:border-primary focus:outline-none font-[inherit]"
                placeholder="Razones de tus decisiones..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
              />
            </div>

            <button
              onClick={handleSaveDecision}
              disabled={savingDecision}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px disabled:opacity-60"
            >
              {savingDecision ? 'Guardando...' : 'Registrar Decision'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
