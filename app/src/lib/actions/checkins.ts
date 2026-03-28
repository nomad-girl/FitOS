'use server'

import { createClient } from '@/lib/supabase/server'
import type { WeeklyCheckinInsert, WeeklyDecisionInsert } from '@/lib/supabase/types'

export async function getCheckin(userId: string, phaseId: string, weekNumber: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select(`
      *,
      weekly_decisions (*)
    `)
    .eq('user_id', userId)
    .eq('phase_id', phaseId)
    .eq('week_number', weekNumber)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getCheckinsForPhase(userId: string, phaseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select(`
      *,
      weekly_decisions (*)
    `)
    .eq('user_id', userId)
    .eq('phase_id', phaseId)
    .order('week_number', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function saveCheckin(data: WeeklyCheckinInsert) {
  const supabase = await createClient()
  const { data: checkin, error } = await supabase
    .from('weekly_checkins')
    .upsert(
      { ...data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,phase_id,week_number' }
    )
    .select()
    .single()

  if (error) throw error
  return checkin
}

export async function saveDecisions(
  checkinId: string,
  data: Omit<WeeklyDecisionInsert, 'checkin_id'>
) {
  const supabase = await createClient()

  // Upsert: delete existing decisions for this check-in, then insert
  await supabase
    .from('weekly_decisions')
    .delete()
    .eq('checkin_id', checkinId)

  const { data: decision, error } = await supabase
    .from('weekly_decisions')
    .insert({ ...data, checkin_id: checkinId })
    .select()
    .single()

  if (error) throw error
  return decision
}

export async function computeWeeklyAverages(userId: string, weekStart: string) {
  const supabase = await createClient()

  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const weekEnd = end.toISOString().split('T')[0]

  const { data: logs, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', weekStart)
    .lte('log_date', weekEnd)

  if (error) throw error
  if (!logs || logs.length === 0) {
    return {
      avg_calories: null,
      avg_protein: null,
      avg_steps: null,
      avg_sleep_hours: null,
      avg_energy: null,
      avg_hunger: null,
      avg_fatigue: null,
      log_count: 0,
    }
  }

  const avg = (values: (number | null)[]) => {
    const valid = values.filter((v): v is number => v !== null)
    if (valid.length === 0) return null
    return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
  }

  return {
    avg_calories: avg(logs.map((l) => l.calories)) !== null
      ? Math.round(avg(logs.map((l) => l.calories))!)
      : null,
    avg_protein: avg(logs.map((l) => l.protein_g)) !== null
      ? Math.round(avg(logs.map((l) => l.protein_g))!)
      : null,
    avg_steps: avg(logs.map((l) => l.steps)) !== null
      ? Math.round(avg(logs.map((l) => l.steps))!)
      : null,
    avg_sleep_hours: avg(logs.map((l) => l.sleep_hours)),
    avg_energy: avg(logs.map((l) => l.energy)),
    avg_hunger: avg(logs.map((l) => l.hunger)),
    avg_fatigue: avg(logs.map((l) => l.fatigue_level)),
    log_count: logs.length,
  }
}
