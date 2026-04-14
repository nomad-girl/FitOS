/**
 * Recovery Engine — Physiological cycle detection & readiness scoring
 *
 * Computes readiness scores (0-100) for global, upper, and lower body,
 * detects the current training phase per zone, classifies energy state,
 * and generates actionable recommendations.
 */

// ── Types ──────────────────────────────────────────────────────────

export type Phase = 'accumulation' | 'peak' | 'fatigue' | 'deload'
export type EnergyState = 'high' | 'sufficient' | 'low' | 'very_low'
export type TrainingStimulus = 'recovery' | 'volume' | 'intense' | 'max'
export type PerformanceTrend = 'up' | 'same' | 'down'

export interface RecoveryInput {
  // Subjective (1-5)
  energy: number | null
  hunger: number | null
  mood: number | null
  sleepHours: number | null
  fatigueGlobal: number | null
  fatigueUpper: number | null
  fatigueLower: number | null

  // Nutrition & activity
  caloriesToday: number | null
  caloriesAvg7d: number | null
  stepsToday: number | null
  stepsAvg7d: number | null

  // Performance trends (computed from recent sessions)
  performanceUpper: PerformanceTrend
  performanceLower: PerformanceTrend

  // Training context
  trainedYesterday: boolean
  consecutiveTrainingDays: number
  daysUntilNextTraining: number | null

  // Yesterday's zones trained (for penalty)
  trainedUpperYesterday: boolean
  trainedLowerYesterday: boolean
}

export interface RecoveryOutput {
  readinessGlobal: number
  readinessUpper: number
  readinessLower: number
  energyScore: number

  phaseGlobal: Phase
  phaseUpper: Phase
  phaseLower: Phase
  energyState: EnergyState

  systemReading: string
  recommendation: string
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Scale a 1-5 subjective value to 0-100 */
function scale5to100(val: number | null): number {
  if (val == null) return 50 // neutral default
  return Math.round(((val - 1) / 4) * 100)
}

/** Invert a 1-5 scale (fatigue: 5=bad → 0, 1=good → 100) */
function invertScale5to100(val: number | null): number {
  if (val == null) return 50
  return Math.round(((5 - val) / 4) * 100)
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}

function trendScore(trend: PerformanceTrend): number {
  switch (trend) {
    case 'up': return 100
    case 'same': return 60
    case 'down': return 20
  }
}

// ── Readiness Scores ────────────────────────────────────────────────

function computeReadinessGlobal(input: RecoveryInput): number {
  const energy = scale5to100(input.energy) * 0.30
  const sleep = input.sleepHours != null
    ? clamp((input.sleepHours / 8) * 100) * 0.20
    : 50 * 0.20
  const mood = scale5to100(input.mood) * 0.10
  const hunger = scale5to100(input.hunger) * 0.10 // moderate hunger = good
  const fatigue = invertScale5to100(input.fatigueGlobal) * 0.30

  return clamp(energy + sleep + mood + hunger + fatigue)
}

function computeReadinessUpper(input: RecoveryInput, globalReadiness: number): number {
  const base = globalReadiness * 0.40
  const fatigue = invertScale5to100(input.fatigueUpper) * 0.40
  const performance = trendScore(input.performanceUpper) * 0.20

  let score = base + fatigue + performance

  // Penalize if trained upper yesterday
  if (input.trainedUpperYesterday) {
    score *= 0.85
  }

  return clamp(score)
}

function computeReadinessLower(input: RecoveryInput, globalReadiness: number): number {
  const base = globalReadiness * 0.40
  const fatigue = invertScale5to100(input.fatigueLower) * 0.40
  const performance = trendScore(input.performanceLower) * 0.20

  let score = base + fatigue + performance

  // Penalize if trained lower yesterday
  if (input.trainedLowerYesterday) {
    score *= 0.85
  }

  return clamp(score)
}

// ── Energy Score ────────────────────────────────────────────────────

function computeEnergyScore(input: RecoveryInput): number {
  let score = 50 // baseline

  // Energy (1-5) → 0-30 points
  if (input.energy != null) {
    score += ((input.energy - 1) / 4) * 30 - 15
  }

  // Hunger: moderate (2-3) is ideal, high (4-5) is bad signal
  if (input.hunger != null) {
    if (input.hunger <= 3) score += 10
    else if (input.hunger === 4) score -= 10
    else score -= 20
  }

  // Calories vs average
  if (input.caloriesToday != null && input.caloriesAvg7d != null && input.caloriesAvg7d > 0) {
    const ratio = input.caloriesToday / input.caloriesAvg7d
    if (ratio >= 0.9 && ratio <= 1.1) score += 15
    else if (ratio < 0.8) score -= 15
    else if (ratio < 0.9) score -= 5
  }

  // High steps with low energy = energy drain
  if (input.stepsToday != null && input.stepsAvg7d != null && input.stepsAvg7d > 0) {
    const ratio = input.stepsToday / input.stepsAvg7d
    if (ratio > 1.3 && (input.energy ?? 3) <= 2) {
      score -= 10
    }
  }

  return clamp(score)
}

function classifyEnergyState(score: number): EnergyState {
  if (score >= 75) return 'high'
  if (score >= 55) return 'sufficient'
  if (score >= 35) return 'low'
  return 'very_low'
}

// ── Phase Detection ─────────────────────────────────────────────────

function detectPhase(readiness: number, fatigue: number | null, trend: PerformanceTrend): Phase {
  const fatigueVal = fatigue ?? 3

  // Very high readiness + not declining = peak performance window
  if (readiness >= 78 && trend !== 'down') return 'peak'

  // Good readiness = productive accumulation
  if (readiness >= 65) return 'accumulation'

  // Medium-low readiness with declining performance or high fatigue = needs deload
  if (readiness < 55 && (trend === 'down' || fatigueVal >= 4)) return 'deload'

  // Low readiness or high fatigue = fatigue accumulating
  if (readiness < 55 || fatigueVal >= 4) return 'fatigue'

  // Mid-range (55-64): check fatigue to differentiate
  if (fatigueVal <= 2 && trend !== 'down') return 'accumulation'

  return 'fatigue'
}

// ── Recommendations ─────────────────────────────────────────────────

const phaseLabel: Record<Phase, string> = {
  accumulation: 'Acumulación',
  peak: 'Peak',
  fatigue: 'Fatiga acumulada',
  deload: 'Recuperación / Deload',
}

const energyLabel: Record<EnergyState, string> = {
  high: 'Alto',
  sufficient: 'Suficiente',
  low: 'Bajo',
  very_low: 'Muy bajo',
}

function readinessLabel(score: number): string {
  if (score >= 80) return 'Alto'
  if (score >= 65) return 'Bueno'
  if (score >= 50) return 'Medio'
  return 'Bajo'
}

function generateSystemReading(input: RecoveryInput, output: Omit<RecoveryOutput, 'systemReading' | 'recommendation'>): string {
  const parts: string[] = []

  // Data quality note
  const hasSubjectiveData = input.energy != null || input.fatigueGlobal != null || input.mood != null
  if (!hasSubjectiveData) {
    parts.push('Sin registro de hoy — usando valores neutros.')
  }

  // Global state with numbers
  parts.push(`Readiness global ${readinessLabel(output.readinessGlobal).toLowerCase()} (${output.readinessGlobal}/100).`)

  // Zone comparison with actual fatigue values
  if (output.phaseUpper !== output.phaseLower) {
    parts.push(`Upper en ${phaseLabel[output.phaseUpper].toLowerCase()} (${output.readinessUpper}), lower en ${phaseLabel[output.phaseLower].toLowerCase()} (${output.readinessLower}).`)
  } else {
    parts.push(`Ambos trenes en ${phaseLabel[output.phaseUpper].toLowerCase()} (U:${output.readinessUpper} / L:${output.readinessLower}).`)
  }

  // Specific subjective data insights
  if (input.energy != null && input.energy <= 2) {
    parts.push(`Energía baja (${input.energy}/5).`)
  }
  if (input.sleepHours != null && input.sleepHours < 6.5) {
    parts.push(`Sueño corto (${input.sleepHours}h).`)
  }
  if (input.fatigueUpper != null && input.fatigueUpper >= 4) {
    parts.push(`Upper muy cargado (${input.fatigueUpper}/5).`)
  }
  if (input.fatigueLower != null && input.fatigueLower >= 4) {
    parts.push(`Lower muy cargado (${input.fatigueLower}/5).`)
  }

  // Energy state with cause
  if (output.energyState === 'low' || output.energyState === 'very_low') {
    const isLowFuel = (input.hunger ?? 3) >= 4 && (input.energy ?? 3) <= 2
    if (isLowFuel) {
      parts.push(`Posible falta de combustible: energía ${input.energy}/5 con hambre ${input.hunger}/5.`)
    } else if (input.caloriesToday != null && input.caloriesAvg7d != null && input.caloriesToday < input.caloriesAvg7d * 0.85) {
      parts.push(`Calorías por debajo del promedio (${input.caloriesToday} vs ${input.caloriesAvg7d} avg).`)
    } else {
      parts.push(`Estado energético ${energyLabel[output.energyState].toLowerCase()} (${output.energyScore}/100).`)
    }
  }

  // Training load context
  if (input.consecutiveTrainingDays >= 3) {
    parts.push(`${input.consecutiveTrainingDays} días seguidos de entreno — acumulando carga.`)
  }
  if (input.trainedYesterday) {
    const zones: string[] = []
    if (input.trainedUpperYesterday) zones.push('upper')
    if (input.trainedLowerYesterday) zones.push('lower')
    if (zones.length > 0) parts.push(`Ayer entrenaste ${zones.join(' y ')}.`)
  }

  // Performance trends
  if (input.performanceUpper === 'down' && input.performanceLower === 'down') {
    parts.push('Rendimiento bajando en ambos trenes.')
  } else if (input.performanceUpper === 'down') {
    parts.push('Rendimiento upper en descenso.')
  } else if (input.performanceLower === 'down') {
    parts.push('Rendimiento lower en descenso.')
  }

  return parts.join(' ')
}

function generateRecommendation(input: RecoveryInput, output: Omit<RecoveryOutput, 'systemReading' | 'recommendation'>): string {
  const recs: string[] = []

  // Zone-specific recommendations with context
  if (output.readinessUpper >= 65 && output.readinessLower < 50) {
    recs.push(`Upper listo para empujar (${output.readinessUpper}). Lower necesita deload o movilidad (${output.readinessLower}).`)
  } else if (output.readinessLower >= 65 && output.readinessUpper < 50) {
    recs.push(`Lower listo para empujar (${output.readinessLower}). Upper necesita deload (${output.readinessUpper}).`)
  } else if (output.readinessUpper >= 80 && output.readinessLower >= 80) {
    recs.push('Ambos trenes en óptimo. Día ideal para intensidad alta o PRs.')
  } else if (output.readinessUpper >= 50 && output.readinessLower >= 50) {
    recs.push('Readiness medio. Hipertrofia con RPE moderado (6-7).')
  } else {
    recs.push('Readiness bajo. Sesión liviana, movilidad, o descanso activo.')
  }

  // Same-zone penalty
  if (input.trainedUpperYesterday && output.readinessUpper < 70) {
    recs.push('Evitar upper intenso hoy — entrenaste esa zona ayer.')
  }
  if (input.trainedLowerYesterday && output.readinessLower < 70) {
    recs.push('Evitar lower intenso hoy — entrenaste esa zona ayer.')
  }

  // Energy/nutrition recommendations with numbers
  if (output.energyState === 'very_low') {
    if ((input.hunger ?? 3) >= 4) {
      recs.push(`Prioridad: comer más. Hambre alta (${input.hunger}/5) con energía baja.`)
    } else {
      recs.push('Energía muy baja. Considerar día off o solo movilidad.')
    }
  } else if (output.energyState === 'low') {
    if (input.caloriesToday != null && input.caloriesAvg7d != null && input.caloriesToday < input.caloriesAvg7d * 0.85) {
      recs.push(`Subir calorías: ${input.caloriesToday} hoy vs ${input.caloriesAvg7d} promedio.`)
    }
  }

  // Sleep
  if (input.sleepHours != null && input.sleepHours < 6) {
    recs.push(`Solo ${input.sleepHours}h de sueño. No es día para máximos.`)
  }

  // Consecutive training
  if (input.consecutiveTrainingDays >= 4) {
    recs.push(`${input.consecutiveTrainingDays} días seguidos entrenando. Día de descanso activo recomendado.`)
  } else if (input.consecutiveTrainingDays === 3) {
    recs.push('3 días seguidos de entreno. Si entrenás, bajar volumen.')
  }

  // Rest days ahead
  if (input.daysUntilNextTraining != null && input.daysUntilNextTraining >= 2 && output.readinessGlobal >= 60) {
    recs.push(`${input.daysUntilNextTraining} días de descanso por delante — podés empujar más.`)
  }

  // Mood
  if (input.mood != null && input.mood <= 2) {
    recs.push('Ánimo bajo. Elegir un entreno que te guste, no el más duro.')
  }

  return recs.join(' ')
}

// ── Training Stimulus Classification ────────────────────────────────

export function classifyStimulus(rpeAvg: number | null, rpeMax: number | null, prCount: number): TrainingStimulus {
  if (prCount > 0 || (rpeMax != null && rpeMax >= 9.5)) return 'max'
  if (rpeAvg != null) {
    if (rpeAvg >= 8) return 'intense'
    if (rpeAvg >= 6.5) return 'volume'
  }
  return 'recovery'
}

export const stimulusLabel: Record<TrainingStimulus, string> = {
  recovery: 'Recuperación',
  volume: 'Volumen',
  intense: 'Intenso',
  max: 'Máximo',
}

export const stimulusColor: Record<TrainingStimulus, string> = {
  recovery: '#10B981',  // green
  volume: '#3B82F6',    // blue
  intense: '#F59E0B',   // amber
  max: '#EF4444',       // red
}

// ── Muscle Group Classification ─────────────────────────────────────

const UPPER_MUSCLES = new Set([
  'chest', 'shoulders', 'biceps', 'triceps', 'upper back', 'lats', 'traps',
  'forearms', 'neck',
])

const LOWER_MUSCLES = new Set([
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors',
  'hip flexors',
])

export function classifyMuscleZone(muscleGroup: string): 'upper' | 'lower' | 'core' | 'full' {
  const mg = muscleGroup.toLowerCase()
  if (UPPER_MUSCLES.has(mg)) return 'upper'
  if (LOWER_MUSCLES.has(mg)) return 'lower'
  if (mg === 'abdominals' || mg === 'core' || mg === 'lower back') return 'core'
  return 'full'
}

export function workoutIsUpper(muscleGroups: string[]): boolean {
  const zones = muscleGroups.map(classifyMuscleZone)
  const upperCount = zones.filter(z => z === 'upper').length
  return upperCount > zones.length * 0.5
}

export function workoutIsLower(muscleGroups: string[]): boolean {
  const zones = muscleGroups.map(classifyMuscleZone)
  const lowerCount = zones.filter(z => z === 'lower').length
  return lowerCount > zones.length * 0.5
}

// ── Main Engine ─────────────────────────────────────────────────────

export function computeRecovery(input: RecoveryInput): RecoveryOutput {
  const readinessGlobal = computeReadinessGlobal(input)
  const readinessUpper = computeReadinessUpper(input, readinessGlobal)
  const readinessLower = computeReadinessLower(input, readinessGlobal)
  const energyScore = computeEnergyScore(input)

  const phaseGlobal = detectPhase(readinessGlobal, input.fatigueGlobal, input.performanceUpper)
  const phaseUpper = detectPhase(readinessUpper, input.fatigueUpper, input.performanceUpper)
  const phaseLower = detectPhase(readinessLower, input.fatigueLower, input.performanceLower)
  const energyState = classifyEnergyState(energyScore)

  const partial = {
    readinessGlobal,
    readinessUpper,
    readinessLower,
    energyScore,
    phaseGlobal,
    phaseUpper,
    phaseLower,
    energyState,
  }

  return {
    ...partial,
    systemReading: generateSystemReading(input, partial),
    recommendation: generateRecommendation(input, partial),
  }
}
