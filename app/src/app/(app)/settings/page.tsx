'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/supabase/auth-cache'
import { syncHevyWorkouts } from '@/lib/hevy/sync'

const DAY_OPTIONS = [
  { value: 'saturday', label: 'Sabado' },
  { value: 'sunday', label: 'Domingo' },
  { value: 'monday', label: 'Lunes' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [weekStartDay, setWeekStartDay] = useState('saturday')
  const [checkinDay, setCheckinDay] = useState('saturday')
  const [heightCm, setHeightCm] = useState('')

  // Hevy state
  const [hevyConnected, setHevyConnected] = useState(false)
  const [hevySyncing, setHevySyncing] = useState(false)
  const [hevyStatus, setHevyStatus] = useState<string | null>(null)
  const [hevyLastSync, setHevyLastSync] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient()
        const userId = await getUserId()

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (data) {
          setDisplayName(data.display_name ?? data.full_name ?? '')
          setWeekStartDay(data.week_start_day ?? 'saturday')
          setCheckinDay(data.checkin_day ?? 'saturday')
          setHeightCm(data.height_cm != null ? String(data.height_cm) : '')
          setHevyLastSync(data.hevy_last_sync_at ?? null)
          // Quick check if Hevy API is configured server-side
          setHevyConnected(!!data.hevy_last_sync_at || !!data.hevy_api_key_encrypted)
        }
        // Auto-test Hevy connection on load
        try {
          const testRes = await fetch('/api/hevy?endpoint=workouts&page=1&page_size=1')
          setHevyConnected(testRes.ok)
        } catch {
          setHevyConnected(false)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveMessage(null)
    try {
      const supabase = createClient()
      const userId = await getUserId()

      const parsedHeight = heightCm.trim() === '' ? null : Number(heightCm)
      const heightValue = parsedHeight != null && Number.isFinite(parsedHeight) && parsedHeight > 0
        ? parsedHeight
        : null

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          display_name: displayName.trim() || null,
          week_start_day: weekStartDay,
          checkin_day: checkinDay,
          height_cm: heightValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (error) {
        setSaveMessage('Error al guardar los cambios')
        console.error('Profile update error:', error)
      } else {
        setSaveMessage('Cambios guardados correctamente')
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch {
      setSaveMessage('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  async function handleHevyTest() {
    setHevyStatus(null)
    setHevySyncing(true)
    try {
      const res = await fetch('/api/hevy?endpoint=workouts&page=1&page_size=1')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setHevyStatus(`❌ Error: ${err.error || res.status}`)
        setHevyConnected(false)
        return
      }
      const data = await res.json()
      const count = data.workouts?.length ?? 0
      setHevyConnected(true)
      setHevyStatus(`✅ Conectado — ${data.page_count} paginas de workouts disponibles`)
      if (count > 0 && data.workouts[0]?.title) {
        setHevyStatus(prev => `${prev}\nUltimo: "${data.workouts[0].title}"`)
      }
    } catch (err) {
      setHevyStatus(`❌ Error de conexion: ${err instanceof Error ? err.message : String(err)}`)
      setHevyConnected(false)
    } finally {
      setHevySyncing(false)
    }
  }

  async function handleHevySync() {
    setHevySyncing(true)
    setHevyStatus('Iniciando sincronizacion...')
    try {
      const userId = await getUserId()
      const result = await syncHevyWorkouts(userId, (msg) => {
        setHevyStatus(msg)
      })

      if (result.errors.length > 0) {
        setHevyStatus(`⚠️ ${result.synced} importados, ${result.skipped} existentes, ${result.errors.length} errores`)
      } else {
        setHevyStatus(`✅ ${result.synced} workouts importados, ${result.skipped} ya existian`)
      }
      setHevyLastSync(new Date().toISOString())
      setHevyConnected(true)
    } catch (err) {
      setHevyStatus(`❌ Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setHevySyncing(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      // Also clear demo cookie
      document.cookie = 'fitos_demo=; path=/; max-age=0'
      router.push('/login')
    } catch {
      setLoggingOut(false)
    }
  }

  const inputClass = 'bg-card border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2.5 text-[.88rem] text-gray-700 font-medium outline-none focus:border-primary/40 transition-colors w-full'
  const selectClass = 'bg-card border border-gray-200 rounded-[var(--radius-sm)] px-3 py-2.5 text-[.88rem] text-gray-700 font-medium outline-none focus:border-primary/40 transition-colors cursor-pointer'

  return (
    <main className="flex-1 py-9 px-11 max-md:py-5 max-md:px-4 max-md:pb-[90px] overflow-x-hidden">
      {/* Page Header */}
      <div className="mb-7 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors no-underline text-[1.1rem]"
        >
          &larr;
        </Link>
        <div>
          <h1 className="text-[1.6rem] font-extrabold text-gray-900 tracking-tight">Configuracion</h1>
          <p className="text-gray-500 text-[.9rem] mt-1">Ajustes de tu perfil</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-[200px]" />
          <div className="bg-gray-200 animate-pulse rounded-[var(--radius)] h-[120px]" />
        </div>
      ) : (
        <div className="max-w-[560px] space-y-6">
          {/* Profile Section */}
          <div className="bg-card rounded-[var(--radius)] p-6 shadow-[var(--shadow)] fade-in">
            <div className="font-bold text-[1.08rem] text-gray-800 mb-5">Perfil</div>

            {/* Display Name */}
            <div className="mb-5">
              <label className="block text-[.84rem] font-semibold text-gray-500 mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tu nombre"
                className={inputClass}
              />
            </div>

            {/* Week Start Day */}
            <div className="mb-5">
              <label className="block text-[.84rem] font-semibold text-gray-500 mb-2">
                Dia inicio de semana
              </label>
              <select
                value={weekStartDay}
                onChange={(e) => setWeekStartDay(e.target.value)}
                className={`${selectClass} w-full`}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Check-in Day */}
            <div className="mb-5">
              <label className="block text-[.84rem] font-semibold text-gray-500 mb-2">
                Dia de check-in
              </label>
              <select
                value={checkinDay}
                onChange={(e) => setCheckinDay(e.target.value)}
                className={`${selectClass} w-full`}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Height */}
            <div className="mb-5">
              <label className="block text-[.84rem] font-semibold text-gray-500 mb-2">
                Altura (cm)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="100"
                max="230"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="161"
                className={inputClass}
              />
              <p className="text-[.75rem] text-gray-400 mt-1.5">Necesario para calcular FFMI y masa magra</p>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-[var(--radius-sm)] bg-primary text-white font-semibold text-[.9rem] cursor-pointer border-none transition-all duration-200 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>

            {/* Save Message */}
            {saveMessage && (
              <div className={`text-center text-[.85rem] font-medium mt-3 ${
                saveMessage.includes('Error') ? 'text-danger' : 'text-[#065F46]'
              }`}>
                {saveMessage}
              </div>
            )}
          </div>

          {/* Integrations Section */}
          <div className="bg-card rounded-[var(--radius)] p-6 shadow-[var(--shadow)] fade-in" style={{ animationDelay: '.05s' }}>
            <div className="font-bold text-[1.08rem] text-gray-800 mb-5">Hevy — Integracion</div>

            <div className="p-[14px_18px] bg-gray-50/50 rounded-[var(--radius-sm)] space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-[.92rem] text-gray-800">Hevy API</span>
                  <span className={`inline-flex w-fit px-2.5 py-[3px] rounded-full text-[.73rem] font-semibold ${
                    hevyConnected
                      ? 'bg-success-light text-[#065F46]'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {hevyConnected ? 'Conectado' : 'No conectado'}
                  </span>
                </div>
                {hevyLastSync && (
                  <span className="text-[.75rem] text-gray-400">
                    Ultimo sync: {new Date(hevyLastSync).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleHevyTest}
                  disabled={hevySyncing}
                  className="flex-1 py-2.5 rounded-[var(--radius-sm)] border border-gray-200 bg-white text-gray-700 font-semibold text-[.85rem] cursor-pointer transition-all duration-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hevySyncing ? '...' : 'Probar Conexion'}
                </button>
                <button
                  onClick={handleHevySync}
                  disabled={hevySyncing}
                  className="flex-1 py-2.5 rounded-[var(--radius-sm)] bg-primary text-white font-semibold text-[.85rem] cursor-pointer border-none transition-all duration-200 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hevySyncing ? 'Sincronizando...' : '🔄 Sincronizar Workouts'}
                </button>
              </div>

              {/* Status Message */}
              {hevyStatus && (
                <div className="text-[.82rem] text-gray-600 whitespace-pre-line bg-white rounded-[var(--radius-sm)] p-3 border border-gray-100">
                  {hevyStatus}
                </div>
              )}
            </div>
          </div>

          {/* Logout Section */}
          <div className="bg-card rounded-[var(--radius)] p-6 shadow-[var(--shadow)] fade-in" style={{ animationDelay: '.1s' }}>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full py-3 rounded-[var(--radius-sm)] border-[1.5px] border-danger/20 bg-danger/5 text-danger font-semibold text-[.9rem] cursor-pointer transition-all duration-200 hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut ? 'Cerrando sesion...' : 'Cerrar Sesion'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
