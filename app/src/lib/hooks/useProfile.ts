'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { getCached, setCache } from '@/lib/cache'
import type { Profile } from '@/lib/supabase/types'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      // Check cache first
      const cached = getCached<Profile>('profile:data')
      if (cached) {
        setProfile(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }

      const supabase = createClient()
      const userId = await getUserId()

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        setError(fetchError.message)
        return
      }

      setProfile(data)
      if (data) setCache('profile:data', data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { profile, loading, error, refetch: fetchProfile }
}
