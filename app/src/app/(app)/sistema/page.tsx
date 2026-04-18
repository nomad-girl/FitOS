'use client'

// Reference page: full periodization system at a glance.
// Mesocycle 3+1 overview + volume-per-muscle table + A/B/C session matrix + golden rules.
import { useState } from 'react'
import {
  resolveMesocycleWeek,
  MUSCLE_VOLUME_PROGRESSION,
  MUSCLE_VOLUME_TOTALS,
  SESSION_MATRIX,
  GOLDEN_RULES,
  CONSECUTIVE_DAYS,
  type MesocycleWeekType,
} from '@/lib/mesocycle'

const WEEK_COLOR: Record<MesocycleWeekType, { bg: string; text: string; border: string; accent: string }> = {
  accumulation: { bg: '#EEF4FB', text: '#1e4b7a', border: '#cadaed', accent: '#2563eb' },
  progression:  { bg: '#F1ECF7', text: '#4c2d7a', border: '#d8c9eb', accent: '#7c3aed' },
  peak:         { bg: '#FBECEC', text: '#7a1f1f', border: '#e8c5c5', accent: '#dc2626' },
  deload:       { bg: '#FDF4DB', text: '#6b4e0e', border: '#e8d9a9', accent: '#d97706' },
}

const MESO_WEEKS = [1, 2, 3, 4].map(w => ({ week: w, plan: resolveMesocycleWeek(w) }))

export default function MesoPreviewPage() {
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(2)
  const activePlan = resolveMesocycleWeek(selectedWeek)
  const activeColor = WEEK_COLOR[activePlan.type]

  return (
    <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden max-w-[1100px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[1.8rem] font-extrabold text-gray-900 tracking-tight">Sistema de entrenamiento</h1>
        <p className="text-gray-500 text-[.95rem] mt-1.5">
          Full body con sesgo anterior/posterior · Periodización ondulante semanal · Progresión de volumen + RPE
        </p>
        <div className="mt-3 inline-flex items-center gap-2 py-1.5 px-3 rounded-full bg-primary-light text-primary-dark text-[.78rem]">
          <span>{'\uD83D\uDCA1'}</span>
          <span>Plantilla por defecto al crear una fase. Cada mesociclo puede tener su propia periodización en el wizard.</span>
        </div>
      </div>

      {/* Mesociclo 3+1 overview — 4 cards */}
      <section className="mb-10">
        <div className="text-[.8rem] font-bold text-gray-500 tracking-[.08em] uppercase mb-3">
          Mesociclo 3+1 semanas
        </div>
        <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
          {MESO_WEEKS.map(({ week, plan }) => {
            const c = WEEK_COLOR[plan.type]
            const active = week === selectedWeek
            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week as 1 | 2 | 3 | 4)}
                className="text-left rounded-[var(--radius)] p-4 border transition-all cursor-pointer"
                style={{
                  background: c.bg,
                  borderColor: active ? c.accent : c.border,
                  borderWidth: active ? 2 : 1,
                  boxShadow: active ? `0 0 0 3px ${c.accent}22` : 'none',
                }}
              >
                <div className="text-[.7rem] font-bold uppercase tracking-wide" style={{ color: c.accent }}>
                  Semana {week}
                </div>
                <div className="font-extrabold text-[1.05rem] mt-1" style={{ color: c.text }}>
                  {plan.typeLabel}
                </div>
                <div className="mt-3 text-[.82rem] font-medium leading-[1.55]" style={{ color: c.text }}>
                  <div>RPE {plan.rpeTarget} · {plan.rir} RIR</div>
                  <div>~{MUSCLE_VOLUME_TOTALS.perSession3x[mesoKey(week)]} series/sesión</div>
                  <div>Reps {plan.repRange[0]}-{plan.repRange[1]}</div>
                  <div>{plan.percent1RM[0]}-{plan.percent1RM[1]}% 1RM</div>
                </div>
                <div className="mt-3 text-[.78rem] italic opacity-80" style={{ color: c.text }}>
                  &quot;{plan.sensation}&quot;
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Volume per muscle × week */}
      <section className="mb-10">
        <div className="text-[.8rem] font-bold text-gray-500 tracking-[.08em] uppercase mb-3">
          Volumen semanal por grupo: MEV → Progresión → MRV
        </div>
        <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[.86rem]">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[.75rem] uppercase tracking-wide">
                  <th className="text-left font-semibold px-4 py-3">Grupo</th>
                  <th className="font-semibold px-3 py-3">MEV</th>
                  <th className="font-semibold px-3 py-3" style={{ background: WEEK_COLOR.accumulation.bg, color: WEEK_COLOR.accumulation.text }}>
                    <div>Sem 1</div>
                    <div className="text-[.68rem] font-medium opacity-80">RPE 7</div>
                  </th>
                  <th className="font-semibold px-3 py-3" style={{ background: WEEK_COLOR.progression.bg, color: WEEK_COLOR.progression.text }}>
                    <div>Sem 2</div>
                    <div className="text-[.68rem] font-medium opacity-80">RPE 8</div>
                  </th>
                  <th className="font-semibold px-3 py-3" style={{ background: WEEK_COLOR.peak.bg, color: WEEK_COLOR.peak.text }}>
                    <div>Sem 3</div>
                    <div className="text-[.68rem] font-medium opacity-80">RPE 9-10</div>
                  </th>
                  <th className="font-semibold px-3 py-3" style={{ background: WEEK_COLOR.deload.bg, color: WEEK_COLOR.deload.text }}>
                    <div>Descarga</div>
                    <div className="text-[.68rem] font-medium opacity-80">RPE 6</div>
                  </th>
                  <th className="font-semibold px-3 py-3">MRV</th>
                </tr>
              </thead>
              <tbody>
                {MUSCLE_VOLUME_PROGRESSION.map((row, i) => (
                  <tr key={row.muscle} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{row.muscle}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{row.mev}</td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ background: WEEK_COLOR.accumulation.bg + '80' }}>{row.week1}</td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ background: WEEK_COLOR.progression.bg + '80' }}>{row.week2}</td>
                    <td className="px-3 py-2.5 text-center font-bold" style={{ background: WEEK_COLOR.peak.bg + '80', color: WEEK_COLOR.peak.text }}>{row.week3}</td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ background: WEEK_COLOR.deload.bg + '80' }}>{row.deload}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{row.mrv[0]}-{row.mrv[1]}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="px-4 py-2.5 text-gray-800">Total/sem</td>
                  <td className="px-3 py-2.5 text-center">{MUSCLE_VOLUME_TOTALS.mev}</td>
                  <td className="px-3 py-2.5 text-center">{MUSCLE_VOLUME_TOTALS.week1}</td>
                  <td className="px-3 py-2.5 text-center">{MUSCLE_VOLUME_TOTALS.week2}</td>
                  <td className="px-3 py-2.5 text-center">{MUSCLE_VOLUME_TOTALS.week3}</td>
                  <td className="px-3 py-2.5 text-center">{MUSCLE_VOLUME_TOTALS.deload}</td>
                  <td />
                </tr>
                <tr className="bg-gray-50 font-semibold text-gray-600 text-[.82rem]">
                  <td className="px-4 py-2.5">Por sesión (3×)</td>
                  <td className="px-3 py-2.5 text-center">~13</td>
                  <td className="px-3 py-2.5 text-center">~{MUSCLE_VOLUME_TOTALS.perSession3x.week1}</td>
                  <td className="px-3 py-2.5 text-center">~{MUSCLE_VOLUME_TOTALS.perSession3x.week2}</td>
                  <td className="px-3 py-2.5 text-center">~{MUSCLE_VOLUME_TOTALS.perSession3x.week3}</td>
                  <td className="px-3 py-2.5 text-center">~{MUSCLE_VOLUME_TOTALS.perSession3x.deload}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-[.82rem] text-gray-500 border-t border-gray-100 bg-gray-50/30">
            <strong>Lectura:</strong> Arrancás en semana 1 cerca del MEV (~17 series/sesión). Cada semana sumás ~2 series por grupo prioritario Y subís RPE. Semana 3 llegás al tope (~29). Descarga baja todo. Doble progresión: más series y más pesado.
          </div>
        </div>
      </section>

      {/* Session matrix A/B/C × weeks */}
      <section className="mb-10">
        <div className="text-[.8rem] font-bold text-gray-500 tracking-[.08em] uppercase mb-3">
          Matriz de sesiones A · B · C
        </div>
        <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[.82rem]">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[.72rem] uppercase tracking-wide">
                  <th className="text-left font-semibold px-4 py-3 w-[150px]" />
                  <th className="font-semibold px-3 py-3">
                    <div className="text-gray-800">Sesión A</div>
                    <div className="text-[.68rem] font-medium opacity-80 normal-case tracking-normal">Glúteo + cuád + empuje</div>
                  </th>
                  <th className="font-semibold px-3 py-3">
                    <div className="text-gray-800">Sesión B</div>
                    <div className="text-[.68rem] font-medium opacity-80 normal-case tracking-normal">Isquio + espalda + bíceps</div>
                  </th>
                  <th className="font-semibold px-3 py-3">
                    <div className="text-gray-800">Sesión C</div>
                    <div className="text-[.68rem] font-medium opacity-80 normal-case tracking-normal">Full lower + detalles</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {SESSION_MATRIX.map((row) => {
                  const plan = resolveMesocycleWeek(row.week)
                  const c = WEEK_COLOR[plan.type]
                  return (
                    <tr key={row.week} className="border-t border-gray-100">
                      <td className="px-4 py-4 align-top" style={{ background: c.bg }}>
                        <div className="text-[.7rem] font-bold uppercase tracking-wide" style={{ color: c.accent }}>
                          SEM {row.week}
                        </div>
                        <div className="font-extrabold text-[.95rem] mt-0.5" style={{ color: c.text }}>
                          {row.label}
                        </div>
                      </td>
                      <SessionCell cell={row.sessionA} />
                      <SessionCell cell={row.sessionB} />
                      <SessionCell cell={row.sessionC} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Consecutive-day combinations */}
      <section className="mb-10">
        <div className="text-[.8rem] font-bold text-gray-500 tracking-[.08em] uppercase mb-3">
          Días consecutivos
        </div>
        <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] p-4 space-y-2">
          {CONSECUTIVE_DAYS.map((rule, i) => {
            const works = rule.verdict === 'works'
            return (
              <div
                key={i}
                className="flex gap-3 items-start rounded-[var(--radius-sm)] px-4 py-3 text-[.9rem] leading-[1.55]"
                style={{
                  background: works ? '#E9F5EE' : '#FBECEC',
                  color: works ? '#1f4a33' : '#7a1f1f',
                }}
              >
                <span className="flex-none font-bold">
                  {rule.pair}: {rule.verdictLabel}.
                </span>
                <span className="flex-1 opacity-90">{rule.reason}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Golden rules */}
      <section className="mb-8">
        <div className="text-[.8rem] font-bold text-gray-500 tracking-[.08em] uppercase mb-3">
          Reglas de oro
        </div>
        <div className="bg-card rounded-[var(--radius)] shadow-[var(--shadow)] p-6">
          <ol className="space-y-3">
            {GOLDEN_RULES.map((rule, i) => (
              <li key={i} className="flex gap-3 text-[.92rem] text-gray-700 leading-[1.55]">
                <span className="flex-none w-6 h-6 rounded-full text-white font-bold text-[.75rem] flex items-center justify-center" style={{ background: activeColor.accent }}>
                  {i + 1}
                </span>
                <span className="flex-1 pt-[2px]">{rule}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  )
}

function mesoKey(w: number): 'week1' | 'week2' | 'week3' | 'deload' {
  if (w === 1) return 'week1'
  if (w === 2) return 'week2'
  if (w === 3) return 'week3'
  return 'deload'
}

function SessionCell({ cell }: { cell: { reps: string; series: string; rpe: string; rir: string; percent1RM: string } }) {
  return (
    <td className="px-4 py-4 align-top">
      <div className="space-y-1 text-gray-700 leading-[1.55]">
        <div><span className="font-semibold">{cell.reps}</span> <span className="text-gray-400">reps</span></div>
        <div><span className="font-semibold">{cell.series}</span> <span className="text-gray-400">series</span></div>
        <div className="text-[.8rem]">
          <span className="font-semibold">RPE {cell.rpe}</span>
          <span className="text-gray-400"> · </span>
          <span className="text-gray-500">{cell.rir} RIR</span>
        </div>
        <div className="text-[.8rem] text-gray-500">{cell.percent1RM} 1RM</div>
      </div>
    </td>
  )
}
