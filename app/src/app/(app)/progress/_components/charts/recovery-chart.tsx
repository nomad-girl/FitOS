'use client'

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts'

interface Props {
  snapshots: Record<string, any>[]
}

export function RecoveryChart({ snapshots }: Props) {
  if (snapshots.length < 2) return null

  const data = snapshots.map(s => {
    const d = new Date(s.snapshot_date + 'T12:00:00')
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      global: s.readiness_global,
      upper: s.readiness_upper,
      lower: s.readiness_lower,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[0, 100]} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
          formatter={(value: any, name: any) => {
            const labels: Record<string, string> = { global: 'Global', upper: 'Superior', lower: 'Inferior' }
            return [value, labels[name] || name]
          }}
        />
        <ReferenceLine y={65} stroke="#F59E0B" strokeDasharray="4 4" strokeOpacity={0.4} />
        <ReferenceLine y={55} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.4} />
        <Line type="monotone" dataKey="global" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: '#10B981' }} connectNulls />
        <Line type="monotone" dataKey="upper" stroke="#0EA5E9" strokeWidth={1.5} dot={{ r: 2, fill: '#0EA5E9' }} connectNulls strokeDasharray="4 2" />
        <Line type="monotone" dataKey="lower" stroke="#F97316" strokeWidth={1.5} dot={{ r: 2, fill: '#F97316' }} connectNulls strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  )
}
