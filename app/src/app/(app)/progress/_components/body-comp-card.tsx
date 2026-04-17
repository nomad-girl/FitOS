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

// Baseline for progress bar: "trained" → 16.5 is Nati's current per doc, target 17.5, ceiling 19
const FFMI_BASELINE = FFMI_SCALE.sedentary  // 14
const FFMI_TARGET = 17.5
const FFMI_CEILING = FFMI_SCALE.naturalCeiling  // 19

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

  // FFMI bar: from baseline → ceiling, show current position + target marker
  const ffmiPct = comp.ffmi != null
    ? Math.max(0, Math.min(100, ((comp.ffmi - FFMI_BASELINE) / (FFMI_CEILING - FFMI_BASELINE)) * 100))
    : 0
  const targetPct = ((FFMI_TARGET - FFMI_BASELINE) / (FFMI_CEILING - FFMI_BASELINE)) * 100
  const progress = ffmiProgress(comp.ffmi, FFMI_BASELINE, FFMI_TARGET)

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

      {/* FFMI — main metric */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[1.65rem] font-extrabold text-gray-900 tabular-nums">
              {comp.ffmi != null ? comp.ffmi.toFixed(1) : '--'}
            </span>
            <span className="text-[.8rem] text-gray-500">FFMI</span>
            {comp.ffmi != null && (
              <span className="text-[.78rem] font-semibold text-primary">{ffmiLabel(comp.ffmi)}</span>
            )}
          </div>
          {progress != null && (
            <span className="text-[.78rem] text-gray-500 tabular-nums">
              {Math.round(progress * 100)}% → {FFMI_TARGET}
            </span>
          )}
        </div>

        {/* Progress bar baseline (14) → ceiling (19), with target marker at 17.5 */}
        <div className="relative h-[10px] rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1d9be2] to-[#1aafcf] transition-all"
            style={{ width: `${ffmiPct}%` }}
          />
          {/* Target marker */}
          <div
            className="absolute top-[-3px] h-[16px] w-[2px] bg-gray-700"
            style={{ left: `${targetPct}%` }}
            title={`Target ${FFMI_TARGET}`}
          />
        </div>
        <div className="flex justify-between text-[.7rem] text-gray-400 mt-1 tabular-nums">
          <span>{FFMI_BASELINE}</span>
          <span className="relative" style={{ left: `${targetPct - 50}%` }}>objetivo {FFMI_TARGET}</span>
          <span>techo {FFMI_CEILING}</span>
        </div>

        {!hasHeight && (
          <div className="text-[.75rem] text-warning mt-2">
            Cargá tu altura en Configuración para calcular FFMI.
          </div>
        )}
        {hasHeight && !hasBF && (
          <div className="text-[.75rem] text-gray-500 mt-2">
            Agregá % de grasa en tu próximo check-in para el cálculo (estimado).
          </div>
        )}
      </div>

      {/* Sub-metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SubMetric
          label="Masa magra"
          value={comp.leanMassKg != null ? `${comp.leanMassKg} kg` : '--'}
        />
        <SubMetric
          label="Masa grasa"
          value={comp.fatMassKg != null ? `${comp.fatMassKg} kg` : '--'}
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
      {hint && <div className="text-[.7rem] text-gray-500">{hint}</div>}
    </div>
  )
}
