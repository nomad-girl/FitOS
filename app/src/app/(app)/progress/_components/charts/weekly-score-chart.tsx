'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip,
} from 'recharts'

interface Props {
  checkins: Record<string, any>[]
}

export function WeeklyScoreChart({ checkins }: Props) {
  const withScore = checkins.filter(c => c.weekly_score != null)
  if (withScore.length < 2) return null

  const data = withScore.map(c => {
    const d = new Date(c.checkin_date + 'T12:00:00')
    const breakdown = typeof c.score_breakdown === 'object' ? c.score_breakdown : {}
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      score: c.weekly_score,
      training: breakdown?.entrenamiento ?? null,
      nutrition: breakdown?.nutricion ?? null,
      steps: breakdown?.pasos ?? null,
      sleep: breakdown?.sueno ?? null,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[0, 100]} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
          formatter={(value: any, name: any) => {
            const labels: Record<string, string> = {
              score: 'Score Total',
              training: 'Entrenamiento',
              nutrition: 'Nutricion',
              steps: 'Pasos',
              sleep: 'Sueno',
            }
            return [value, labels[name] || name]
          }}
        />
        <Bar dataKey="training" stackId="a" fill="#F97316" opacity={0.25} name="training" />
        <Bar dataKey="nutrition" stackId="a" fill="#0EA5E9" opacity={0.25} name="nutrition" />
        <Bar dataKey="steps" stackId="a" fill="#06B6D4" opacity={0.25} name="steps" />
        <Bar dataKey="sleep" stackId="a" fill="#6366F1" opacity={0.25} name="sleep" radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10B981', stroke: 'white', strokeWidth: 1.5 }} name="score" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
