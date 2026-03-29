import { NextRequest, NextResponse } from 'next/server'
import { fetchHevyExerciseTemplates } from '@/lib/hevy'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)

    const data = await fetchHevyExerciseTemplates(page)
    return NextResponse.json(data)
  } catch (err) {
    console.error('Hevy exercises proxy error:', err)
    const message = err instanceof Error ? err.message : 'Error fetching exercise templates from Hevy'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
