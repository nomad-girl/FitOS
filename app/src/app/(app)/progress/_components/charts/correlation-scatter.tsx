'use client'

import { useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ZAxis,
} from 'recharts'
import { METRICS, METRIC_BY_KEY, formatMetricValue } from '../../_lib/metric-definitions'

interface Props {
  timeline: Record<string, Record<string, number | null>>
  weeklyCheckins: Record<string, any>[]
}

export function CorrelationScatter({ timeline, weeklyCheckins }: Props) {
  const [xKey, setXKey] = useState('sleep_hours')
  const [yKey, setYKey] = useState('energy')

  // Build merged data from timeline + weekly checkins
  const allData: Record<string, Record<string, number | null>> = { ...timeline }
  for (const c of weeklyCheckins) {
    const date = c.checkin_date
    if (!allData[date]) allData[date] = {}
    for (const m of METRICS) {
      if (m.source === 'weekly_checkins' && c[m.column] != null) {
        allData[date][m.key] = c[m.column]
      }
    }
  }

  // Filter to points that have both values
  const points = Object.entries(allData)
    .filter(([, row]) => row[xKey] != null && row[yKey] != null)
    .map(([date, row]) => ({
      x: row[xKey]!,
      y: row[yKey]!,
      date,
    }))

  const xMetric = METRIC_BY_KEY[xKey]
  const yMetric = METRIC_BY_KEY[yKey]

  // Available metrics for selection (those with at least some data)
  const availableKeys = METRICS.filter(m => {
    return Object.values(allData).some(row => row[m.key] != null)
  })

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[.72rem] text-gray-400 font-semibold">X:</span>
          <select
            value={xKey}
            onChange={e => setXKey(e.target.value)}
            className="text-[.78rem] font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
          >
            {availableKeys.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <span className="text-gray-300 text-[.8rem]">vs</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[.72rem] text-gray-400 font-semibold">Y:</span>
          <select
            value={yKey}
            onChange={e => setYKey(e.target.value)}
            className="text-[.78rem] font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
          >
            {availableKeys.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {points.length < 3 ? (
        <div className="text-center text-gray-400 text-[.86rem] py-8">
          Se necesitan al menos 3 puntos para mostrar la correlacion
        </div>
      ) : (
        <>
          <div className="text-right text-[.7rem] text-gray-400 mb-1">{points.length} puntos</div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                type="number"
                dataKey="x"
                name={xMetric?.label || xKey}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                label={{ value: xMetric?.label || xKey, position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9CA3AF' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yMetric?.label || yKey}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                label={{ value: yMetric?.label || yKey, angle: -90, position: 'insideLeft', offset: 15, fontSize: 10, fill: '#9CA3AF' }}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                formatter={(value: any, name: any) => {
                  const key = name === (xMetric?.label || xKey) ? xKey : yKey
                  return [formatMetricValue(key, value), name]
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload
                  if (!p?.date) return ''
                  const d = new Date(p.date + 'T12:00:00')
                  return `${d.getDate()}/${d.getMonth() + 1}`
                }}
              />
              <Scatter data={points} fill="#6366F1" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
