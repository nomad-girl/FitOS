import { NextRequest, NextResponse } from 'next/server'
import { fetchHevyWorkouts } from '@/lib/hevy'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('page_size') || '5', 10)

    const data = await fetchHevyWorkouts(page, pageSize)
    return NextResponse.json(data)
  } catch (err) {
    console.error('Hevy workouts proxy error:', err)
    const message = err instanceof Error ? err.message : 'Error fetching workouts from Hevy'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
