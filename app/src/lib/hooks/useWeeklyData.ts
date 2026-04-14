'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { getCached, setCache } from '@/lib/cache'
import { dateToLocal, parseLocalDate } from '@/lib/date-utils'
import type { DailyLog, WeeklyCheckin } from '@/lib/supabase/types'

interface WeeklyAverages {
  avg_calories: number | null
  avg_protein: number | null
  avg_steps: number | null
  avg_sleep_hours: number | null
  avg_energy: number | null
  avg_hunger: number | null
  avg_fatigue: number | null
  log_count: number
}

interface WeeklyData {
  logs: DailyLog[]
  averages: WeeklyAverages
  checkin: WeeklyCheckin | null
}

function getWeekStart(date: Date, weekStartDay: string = 'saturday'): string {
  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const target = dayMap[weekStartDay] ?? 6
  const d = new Date(date)
  const current = d.getDay()
  const diff = (current - target + 7) % 7
  d.setDate(d.getDate() - diff)
  return dateToLocal(d)
}

export function useWeeklyData(phaseId?: string | null, weekStartDay: string = 'saturday', weekOffset: number = 0) {
  const [data, setData] = useState<WeeklyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeeklyData = useCallback(async () => {
    try {
      // Check cache first
      const cacheKey = `dashboard:weeklyData:${phaseId ?? 'none'}:${weekOffset}`
      const cached = getCached<WeeklyData>(cacheKey)
      if (cached) {
        setData(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }

      const supabase = createClient()
      const userId = await getUserId()

      const baseDate = new Date()
      if (weekOffset !== 0) {
        baseDate.setDate(baseDate.getDate() + weekOffset * 7)
      }
      const weekStart = getWeekStart(baseDate, weekStartDay)
      const weekEnd = parseLocalDate(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekEndStr = dateToLocal(weekEnd)

      // Fetch logs AND checkin in PARALLEL (not sequential)
      const logsPromise = supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', weekStart)
        .lte('log_date', weekEndStr)
        .order('log_date', { ascending: true })

      const checkinPromise = phaseId
        ? supabase
            .from('weekly_checkins')
            .select('*')
            .eq('user_id', userId)
            .eq('phase_id', phaseId)
            .gte('checkin_date', weekStart)
            .lte('checkin_date', weekEndStr)
            .single()
        : Promise.resolve({ data: null })

      const [logsResult, checkinResult] = await Promise.all([logsPromise, checkinPromise])

      if (logsResult.error) {
        setError(logsResult.error.message)
        return
      }

      const validLogs = logsResult.data ?? []
      const checkin: WeeklyCheckin | null = checkinResult.data as WeeklyCheckin | null

      // Compute averages
      const avg = (values: (number | null)[]) => {
        const valid = values.filter((v): v is number => v !== null)
        if (valid.length === 0) return null
        return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
      }

      const averages: WeeklyAverages = {
        avg_calories: avg(validLogs.map((l) => l.calories)) !== null
          ? Math.round(avg(validLogs.map((l) => l.calories))!)
          : null,
        avg_protein: avg(validLogs.map((l) => l.protein_g)) !== null
          ? Math.round(avg(validLogs.map((l) => l.protein_g))!)
          : null,
        avg_steps: avg(validLogs.map((l) => l.steps)) !== null
          ? Math.round(avg(validLogs.map((l) => l.steps))!)
          : null,
        avg_sleep_hours: avg(validLogs.map((l) => l.sleep_hours)),
        avg_energy: avg(validLogs.map((l) => l.energy)),
        avg_hunger: avg(validLogs.map((l) => l.hunger)),
        avg_fatigue: avg(validLogs.map((l) => l.fatigue_level)),
        log_count: validLogs.length,
      }

      const weeklyData: WeeklyData = { logs: validLogs, averages, checkin }
      setData(weeklyData)
      setCache(cacheKey, weeklyData, undefined, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching weekly data')
    } finally {
      setLoading(false)
    }
  }, [phaseId, weekStartDay, weekOffset])

  useEffect(() => {
    fetchWeeklyData()
  }, [fetchWeeklyData])

  return { data, loading, error, refetch: fetchWeeklyData }
}
