export interface WeeklyScoreData {
  score: number | null
  status: 'pendiente' | 'parcial' | 'completo'
  breakdown: {
    entrenamiento: number | null
    nutricion: number | null
    pasos: number | null
    sueno: number | null
  }
}

export function computeWeeklyScore(
  logs: { calories: number | null; protein_g: number | null; steps: number | null; sleep_hours: number | null }[],
  targets: { calorie_target: number | null; protein_target: number | null; step_goal: number | null; sleep_goal: number | null },
  adherence: { done: number; planned: number } | null,
): WeeklyScoreData {
  const hasLogs = logs.length > 0
  const hasAdherence = adherence && adherence.planned > 0

  // Entrenamiento (training adherence) — 30% weight
  let entrenamientoScore: number | null = null
  if (hasAdherence) {
    entrenamientoScore = Math.min(Math.round((adherence!.done / adherence!.planned) * 100), 100)
  }

  // Nutricion — 30% weight
  // If targets are set, score vs targets. Otherwise, score based on logging consistency.
  let nutricionScore: number | null = null
  if (hasLogs) {
    let calScore: number | null = null
    let protScore: number | null = null

    const cals = logs.filter(l => l.calories != null).map(l => l.calories!)
    const prots = logs.filter(l => l.protein_g != null).map(l => l.protein_g!)

    if (targets.calorie_target && cals.length > 0) {
      const avg = cals.reduce((a, b) => a + b, 0) / cals.length
      const ratio = avg / targets.calorie_target
      calScore = Math.max(0, Math.round(100 - Math.abs(1 - ratio) * 200))
    }

    if (targets.protein_target && prots.length > 0) {
      const avg = prots.reduce((a, b) => a + b, 0) / prots.length
      protScore = Math.min(Math.round((avg / targets.protein_target) * 100), 100)
    }

    // If no targets set but user logs nutrition, score based on logging consistency
    if (calScore === null && protScore === null) {
      const nutritionLogs = logs.filter(l => l.calories != null || l.protein_g != null).length
      if (nutritionLogs > 0) {
        nutricionScore = Math.min(Math.round((nutritionLogs / 7) * 100), 100)
      }
    } else {
      const scores = [calScore, protScore].filter((s): s is number => s !== null)
      if (scores.length > 0) {
        nutricionScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      }
    }
  }

  // Pasos — 20% weight
  let pasosScore: number | null = null
  if (hasLogs && targets.step_goal) {
    const steps = logs.filter(l => l.steps != null).map(l => l.steps!)
    if (steps.length > 0) {
      const avg = steps.reduce((a, b) => a + b, 0) / steps.length
      pasosScore = Math.min(Math.round((avg / targets.step_goal) * 100), 100)
    }
  }

  // Sueno — 20% weight
  let suenoScore: number | null = null
  if (hasLogs && targets.sleep_goal) {
    const sleeps = logs.filter(l => l.sleep_hours != null).map(l => l.sleep_hours!)
    if (sleeps.length > 0) {
      const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length
      const ratio = avg / targets.sleep_goal
      suenoScore = ratio >= 1 ? 100 : Math.round(ratio * 100)
    }
  }

  // Weighted total (only from available scores)
  const parts: { score: number; weight: number }[] = []
  if (entrenamientoScore !== null) parts.push({ score: entrenamientoScore, weight: 0.30 })
  if (nutricionScore !== null) parts.push({ score: nutricionScore, weight: 0.30 })
  if (pasosScore !== null) parts.push({ score: pasosScore, weight: 0.20 })
  if (suenoScore !== null) parts.push({ score: suenoScore, weight: 0.20 })

  let score: number | null = null
  let status: 'pendiente' | 'parcial' | 'completo' = 'pendiente'

  if (parts.length > 0) {
    const totalWeight = parts.reduce((a, p) => a + p.weight, 0)
    score = Math.round(parts.reduce((a, p) => a + p.score * (p.weight / totalWeight), 0))
    status = parts.length >= 3 ? 'completo' : 'parcial'
  }

  return {
    score,
    status,
    breakdown: {
      entrenamiento: entrenamientoScore,
      nutricion: nutricionScore,
      pasos: pasosScore,
      sueno: suenoScore,
    },
  }
}
