'use client'

import { useState, useEffect, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { RightPanel } from '@/components/layout/right-panel'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { getCached, setCache, invalidateCache } from '@/lib/cache'
import type { LearnResource } from '@/lib/supabase/types'

type ResourceFilter = 'all' | 'video' | 'article' | 'book' | 'note'

// Map resource_type to display info
function getResourceDisplay(resource: LearnResource) {
  const typeMap: Record<string, { icon: string; iconBg: string; sourceBadge: 'red' | 'blue' | 'green' | 'gray' }> = {
    video: { icon: '\uD83C\uDFAC', iconBg: 'bg-danger-light', sourceBadge: 'red' },
    book: { icon: '\uD83D\uDCD6', iconBg: 'bg-primary-light', sourceBadge: 'blue' },
    note: { icon: '\uD83D\uDCDD', iconBg: 'bg-success-light', sourceBadge: 'green' },
    article: { icon: '\uD83D\uDCF0', iconBg: 'bg-primary-light', sourceBadge: 'gray' },
  }
  return typeMap[resource.resource_type] ?? { icon: '\uD83D\uDCCB', iconBg: 'bg-gray-100', sourceBadge: 'gray' as const }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `Agregado ${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`
}

function getSourceLabel(resource: LearnResource): string {
  if (resource.source) return resource.source
  const defaults: Record<string, string> = {
    video: 'Video',
    book: 'Libro',
    note: 'Nota Personal',
    article: 'Articulo',
  }
  return defaults[resource.resource_type] ?? resource.resource_type
}

// Smart tag suggestions based on URL/title content
const TAG_SUGGESTIONS = [
  'Gluteos', 'Espalda', 'Piernas', 'Pecho', 'Hombros', 'Brazos', 'Core',
  'Nutricion', 'Proteina', 'Deficit', 'Volumen', 'Fuerza', 'Hipertrofia',
  'Tecnica', 'Movilidad', 'Recuperacion', 'Suplementos', 'Cardio', 'NEAT',
  'Periodizacion', 'RPE', 'Progresion', 'Deload', 'Motivacion', 'Mindset',
]

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
  return ''
}

function autoSuggestTags(text: string): string[] {
  const lower = text.toLowerCase()
  return TAG_SUGGESTIONS.filter((tag) => lower.includes(tag.toLowerCase()))
}

// Extract video thumbnail URL from common platforms
function getThumbnailUrl(url: string | null): string | null {
  if (!url) return null
  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
  // Vimeo: vimeo.com/ID — no easy static thumbnail
  return null
}

export default function LearnPage() {
  const [filter, setFilter] = useState<ResourceFilter>('all')
  const [search, setSearch] = useState('')
  const [resources, setResources] = useState<LearnResource[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addType, setAddType] = useState('video')
  const [addSource, setAddSource] = useState('')
  const [addContent, setAddContent] = useState('')
  const [addTags, setAddTags] = useState<string[]>([])
  const [addMuscleGroups, setAddMuscleGroups] = useState<string[]>([])
  const [addExercises, setAddExercises] = useState<string[]>([])
  const [addSaving, setAddSaving] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiDone, setAiDone] = useState(false)

  async function fetchResources() {
    // Check cache first
    const cached = getCached<LearnResource[]>('learn:resources')
    if (cached) {
      setResources(cached)
      setLoading(false)
    }

    const supabase = createClient()
    const userId = await getUserId()

    const { data, error } = await supabase
      .from('learn_resources')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      setResources(data)
      setCache('learn:resources', data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchResources()
  }, [])

  function handleUrlInput(url: string) {
    setAddUrl(url)
    if (url) {
      setAddType(detectTypeFromUrl(url))
      const src = detectSourceFromUrl(url)
      if (src) setAddSource(src)
    }
  }

  async function analyzeWithAI(url: string) {
    if (!url.startsWith('http') || aiAnalyzing) return
    setAiAnalyzing(true)
    setAiDone(false)
    try {
      const res = await fetch('/api/ai/analyze-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title: addTitle }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.title) setAddTitle(data.title)
        if (data.summary) setAddContent(data.summary)
        if (data.resource_type) setAddType(data.resource_type)
        if (data.source) setAddSource(data.source)
        if (data.tags?.length) setAddTags(data.tags)
        if (data.muscle_groups?.length) setAddMuscleGroups(data.muscle_groups)
        if (data.related_exercises?.length) setAddExercises(data.related_exercises)
        setAiDone(true)
      }
    } catch (err) {
      console.error('AI analyze error:', err)
      const suggested = autoSuggestTags(url)
      if (suggested.length > 0) setAddTags((prev) => [...new Set([...prev, ...suggested])])
    } finally {
      setAiAnalyzing(false)
    }
  }

  // Trigger AI on paste — prevent default to avoid duplicate URL
  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').trim()
    if (pasted.startsWith('http')) {
      e.preventDefault()
      setAddUrl(pasted)
      setAddType(detectTypeFromUrl(pasted))
      const src = detectSourceFromUrl(pasted)
      if (src) setAddSource(src)
      analyzeWithAI(pasted)
    }
  }

  function handleTitleChange(title: string) {
    setAddTitle(title)
    if (!aiDone) {
      const suggested = autoSuggestTags(title)
      if (suggested.length > 0) setAddTags((prev) => [...new Set([...prev, ...suggested])])
    }
  }

  function toggleTag(tag: string) {
    setAddTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  async function handleAddResource() {
    if (!addTitle.trim()) { alert('Ponele un titulo'); return }
    setAddSaving(true)
    try {
      const supabase = createClient()
      const userId = await getUserId()

      // Combine all tags: regular + muscle groups + exercises
      const allTags = [...new Set([...addTags, ...addMuscleGroups, ...addExercises])]

      const { error } = await supabase.from('learn_resources').insert({
        user_id: userId,
        title: addTitle.trim(),
        resource_type: addType,
        source: addSource || null,
        url: addUrl || null,
        content: addContent || null,
        tags: allTags,
        linked_exercise_ids: [],
        is_pinned: false,
      })

      if (error) { alert('Error: ' + error.message); return }

      // Reset form and invalidate cache
      invalidateCache('learn:')
      setAddUrl(''); setAddTitle(''); setAddType('video'); setAddSource('')
      setAddContent(''); setAddTags([]); setAddMuscleGroups([]); setAddExercises([])
      setAiDone(false); setShowAddForm(false)
      fetchResources()
    } catch { alert('Error guardando recurso') }
    finally { setAddSaving(false) }
  }

  async function handleDeleteResource(id: string) {
    if (!confirm('Eliminar este recurso?')) return
    const supabase = createClient()
    await supabase.from('learn_resources').delete().eq('id', id)
    invalidateCache('learn:')
    fetchResources()
  }

  async function handleTogglePin(resource: LearnResource) {
    const supabase = createClient()
    await supabase.from('learn_resources').update({ is_pinned: !resource.is_pinned }).eq('id', resource.id)
    invalidateCache('learn:')
    fetchResources()
  }

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (filter !== 'all' && r.resource_type !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        const inTitle = r.title.toLowerCase().includes(q)
        const inTags = r.tags.some((t) => t.toLowerCase().includes(q))
        const inContent = r.content?.toLowerCase().includes(q)
        if (!inTitle && !inTags && !inContent) return false
      }
      return true
    })
  }, [resources, filter, search])

  const pinnedResources = filteredResources.filter((r) => r.is_pinned)
  const recentResources = filteredResources.filter((r) => !r.is_pinned)

  // Compute stats from real data
  const stats = useMemo(() => {
    const total = resources.length
    const videos = resources.filter((r) => r.resource_type === 'video').length
    const articles = resources.filter((r) => r.resource_type === 'article').length
    const notes = resources.filter((r) => r.resource_type === 'note').length
    const books = resources.filter((r) => r.resource_type === 'book').length
    return [
      { label: 'Total Recursos', value: String(total) },
      { label: 'Videos', value: String(videos) },
      { label: 'Articulos', value: String(articles) },
      { label: 'Notas Personales', value: String(notes) },
      ...(books > 0 ? [{ label: 'Libros', value: String(books) }] : []),
    ]
  }, [resources])

  // Compute tag counts from real data
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of resources) {
      for (const tag of r.tags) {
        counts[tag] = (counts[tag] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => `${tag} (${count})`)
  }, [resources])

  return (
    <>
      <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
        {/* Page Header */}
        <div className="mb-7">
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Aprender</h1>
              <p className="text-gray-500 text-[.9rem] mt-1">Tu wiki personal de entrenamiento</p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px"
            >
              {showAddForm ? 'Cancelar' : '+ Agregar Recurso'}
            </button>
          </div>
        </div>

        {/* Add Resource Form */}
        {showAddForm && (
          <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow-md)] mb-6 fade-in border-[1.5px] border-primary/20">
            <div className="font-bold text-[1rem] text-gray-800 mb-1">Nuevo Recurso</div>
            <p className="text-[.8rem] text-gray-400 mb-4">Pega un link y la IA lo analiza y taguea automaticamente.</p>

            {/* URL input - the magic link */}
            <div className="mb-3">
              <label className="text-[.77rem] text-gray-400 block mb-1">Link</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={addUrl}
                    onChange={(e) => handleUrlInput(e.target.value)}
                    onPaste={handleUrlPaste}
                    placeholder="Pega un link aca..."
                    className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] focus:border-primary focus:outline-none pr-10"
                  />
                  {aiAnalyzing && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full" style={{ animation: 'spin 1s linear infinite' }} />
                    </span>
                  )}
                  {aiDone && !aiAnalyzing && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success text-[.9rem]">{'\u2705'}</span>
                  )}
                </div>
                {addUrl.startsWith('http') && !aiDone && !aiAnalyzing && (
                  <button
                    type="button"
                    onClick={() => analyzeWithAI(addUrl)}
                    className="py-2.5 px-4 rounded-[var(--radius-sm)] font-semibold text-[.84rem] bg-gradient-to-br from-primary to-accent text-white cursor-pointer border-none whitespace-nowrap"
                  >
                    Analizar
                  </button>
                )}
              </div>
              {aiAnalyzing && (
                <div className="text-[.75rem] text-primary mt-1 flex items-center gap-1.5">
                  Analizando con IA...
                </div>
              )}
              {!aiAnalyzing && !aiDone && addUrl && (
                <div className="text-[.72rem] text-gray-400 mt-1">
                  Pega un link y se analiza automaticamente, o toca &quot;Analizar&quot;
                </div>
              )}
            </div>

            {/* AI results or manual form */}
            <div className="grid grid-cols-2 gap-3 mb-3 max-sm:grid-cols-1">
              <div>
                <label className="text-[.77rem] text-gray-400 block mb-1">Titulo {aiDone && <span className="text-success text-[.65rem]">IA</span>}</label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="ej: Activacion de gluteos con banda"
                  className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Tipo</label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value)}
                    className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] focus:border-primary focus:outline-none bg-card"
                  >
                    <option value="video">Video</option>
                    <option value="article">Articulo</option>
                    <option value="note">Nota</option>
                    <option value="book">Libro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[.77rem] text-gray-400 block mb-1">Fuente</label>
                  <input
                    type="text"
                    value={addSource}
                    onChange={(e) => setAddSource(e.target.value)}
                    placeholder="Instagram"
                    className="w-full py-2.5 px-3 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.9rem] focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-[.77rem] text-gray-400 block mb-1">Resumen {aiDone && <span className="text-success text-[.65rem]">IA</span>}</label>
              <textarea
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="De que trata, que aprendiste, etc."
                rows={2}
                className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.87rem] resize-y min-h-[50px] focus:border-primary focus:outline-none font-[inherit]"
              />
            </div>

            {/* Tags - AI generated + manual */}
            <div className="mb-3">
              <label className="text-[.77rem] text-gray-400 block mb-1.5">
                Tags {addTags.length > 0 && <span className="text-primary">({addTags.length})</span>}
                {aiDone && <span className="text-success text-[.65rem] ml-1">IA</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {/* Show AI-generated tags first */}
                {addTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setAddTags((prev) => prev.filter((t) => t !== tag))}
                    className="py-[5px] px-3 rounded-full border-[1.5px] text-[.78rem] font-medium cursor-pointer transition-all duration-200 bg-primary-light border-primary text-primary-dark"
                  >
                    {tag} &times;
                  </button>
                ))}
                {/* Show suggestions that aren't already selected */}
                {TAG_SUGGESTIONS.filter((t) => !addTags.includes(t)).slice(0, 10).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="py-[5px] px-3 rounded-full border-[1.5px] text-[.78rem] font-medium cursor-pointer transition-all duration-200 border-gray-200 text-gray-400 hover:border-primary hover:text-primary"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Muscle Groups - AI detected */}
            {addMuscleGroups.length > 0 && (
              <div className="mb-3">
                <label className="text-[.77rem] text-gray-400 block mb-1.5">
                  Grupos Musculares <span className="text-success text-[.65rem]">IA</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {addMuscleGroups.map((mg) => (
                    <button
                      key={mg}
                      type="button"
                      onClick={() => setAddMuscleGroups((prev) => prev.filter((m) => m !== mg))}
                      className="py-[5px] px-3 rounded-full border-[1.5px] text-[.78rem] font-medium cursor-pointer bg-accent/10 border-accent/40 text-accent-dark"
                    >
                      {mg} &times;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Related Exercises - AI detected */}
            {addExercises.length > 0 && (
              <div className="mb-3">
                <label className="text-[.77rem] text-gray-400 block mb-1.5">
                  Ejercicios Relacionados <span className="text-success text-[.65rem]">IA</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {addExercises.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setAddExercises((prev) => prev.filter((e) => e !== ex))}
                      className="py-[5px] px-3 rounded-full border-[1.5px] text-[.78rem] font-medium cursor-pointer bg-success-light border-success/40 text-[#065F46]"
                    >
                      {ex} &times;
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleAddResource}
              disabled={addSaving || !addTitle.trim() || aiAnalyzing}
              className="w-full py-2.5 rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] disabled:opacity-60"
            >
              {addSaving ? 'Guardando...' : 'Guardar Recurso'}
            </button>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-2.5 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[.9rem]">{'\uD83D\uDD0D'}</span>
            <input
              type="text"
              placeholder="Buscar recursos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2.5 pl-9 pr-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.95rem] focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {([
              { id: 'all' as const, label: 'Todos' },
              { id: 'video' as const, label: 'Videos' },
              { id: 'article' as const, label: 'Articulos' },
              { id: 'note' as const, label: 'Notas' },
            ]).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`py-2 px-4 rounded-[var(--radius-sm)] font-semibold text-[.84rem] cursor-pointer border-[1.5px] transition-all duration-200 ${
                  filter === f.id
                    ? 'bg-primary-light border-primary text-primary-dark'
                    : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary bg-card'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex flex-col gap-3.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)]">
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-gray-200 animate-pulse rounded-[6px] h-4 w-44" />
                      <div className="bg-gray-200 animate-pulse rounded-full h-4 w-14" />
                    </div>
                    <div className="bg-gray-200 animate-pulse rounded-[6px] h-3 w-full mb-2" />
                    <div className="flex gap-1.5">
                      <div className="bg-gray-200 animate-pulse rounded-full h-4 w-16" />
                      <div className="bg-gray-200 animate-pulse rounded-full h-4 w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredResources.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-[.95rem]">
            No hay recursos todavía. Se irán agregando a medida que avances con tu entrenamiento.
          </div>
        )}

        {/* Pinned */}
        {pinnedResources.length > 0 && (
          <>
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4 flex items-center gap-2">{'\uD83D\uDCCC'} Fijados</div>
            {pinnedResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} onDelete={handleDeleteResource} onTogglePin={handleTogglePin} />
            ))}
          </>
        )}

        {/* Recent */}
        {recentResources.length > 0 && (
          <>
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4 mt-6 flex items-center gap-2">{'\uD83D\uDCF1'} Recientes</div>
            {recentResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} onDelete={handleDeleteResource} onTogglePin={handleTogglePin} />
            ))}
          </>
        )}
      </main>

      {/* Right Panel */}
      <RightPanel>
        <div className="font-bold text-base text-gray-800 mb-[18px]">Estadisticas</div>

        <div className="flex flex-col gap-3 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card rounded-[var(--radius)] p-[14px_18px] shadow-[var(--shadow)]">
              <div className="flex justify-between items-center">
                <span className="text-[.84rem] text-gray-400">{stat.label}</span>
                <span className="font-bold">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {tagCounts.length > 0 && (
          <>
            <div className="font-bold text-base text-gray-800 mt-6 mb-[18px]">Temas</div>
            <div className="flex flex-wrap gap-1.5">
              {tagCounts.map((topic) => (
                <Badge key={topic} variant="gray" className="cursor-pointer">{topic}</Badge>
              ))}
            </div>
          </>
        )}
      </RightPanel>
    </>
  )
}

function ResourceCard({ resource, onDelete, onTogglePin }: { resource: LearnResource; onDelete: (id: string) => void; onTogglePin: (r: LearnResource) => void }) {
  const display = getResourceDisplay(resource)
  const sourceLabel = getSourceLabel(resource)
  const thumbnail = getThumbnailUrl(resource.url)

  return (
    <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-3.5 transition-all duration-200 hover:shadow-[var(--shadow-md)] group">
      <div className="flex gap-4 items-start">
        {thumbnail ? (
          <a href={resource.url ?? '#'} target="_blank" rel="noopener noreferrer" className="shrink-0 no-underline">
            <img
              src={thumbnail}
              alt=""
              className="w-[120px] h-[68px] rounded-[var(--radius-sm)] object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </a>
        ) : (
          <a href={resource.url ?? '#'} target="_blank" rel="noopener noreferrer" className={`w-12 h-12 rounded-[var(--radius-sm)] ${display.iconBg} flex items-center justify-center text-[1.3rem] shrink-0 no-underline`}>
            {display.icon}
          </a>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {resource.url ? (
              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[.95rem] text-gray-800 hover:text-primary no-underline">{resource.title}</a>
            ) : (
              <span className="font-bold text-[.95rem] text-gray-800">{resource.title}</span>
            )}
            <Badge variant={display.sourceBadge} className="text-[.65rem]">{sourceLabel}</Badge>
          </div>
          {resource.content && (
            <div className="text-[.84rem] text-gray-400 mb-2">{resource.content}</div>
          )}
          {resource.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {resource.tags.map((tag) => (
                <Badge key={tag} variant="gray" className="text-[.65rem]">{tag}</Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            {!resource.is_pinned && (
              <span className="text-[.77rem] text-gray-400">{formatDate(resource.created_at)}</span>
            )}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onTogglePin(resource)} className="text-[.75rem] text-gray-400 hover:text-primary bg-transparent border-none cursor-pointer">
                {resource.is_pinned ? 'Desfijar' : 'Fijar'}
              </button>
              <button onClick={() => onDelete(resource.id)} className="text-[.75rem] text-gray-400 hover:text-danger bg-transparent border-none cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
