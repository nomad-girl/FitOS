'use client'

import { useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList,
} from 'recharts'

interface Props {
  dailyLogs: Record<string, any>[]
}

const VARS = [
  { key: 'volume', label: 'Volumen', color: '#F97316' },
  { key: 'sets', label: 'Series', color: '#10B981' },
  { key: 'rpe', label: 'RPE', color: '#EF4444' },
  { key: 'prs', label: 'PRs', color: '#FBBF24' },
]

// Custom label to render PR badge on top of volume bars
function PRLabel(props: any) {
  const { x, y, width, value } = props
  if (!value || value <= 0) return null
  const cx = x + width / 2
  const cy = y - 12
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="#FBBF24" stroke="#F59E0B" strokeWidth={1} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight="800" fill="#7C2D12">
        {value}
      </text>
    </g>
  )
}

export function TrainingChart({ dailyLogs }: Props) {
  const [activeVars, setActiveVars] = useState<Record<string, boolean>>({ volume: true, sets: true, rpe: true, prs: true })

  const trainingDays = dailyLogs.filter(l => l.training_volume_kg != null && l.training_volume_kg > 0)
  if (trainingDays.length === 0) return null

  const data = trainingDays.map(l => {
    const d = new Date(l.log_date + 'T12:00:00')
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      volume: l.training_volume_kg ? Math.round(l.training_volume_kg) : null,
      sets: l.training_sets,
      rpe: l.training_rpe_avg,
      prs: l.pr_count ?? 0,
      name: l.training_name,
    }
  })

  const showVolume = activeVars.volume
  const showSets = activeVars.sets
  const showRpe = activeVars.rpe
  const showPRs = activeVars.prs

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

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: showPRs ? 22 : 5, right: showRpe || showSets ? 10 : 5, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          {showVolume && <YAxis yAxisId="vol" tick={{ fontSize: 10, fill: '#9CA3AF' }} />}
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
              const prVal = item?.prs
              const prText = prVal > 0 ? ` — ${prVal} PR${prVal > 1 ? 's' : ''}` : ''
              return item?.name ? `${label} — ${item.name}${prText}` : `${label}${prText}`
            }}
          />
          {showVolume && (
            <Bar dataKey="volume" yAxisId="vol" fill="#F97316" opacity={0.35} radius={[3, 3, 0, 0]} name="volume">
              {showPRs && <LabelList dataKey="prs" content={<PRLabel />} />}
            </Bar>
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
