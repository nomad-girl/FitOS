'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { useProfile } from '@/lib/hooks/useProfile'
import { useActivePhase } from '@/lib/hooks/useActivePhase'
import { syncHevyWorkouts } from '@/lib/hevy/sync'

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

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miercoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sabado' },
  { value: 'sunday', label: 'Domingo' },
]

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const router = useRouter()
  const { profile, loading: profileLoading, refetch } = useProfile()
  const { phase, loading: phaseLoading } = useActivePhase()
  const [loggingOut, setLoggingOut] = useState(false)
  const [dailyLogCount, setDailyLogCount] = useState<number | null>(null)
  const [latestCheckin, setLatestCheckin] = useState<{ weight_kg: number | null; waist_cm: number | null } | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isDemo, setIsDemo] = useState(false)

  // Editable fields
  const [editName, setEditName] = useState('')
  const [editWeekStartDay, setEditWeekStartDay] = useState('monday')
  const [editCheckinDay, setEditCheckinDay] = useState('monday')
  const [editTrainingDays, setEditTrainingDays] = useState(3)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Sync profile data into edit state when profile loads/changes
  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name ?? '')
      setEditWeekStartDay(profile.week_start_day ?? 'monday')
      setEditCheckinDay(profile.checkin_day ?? 'monday')
      setEditTrainingDays(profile.training_days_per_week ?? 3)
    }
  }, [profile])

  useEffect(() => {
    if (!open) {
      setSaveMessage(null)
      return
    }

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
  const initial = (editName || displayName).charAt(0).toUpperCase()
  const trainingSince = profile?.training_since
    ? new Date(profile.training_since).getFullYear().toString()
    : null
  const hevyConnected = !!profile?.hevy_api_key_encrypted

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

  async function handleSave() {
    setSaving(true)
    setSaveMessage(null)
    try {
      const supabase = createClient()
      const userId = await getUserId()

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim() || null,
          week_start_day: editWeekStartDay,
          checkin_day: editCheckinDay,
          training_days_per_week: editTrainingDays,
        })
        .eq('id', userId)

      if (error) {
        setSaveMessage('Error al guardar los cambios')
        console.error('Profile update error:', error)
      } else {
        setSaveMessage('Cambios guardados correctamente')
        refetch()
        // Clear success message after 3 seconds
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch {
      setSaveMessage('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const handleHevySync = useCallback(async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const supabase = createClient()
      const userId = await getUserId()

      const result = await syncHevyWorkouts(userId, (msg) => {
        setSyncMessage(msg)
      })

      if (result.errors.length > 0) {
        setSyncMessage(`${result.synced} importados, ${result.skipped} existentes. ${result.errors.length} errores.`)
      } else {
        setSyncMessage(`Listo: ${result.synced} sesiones importadas, ${result.skipped} ya existian.`)
      }
      refetch()
    } catch (err) {
      setSyncMessage('Error al sincronizar con Hevy')
      console.error('Hevy sync error:', err)
    } finally {
      setSyncing(false)
    }
  }, [refetch])

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

  const selectClass = 'bg-card border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.88rem] text-gray-700 font-medium outline-none focus:border-primary/40 transition-colors cursor-pointer'
  const inputClass = 'bg-card border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2 text-[.88rem] text-gray-700 font-medium outline-none focus:border-primary/40 transition-colors w-full'

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[500] flex justify-center items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-card rounded-[var(--radius)] w-[480px] max-w-[90vw] max-h-[85vh] overflow-y-auto p-8 shadow-[var(--shadow-lg)] fade-scale" onMouseDown={(e) => e.stopPropagation()}>
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
              <div className="flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Tu nombre"
                  className={`${inputClass} font-bold text-[1.1rem]`}
                />
                {userEmail && (
                  <div className="text-[.8rem] text-gray-400 mt-1">{userEmail}</div>
                )}
                {isDemo && (
                  <div className="text-[.8rem] text-gray-400 mt-1">Modo demo</div>
                )}
                {trainingSince && (
                  <div className="text-[.84rem] text-gray-400 mt-1">Entrenando desde {trainingSince}</div>
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
              {/* Week Start Day */}
              <div className="flex justify-between items-center p-[14px_18px] bg-card">
                <span className="font-medium text-[.92rem]">Inicio de semana</span>
                <select
                  value={editWeekStartDay}
                  onChange={(e) => setEditWeekStartDay(e.target.value)}
                  className={selectClass}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Check-in Day */}
              <div className="flex justify-between items-center p-[14px_18px] bg-card">
                <span className="font-medium text-[.92rem]">Dia de Check-in</span>
                <select
                  value={editCheckinDay}
                  onChange={(e) => setEditCheckinDay(e.target.value)}
                  className={selectClass}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Training Days */}
              <div className="flex justify-between items-center p-[14px_18px] bg-card">
                <span className="font-medium text-[.92rem]">Dias de entrenamiento</span>
                <select
                  value={editTrainingDays}
                  onChange={(e) => setEditTrainingDays(Number(e.target.value))}
                  className={selectClass}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>{n}/sem</option>
                  ))}
                </select>
              </div>

              {/* Hevy Integration */}
              <div className="flex justify-between items-center p-[14px_18px] bg-card">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-[.92rem]">Integracion Hevy</span>
                  <span className={`inline-flex w-fit px-2.5 py-[3px] rounded-full text-[.73rem] font-semibold ${
                    hevyConnected
                      ? 'bg-success-light text-[#065F46]'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {hevyConnected ? 'Conectado' : 'No conectado'}
                  </span>
                  {profile?.hevy_last_sync_at && (
                    <span className="text-[.73rem] text-gray-400">
                      Ultima sync: {new Date(profile.hevy_last_sync_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleHevySync}
                  disabled={syncing}
                  className="px-4 py-2 rounded-[var(--radius-sm)] bg-primary/10 text-primary font-semibold text-[.82rem] cursor-pointer border border-primary/20 transition-all duration-200 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {syncing ? 'Sincronizando...' : 'Sincronizar Hevy'}
                </button>
              </div>
              {syncMessage && (
                <div className={`p-[10px_18px] bg-card text-[.82rem] ${
                  syncMessage.includes('Error') || syncMessage.includes('errores')
                    ? 'text-danger'
                    : 'text-[#065F46]'
                }`}>
                  {syncMessage}
                </div>
              )}

              <div className="flex justify-between items-center p-[14px_18px] bg-card cursor-pointer">
                <span className="font-medium text-[.92rem]">Objetivos de Nutricion</span>
                <span className="text-gray-400">&rsaquo;</span>
              </div>
              <div className="flex justify-between items-center p-[14px_18px] bg-card cursor-pointer">
                <span className="font-medium text-[.92rem]">Base de Ejercicios</span>
                <span className="text-gray-400">&rsaquo;</span>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-[var(--radius-sm)] border-[1.5px] border-primary/20 bg-primary text-white font-semibold text-[.9rem] cursor-pointer transition-all duration-200 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>

            {/* Save Message */}
            {saveMessage && (
              <div className={`text-center text-[.85rem] font-medium mb-3 ${
                saveMessage.includes('Error') ? 'text-danger' : 'text-[#065F46]'
              }`}>
                {saveMessage}
              </div>
            )}

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
