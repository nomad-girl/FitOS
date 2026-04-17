'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'

export interface TimeRange {
  from: string
  to: string
  label: string
}

export interface AnalyticsData {
  dailyLogs: Record<string, any>[]
  weeklyCheckins: Record<string, any>[]
  sessions: { session_date: string; duration_minutes: number | null; total_volume_kg: number | null; notes: string | null }[]
  recoverySnapshots: Record<string, any>[]
  profile: Record<string, any> | null
  milestones: Record<string, any>[]
  // Unified timeline: date -> merged data from all sources
  timeline: Record<string, Record<string, number | null>>
  loading: boolean
  error: string | null
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getTimeRange(period: string): TimeRange {
  const now = new Date()
  const to = dateToStr(now)
  const labels: Record<string, string> = {
    '1S': 'Ultima semana',
    '2S': 'Ultimas 2 semanas',
    '1M': 'Ultimo mes',
    '3M': 'Ultimos 3 meses',
    '6M': 'Ultimos 6 meses',
    '1A': 'Ultimo ano',
    'Todo': 'Todo',
  }

  if (period === 'Todo') {
    return { from: '2020-01-01', to, label: labels[period] }
  }

  const d = new Date()
  switch (period) {
    case '1S': d.setDate(d.getDate() - 7); break
    case '2S': d.setDate(d.getDate() - 14); break
    case '1M': d.setMonth(d.getMonth() - 1); break
    case '3M': d.setMonth(d.getMonth() - 3); break
    case '6M': d.setMonth(d.getMonth() - 6); break
    case '1A': d.setFullYear(d.getFullYear() - 1); break
  }

  return { from: dateToStr(d), to, label: labels[period] || period }
}

export function useAnalyticsData(range: TimeRange): AnalyticsData {
  const [data, setData] = useState<AnalyticsData>({
    dailyLogs: [],
    weeklyCheckins: [],
    sessions: [],
    recoverySnapshots: [],
    profile: null,
    milestones: [],
    timeline: {},
    loading: true,
    error: null,
  })

  const fetchAll = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }))
      const supabase = createClient()
      const userId = await getUserId()

      const [logsRes, checkinsRes, sessionsRes, recoveryRes, profileRes, milestonesRes] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('log_date', range.from)
          .lte('log_date', range.to)
          .order('log_date', { ascending: true }),
        supabase
          .from('weekly_checkins')
          .select('*')
          .eq('user_id', userId)
          .gte('checkin_date', range.from)
          .lte('checkin_date', range.to)
          .order('checkin_date', { ascending: true }),
        supabase
          .from('executed_sessions')
          .select('session_date, duration_minutes, total_volume_kg, notes')
          .eq('user_id', userId)
          .gte('session_date', range.from)
          .lte('session_date', range.to)
          .order('session_date', { ascending: true }),
        supabase
          .from('recovery_snapshots')
          .select('snapshot_date, readiness_global, readiness_upper, readiness_lower')
          .eq('user_id', userId)
          .gte('snapshot_date', range.from)
          .lte('snapshot_date', range.to)
          .order('snapshot_date', { ascending: true }),
        supabase
          .from('profiles')
          .select('calorie_target, protein_target, step_goal, sleep_goal, training_days_per_week, week_start_day, height_cm')
          .eq('id', userId)
          .single(),
        supabase
          .from('milestones')
          .select('*')
          .eq('user_id', userId)
          .order('milestone_date', { ascending: false }),
      ])

      const dailyLogs = logsRes.data ?? []
      const weeklyCheckins = checkinsRes.data ?? []
      const sessions = sessionsRes.data ?? []
      const recoverySnapshots = recoveryRes.data ?? []

      // Build unified timeline
      const timeline: Record<string, Record<string, number | null>> = {}

      for (const log of dailyLogs) {
        const date = log.log_date
        if (!timeline[date]) timeline[date] = {}
        const t = timeline[date]
        t.calories = log.calories
        t.protein_g = log.protein_g
        t.steps = log.steps
        t.sleep_hours = log.sleep_hours
        t.energy = log.energy
        t.mood = log.mood
        t.hunger = log.hunger
        t.fatigue_level = log.fatigue_level
        t.fatigue_upper = log.fatigue_upper
        t.fatigue_lower = log.fatigue_lower
        t.training_volume_kg = log.training_volume_kg
        t.training_sets = log.training_sets
        t.training_rpe_avg = log.training_rpe_avg
      }

      for (const snap of recoverySnapshots) {
        const date = snap.snapshot_date
        if (!timeline[date]) timeline[date] = {}
        timeline[date].readiness_global = snap.readiness_global
        timeline[date].readiness_upper = snap.readiness_upper
        timeline[date].readiness_lower = snap.readiness_lower
      }

      setData({
        dailyLogs,
        weeklyCheckins,
        sessions,
        recoverySnapshots,
        profile: profileRes.data,
        milestones: milestonesRes.data ?? [],
        timeline,
        loading: false,
        error: null,
      })
    } catch (err) {
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Error cargando datos',
      }))
    }
  }, [range.from, range.to])

  useEffect(() => { fetchAll() }, [fetchAll])

  return data
}
