// Weekly periodization inside a phase: 3+1 block (accumulation/progression/peak/deload).
// Derives RPE target, rep range, volume multiplier from the week-of-mesocycle.
// No schema changes — purely computed from phase.start_date + current date + volume_targets.

export type MesocycleWeekType = 'accumulation' | 'progression' | 'peak' | 'deload'

export interface MesocycleWeekPlan {
  mesoWeek: number              // 1..4 inside the current 4-week block
  mesoBlockIndex: number        // 0, 1, 2 ... number of 3+1 blocks completed before this one
  type: MesocycleWeekType
  typeLabel: string             // Spanish label
  rpeTarget: number             // 1-10
  rir: number                   // reps in reserve
  repRange: [number, number]
  volumeMultiplier: number      // multiply MEV-ish base to get this week's target
  percent1RM: [number, number]  // advisory
  sensation: string
}

// Spec (from the training doc):
// Wk1 Accumulation: RPE 7, RIR 3, 10-15 reps, 60-67% 1RM, vol ×0.6
// Wk2 Progression:  RPE 8, RIR 2, 8-12 reps, 70-80% 1RM,  vol ×0.8
// Wk3 Peak:         RPE 9-10, RIR 0-1, 6-10 reps, 80-90% 1RM, vol ×1.0
// Wk4 Deload:       RPE 6, RIR 4+, 10-15 reps, 55-65% 1RM, vol ×0.4
const WEEK_TEMPLATES: Record<1 | 2 | 3 | 4, MesocycleWeekPlan> = {
  1: {
    mesoWeek: 1,
    mesoBlockIndex: 0,
    type: 'accumulation',
    typeLabel: 'Acumulación',
    rpeTarget: 7,
    rir: 3,
    repRange: [10, 15],
    volumeMultiplier: 0.6,
    percent1RM: [60, 67],
    sensation: 'Podría más',
  },
  2: {
    mesoWeek: 2,
    mesoBlockIndex: 0,
    type: 'progression',
    typeLabel: 'Progresión',
    rpeTarget: 8,
    rir: 2,
    repRange: [8, 12],
    volumeMultiplier: 0.8,
    percent1RM: [70, 80],
    sensation: 'Exigente',
  },
  3: {
    mesoWeek: 3,
    mesoBlockIndex: 0,
    type: 'peak',
    typeLabel: 'Peak',
    rpeTarget: 9.5,
    rir: 0,
    repRange: [6, 10],
    volumeMultiplier: 1.0,
    percent1RM: [80, 90],
    sensation: 'Al límite',
  },
  4: {
    mesoWeek: 4,
    mesoBlockIndex: 0,
    type: 'deload',
    typeLabel: 'Descarga',
    rpeTarget: 6,
    rir: 4,
    repRange: [10, 15],
    volumeMultiplier: 0.4,
    percent1RM: [55, 65],
    sensation: 'No sirve (es a propósito)',
  },
}

// Per-phase periodization stored on phases.periodization JSONB.
// When set, overrides the default 3+1 template above. Each entry corresponds
// to a single week inside the block; the block then repeats.
export interface PhasePeriodizationWeek {
  week: number                  // 1..blockLength (informational)
  type: MesocycleWeekType
  rpe: number
  rir: number
  repRange: [number, number]
  pct1rm: [number, number]
  volumeMultiplier: number
  sensation?: string
  note?: string
}
export interface PhasePeriodization {
  blockLength: number
  weeks: PhasePeriodizationWeek[]
}

// Resolve the mesocycle plan for a given phase week (1-based within the phase).
// If `periodization` is provided (from phase.periodization), it overrides the
// global template. Otherwise falls back to the 3+1 default in WEEK_TEMPLATES.
export function resolveMesocycleWeek(
  phaseWeek: number,
  periodizationOrBlockLength?: PhasePeriodization | number | null,
  legacyBlockLength = 4,
): MesocycleWeekPlan {
  const w = Math.max(1, Math.floor(phaseWeek))

  // Custom periodization path
  if (periodizationOrBlockLength && typeof periodizationOrBlockLength === 'object' && Array.isArray(periodizationOrBlockLength.weeks) && periodizationOrBlockLength.weeks.length > 0) {
    const p = periodizationOrBlockLength
    const blockLength = Math.max(1, p.blockLength || p.weeks.length)
    const idx = (w - 1) % blockLength
    const blockIndex = Math.floor((w - 1) / blockLength)
    const wk = p.weeks[idx] ?? p.weeks[p.weeks.length - 1]
    return {
      mesoWeek: (idx + 1) as 1 | 2 | 3 | 4,
      mesoBlockIndex: blockIndex,
      type: wk.type,
      typeLabel: typeLabel(wk.type),
      rpeTarget: wk.rpe,
      rir: wk.rir,
      repRange: wk.repRange,
      volumeMultiplier: wk.volumeMultiplier,
      percent1RM: wk.pct1rm,
      sensation: wk.sensation ?? defaultSensation(wk.type),
    }
  }

  // Default global template (current behavior)
  const blockLength = typeof periodizationOrBlockLength === 'number' ? periodizationOrBlockLength : legacyBlockLength
  const mesoWeek = ((w - 1) % blockLength) + 1 as 1 | 2 | 3 | 4
  const blockIndex = Math.floor((w - 1) / blockLength)
  return { ...WEEK_TEMPLATES[mesoWeek], mesoBlockIndex: blockIndex }
}

function typeLabel(t: MesocycleWeekType): string {
  return t === 'accumulation' ? 'Acumulación'
    : t === 'progression' ? 'Progresión'
    : t === 'peak' ? 'Peak'
    : 'Descarga'
}

function defaultSensation(t: MesocycleWeekType): string {
  return t === 'accumulation' ? 'Podría más'
    : t === 'progression' ? 'Exigente'
    : t === 'peak' ? 'Al límite'
    : 'No sirve (es a propósito)'
}

// Default periodization presets for the wizard (matches Sistema reference + extras).
export const PERIODIZATION_PRESETS: Record<string, { label: string; periodization: PhasePeriodization }> = {
  '3+1': {
    label: '3+1 (4 semanas)',
    periodization: {
      blockLength: 4,
      weeks: [
        { week: 1, type: 'accumulation', rpe: 7, rir: 3, repRange: [10, 15], pct1rm: [60, 67], volumeMultiplier: 0.6, sensation: 'Podría más' },
        { week: 2, type: 'progression',  rpe: 8, rir: 2, repRange: [8, 12],  pct1rm: [70, 80], volumeMultiplier: 0.8, sensation: 'Exigente' },
        { week: 3, type: 'peak',         rpe: 9.5, rir: 0, repRange: [6, 10], pct1rm: [80, 90], volumeMultiplier: 1.0, sensation: 'Al límite' },
        { week: 4, type: 'deload',       rpe: 6, rir: 4, repRange: [10, 15], pct1rm: [55, 65], volumeMultiplier: 0.4, sensation: 'No sirve (es a propósito)' },
      ],
    },
  },
  '4+1': {
    label: '4+1 (5 semanas)',
    periodization: {
      blockLength: 5,
      weeks: [
        { week: 1, type: 'accumulation', rpe: 7, rir: 3, repRange: [10, 15], pct1rm: [60, 67], volumeMultiplier: 0.6 },
        { week: 2, type: 'accumulation', rpe: 7.5, rir: 2.5, repRange: [9, 13], pct1rm: [65, 72], volumeMultiplier: 0.7 },
        { week: 3, type: 'progression',  rpe: 8, rir: 2, repRange: [8, 12],  pct1rm: [70, 80], volumeMultiplier: 0.85 },
        { week: 4, type: 'peak',         rpe: 9.5, rir: 0, repRange: [6, 10], pct1rm: [80, 90], volumeMultiplier: 1.0 },
        { week: 5, type: 'deload',       rpe: 6, rir: 4, repRange: [10, 15], pct1rm: [55, 65], volumeMultiplier: 0.4 },
      ],
    },
  },
  '5+1': {
    label: '5+1 (6 semanas)',
    periodization: {
      blockLength: 6,
      weeks: [
        { week: 1, type: 'accumulation', rpe: 7, rir: 3, repRange: [10, 15], pct1rm: [60, 67], volumeMultiplier: 0.6 },
        { week: 2, type: 'accumulation', rpe: 7.5, rir: 2.5, repRange: [9, 13], pct1rm: [65, 72], volumeMultiplier: 0.7 },
        { week: 3, type: 'progression',  rpe: 8, rir: 2, repRange: [8, 12], pct1rm: [70, 78], volumeMultiplier: 0.8 },
        { week: 4, type: 'progression',  rpe: 8.5, rir: 1.5, repRange: [7, 11], pct1rm: [75, 83], volumeMultiplier: 0.9 },
        { week: 5, type: 'peak',         rpe: 9.5, rir: 0, repRange: [5, 8], pct1rm: [82, 92], volumeMultiplier: 1.0 },
        { week: 6, type: 'deload',       rpe: 6, rir: 4, repRange: [10, 15], pct1rm: [55, 65], volumeMultiplier: 0.4 },
      ],
    },
  },
  linear: {
    label: 'Lineal (sin deload)',
    periodization: {
      blockLength: 4,
      weeks: [
        { week: 1, type: 'accumulation', rpe: 7, rir: 3, repRange: [10, 15], pct1rm: [60, 67], volumeMultiplier: 0.7 },
        { week: 2, type: 'progression',  rpe: 8, rir: 2, repRange: [8, 12], pct1rm: [70, 78], volumeMultiplier: 0.85 },
        { week: 3, type: 'progression',  rpe: 8.5, rir: 1.5, repRange: [6, 10], pct1rm: [75, 85], volumeMultiplier: 0.95 },
        { week: 4, type: 'peak',         rpe: 9, rir: 1, repRange: [5, 8], pct1rm: [82, 90], volumeMultiplier: 1.0 },
      ],
    },
  },
}

// Target sets per muscle group for this week, derived from volume_targets (MEV/MAV/MRV shape).
// If the stored format is flat (e.g. {glutes: 18}), treat it as MAV baseline and scale.
export function targetSetsForWeek(
  volumeTargets: Record<string, unknown> | null | undefined,
  plan: MesocycleWeekPlan,
): Record<string, number> {
  if (!volumeTargets || typeof volumeTargets !== 'object') return {}
  const out: Record<string, number> = {}
  const { volumeMultiplier, type } = plan

  for (const [muscle, raw] of Object.entries(volumeTargets)) {
    let baseline: number | null = null
    if (typeof raw === 'number') {
      baseline = raw
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      const mev = typeof obj.mev === 'number' ? obj.mev : null
      const mav = typeof obj.mav === 'number' ? obj.mav : null
      const mrv = typeof obj.mrv === 'number' ? obj.mrv : null
      // Anchor to MEV for accum, MAV for progression, (MRV-1) for peak, MEV-2 for deload
      if (type === 'accumulation' && mev != null) baseline = mev
      else if (type === 'progression' && mav != null) baseline = mav
      else if (type === 'peak' && mrv != null) baseline = Math.max(mav ?? mrv - 2, mrv - 2)
      else if (type === 'deload' && mev != null) baseline = Math.max(0, mev - 2)
      else baseline = mav ?? mev ?? mrv ?? null
    }
    if (baseline == null) continue

    // For MEV/MAV/MRV shape, the anchor already encodes the phase, so don't multiply again.
    // For flat numbers, treat baseline as MAV and apply the multiplier.
    const anchored = typeof raw === 'object'
    out[muscle] = Math.round(anchored ? baseline : baseline * volumeMultiplier)
  }
  return out
}

// Compact human summary for a chip: "RPE 8 · 8-12 reps · RIR 2"
export function formatMesoChip(plan: MesocycleWeekPlan): string {
  return `RPE ${plan.rpeTarget} · ${plan.repRange[0]}-${plan.repRange[1]} reps · RIR ${plan.rir}`
}

// ─────────────────────────────────────────────────────────────
// Reference tables (volume progression + session matrix)
// Data source: "Sistema de entrenamiento final" doc (Nati, abril 2026)
// ─────────────────────────────────────────────────────────────

export interface MuscleVolumeRow {
  muscle: string
  mev: number
  week1: number
  week2: number
  week3: number
  deload: number
  mrv: [number, number]
}

export const MUSCLE_VOLUME_PROGRESSION: MuscleVolumeRow[] = [
  { muscle: 'Glúteos',        mev: 10, week1: 12, week2: 16, week3: 20, deload: 8, mrv: [22, 25] },
  { muscle: 'Cuádriceps',     mev: 6,  week1: 8,  week2: 11, week3: 14, deload: 5, mrv: [16, 18] },
  { muscle: 'Isquiotibiales', mev: 6,  week1: 8,  week2: 10, week3: 13, deload: 5, mrv: [16, 18] },
  { muscle: 'Espalda',        mev: 6,  week1: 8,  week2: 10, week3: 13, deload: 5, mrv: [16, 18] },
  { muscle: 'Bíceps',         mev: 4,  week1: 5,  week2: 7,  week3: 9,  deload: 4, mrv: [12, 14] },
  { muscle: 'Hombros',        mev: 2,  week1: 4,  week2: 6,  week3: 8,  deload: 3, mrv: [8, 10] },
  { muscle: 'Pecho',          mev: 2,  week1: 3,  week2: 4,  week3: 5,  deload: 2, mrv: [8, 10] },
  { muscle: 'Tríceps',        mev: 2,  week1: 3,  week2: 4,  week3: 5,  deload: 2, mrv: [8, 10] },
]

export const MUSCLE_VOLUME_TOTALS = {
  mev: 38,
  week1: 51,
  week2: 68,
  week3: 87,
  deload: 34,
  perSession3x: { week1: 17, week2: 23, week3: 29, deload: 11 },
}

export interface SessionCellSpec {
  reps: string
  series: string
  rpe: string
  rir: string
  percent1RM: string
}

export interface SessionRow {
  week: 1 | 2 | 3 | 4
  label: string
  sessionA: SessionCellSpec
  sessionB: SessionCellSpec
  sessionC: SessionCellSpec
}

// Session A: Glúteo+cuád+empuje | B: Isquio+espalda+bíceps | C: Full lower+detalles
export const SESSION_MATRIX: SessionRow[] = [
  {
    week: 1, label: 'Acumulación',
    sessionA: { reps: '10-15', series: '32-36', rpe: '7',    rir: '3',   percent1RM: '60-67%' },
    sessionB: { reps: '10-15', series: '32-36', rpe: '7',    rir: '3',   percent1RM: '60-67%' },
    sessionC: { reps: '15-20', series: '28-32', rpe: '6',    rir: '4+',  percent1RM: '50-60%' },
  },
  {
    week: 2, label: 'Progresión',
    sessionA: { reps: '6-12',  series: '26-30', rpe: '8',    rir: '2',   percent1RM: '70-80%' },
    sessionB: { reps: '6-12',  series: '26-30', rpe: '8',    rir: '2',   percent1RM: '70-80%' },
    sessionC: { reps: '10-15', series: '22-26', rpe: '7',    rir: '3',   percent1RM: '60-67%' },
  },
  {
    week: 3, label: 'Peak',
    sessionA: { reps: '6-10',  series: '20-24', rpe: '9-10', rir: '0-1', percent1RM: '80-90%' },
    sessionB: { reps: '6-10',  series: '20-24', rpe: '9-10', rir: '0-1', percent1RM: '80-90%' },
    sessionC: { reps: '8-12',  series: '18-22', rpe: '8',    rir: '2',   percent1RM: '70-80%' },
  },
  {
    week: 4, label: 'Descarga',
    sessionA: { reps: '10-15', series: '15-18', rpe: '6-7',  rir: '4+',  percent1RM: '55-65%' },
    sessionB: { reps: '10-15', series: '15-18', rpe: '6-7',  rir: '4+',  percent1RM: '55-65%' },
    sessionC: { reps: '12-20', series: '12-15', rpe: '5-6',  rir: '5+',  percent1RM: '45-55%' },
  },
]

export interface ConsecutiveDayRule {
  pair: string          // e.g. "A → B"
  verdict: 'works' | 'avoid'
  verdictLabel: string  // "funciona" | "evitar"
  reason: string
}

export const CONSECUTIVE_DAYS: ConsecutiveDayRule[] = [
  { pair: 'A seguido de B', verdict: 'works', verdictLabel: 'funciona', reason: 'Empuje de cadera ayer, tiraje hoy. Patrones distintos.' },
  { pair: 'B seguido de C', verdict: 'works', verdictLabel: 'funciona', reason: 'Tiraje ayer, lower liviano hoy.' },
  { pair: 'C seguido de A', verdict: 'works', verdictLabel: 'funciona', reason: 'Lower liviano ayer, lower pesado hoy.' },
  { pair: 'A seguido de C', verdict: 'avoid', verdictLabel: 'evitar',   reason: 'Ambos tienen empuje de cadera pesado. Necesitan 48h+.' },
]

export const GOLDEN_RULES = [
  'Volumen y RPE nunca suben juntos. Cuando uno sube, el otro baja.',
  'RPE 9-10 solo en semana 3 (peak). Es tu semana de PRs.',
  'La descarga se siente como perder el tiempo. Si no se siente así, estás yendo muy pesado.',
  'La sesión C siempre va un escalón por debajo de A y B en RPE y carga.',
  'Los % de 1RM son orientativos. Lo que manda es el RPE/RIR. Si el 70% se siente como RPE 9, bajá el peso.',
  'Para ejercicios de aislamiento, ignorá el % de 1RM. Guíate solo por RPE y reps.',
]
