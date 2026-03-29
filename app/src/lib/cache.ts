// Simple in-memory cache for Supabase data
// Data persists across page navigations (SPA), expires after TTL

type CacheEntry<T> = {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL = 60 * 1000 // 1 minute

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
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
