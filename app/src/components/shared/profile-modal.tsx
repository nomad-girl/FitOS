'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks/useProfile'
import { useActivePhase } from '@/lib/hooks/useActivePhase'

interface ProfileModalProps {
  open: boolean
  onClose: () => void
}

const GOAL_LABELS: Record<string, string> = {
  bulk: 'Volumen',
  cut: 'Definicion',
  maintain: 'Mantenimiento',
  recomp: 'Recomposicion',
  strength: 'Fuerza',
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const { phase, loading: phaseLoading } = useActivePhase()
  const [loggingOut, setLoggingOut] = useState(false)
  const [dailyLogCount, setDailyLogCount] = useState<number | null>(null)
  const [latestCheckin, setLatestCheckin] = useState<{ weight_kg: number | null; waist_cm: number | null } | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    if (!open) return

    const supabase = createClient()

    async function fetchExtra() {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? '4c870837-a1aa-45f9-b91c-91b216b2eaed'

      setUserEmail(user?.email ?? null)
      setIsDemo(!user)

      // Count daily logs
      const { count } = await supabase
        .from('daily_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      setDailyLogCount(count ?? 0)

      // Get latest checkin for weight/waist
      const { data: checkin } = await supabase
        .from('weekly_checkins')
        .select('weight_kg, waist_cm')
        .eq('user_id', userId)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .single()

      setLatestCheckin(checkin ?? null)
    }

    fetchExtra()
  }, [open])

  if (!open) return null

  const displayName = profile?.full_name ?? 'Usuario'
  const initial = displayName.charAt(0).toUpperCase()
  const trainingSince = profile?.training_since
    ? new Date(profile.training_since).getFullYear().toString()
    : null
  const hevyConnected = !!profile?.hevy_api_key_encrypted
  const checkinDay = profile?.checkin_day ?? 'Domingo'
  const trainingDays = profile?.training_days_per_week

  // Phase info
  const phaseGoalLabel = phase ? (GOAL_LABELS[phase.goal] ?? phase.goal) : null
  const phaseName = phase?.name ?? null

  // Weeks into phase
  let phaseWeeks: number | null = null
  if (phase?.start_date) {
    const start = new Date(phase.start_date)
    const now = new Date()
    phaseWeeks = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      if (isDemo) {
        // Clear demo cookie
        document.cookie = 'fitos_demo=; path=/; max-age=0'
      } else {
        const supabase = createClient()
        await supabase.auth.signOut()
      }
      router.push('/login')
    } catch {
      setLoggingOut(false)
    }
  }

  const loading = profileLoading || phaseLoading

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[500] flex justify-center items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card rounded-[var(--radius)] w-[480px] max-w-[90vw] max-h-[85vh] overflow-y-auto p-8 shadow-[var(--shadow-lg)] fade-scale">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-[1.2rem] font-extrabold">Perfil</h2>
          <button onClick={onClose} className="text-[1.3rem] text-gray-400 p-1 cursor-pointer bg-transparent border-none hover:text-gray-600">&times;</button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-[.9rem]">Cargando...</div>
        ) : (
          <>
            {/* User Info */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-extrabold text-[1.4rem]">
                {initial}
              </div>
              <div>
                <div className="font-bold text-[1.1rem]">{displayName}</div>
                {userEmail && (
                  <div className="text-[.8rem] text-gray-400">{userEmail}</div>
                )}
                {isDemo && (
                  <div className="text-[.8rem] text-gray-400">Modo demo</div>
                )}
                {trainingSince && (
                  <div className="text-[.84rem] text-gray-400">Entrenando desde {trainingSince}</div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] text-center">
                <div className="text-[.77rem] text-gray-400">Peso</div>
                <div className="font-extrabold">
                  {latestCheckin?.weight_kg != null
                    ? `${latestCheckin.weight_kg} kg`
                    : '—'}
                </div>
              </div>
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] text-center">
                <div className="text-[.77rem] text-gray-400">Cintura</div>
                <div className="font-extrabold">
                  {latestCheckin?.waist_cm != null
                    ? `${latestCheckin.waist_cm} cm`
                    : '—'}
                </div>
              </div>
              <div className="bg-card rounded-[var(--radius)] p-[18px_22px] shadow-[var(--shadow)] text-center">
                <div className="text-[.77rem] text-gray-400">Dias logueados</div>
                <div className="font-extrabold">
                  {dailyLogCount != null ? dailyLogCount : '—'}
                </div>
              </div>
            </div>

            {/* Active Phase */}
            {phaseName && (
              <div className="mb-6 p-4 bg-primary/5 rounded-[var(--radius-sm)] border border-primary/10">
                <div className="text-[.77rem] text-gray-400 mb-1">Fase activa</div>
                <div className="font-bold text-[.95rem]">{phaseName}</div>
                <div className="flex gap-4 mt-1.5 text-[.82rem] text-gray-500">
                  {phaseGoalLabel && <span>{phaseGoalLabel}</span>}
                  {phaseWeeks != null && <span>Semana {phaseWeeks}{phase?.duration_weeks ? ` / ${phase.duration_weeks}` : ''}</span>}
                  {phase?.frequency && <span>{phase.frequency}x/sem</span>}
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Ajustes</div>

            <div className="flex flex-col gap-px bg-gray-100 rounded-[var(--radius-sm)] overflow-hidden mb-5">
              <div className="flex justify-between items-center p-[14px_18px] bg-card cursor-pointer">
                <span className="font-medium text-[.92rem]">Integracion Hevy</span>
                <span className={`inline-flex px-2.5 py-[3px] rounded-full text-[.73rem] font-semibold ${
                  hevyConnected
                    ? 'bg-success-light text-[#065F46]'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {hevyConnected ? 'Conectado' : 'No conectado'}
                </span>
              </div>
              <div className="flex justify-between items-center p-[14px_18px] bg-card cursor-pointer">
                <span className="font-medium text-[.92rem]">Dias de entrenamiento</span>
                <span className="text-gray-500 text-[.88rem]">{trainingDays != null ? `${trainingDays}/sem` : '—'}</span>
              </div>
              <div className="flex justify-between items-center p-[14px_18px] bg-card cursor-pointer">
                <span className="font-medium text-[.92rem]">Objetivos de Nutricion</span>
                <span className="text-gray-400">&rsaquo;</span>
              </div>
              <div className="flex justify-between items-center p-[14px_18px] bg-card cursor-pointer">
                <span className="font-medium text-[.92rem]">Base de Ejercicios</span>
                <span className="text-gray-400">&rsaquo;</span>
              </div>
              <div className="flex justify-between items-center p-[14px_18px] bg-card">
                <span className="font-medium text-[.92rem]">Dia de Check-in</span>
                <span className="text-gray-500 text-[.88rem]">{checkinDay}</span>
              </div>
            </div>

            {/* Coach Notes */}
            {profile?.coach_context && (
              <>
                <div className="text-[1.08rem] font-bold text-gray-800 mb-4">Notas del Coach</div>
                <div className="w-full py-2.5 px-3.5 border-[1.5px] border-gray-200 rounded-[var(--radius-sm)] text-[.87rem] text-gray-600 min-h-[60px] whitespace-pre-wrap mb-5">
                  {profile.coach_context}
                </div>
              </>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full py-3 rounded-[var(--radius-sm)] border-[1.5px] border-danger/20 bg-danger/5 text-danger font-semibold text-[.9rem] cursor-pointer transition-all duration-200 hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut
                ? 'Cerrando sesion...'
                : isDemo
                  ? 'Salir del modo demo'
                  : 'Cerrar sesion'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
