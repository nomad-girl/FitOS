import { NextResponse } from 'next/server'
import { fetchHevyRoutines } from '@/lib/hevy'

export async function GET() {
  try {
    const data = await fetchHevyRoutines()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Hevy routines proxy error:', err)
    const message = err instanceof Error ? err.message : 'Error fetching routines from Hevy'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
