import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

interface AnalyzeRequest {
  url: string
  title?: string
}

interface AnalyzeResponse {
  title: string
  summary: string
  resource_type: 'video' | 'article' | 'book' | 'note'
  source: string
  tags: string[]
  muscle_groups: string[]
  related_exercises: string[]
  thumbnail_url?: string
}

// ─── Fetch video info via oEmbed (YouTube, Instagram, etc.) ──────
async function fetchOEmbed(url: string): Promise<{ title: string; author: string; thumbnail_url?: string } | null> {
  const oembedEndpoints: [RegExp, string][] = [
    [/youtube\.com|youtu\.be/i, `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`],
    [/vimeo\.com/i, `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`],
    [/instagram\.com/i, `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`],
    [/tiktok\.com/i, `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`],
  ]

  for (const [pattern, endpoint] of oembedEndpoints) {
    if (pattern.test(url)) {
      try {
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          return { title: data.title ?? '', author: data.author_name ?? '', thumbnail_url: data.thumbnail_url ?? undefined }
        }
      } catch { /* fallback to HTML scraping */ }
    }
  }
  return null
}

// ─── Fetch page metadata via HTML scraping ───────────────────────
async function fetchPageInfo(url: string): Promise<{ title: string; description: string; text: string; thumbnail_url?: string }> {
  // First try oEmbed for supported platforms
  const oembed = await fetchOEmbed(url)
  if (oembed?.title) {
    // For YouTube, derive high-quality thumbnail from URL
    let thumbnail = oembed.thumbnail_url
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
    if (ytMatch) thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`

    return {
      title: oembed.title,
      description: oembed.author ? `Por ${oembed.author}` : '',
      text: oembed.title + (oembed.author ? ` — por ${oembed.author}` : ''),
      thumbnail_url: thumbnail,
    }
  }

  // Fallback: scrape HTML
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FitOS/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return { title: '', description: '', text: '' }

    const html = await res.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i)
      || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i)
    const title = ogTitleMatch?.[1] || titleMatch?.[1]?.trim() || ''

    // Extract description
    const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i)
      || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"[^>]*>/i)
      || html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)
      || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"[^>]*>/i)
    const description = descMatch?.[1] || ''

    // Extract og:image for thumbnail
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i)
      || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"[^>]*>/i)
    const thumbnail_url = ogImageMatch?.[1] || undefined

    // Extract visible text (strip tags, limit length)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyHtml = bodyMatch?.[1] || html
    const text = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)

    return { title, description, text, thumbnail_url }
  } catch {
    return { title: '', description: '', text: '' }
  }
}

function detectTypeFromUrl(url: string): string {
  if (/youtube\.com|youtu\.be|instagram\.com\/reel|tiktok\.com|vimeo\.com/i.test(url)) return 'video'
  if (/\.pdf$/i.test(url)) return 'book'
  return 'article'
}

function detectSourceFromUrl(url: string): string {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube'
  if (/instagram\.com/i.test(url)) return 'Instagram'
  if (/tiktok\.com/i.test(url)) return 'TikTok'
  if (/twitter\.com|x\.com/i.test(url)) return 'X/Twitter'
  if (/reddit\.com/i.test(url)) return 'Reddit'
  if (/spotify\.com/i.test(url)) return 'Spotify'
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

// ─── POST handler ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeRequest
    const { url, title: userTitle } = body

    if (!url) {
      return NextResponse.json({ error: 'Se requiere una URL' }, { status: 400 })
    }

    // 1. Fetch page info
    const pageInfo = await fetchPageInfo(url)
    const detectedType = detectTypeFromUrl(url)
    const detectedSource = detectSourceFromUrl(url)

    // 2. Build context for Claude
    const context = [
      `URL: ${url}`,
      pageInfo.title ? `Titulo de la pagina: ${pageInfo.title}` : '',
      userTitle ? `Titulo del usuario: ${userTitle}` : '',
      pageInfo.description ? `Descripcion: ${pageInfo.description}` : '',
      pageInfo.text ? `Contenido (extracto): ${pageInfo.text.slice(0, 2000)}` : '',
      `Tipo detectado: ${detectedType}`,
      `Fuente detectada: ${detectedSource}`,
    ].filter(Boolean).join('\n')

    // 3. Call Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `Sos un asistente de entrenamiento que analiza recursos de fitness/salud. Tu trabajo es analizar una URL y extraer información útil para categorizar y taguear el recurso.

Respondé SOLAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "title": "titulo descriptivo y conciso en español (si el original está en inglés, traducilo)",
  "summary": "resumen de 1-2 oraciones de qué trata el recurso",
  "resource_type": "video|article|book|note",
  "source": "nombre de la fuente (YouTube, Instagram, etc.)",
  "tags": ["array de tags relevantes"],
  "muscle_groups": ["grupos musculares mencionados o relevantes"],
  "related_exercises": ["ejercicios específicos mencionados o relevantes"]
}

REGLAS PARA TAGS:
- Inventá las tags que creas necesarias, no te limites a una lista fija
- Categorías amplias: "Nutricion", "Entrenamiento", "Salud General", "Recuperacion", "Suplementos", "Mentalidad", "Movilidad", "Cardio", "Tecnica"
- Categorías específicas según el contenido: "Deficit Calorico", "Bulking", "Periodizacion", "RPE", "Progresion de Carga", "Proteina", "Creatina", "Sueño", "Estres", "Deload", "NEAT", etc.
- Si es sobre un ejercicio específico, agregá el nombre como tag también

GRUPOS MUSCULARES (usá estos nombres exactos cuando aplique):
Glutes, Hamstrings, Quadriceps, Shoulders, Triceps, Abdominals, Lats, Biceps, Upper Back, Abductors, Chest, Adductors, Forearms, Lower Back, Calves

EJERCICIOS RELACIONADOS:
- Si el recurso menciona ejercicios específicos, listalos (ej: "Hip Thrust", "Sentadilla Bulgara", "Press Banca")
- Si no hay ejercicios específicos, dejá el array vacío`,
      messages: [
        {
          role: 'user',
          content: `Analizá este recurso:\n\n${context}`,
        },
      ],
    })

    // Extract text response
    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No se recibió respuesta del modelo')
    }

    // Parse JSON
    let result: AnalyzeResponse
    try {
      let jsonStr = textBlock.text.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1].trim()
      result = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse AI response:', textBlock.text)
      // Fallback: return basic info from page scraping
      return NextResponse.json({
        title: pageInfo.title || userTitle || url,
        summary: pageInfo.description || '',
        resource_type: detectedType,
        source: detectedSource,
        tags: [],
        muscle_groups: [],
        related_exercises: [],
        thumbnail_url: pageInfo.thumbnail_url,
      })
    }

    // Merge source detection (AI might not know the platform)
    if (!result.source && detectedSource) {
      result.source = detectedSource
    }
    if (!result.resource_type) {
      result.resource_type = detectedType as AnalyzeResponse['resource_type']
    }

    // Add thumbnail from page info
    if (pageInfo.thumbnail_url) {
      result.thumbnail_url = pageInfo.thumbnail_url
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Analyze resource error:', err)
    const message = err instanceof Error ? err.message : 'Error analizando recurso'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
