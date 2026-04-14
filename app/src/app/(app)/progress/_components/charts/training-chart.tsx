'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip,
} from 'recharts'

interface Props {
  dailyLogs: Record<string, any>[]
}

export function TrainingChart({ dailyLogs }: Props) {
  const trainingDays = dailyLogs.filter(l => l.training_volume_kg != null && l.training_volume_kg > 0)
  if (trainingDays.length === 0) return null

  const data = trainingDays.map(l => {
    const d = new Date(l.log_date + 'T12:00:00')
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      volume: l.training_volume_kg ? Math.round(l.training_volume_kg) : null,
      sets: l.training_sets,
      rpe: l.training_rpe_avg,
      name: l.training_name,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis yAxisId="vol" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis yAxisId="rpe" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[0, 10]} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
          formatter={(value: any, name: any) => {
            if (name === 'volume') return [`${value.toLocaleString()} kg`, 'Volumen']
            if (name === 'sets') return [value, 'Series']
            if (name === 'rpe') return [value, 'RPE']
            return [value, name]
          }}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload
            return item?.name ? `${label} - ${item.name}` : label
          }}
        />
        <Bar dataKey="volume" yAxisId="vol" fill="#F97316" opacity={0.35} radius={[3, 3, 0, 0]} name="volume" />
        <Line type="monotone" dataKey="sets" yAxisId="vol" stroke="#10B981" strokeWidth={2} dot={{ r: 2.5, fill: '#10B981' }} connectNulls name="sets" />
        <Line type="monotone" dataKey="rpe" yAxisId="rpe" stroke="#EF4444" strokeWidth={2} dot={{ r: 2.5, fill: '#EF4444' }} connectNulls name="rpe" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
