'use client'

import { useState, useEffect, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { RightPanel } from '@/components/layout/right-panel'
import { createClient } from '@/lib/supabase/client'
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

export default function LearnPage() {
  const [filter, setFilter] = useState<ResourceFilter>('all')
  const [search, setSearch] = useState('')
  const [resources, setResources] = useState<LearnResource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchResources() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      const { data, error } = await supabase
        .from('learn_resources')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (!error && data) {
        setResources(data)
      }
      setLoading(false)
    }
    fetchResources()
  }, [])

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (filter !== 'all' && r.resource_type !== filter) return false
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
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
            <button className="inline-flex items-center justify-center gap-2 py-2.5 px-[22px] rounded-[var(--radius-sm)] font-semibold text-[.9rem] bg-gradient-to-br from-primary to-accent text-white shadow-[0_2px_8px_rgba(14,165,233,.25)] cursor-pointer border-none transition-all duration-200 hover:shadow-[0_4px_16px_rgba(14,165,233,.35)] hover:-translate-y-px">
              + Agregar Recurso
            </button>
          </div>
        </div>

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

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12 text-gray-400 text-[.95rem]">Cargando recursos...</div>
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
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </>
        )}

        {/* Recent */}
        {recentResources.length > 0 && (
          <>
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4 mt-6 flex items-center gap-2">{'\uD83D\uDCF1'} Recientes</div>
            {recentResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
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

function ResourceCard({ resource }: { resource: LearnResource }) {
  const display = getResourceDisplay(resource)
  const sourceLabel = getSourceLabel(resource)

  return (
    <div className="bg-card rounded-[var(--radius)] p-[24px_26px] shadow-[var(--shadow)] mb-3.5 cursor-pointer transition-all duration-200 hover:shadow-[var(--shadow-md)]">
      <div className="flex gap-4 items-start">
        <div className={`w-12 h-12 rounded-[var(--radius-sm)] ${display.iconBg} flex items-center justify-center text-[1.3rem] shrink-0`}>
          {display.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-[.95rem] text-gray-800">{resource.title}</span>
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
          {!resource.is_pinned && (
            <div className="text-[.77rem] text-gray-400 mt-1">{formatDate(resource.created_at)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
