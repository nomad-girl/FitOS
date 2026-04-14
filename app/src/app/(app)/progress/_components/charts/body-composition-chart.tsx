'use client'

import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts'

interface Props {
  checkins: Record<string, any>[]
}

const VARS = [
  { key: 'weight_kg', label: 'Peso', color: '#0EA5E9', unit: 'kg', yAxisId: 'kg' },
  { key: 'waist_cm', label: 'Cintura', color: '#F97316', unit: 'cm', yAxisId: 'cm' },
  { key: 'hip_cm', label: 'Cadera', color: '#EC4899', unit: 'cm', yAxisId: 'cm' },
  { key: 'thigh_cm', label: 'Muslo', color: '#8B5CF6', unit: 'cm', yAxisId: 'cm' },
  { key: 'low_hip_cm', label: 'Cadera baja', color: '#14B8A6', unit: 'cm', yAxisId: 'cm' },
]

export function BodyCompositionChart({ checkins }: Props) {
  const [activeVars, setActiveVars] = useState<Record<string, boolean>>({ weight_kg: true, waist_cm: true })

  // Only show vars with data
  const availableVars = VARS.filter(v => checkins.some(c => c[v.key] != null))
  if (availableVars.length === 0) return null

  const data = checkins.map(c => {
    const d = new Date(c.checkin_date + 'T12:00:00')
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      ...Object.fromEntries(availableVars.map(v => [v.key, c[v.key]])),
    }
  })

  const hasKg = availableVars.some(v => v.yAxisId === 'kg' && activeVars[v.key])
  const hasCm = availableVars.some(v => v.yAxisId === 'cm' && activeVars[v.key])

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {availableVars.map(v => (
          <button
            key={v.key}
            onClick={() => setActiveVars(prev => ({ ...prev, [v.key]: !prev[v.key] }))}
            className="text-[.72rem] font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-all flex items-center gap-1"
            style={{
              borderColor: activeVars[v.key] ? v.color : '#E5E7EB',
              backgroundColor: activeVars[v.key] ? `${v.color}15` : 'transparent',
              color: activeVars[v.key] ? v.color : '#9CA3AF',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeVars[v.key] ? v.color : '#D1D5DB' }} />
            {v.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          {hasKg && <YAxis yAxisId="kg" tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={['auto', 'auto']} />}
          {hasCm && <YAxis yAxisId="cm" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={['auto', 'auto']} />}
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
            formatter={(value: any, name: any) => {
              const v = availableVars.find(vr => vr.key === name)
              return [`${value} ${v?.unit || ''}`, v?.label || name]
            }}
          />
          {availableVars.filter(v => activeVars[v.key]).map(v => (
            <Line
              key={v.key}
              type="monotone"
              dataKey={v.key}
              stroke={v.color}
              strokeWidth={2}
              dot={{ r: 3, fill: v.color, stroke: 'white', strokeWidth: 1.5 }}
              yAxisId={v.yAxisId}
              connectNulls
              name={v.key}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
