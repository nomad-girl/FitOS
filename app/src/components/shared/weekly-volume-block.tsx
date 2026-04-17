'use client'

import Link from 'next/link'
import { useState } from 'react'
import { resolveMesocycleWeek, formatMesoChip, MUSCLE_VOLUME_PROGRESSION } from '@/lib/mesocycle'
import type { DailyLog } from '@/lib/supabase/types'

interface WeeklyVolumeBlockProps {
  weekNumber: number
  weeklyVolume: Record<string, number>
  logs: DailyLog[]
  /** Compact mode shrinks the muscle label + number column for narrow containers (sidebar). */
  compact?: boolean
  /** If true, render a mobile-style collapsible header. Otherwise always expanded. */
  collapsible?: boolean
  defaultCollapsed?: boolean
  /** Extra classes on the outer card. */
  className?: string
  style?: React.CSSProperties
}

export function WeeklyVolumeBlock({
  weekNumber,
  weeklyVolume,
  logs,
  compact = false,
  collapsible = false,
  defaultCollapsed = false,
  className = '',
  style,
}: WeeklyVolumeBlockProps) {
  const [open, setOpen] = useState(!defaultCollapsed)

  const meso = resolveMesocycleWeek(weekNumber)
  const weekKey = meso.type === 'accumulation' ? 'week1'
    : meso.type === 'progression' ? 'week2'
    : meso.type === 'peak' ? 'week3' : 'deload'
  const typeColor = meso.type === 'accumulation' ? '#2563eb'
    : meso.type === 'progression' ? '#7c3aed'
    : meso.type === 'peak' ? '#dc2626' : '#d97706'
  const typeBg = meso.type === 'accumulation' ? '#EEF4FB'
    : meso.type === 'progression' ? '#F1ECF7'
    : meso.type === 'peak' ? '#FBECEC' : '#FDF4DB'

  const totalTarget = MUSCLE_VOLUME_PROGRESSION.reduce((sum, row) => sum + row[weekKey], 0)
  const totalDone = MUSCLE_VOLUME_PROGRESSION.reduce((sum, row) => sum + (weeklyVolume[row.muscle] ?? 0), 0)
  const totalPct = totalTarget > 0 ? Math.min(100, (totalDone / totalTarget) * 100) : 0
  const totalColor = totalPct >= 100 ? '#10B981' : totalPct >= 50 ? typeColor : '#cbd5e1'

  const rpeVals = logs.map(l => l.training_rpe_avg).filter((v): v is number => v != null)
  const avgRpe = rpeVals.length > 0 ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null
  const rpeTarget = meso.rpeTarget
  const rpePct = avgRpe != null ? Math.min(100, (avgRpe / 10) * 100) : 0
  const rpeDelta = avgRpe != null ? avgRpe - rpeTarget : 0
  const rpeColor = avgRpe == null ? '#cbd5e1'
    : Math.abs(rpeDelta) <= 0.5 ? '#10B981'
    : rpeDelta > 0.5 ? '#dc2626' : '#cbd5e1'

  // Compact vs full column widths
  const labelW = compact ? 'w-[72px]' : 'w-[110px]'
  const numW = compact ? 'w-[56px]' : 'w-[72px]'
  const fontSize = compact ? 'text-[.78rem]' : 'text-[.86rem]'

  return (
    <div
      className={`bg-card rounded-[var(--radius)] ${compact ? 'p-[16px_18px]' : 'p-[22px_26px]'} mb-[18px] shadow-[var(--shadow)] fade-in ${className}`}
      style={style}
    >
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => collapsible && setOpen(v => !v)}
          className={`text-left bg-transparent border-none p-0 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
          aria-expanded={open}
        >
          <div className="flex items-center gap-1.5">
            <div className="text-[.77rem] font-bold text-gray-400 uppercase tracking-[.08em]">Esta semana</div>
            {collapsible && (
              <span className="text-gray-400 text-[.7rem] transition-transform" style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>▼</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center py-[3px] px-2.5 rounded-full text-[.7rem] font-bold uppercase tracking-wide" style={{ background: typeBg, color: typeColor }}>
              {meso.typeLabel}
            </span>
            <span className="text-[.78rem] text-gray-600 font-medium">{formatMesoChip(meso)}</span>
          </div>
        </button>
        {!compact && (
          <Link href="/sistema" className="text-[.78rem] font-semibold text-primary no-underline">
            Ver sistema →
          </Link>
        )}
      </div>

      {open && (
        <>
          {/* Summary: total volume + avg RPE */}
          <div className="space-y-2 mb-3 pb-3 border-b border-gray-100">
            <div className={`flex items-center gap-3 ${fontSize}`}>
              <div className={`${labelW} text-gray-800 font-semibold`}>Total vol.</div>
              <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${totalPct}%`, background: totalColor }} />
              </div>
              <div className={`${numW} text-right text-gray-500 tabular-nums text-[.78rem]`}>
                <span className="font-semibold text-gray-800">{totalDone % 1 === 0 ? totalDone : totalDone.toFixed(1)}</span>
                <span className="text-gray-400"> / {totalTarget}</span>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${fontSize}`}>
              <div className={`${labelW} text-gray-800 font-semibold`}>RPE medio</div>
              <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden relative">
                <div className="h-full rounded-full transition-all" style={{ width: `${rpePct}%`, background: rpeColor }} />
                <div className="absolute top-[-2px] h-[14px] w-[2px] bg-gray-700" style={{ left: `${(rpeTarget / 10) * 100}%` }} />
              </div>
              <div className={`${numW} text-right text-gray-500 tabular-nums text-[.78rem]`}>
                <span className="font-semibold text-gray-800">{avgRpe != null ? avgRpe.toFixed(1) : '--'}</span>
                <span className="text-gray-400"> / {rpeTarget}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {MUSCLE_VOLUME_PROGRESSION.map(row => {
              const target = row[weekKey]
              const done = weeklyVolume[row.muscle] ?? 0
              const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0
              const color = pct >= 100 ? '#10B981' : pct >= 50 ? typeColor : '#cbd5e1'
              return (
                <div key={row.muscle} className={`flex items-center gap-3 ${fontSize}`}>
                  <div className={`${labelW} text-gray-700 font-medium truncate`}>{row.muscle}</div>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className={`${numW} text-right text-gray-500 tabular-nums text-[.78rem]`}>
                    <span className="font-semibold text-gray-800">{done % 1 === 0 ? done : done.toFixed(1)}</span>
                    <span className="text-gray-400"> / {target}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
