import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'No service role key' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Delete all user data in order (respecting foreign keys)
    const tables = [
      'fatigue_entries',
      'executed_sets',
      'executed_exercises',
      'executed_sessions',
      'exercise_mappings',
      'weekly_checkins',
      'daily_logs',
      'decisions',
      'insights',
      'routine_sets',
      'routine_exercises',
      'routines',
      'phases',
      'macrocycles',
      'resources',
    ]

    const results: Record<string, string> = {}
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId)
      results[table] = error ? error.message : 'ok'
    }

    return NextResponse.json({ cleaned: true, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
