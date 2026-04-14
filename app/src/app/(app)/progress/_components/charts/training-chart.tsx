'use client'

import { useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip,
} from 'recharts'

interface Props {
  dailyLogs: Record<string, any>[]
}

const VARS = [
  { key: 'volume', label: 'Volumen', color: '#F97316', type: 'bar' as const },
  { key: 'sets', label: 'Series', color: '#10B981', type: 'line' as const },
  { key: 'rpe', label: 'RPE', color: '#EF4444', type: 'line' as const },
]

export function TrainingChart({ dailyLogs }: Props) {
  const [activeVars, setActiveVars] = useState<Record<string, boolean>>({ volume: true, sets: true, rpe: true })

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

  const showVolume = activeVars.volume
  const showSets = activeVars.sets
  const showRpe = activeVars.rpe

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {VARS.map(v => (
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
        <ComposedChart data={data} margin={{ top: 5, right: showRpe || showSets ? 10 : 5, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          {/* Left axis: volume (kg) */}
          {showVolume && <YAxis yAxisId="vol" tick={{ fontSize: 10, fill: '#9CA3AF' }} />}
          {/* Right axis: RPE (0-10) or sets — whichever is shown */}
          {showRpe && <YAxis yAxisId="rpe" orientation="right" tick={{ fontSize: 10, fill: '#EF4444' }} domain={[0, 10]} />}
          {showSets && !showRpe && <YAxis yAxisId="sets" orientation="right" tick={{ fontSize: 10, fill: '#10B981' }} />}
          {showSets && showRpe && <YAxis yAxisId="sets" hide domain={['auto', 'auto']} />}
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
            formatter={(value: any, name: any) => {
              if (name === 'volume') return [`${Number(value).toLocaleString()} kg`, 'Volumen']
              if (name === 'sets') return [value, 'Series']
              if (name === 'rpe') return [value, 'RPE']
              return [value, name]
            }}
            labelFormatter={(label, payload) => {
              const item = payload?.[0]?.payload
              return item?.name ? `${label} — ${item.name}` : label
            }}
          />
          {showVolume && (
            <Bar dataKey="volume" yAxisId="vol" fill="#F97316" opacity={0.35} radius={[3, 3, 0, 0]} name="volume" />
          )}
          {showSets && (
            <Line type="monotone" dataKey="sets" yAxisId="sets" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981', stroke: 'white', strokeWidth: 1.5 }} connectNulls name="sets" />
          )}
          {showRpe && (
            <Line type="monotone" dataKey="rpe" yAxisId="rpe" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: '#EF4444', stroke: 'white', strokeWidth: 1.5 }} connectNulls name="rpe" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
