'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayLocal } from '@/lib/date-utils'
import type { DailyLog, FatigueEntry } from '@/lib/supabase/types'

type DailyLogWithFatigue = DailyLog & { fatigue_entries: FatigueEntry[] }

export function useDailyLog(date?: string) {
  const today = date ?? todayLocal()
  const [log, setLog] = useState<DailyLogWithFatigue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const { data, error: fetchError } = await supabase
        .from('daily_logs')
        .select(`
          *,
          fatigue_entries (*)
        `)
        .eq('user_id', userId)
        .eq('log_date', today)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        setError(fetchError.message)
        return
      }

      setLog(data as DailyLogWithFatigue | null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching daily log')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  return { log, loading, error, refetch: fetchLog }
}
