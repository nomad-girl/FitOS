export interface MetricDef {
  key: string
  label: string
  color: string
  unit: string
  source: 'daily_logs' | 'weekly_checkins' | 'recovery_snapshots' | 'executed_sessions'
  column: string
  category: 'body' | 'nutrition' | 'training' | 'recovery' | 'subjective'
  scale?: [number, number]
  higherIsBetter: boolean
}

export const METRICS: MetricDef[] = [
  // Body composition (weekly_checkins)
  { key: 'weight_kg', label: 'Peso', color: '#0EA5E9', unit: 'kg', source: 'weekly_checkins', column: 'weight_kg', category: 'body', higherIsBetter: false },
  { key: 'waist_cm', label: 'Cintura', color: '#F97316', unit: 'cm', source: 'weekly_checkins', column: 'waist_cm', category: 'body', higherIsBetter: false },
  { key: 'hip_cm', label: 'Cadera', color: '#EC4899', unit: 'cm', source: 'weekly_checkins', column: 'hip_cm', category: 'body', higherIsBetter: false },
  { key: 'thigh_cm', label: 'Muslo', color: '#8B5CF6', unit: 'cm', source: 'weekly_checkins', column: 'thigh_cm', category: 'body', higherIsBetter: false },
  { key: 'low_hip_cm', label: 'Cadera baja', color: '#14B8A6', unit: 'cm', source: 'weekly_checkins', column: 'low_hip_cm', category: 'body', higherIsBetter: false },
  { key: 'resting_hr', label: 'FC reposo', color: '#EF4444', unit: 'bpm', source: 'weekly_checkins', column: 'resting_hr', category: 'body', higherIsBetter: false },
  { key: 'hrv', label: 'HRV', color: '#6366F1', unit: 'ms', source: 'weekly_checkins', column: 'hrv', category: 'body', higherIsBetter: true },

  // Nutrition (daily_logs)
  { key: 'calories', label: 'Calorias', color: '#0EA5E9', unit: 'kcal', source: 'daily_logs', column: 'calories', category: 'nutrition', higherIsBetter: false },
  { key: 'protein_g', label: 'Proteina', color: '#8B5CF6', unit: 'g', source: 'daily_logs', column: 'protein_g', category: 'nutrition', higherIsBetter: true },

  // Training (daily_logs)
  { key: 'training_volume_kg', label: 'Volumen', color: '#F97316', unit: 'kg', source: 'daily_logs', column: 'training_volume_kg', category: 'training', higherIsBetter: true },
  { key: 'training_sets', label: 'Series', color: '#10B981', unit: '', source: 'daily_logs', column: 'training_sets', category: 'training', higherIsBetter: true },
  { key: 'training_rpe_avg', label: 'RPE prom', color: '#EF4444', unit: '', source: 'daily_logs', column: 'training_rpe_avg', category: 'training', higherIsBetter: false },

  // Subjective (daily_logs)
  { key: 'energy', label: 'Energia', color: '#10B981', unit: '/5', source: 'daily_logs', column: 'energy', category: 'subjective', scale: [1, 5], higherIsBetter: true },
  { key: 'mood', label: 'Animo', color: '#F59E0B', unit: '/5', source: 'daily_logs', column: 'mood', category: 'subjective', scale: [1, 5], higherIsBetter: true },
  { key: 'hunger', label: 'Hambre', color: '#EC4899', unit: '/5', source: 'daily_logs', column: 'hunger', category: 'subjective', scale: [1, 5], higherIsBetter: false },
  { key: 'fatigue_level', label: 'Fatiga', color: '#EF4444', unit: '/5', source: 'daily_logs', column: 'fatigue_level', category: 'subjective', scale: [1, 5], higherIsBetter: false },
  { key: 'fatigue_upper', label: 'Fatiga superior', color: '#F97316', unit: '/5', source: 'daily_logs', column: 'fatigue_upper', category: 'subjective', scale: [1, 5], higherIsBetter: false },
  { key: 'fatigue_lower', label: 'Fatiga inferior', color: '#A855F7', unit: '/5', source: 'daily_logs', column: 'fatigue_lower', category: 'subjective', scale: [1, 5], higherIsBetter: false },
  { key: 'sleep_hours', label: 'Sueno', color: '#6366F1', unit: 'h', source: 'daily_logs', column: 'sleep_hours', category: 'subjective', higherIsBetter: true },
  { key: 'steps', label: 'Pasos', color: '#06B6D4', unit: '', source: 'daily_logs', column: 'steps', category: 'subjective', higherIsBetter: true },

  // Recovery (recovery_snapshots)
  { key: 'readiness_global', label: 'Readiness Global', color: '#10B981', unit: '', source: 'recovery_snapshots', column: 'readiness_global', category: 'recovery', higherIsBetter: true },
  { key: 'readiness_upper', label: 'Readiness Superior', color: '#0EA5E9', unit: '', source: 'recovery_snapshots', column: 'readiness_upper', category: 'recovery', higherIsBetter: true },
  { key: 'readiness_lower', label: 'Readiness Inferior', color: '#F97316', unit: '', source: 'recovery_snapshots', column: 'readiness_lower', category: 'recovery', higherIsBetter: true },

  // Weekly aggregates (weekly_checkins)
  { key: 'weekly_score', label: 'Score semanal', color: '#10B981', unit: 'pts', source: 'weekly_checkins', column: 'weekly_score', category: 'recovery', higherIsBetter: true },
]

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map(m => [m.key, m]))

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'body', label: 'Composicion Corporal' },
  { key: 'nutrition', label: 'Nutricion' },
  { key: 'training', label: 'Entrenamiento' },
  { key: 'subjective', label: 'Bienestar' },
  { key: 'recovery', label: 'Recuperacion' },
]

export function formatMetricValue(key: string, value: number): string {
  const m = METRIC_BY_KEY[key]
  if (!m) return String(value)
  if (key === 'steps') return `${(value / 1000).toFixed(1)}k`
  if (key === 'training_volume_kg' && value >= 1000) return `${(value / 1000).toFixed(1)}t`
  if (m.scale) return `${value}${m.unit}`
  if (Number.isInteger(value)) return `${value}${m.unit ? ' ' + m.unit : ''}`
  return `${value.toFixed(1)}${m.unit ? ' ' + m.unit : ''}`
}

export function deltaColor(key: string, delta: number): string {
  if (delta === 0) return '#9CA3AF'
  const m = METRIC_BY_KEY[key]
  if (!m) return '#9CA3AF'
  const positive = delta > 0
  return (positive === m.higherIsBetter) ? '#10B981' : '#EF4444'
}
