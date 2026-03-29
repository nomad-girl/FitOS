'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache } from '@/lib/cache'
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

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export function useWeeklyData(phaseId?: string | null) {
  const [data, setData] = useState<WeeklyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeeklyData = useCallback(async () => {
    try {
      // Check cache first
      const cacheKey = `dashboard:weeklyData:${phaseId ?? 'none'}`
      const cached = getCached<WeeklyData>(cacheKey)
      if (cached) {
        setData(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const weekStart = getWeekStart(new Date())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      // Fetch daily logs for this week
      const { data: logs, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', weekStart)
        .lte('log_date', weekEndStr)
        .order('log_date', { ascending: true })

      if (logsError) {
        setError(logsError.message)
        return
      }

      const validLogs = logs ?? []

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

      // Fetch check-in if we have a phase
      let checkin: WeeklyCheckin | null = null
      if (phaseId) {
        // Determine week number (weeks since phase start — or just use week 1 as fallback)
        const { data: checkinData } = await supabase
          .from('weekly_checkins')
          .select('*')
          .eq('user_id', userId)
          .eq('phase_id', phaseId)
          .gte('checkin_date', weekStart)
          .lte('checkin_date', weekEndStr)
          .single()

        checkin = checkinData
      }

      const weeklyData: WeeklyData = { logs: validLogs, averages, checkin }
      setData(weeklyData)
      setCache(cacheKey, weeklyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching weekly data')
    } finally {
      setLoading(false)
    }
  }, [phaseId])

  useEffect(() => {
    fetchWeeklyData()
  }, [fetchWeeklyData])

  return { data, loading, error, refetch: fetchWeeklyData }
}
