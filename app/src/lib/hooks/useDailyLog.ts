'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
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
      const userId = await getUserId()

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
