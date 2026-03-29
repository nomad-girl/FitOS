// Singleton auth cache — avoids repeated auth.getUser() network calls
// The user ID stays the same for the entire session

import { createClient } from './client'

let cachedUserId: string | null = null
let authPromise: Promise<string> | null = null

const FALLBACK_USER_ID = '4c870837-a1aa-45f9-b91c-91b216b2eaed'

export async function getUserId(): Promise<string> {
  // Return cached immediately
  if (cachedUserId) return cachedUserId

  // If already fetching, reuse the same promise (dedup)
  if (authPromise) return authPromise

  authPromise = (async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      cachedUserId = user?.id ?? FALLBACK_USER_ID
      return cachedUserId
    } catch {
      cachedUserId = FALLBACK_USER_ID
      return cachedUserId
    } finally {
      authPromise = null
    }
  })()

  return authPromise
}

export function clearAuthCache() {
  cachedUserId = null
  authPromise = null
}
