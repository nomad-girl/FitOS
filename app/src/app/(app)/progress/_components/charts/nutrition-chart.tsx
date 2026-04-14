'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts'

interface Props {
  dailyLogs: Record<string, any>[]
  calorieTarget: number | null
  proteinTarget: number | null
}

export function NutritionChart({ dailyLogs, calorieTarget, proteinTarget }: Props) {
  const logsWithNutrition = dailyLogs.filter(l => l.calories != null || l.protein_g != null)
  if (logsWithNutrition.length === 0) return null

  const data = logsWithNutrition.map(l => {
    const d = new Date(l.log_date + 'T12:00:00')
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      calories: l.calories,
      protein_g: l.protein_g,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis yAxisId="cal" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis yAxisId="prot" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
          formatter={(value: any, name: any) => {
            if (name === 'calories') return [`${value} kcal`, 'Calorias']
            if (name === 'protein_g') return [`${value}g`, 'Proteina']
            return [value, name]
          }}
        />
        {calorieTarget && (
          <ReferenceLine yAxisId="cal" y={calorieTarget} stroke="#0EA5E9" strokeDasharray="5 5" strokeOpacity={0.5} />
        )}
        {proteinTarget && (
          <ReferenceLine yAxisId="prot" y={proteinTarget} stroke="#8B5CF6" strokeDasharray="5 5" strokeOpacity={0.5} />
        )}
        <Bar dataKey="calories" yAxisId="cal" fill="#0EA5E9" opacity={0.3} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="protein_g" yAxisId="prot" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 2.5, fill: '#8B5CF6' }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
