'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache } from '@/lib/cache'
import type { Phase, RoutineWithExercises } from '@/lib/supabase/types'

type PhaseWithRoutines = Phase & { routines: RoutineWithExercises[] }

export function useActivePhase() {
  const [phase, setPhase] = useState<PhaseWithRoutines | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivePhase = useCallback(async () => {
    try {
      // Check cache first
      const cached = getCached<PhaseWithRoutines>('dashboard:activePhase')
      if (cached) {
        setPhase(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // In demo mode, use Nati's real user ID
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      // Get active phase
      const { data: phaseData, error: phaseError } = await supabase
        .from('phases')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (phaseError && phaseError.code !== 'PGRST116') {
        setError(phaseError.message)
        return
      }

      if (!phaseData) {
        setPhase(null)
        return
      }

      // Get routines with exercises and sets
      const { data: routines, error: routinesError } = await supabase
        .from('routines')
        .select(`
          *,
          routine_exercises (
            *,
            exercise:exercises (*),
            routine_sets (*)
          )
        `)
        .eq('phase_id', phaseData.id)
        .order('display_order', { ascending: true })

      if (routinesError) {
        setError(routinesError.message)
        return
      }

      // Sort nested data
      const sortedRoutines = (routines ?? []).map((r) => ({
        ...r,
        routine_exercises: (r.routine_exercises ?? [])
          .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
          .map((re: { routine_sets?: { set_number: number }[] }) => ({
            ...re,
            routine_sets: (re.routine_sets ?? []).sort(
              (a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number
            ),
          })),
      }))

      const phaseWithRoutines = { ...phaseData, routines: sortedRoutines as RoutineWithExercises[] }
      setPhase(phaseWithRoutines)
      setCache('dashboard:activePhase', phaseWithRoutines)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching active phase')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivePhase()
  }, [fetchActivePhase])

  return { phase, loading, error, refetch: fetchActivePhase }
}
