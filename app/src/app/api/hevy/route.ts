import { NextRequest, NextResponse } from 'next/server'

const HEVY_BASE_URL = 'https://api.hevyapp.com/v1'
const HEVY_API_KEY = process.env.HEVY_API_KEY

export async function GET(request: NextRequest) {
  if (!HEVY_API_KEY) {
    return NextResponse.json(
      { error: 'HEVY_API_KEY no configurada' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Falta el parametro "endpoint"' },
      { status: 400 }
    )
  }

  // Build forwarded query params (exclude our "endpoint" param)
  const forwardParams = new URLSearchParams()
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      forwardParams.set(key, value)
    }
  })

  const queryString = forwardParams.toString()
  const url = `${HEVY_BASE_URL}/${endpoint.replace(/^\//, '')}${queryString ? `?${queryString}` : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'api-key': HEVY_API_KEY,
        'Accept': 'application/json',
      },
      // Don't cache Hevy responses
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Hevy API error: ${response.status}`, details: text },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Hevy proxy error:', err)
    return NextResponse.json(
      { error: 'Error conectando con Hevy' },
      { status: 502 }
    )
  }
}
