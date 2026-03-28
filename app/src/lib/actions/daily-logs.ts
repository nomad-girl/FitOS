'use server'

import { createClient } from '@/lib/supabase/server'
import type { DailyLogInsert } from '@/lib/supabase/types'

export async function getDailyLog(userId: string, date: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_logs')
    .select(`
      *,
      fatigue_entries (*)
    `)
    .eq('user_id', userId)
    .eq('log_date', date)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getDailyLogsForWeek(userId: string, weekStart: string) {
  const supabase = await createClient()

  // Calculate week end (weekStart + 6 days)
  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const weekEnd = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_logs')
    .select(`
      *,
      fatigue_entries (*)
    `)
    .eq('user_id', userId)
    .gte('log_date', weekStart)
    .lte('log_date', weekEnd)
    .order('log_date', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function upsertDailyLog(data: DailyLogInsert) {
  const supabase = await createClient()
  const { data: log, error } = await supabase
    .from('daily_logs')
    .upsert(
      { ...data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,log_date' }
    )
    .select()
    .single()

  if (error) throw error
  return log
}

export async function saveFatigueEntries(dailyLogId: string, zones: string[]) {
  const supabase = await createClient()

  // Delete existing entries for this log
  const { error: deleteError } = await supabase
    .from('fatigue_entries')
    .delete()
    .eq('daily_log_id', dailyLogId)

  if (deleteError) throw deleteError

  // Insert new entries
  if (zones.length > 0) {
    const { error: insertError } = await supabase
      .from('fatigue_entries')
      .insert(
        zones.map((zone) => ({
          daily_log_id: dailyLogId,
          zone,
        }))
      )

    if (insertError) throw insertError
  }
}
