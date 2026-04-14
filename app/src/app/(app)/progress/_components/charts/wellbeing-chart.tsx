'use client'

import { useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip,
} from 'recharts'

interface Props {
  dailyLogs: Record<string, any>[]
}

const VARS = [
  { key: 'energy', label: 'Energia', color: '#10B981' },
  { key: 'mood', label: 'Animo', color: '#F59E0B' },
  { key: 'sleep_hours', label: 'Sueno', color: '#6366F1' },
  { key: 'fatigue_level', label: 'Fatiga', color: '#EF4444' },
  { key: 'hunger', label: 'Hambre', color: '#EC4899' },
  { key: 'fatigue_upper', label: 'Fatiga sup.', color: '#F97316' },
  { key: 'fatigue_lower', label: 'Fatiga inf.', color: '#A855F7' },
]

export function WellbeingChart({ dailyLogs }: Props) {
  const [activeVars, setActiveVars] = useState<Record<string, boolean>>({ energy: true, mood: true, sleep_hours: true, fatigue_level: true })

  const available = VARS.filter(v => dailyLogs.some(l => l[v.key] != null))
  if (available.length === 0) return null

  const data = dailyLogs.filter(l => available.some(v => l[v.key] != null)).map(l => {
    const d = new Date(l.log_date + 'T12:00:00')
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      ...Object.fromEntries(available.map(v => [v.key, l[v.key]])),
    }
  })

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {available.map(v => (
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

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
            formatter={(value: any, name: any) => {
              const v = available.find(vr => vr.key === name)
              const unit = name === 'sleep_hours' ? 'h' : '/5'
              return [`${value}${unit}`, v?.label || name]
            }}
          />
          {available.filter(v => activeVars[v.key]).map(v => (
            <Area
              key={v.key}
              type="monotone"
              dataKey={v.key}
              stroke={v.color}
              fill={v.color}
              fillOpacity={0.1}
              strokeWidth={2}
              dot={{ r: 2, fill: v.color }}
              connectNulls
              name={v.key}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
