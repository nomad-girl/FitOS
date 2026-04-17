'use client'

import { calcBodyComp, ffmiLabel, ffmiProgress, waistToHipLabel, FFMI_SCALE } from '@/lib/body-comp'

interface BodyCompCardProps {
  latestCheckin: {
    weight_kg: number | null
    body_fat_pct: number | null
    waist_cm: number | null
    hip_cm: number | null
  } | null
  heightCm: number | null
}

// Scale for the progress bar + milestones (from plan doc, section 4)
const FFMI_BASELINE = FFMI_SCALE.sedentary  // 14
const FFMI_CEILING = FFMI_SCALE.naturalCeiling  // 19

// Milestones along the progress bar: FFMI target, date label, lean-mass kg, short label
const MILESTONES: Array<{ ffmi: number; date: string; leanKg: number; label: string }> = [
  { ffmi: 17.0, date: 'Ago 2026', leanKg: 44, label: 'Milestone 1' },
  { ffmi: 17.5, date: 'Mar 2027', leanKg: 46, label: 'Objetivo 12m' },
]
const FFMI_TARGET_FINAL = MILESTONES[MILESTONES.length - 1].ffmi

function pctOnScale(ffmi: number): number {
  return Math.max(0, Math.min(100, ((ffmi - FFMI_BASELINE) / (FFMI_CEILING - FFMI_BASELINE)) * 100))
}

export function BodyCompCard({ latestCheckin, heightCm }: BodyCompCardProps) {
  if (!latestCheckin) return null

  const comp = calcBodyComp({
    weightKg: latestCheckin.weight_kg,
    heightCm,
    bodyFatPct: latestCheckin.body_fat_pct,
    waistCm: latestCheckin.waist_cm,
    hipCm: latestCheckin.hip_cm,
  })

  const hasHeight = heightCm != null && heightCm > 0
  const hasBF = latestCheckin.body_fat_pct != null

  const ffmiPct = comp.ffmi != null ? pctOnScale(comp.ffmi) : 0
  // Progress to next unmet milestone (or stays on final one)
  const nextMilestone = comp.ffmi != null
    ? MILESTONES.find(m => comp.ffmi! < m.ffmi) ?? MILESTONES[MILESTONES.length - 1]
    : MILESTONES[0]
  const progress = ffmiProgress(comp.ffmi, FFMI_BASELINE, nextMilestone.ffmi)

  const whRatio = comp.waistToHip
  const whLabel = waistToHipLabel(whRatio)
  const whColor = whLabel.level === 'good' ? '#10B981' : whLabel.level === 'warn' ? '#d97706' : '#dc2626'

  return (
    <div className="bg-card rounded-[var(--radius)] p-[18px_20px] mb-5 shadow-[var(--shadow)] fade-in">
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-[.77rem] font-bold text-gray-400 uppercase tracking-[.08em]">Composición corporal</div>
          <div className="text-[.82rem] text-gray-500 mt-0.5">
            FFMI · masa magra · ratios
          </div>
        </div>
      </div>

      {/* FFMI — main metric with lean mass kg alongside */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5 flex-wrap gap-x-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[1.65rem] font-extrabold text-gray-900 tabular-nums">
              {comp.ffmi != null ? comp.ffmi.toFixed(1) : '--'}
            </span>
            <span className="text-[.8rem] text-gray-500">FFMI</span>
            {comp.leanMassKg != null && (
              <span className="text-[.85rem] text-gray-600 tabular-nums">
                · <span className="font-semibold text-gray-800">{comp.leanMassKg} kg</span> magra
              </span>
            )}
            {comp.ffmi != null && (
              <span className="text-[.78rem] font-semibold text-primary ml-1">{ffmiLabel(comp.ffmi)}</span>
            )}
          </div>
          {progress != null && (
            <span className="text-[.78rem] text-gray-500 tabular-nums">
              {Math.round(progress * 100)}% → {nextMilestone.ffmi} · {nextMilestone.date}
            </span>
          )}
        </div>

        {/* Progress bar from baseline → ceiling with milestone markers */}
        <div className="relative h-[10px] rounded-full bg-gray-100 overflow-hidden mt-1">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1d9be2] to-[#1aafcf] transition-all"
            style={{ width: `${ffmiPct}%` }}
          />
          {MILESTONES.map(m => {
            const reached = comp.ffmi != null && comp.ffmi >= m.ffmi
            return (
              <div
                key={m.ffmi}
                className="absolute top-[-3px] h-[16px] w-[2px]"
                style={{ left: `${pctOnScale(m.ffmi)}%`, background: reached ? '#10B981' : '#374151' }}
                title={`${m.ffmi} · ${m.date} · ${m.leanKg}kg`}
              />
            )
          })}
        </div>

        {/* Axis labels under the bar: baseline + milestones + ceiling */}
        <div className="relative h-[22px] mt-1 text-[.66rem] text-gray-400 tabular-nums">
          <span className="absolute left-0 -translate-x-0">
            <span className="block font-semibold">{FFMI_BASELINE}</span>
            <span className="block text-[.6rem]">base</span>
          </span>
          {MILESTONES.map(m => (
            <span
              key={m.ffmi}
              className="absolute -translate-x-1/2 text-center"
              style={{ left: `${pctOnScale(m.ffmi)}%` }}
            >
              <span className="block font-semibold text-gray-700">{m.ffmi}</span>
              <span className="block text-[.6rem] whitespace-nowrap">{m.date} · {m.leanKg}kg</span>
            </span>
          ))}
          <span className="absolute right-0 translate-x-0 text-right">
            <span className="block font-semibold">{FFMI_CEILING}</span>
            <span className="block text-[.6rem]">techo</span>
          </span>
        </div>

        {!hasHeight && (
          <div className="text-[.75rem] text-warning mt-3">
            Cargá tu altura en Configuración para calcular FFMI.
          </div>
        )}
        {hasHeight && !hasBF && (
          <div className="text-[.75rem] text-gray-500 mt-3">
            Agregá % de grasa en tu próximo check-in para el cálculo.
          </div>
        )}
      </div>

      {/* Sub-metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-5">
        <SubMetric
          label="Masa magra"
          value={comp.leanMassKg != null ? `${comp.leanMassKg} kg` : '--'}
          hint={comp.leanMassKg != null ? `objetivo ${nextMilestone.leanKg} kg` : undefined}
        />
        <SubMetric
          label="Masa grasa"
          value={comp.fatMassKg != null ? `${comp.fatMassKg} kg` : '--'}
          hint={comp.fatMassKg != null && latestCheckin.body_fat_pct != null ? `${latestCheckin.body_fat_pct}%` : undefined}
        />
        <SubMetric
          label="Cintura / cadera"
          value={whRatio != null ? whRatio.toFixed(2) : '--'}
          accent={whRatio != null ? whColor : undefined}
          hint={whRatio != null ? whLabel.label : undefined}
        />
        <SubMetric
          label="Cintura / altura"
          value={comp.waistToHeight != null ? comp.waistToHeight.toFixed(2) : '--'}
          hint={comp.waistToHeight != null && comp.waistToHeight < 0.5 ? 'Saludable' : undefined}
        />
      </div>

      {/* Target final: FFMI 17.5 by Mar 2027 */}
      <div className="mt-4 pt-3 border-t border-gray-100 text-[.78rem] text-gray-500">
        Objetivo final: FFMI <span className="font-semibold text-gray-700">{FFMI_TARGET_FINAL}</span> con{' '}
        <span className="font-semibold text-gray-700">{MILESTONES[MILESTONES.length - 1].leanKg} kg</span> de masa magra
        · <span className="font-semibold text-gray-700">{MILESTONES[MILESTONES.length - 1].date}</span>
      </div>
    </div>
  )
}

function SubMetric({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) {
  return (
    <div>
      <div className="text-[.72rem] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-[1.05rem] font-bold tabular-nums" style={{ color: accent ?? '#1f2937' }}>
        {value}
      </div>
      {hint && <div className="text-[.68rem] text-gray-500">{hint}</div>}
    </div>
  )
}
