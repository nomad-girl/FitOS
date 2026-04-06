// Simple in-memory cache for Supabase data
// Data persists across page navigations (SPA), expires after TTL

type CacheEntry<T> = {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL = 60 * 1000 // 1 minute

export function getCached<T>(key: string, ttl?: number): T | null {
  // Check in-memory first
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (entry) {
    if (Date.now() - entry.timestamp > (ttl ?? DEFAULT_TTL)) {
      cache.delete(key)
    } else {
      return entry.data
    }
  }
  // Check localStorage for persistent cache
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`fitos:cache:${key}`)
      if (stored) {
        const parsed = JSON.parse(stored) as CacheEntry<T>
        if (Date.now() - parsed.timestamp <= (ttl ?? DEFAULT_TTL)) {
          cache.set(key, parsed) // warm in-memory
          return parsed.data
        } else {
          localStorage.removeItem(`fitos:cache:${key}`)
        }
      }
    } catch { /* ignore */ }
  }
  return null
}

export function setCache<T>(key: string, data: T, ttl?: number, persist?: boolean): void {
  const entry = { data, timestamp: Date.now() }
  cache.set(key, entry)
  // Persist to localStorage if requested or if TTL > 5 minutes
  if (persist || (ttl && ttl > 5 * 60 * 1000)) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`fitos:cache:${key}`, JSON.stringify(entry))
      } catch { /* quota exceeded, ignore */ }
    }
  }
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
