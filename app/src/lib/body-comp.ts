// Body composition calculations: FFMI, lean mass, body fat estimation, ratios.
// All inputs validated: returns null when data is missing, never throws.

export interface BodyCompInput {
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  bodyFatPct?: number | null
  waistCm?: number | null
  hipCm?: number | null
}

export interface BodyCompOutput {
  leanMassKg: number | null
  fatMassKg: number | null
  ffmi: number | null
  normalizedFfmi: number | null
  waistToHip: number | null
  waistToHeight: number | null
  bmi: number | null
}

// FFMI reference scale for women (Kouri/Pope heuristic, adjusted).
// 14 sedentary, 16 trained, 17 advanced, 18 near-natural ceiling, 19 elite-natural.
export const FFMI_SCALE = {
  sedentary: 14,
  trained: 16,
  advanced: 17,
  nearCeiling: 18,
  naturalCeiling: 19,
} as const

export function calcBodyComp(input: BodyCompInput): BodyCompOutput {
  const { weightKg, heightCm, bodyFatPct, waistCm, hipCm } = input
  const heightM = heightCm ? heightCm / 100 : null

  const bmi = weightKg && heightM ? weightKg / (heightM * heightM) : null

  let leanMassKg: number | null = null
  let fatMassKg: number | null = null
  if (weightKg && bodyFatPct != null && bodyFatPct >= 0 && bodyFatPct < 100) {
    fatMassKg = weightKg * (bodyFatPct / 100)
    leanMassKg = weightKg - fatMassKg
  }

  let ffmi: number | null = null
  let normalizedFfmi: number | null = null
  if (leanMassKg != null && heightM) {
    ffmi = leanMassKg / (heightM * heightM)
    // Kouri normalization to 1.68m reference
    normalizedFfmi = ffmi + 6.1 * (1.8 - heightM)
  }

  const waistToHip = waistCm && hipCm ? waistCm / hipCm : null
  const waistToHeight = waistCm && heightCm ? waistCm / heightCm : null

  return {
    leanMassKg: round(leanMassKg, 1),
    fatMassKg: round(fatMassKg, 1),
    ffmi: round(ffmi, 1),
    normalizedFfmi: round(normalizedFfmi, 1),
    waistToHip: round(waistToHip, 2),
    waistToHeight: round(waistToHeight, 2),
    bmi: round(bmi, 1),
  }
}

// FFMI → human label
export function ffmiLabel(ffmi: number | null): string {
  if (ffmi == null) return '—'
  if (ffmi < 14.5) return 'Sedentaria'
  if (ffmi < 16.5) return 'Entrenada'
  if (ffmi < 17.5) return 'Avanzada'
  if (ffmi < 18.5) return 'Cerca del techo'
  return 'Techo natural'
}

// Waist-to-hip risk label (female cutoffs per WHO)
export function waistToHipLabel(ratio: number | null): { label: string; level: 'good' | 'warn' | 'alert' } {
  if (ratio == null) return { label: '—', level: 'good' }
  if (ratio <= 0.72) return { label: 'Excelente', level: 'good' }
  if (ratio <= 0.80) return { label: 'Normal', level: 'good' }
  if (ratio <= 0.85) return { label: 'Elevado', level: 'warn' }
  return { label: 'Alto', level: 'alert' }
}

// Progress towards FFMI goal: 0..1 clamp between baseline and target.
export function ffmiProgress(
  current: number | null,
  baseline: number,
  target: number,
): number | null {
  if (current == null) return null
  if (target <= baseline) return null
  const pct = (current - baseline) / (target - baseline)
  return Math.max(0, Math.min(1, pct))
}

function round(v: number | null, digits: number): number | null {
  if (v == null || !Number.isFinite(v)) return null
  const m = Math.pow(10, digits)
  return Math.round(v * m) / m
}
