'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { invalidateCache } from '@/lib/cache'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { ffmiLabel, FFMI_SCALE } from '@/lib/body-comp'
import { loadCloseoutData, type CloseoutData } from '@/lib/phase-closeout'
import type { Phase } from '@/lib/supabase/types'

type CheckState = 'pending' | 'hit' | 'miss' | 'skip'

const goalLabel: Record<string, string> = {
  build: 'Build / Volumen',
  cut: 'Cut / Define',
  maintain: 'Mantenimiento',
  strength: 'Fuerza',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function deltaColor(value: number | null, goodWhen: 'down' | 'up' | 'either'): string {
  if (value == null || value === 0) return 'text-gray-400'
  const positive = value > 0
  if (goodWhen === 'either') return 'text-gray-700'
  const isGood = (goodWhen === 'down' && !positive) || (goodWhen === 'up' && positive)
  return isGood ? 'text-success' : 'text-warning'
}

function fmtDelta(value: number | null, unit: string): string {
  if (value == null) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value} ${unit}`
}

export default function CloseoutPage({ params }: { params: Promise<{ phaseId: string }> }) {
  const { phaseId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CloseoutData | null>(null)
  const [targetStates, setTargetStates] = useState<Record<string, CheckState>>({})
  const [warningStates, setWarningStates] = useState<Record<string, CheckState>>({})
  const [exitStates, setExitStates] = useState<Record<string, CheckState>>({})
  const [whatWorked, setWhatWorked] = useState('')
  const [whatDidnt, setWhatDidnt] = useState('')
  const [howFelt, setHowFelt] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const userId = await getUserId()
      const [phaseRes, profileRes] = await Promise.all([
        supabase.from('phases').select('*').eq('id', phaseId).single(),
        supabase.from('profiles').select('height_cm').eq('id', userId).single(),
      ])
      if (!phaseRes.data) { setLoading(false); return }
      const closeout = await loadCloseoutData(
        supabase,
        phaseRes.data as Phase,
        userId,
        (profileRes.data as { height_cm: number | null } | null)?.height_cm ?? null,
      )
      setData(closeout)

      // Hydrate previous closeout if exists in outcome_notes
      const outcome = (phaseRes.data as Phase).outcome_notes
      if (outcome) {
        try {
          const parsed = JSON.parse(outcome)
          if (parsed?.targetStates) setTargetStates(parsed.targetStates)
          if (parsed?.warningStates) setWarningStates(parsed.warningStates)
          if (parsed?.exitStates) setExitStates(parsed.exitStates)
          if (parsed?.whatWorked) setWhatWorked(parsed.whatWorked)
          if (parsed?.whatDidnt) setWhatDidnt(parsed.whatDidnt)
          if (parsed?.howFelt) setHowFelt(parsed.howFelt)
        } catch {
          // legacy: plain text → put it in whatWorked
          setWhatWorked(outcome)
        }
      } else {
        setTargetStates(Object.fromEntries(closeout.progressTargets.map((t) => [t.id, 'pending' as CheckState])))
        setWarningStates(Object.fromEntries(closeout.progressWarnings.map((t) => [t.id, 'pending' as CheckState])))
        setExitStates(Object.fromEntries(closeout.exitCriteria.map((t) => [t.id, 'pending' as CheckState])))
      }
    } catch (err) {
      console.error('Closeout load error:', err)
    } finally {
      setLoading(false)
    }
  }, [phaseId])

  useEffect(() => { fetchData() }, [fetchData])

  function cycleState(prev: CheckState): CheckState {
    return prev === 'pending' ? 'hit' : prev === 'hit' ? 'miss' : prev === 'miss' ? 'skip' : 'pending'
  }

  async function saveAndComplete(action: 'save' | 'complete' | 'next') {
    if (!data) return
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = JSON.stringify({
        targetStates, warningStates, exitStates,
        whatWorked, whatDidnt, howFelt,
        savedAt: new Date().toISOString(),
      })
      const update: { outcome_notes: string; status?: string; end_date?: string; updated_at: string } = {
        outcome_notes: payload,
        updated_at: new Date().toISOString(),
      }
      if (action !== 'save' && data.phase.status === 'active') {
        update.status = 'completed'
        update.end_date = new Date().toISOString().split('T')[0]
      }
      const { error } = await supabase.from('phases').update(update).eq('id', phaseId)
      if (error) { alert('Error guardando: ' + error.message); return }
      invalidateCache('plan:')
      if (action === 'next') {
        router.push('/plan?tab=macro&newPhase=1&from=' + phaseId)
      } else if (action === 'complete') {
        router.push('/plan')
      } else {
        await fetchData()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        <div className="bg-gray-200 animate-pulse rounded-[6px] h-7 w-64 mb-3" />
        <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-80 mb-6" />
        {[1, 2, 3].map(i => <div key={i} className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-[180px] mb-5" />)}
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px]">
        <div className="text-center text-gray-500">Fase no encontrada.</div>
        <div className="text-center mt-3">
          <Link href="/plan" className="text-primary font-semibold">← Volver al plan</Link>
        </div>
      </main>
    )
  }

  const { phase, entry, latest, delta, volume, totalPlanned, totalActual, sessionsDone, sessionsPlanned, prs, suggestions } = data
  const adherencePct = sessionsPlanned > 0 ? Math.round((sessionsDone / sessionsPlanned) * 100) : 0
  const newPrCount = prs.filter(p => p.isNewPr).length

  return (
    <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/plan"
          className="text-gray-500 font-semibold text-[.82rem] mb-3 inline-block hover:text-primary transition-colors"
        >
          ← Volver al plan
        </Link>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Badge variant="blue">Cierre de mesociclo</Badge>
          {phase.status === 'completed' && <Badge variant="green">Ya completada</Badge>}
          {phase.status === 'active' && <Badge variant="yellow">Aún activa</Badge>}
          <Badge variant="gray">{goalLabel[phase.goal] ?? phase.goal}</Badge>
        </div>
        <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">{phase.name}</h1>
        <p className="text-gray-500 text-[.88rem] mt-1">
          {formatDate(data.startDate)} → {formatDate(data.endDate)} · {data.weeksCompleted} de {data.weeksPlanned} semanas
        </p>
        {phase.objective && (
          <p className="text-gray-600 text-[.9rem] mt-2 italic">"{phase.objective}"</p>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6 max-sm:grid-cols-2">
        <KpiCard label="Adherencia" value={`${adherencePct}%`} hint={`${sessionsDone}/${sessionsPlanned} sesiones`} accent={adherencePct >= 80 ? '#10B981' : adherencePct >= 60 ? '#d97706' : '#dc2626'} />
        <KpiCard label="Volumen real" value={`${totalActual}`} hint={totalPlanned > 0 ? `${Math.round((totalActual / totalPlanned) * 100)}% del plan` : 'sin plan'} />
        <KpiCard label="PRs nuevos" value={String(newPrCount)} hint={`${prs.length} mejores marcas`} accent={newPrCount > 0 ? '#10B981' : undefined} />
        <KpiCard
          label="Δ Peso"
          value={delta?.weightKg != null ? fmtDelta(delta.weightKg, 'kg') : '--'}
          hint={delta?.fatMassKg != null ? `grasa ${fmtDelta(delta.fatMassKg, 'kg')}` : ''}
          accent={delta?.weightKg != null ? (phase.goal === 'cut' ? (delta.weightKg < 0 ? '#10B981' : '#d97706') : phase.goal === 'build' ? (delta.weightKg > 0 ? '#10B981' : '#d97706') : undefined) : undefined}
        />
      </div>

      {/* SECTION: Body composition + FFMI */}
      <Section title="Composición corporal" subtitle="Inicio vs último check-in">
        {!entry || !latest ? (
          <div className="text-[.86rem] text-gray-500 py-2">
            {!entry ? 'No hay baseline en los criterios de entrada ni check-in inicial.' : 'No hay check-in semanal dentro de la fase.'}
            {!latest && <> Hacé un check-in en <Link href="/checkin" className="text-primary font-semibold">/checkin</Link>.</>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
              <BodyCompCol label="Peso" entry={entry.weight_kg} latest={latest.weight_kg} delta={delta?.weightKg ?? null} unit="kg" goodWhen={phase.goal === 'cut' ? 'down' : phase.goal === 'build' ? 'up' : 'either'} />
              <BodyCompCol label="Grasa corporal" entry={entry.body_fat_pct} latest={latest.body_fat_pct} delta={delta?.bodyFatPct ?? null} unit="%" goodWhen="down" />
              <BodyCompCol label="Cintura" entry={entry.waist_cm} latest={latest.waist_cm} delta={delta?.waistCm ?? null} unit="cm" goodWhen="down" />
              <BodyCompCol label="Masa magra" entry={entry.comp.leanMassKg} latest={latest.comp.leanMassKg} delta={delta?.leanMassKg ?? null} unit="kg" goodWhen="up" />
              <BodyCompCol label="Masa grasa" entry={entry.comp.fatMassKg} latest={latest.comp.fatMassKg} delta={delta?.fatMassKg ?? null} unit="kg" goodWhen="down" />
              <BodyCompCol label="FFMI" entry={entry.comp.ffmi} latest={latest.comp.ffmi} delta={delta?.ffmi ?? null} unit="" goodWhen="up" />
            </div>

            {/* FFMI scale visual */}
            {latest.comp.ffmi != null && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <FfmiScale entryFfmi={entry.comp.ffmi} latestFfmi={latest.comp.ffmi} />
              </div>
            )}
          </>
        )}
      </Section>

      {/* SECTION: Volume planned vs done */}
      <Section title="Volumen por músculo" subtitle={`${totalActual} / ${totalPlanned} series planeadas`}>
        {volume.length === 0 ? (
          <div className="text-[.86rem] text-gray-500 py-2">Sin datos de volumen — ¿sincronizaste con Hevy?</div>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-[.86rem] min-w-[420px]">
              <thead>
                <tr className="bg-gray-50 text-left text-[.72rem] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-semibold">Músculo</th>
                  <th className="px-3 py-2 font-semibold text-right">Plan</th>
                  <th className="px-3 py-2 font-semibold text-right">Real</th>
                  <th className="px-3 py-2 font-semibold text-right">Δ</th>
                  <th className="px-3 py-2 font-semibold w-[120px]">Adherencia</th>
                </tr>
              </thead>
              <tbody>
                {volume.map(row => {
                  const ratio = row.planned > 0 ? row.actual / row.planned : 0
                  const barColor = ratio >= 0.9 && ratio <= 1.15 ? 'bg-success'
                    : ratio >= 0.7 ? 'bg-warning'
                    : ratio === 0 ? 'bg-gray-300'
                    : 'bg-danger'
                  return (
                    <tr key={row.muscle} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-semibold text-gray-800">{row.muscle}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{row.planned || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{row.actual || '—'}</td>
                      <td className={`px-3 py-2 text-right tabular-nums text-[.78rem] ${row.diffPct == null ? 'text-gray-400' : row.diffPct >= -10 && row.diffPct <= 15 ? 'text-success' : 'text-warning'}`}>
                        {row.diffPct != null ? `${row.diffPct > 0 ? '+' : ''}${row.diffPct}%` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor}`} style={{ width: `${Math.min(ratio * 100, 130)}%` }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* SECTION: PRs */}
      <Section title="Records personales" subtitle={prs.length > 0 ? `${prs.length} en total · ${newPrCount} nuevos` : 'sin movimientos'}>
        {prs.length === 0 ? (
          <div className="text-[.86rem] text-gray-500 py-2">Sin PRs registrados en esta fase.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {prs.slice(0, 12).map(pr => (
              <div key={pr.exerciseName} className={`flex items-center justify-between py-2 px-3 rounded-[var(--radius-xs)] ${pr.isNewPr ? 'bg-success-light/50 border-l-2 border-l-success' : 'bg-gray-50'}`}>
                <div className="font-semibold text-[.86rem] text-gray-800 flex items-center gap-2">
                  {pr.isNewPr && <span className="text-success text-[.7rem] font-bold uppercase tracking-wide">PR</span>}
                  {pr.exerciseName}
                </div>
                <div className="text-[.84rem] text-primary font-bold tabular-nums">
                  {pr.weight}kg × {pr.reps}
                </div>
              </div>
            ))}
            {prs.length > 12 && (
              <div className="text-[.78rem] text-gray-400 text-center mt-1">y {prs.length - 12} más...</div>
            )}
          </div>
        )}
      </Section>

      {/* SECTION: Targets and warnings */}
      {(data.progressTargets.length > 0 || data.progressWarnings.length > 0) && (
        <Section title="Objetivos y señales" subtitle="Marcá cómo te fue con cada uno">
          {data.progressTargets.length > 0 && (
            <div className="mb-4">
              <div className="text-[.78rem] font-bold text-gray-500 uppercase tracking-wide mb-2">Targets</div>
              <CriteriaList items={data.progressTargets} states={targetStates} setStates={setTargetStates} cycleState={cycleState} />
            </div>
          )}
          {data.progressWarnings.length > 0 && (
            <div>
              <div className="text-[.78rem] font-bold text-gray-500 uppercase tracking-wide mb-2">Señales de alerta</div>
              <CriteriaList items={data.progressWarnings} states={warningStates} setStates={setWarningStates} cycleState={cycleState} kind="warning" />
            </div>
          )}
        </Section>
      )}

      {/* SECTION: Exit criteria */}
      {data.exitCriteria.length > 0 && (
        <Section title="Criterios de salida" subtitle="¿Se cumplieron?">
          <CriteriaList items={data.exitCriteria} states={exitStates} setStates={setExitStates} cycleState={cycleState} />
        </Section>
      )}

      {/* SECTION: Reflection */}
      <Section title="Reflexión" subtitle="Lo que se guarda en el outcome">
        <div className="grid gap-3">
          <ReflectField label="¿Qué funcionó?" value={whatWorked} onChange={setWhatWorked} placeholder="Lo que repetirías sin pensar..." />
          <ReflectField label="¿Qué no funcionó?" value={whatDidnt} onChange={setWhatDidnt} placeholder="Lo que cambiarías al toque..." />
          <ReflectField label="¿Cómo te sentiste?" value={howFelt} onChange={setHowFelt} placeholder="Energía, motivación, fatiga..." />
        </div>
      </Section>

      {/* SECTION: Suggestions */}
      <Section title="Decisiones para el próximo meso" subtitle="Sugerencias automáticas según los datos">
        {suggestions.length === 0 ? (
          <div className="text-[.86rem] text-gray-500 py-2">No hay sugerencias claras — todo dentro de rango.</div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {suggestions.map((s, i) => (
              <li key={i} className="flex gap-3 items-start text-[.88rem] text-gray-700 leading-[1.55]">
                <span className="flex-none w-6 h-6 rounded-full bg-primary-light text-primary font-bold text-[.75rem] flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-11 max-md:-mx-4 px-11 max-md:px-4 py-3 bg-card border-t border-gray-100 mt-4 flex gap-2 flex-wrap items-center justify-end max-md:mb-[60px]">
        <button
          onClick={() => saveAndComplete('save')}
          disabled={saving}
          className="py-2.5 px-4 rounded-[var(--radius-sm)] border-[1.5px] border-gray-200 text-gray-700 font-semibold text-[.85rem] bg-card cursor-pointer hover:border-gray-300 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar borrador'}
        </button>
        {phase.status === 'active' && (
          <button
            onClick={() => saveAndComplete('complete')}
            disabled={saving}
            className="py-2.5 px-4 rounded-[var(--radius-sm)] border-[1.5px] border-warning text-warning font-semibold text-[.85rem] bg-card cursor-pointer hover:bg-warning-light disabled:opacity-50"
          >
            Marcar como completada
          </button>
        )}
        <button
          onClick={() => saveAndComplete('next')}
          disabled={saving}
          className="py-2.5 px-4 rounded-[var(--radius-sm)] font-semibold text-[.85rem] bg-gradient-to-br from-primary to-accent text-white cursor-pointer disabled:opacity-50 shadow-[0_2px_8px_rgba(14,165,233,.25)]"
        >
          Crear próxima fase →
        </button>
      </div>
    </main>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-[1.05rem] font-bold text-gray-800">{title}</h2>
        {subtitle && <span className="text-[.76rem] text-gray-400">{subtitle}</span>}
      </div>
      <div className="bg-card rounded-[var(--radius)] p-[16px_18px] shadow-[var(--shadow)]">
        {children}
      </div>
    </section>
  )
}

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="bg-card rounded-[var(--radius)] p-[14px_16px] shadow-[var(--shadow)]">
      <div className="text-[.7rem] text-gray-400 uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-[1.35rem] font-extrabold tabular-nums mt-1" style={{ color: accent ?? '#1f2937' }}>{value}</div>
      {hint && <div className="text-[.74rem] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  )
}

function BodyCompCol({ label, entry, latest, delta, unit, goodWhen }: {
  label: string
  entry: number | null
  latest: number | null
  delta: number | null
  unit: string
  goodWhen: 'up' | 'down' | 'either'
}) {
  return (
    <div className="border border-gray-100 rounded-[var(--radius-sm)] p-3">
      <div className="text-[.72rem] text-gray-400 uppercase tracking-wide font-semibold mb-1">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[.85rem] text-gray-500 tabular-nums">{entry ?? '--'}</span>
        <span className="text-gray-300">→</span>
        <span className="text-[1.1rem] font-bold tabular-nums">{latest ?? '--'}</span>
        <span className="text-[.78rem] text-gray-400">{unit}</span>
      </div>
      {delta != null && (
        <div className={`text-[.82rem] font-semibold mt-1 ${deltaColor(delta, goodWhen)}`}>
          {fmtDelta(delta, unit).trim()}
        </div>
      )}
    </div>
  )
}

function FfmiScale({ entryFfmi, latestFfmi }: { entryFfmi: number | null; latestFfmi: number | null }) {
  const min = FFMI_SCALE.sedentary
  const max = FFMI_SCALE.naturalCeiling
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
  const entryPct = entryFfmi != null ? pct(entryFfmi) : null
  const latestPct = latestFfmi != null ? pct(latestFfmi) : null
  const segments = [
    { from: FFMI_SCALE.sedentary, to: FFMI_SCALE.trained, color: '#e5e7eb' },
    { from: FFMI_SCALE.trained, to: FFMI_SCALE.advanced, color: '#dbeafe' },
    { from: FFMI_SCALE.advanced, to: FFMI_SCALE.nearCeiling, color: '#bfdbfe' },
    { from: FFMI_SCALE.nearCeiling, to: FFMI_SCALE.naturalCeiling, color: '#93c5fd' },
  ]
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <div className="text-[.78rem] font-bold text-gray-500 uppercase tracking-wide">Posición FFMI</div>
        <div className="text-[.82rem] text-gray-700">
          <span className="font-bold">{latestFfmi}</span> · {ffmiLabel(latestFfmi)}
        </div>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden flex">
        {segments.map(s => (
          <div key={s.from} style={{ background: s.color, flex: s.to - s.from }} />
        ))}
        {entryPct != null && (
          <div className="absolute top-[-3px] h-[18px] w-[2px] bg-gray-500" style={{ left: `${entryPct}%` }} title={`Inicio: ${entryFfmi}`} />
        )}
        {latestPct != null && (
          <div className="absolute top-[-5px] h-[22px] w-[3px] bg-primary rounded-full" style={{ left: `${latestPct}%` }} title={`Actual: ${latestFfmi}`} />
        )}
      </div>
      <div className="relative h-5 mt-1 text-[.66rem] text-gray-400 tabular-nums">
        <span className="absolute left-0">{min} sedentaria</span>
        <span className="absolute" style={{ left: `${pct(FFMI_SCALE.trained)}%`, transform: 'translateX(-50%)' }}>{FFMI_SCALE.trained}</span>
        <span className="absolute" style={{ left: `${pct(FFMI_SCALE.advanced)}%`, transform: 'translateX(-50%)' }}>{FFMI_SCALE.advanced}</span>
        <span className="absolute" style={{ left: `${pct(FFMI_SCALE.nearCeiling)}%`, transform: 'translateX(-50%)' }}>{FFMI_SCALE.nearCeiling}</span>
        <span className="absolute right-0">{max} techo</span>
      </div>
      {entryFfmi != null && latestFfmi != null && (
        <div className="text-[.78rem] text-gray-500 mt-2">
          De <span className="font-semibold text-gray-700">{entryFfmi}</span> a{' '}
          <span className="font-semibold text-gray-700">{latestFfmi}</span> ({latestFfmi - entryFfmi >= 0 ? '+' : ''}{(Math.round((latestFfmi - entryFfmi) * 10) / 10)})
        </div>
      )}
    </div>
  )
}

function CriteriaList({ items, states, setStates, cycleState, kind = 'target' }: {
  items: { id: string; label: string; detail: string }[]
  states: Record<string, CheckState>
  setStates: (fn: (prev: Record<string, CheckState>) => Record<string, CheckState>) => void
  cycleState: (s: CheckState) => CheckState
  kind?: 'target' | 'warning'
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map(item => {
        const s = states[item.id] ?? 'pending'
        const cfg = stateChip(s, kind)
        return (
          <button
            key={item.id}
            onClick={() => setStates(prev => ({ ...prev, [item.id]: cycleState(s) }))}
            className="flex items-start gap-3 py-2 px-3 rounded-[var(--radius-xs)] hover:bg-gray-50 transition-colors text-left bg-transparent border-none cursor-pointer"
          >
            <span className={`flex-none w-6 h-6 rounded-full flex items-center justify-center text-[.78rem] font-bold ${cfg.cls}`}>
              {cfg.icon}
            </span>
            <span className="flex-1">
              <div className="font-semibold text-[.86rem] text-gray-800">{item.label}</div>
              <div className="text-[.78rem] text-gray-500">{item.detail}</div>
            </span>
            <span className={`text-[.7rem] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.short}</span>
          </button>
        )
      })}
    </div>
  )
}

function stateChip(state: CheckState, kind: 'target' | 'warning'): { cls: string; text: string; icon: string; short: string } {
  if (state === 'hit') {
    return kind === 'target'
      ? { cls: 'bg-success-light text-success', text: 'text-success', icon: '✓', short: 'Cumplió' }
      : { cls: 'bg-warning-light text-warning', text: 'text-warning', icon: '⚠', short: 'Apareció' }
  }
  if (state === 'miss') {
    return kind === 'target'
      ? { cls: 'bg-danger-light text-danger', text: 'text-danger', icon: '✗', short: 'No cumplió' }
      : { cls: 'bg-success-light text-success', text: 'text-success', icon: '✓', short: 'No apareció' }
  }
  if (state === 'skip') {
    return { cls: 'bg-gray-100 text-gray-400', text: 'text-gray-400', icon: '—', short: 'N/A' }
  }
  return { cls: 'bg-gray-50 text-gray-400 border border-gray-200', text: 'text-gray-400', icon: '·', short: 'Pendiente' }
}

function ReflectField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-[.78rem] font-semibold text-gray-600 block mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full py-2 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.86rem] focus:border-primary focus:outline-none resize-none"
      />
    </div>
  )
}
