import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Read-only: lists the logged-in user's weekly check-ins so we can inspect
// exactly what weight_kg / body_fat_pct is stored per week, per phase.
export async function GET() {
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'No autenticada' }, { status: 401 })
  }

  const { data: phases } = await supabase
    .from('phases')
    .select('id, name, status, start_date, duration_weeks')
    .eq('user_id', userId)

  const phaseById = new Map((phases ?? []).map((p) => [p.id, p]))

  const { data: checkins, error } = await supabase
    .from('weekly_checkins')
    .select('id, phase_id, week_number, checkin_date, weight_kg, body_fat_pct, waist_cm, hip_cm, updated_at')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (checkins ?? []).map((c) => {
    const w = c.weight_kg
    const bf = c.body_fat_pct
    const leanIfWeight = w != null && bf != null ? Math.round(w * (1 - bf / 100) * 10) / 10 : null
    const looksLikeLeanMass = w != null && w < 45
    return {
      phase: phaseById.get(c.phase_id)?.name ?? c.phase_id,
      week_number: c.week_number,
      checkin_date: c.checkin_date,
      weight_kg: w,
      body_fat_pct: bf,
      waist_cm: c.waist_cm,
      hip_cm: c.hip_cm,
      // If weight_kg were the *real* weight, this is what lean mass would be.
      lean_if_weight_real: leanIfWeight,
      suspicious_low_weight: looksLikeLeanMass,
      updated_at: c.updated_at,
    }
  })

  return NextResponse.json(
    { count: rows.length, checkins: rows },
    { status: 200 }
  )
}
