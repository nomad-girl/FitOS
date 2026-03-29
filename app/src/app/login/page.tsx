'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const supabase = createClient()

  async function handleSubmit() {
    if (!email || !password) {
      setError('Completa email y contraseña')
      return
    }
    if (mode === 'signup' && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      setLoading(false)

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos')
        } else {
          setError(authError.message)
        }
      } else {
        router.push('/')
        router.refresh()
      }
    } else if (mode === 'signup') {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      setLoading(false)

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este email ya esta registrado. Intenta iniciar sesion.')
        } else {
          setError(authError.message)
        }
      } else {
        setSuccess('Cuenta creada. Revisa tu email para confirmar.')
        setMode('login')
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-accent">
      <div className="bg-card rounded-[20px] p-12 px-10 w-[420px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,.2)] text-center fade-scale">
        {/* Logo */}
        <div className="text-[2rem] font-extrabold text-gray-800 mb-1.5">
          Fit<span className="text-primary">OS</span>
        </div>
        <div className="text-gray-500 text-[.9rem] mb-8">
          Tu cerebro de entrenamiento personal
        </div>

        {/* Email Input */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="tu@email.com"
          autoComplete="email"
          className="w-full py-3.5 px-[18px] border-[1.5px] border-gray-200 rounded-[12px] text-base transition-all duration-200 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,165,233,.15)] mb-3"
        />

        {/* Password Input */}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Contraseña"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="w-full py-3.5 px-[18px] border-[1.5px] border-gray-200 rounded-[12px] text-base transition-all duration-200 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,165,233,.15)]"
        />

        {error && (
          <div className="text-danger text-[.82rem] mt-3">{error}</div>
        )}
        {success && (
          <div className="text-success text-[.82rem] mt-3">{success}</div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="w-full py-3.5 rounded-[12px] border-none bg-primary text-white font-bold text-base cursor-pointer mt-4 transition-all duration-200 hover:bg-primary-dark active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar Sesion' : 'Crear Cuenta'}
        </button>

        {/* Toggle login/signup */}
        <div className="mt-4">
          {mode === 'login' ? (
            <button
              onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
              className="text-primary font-semibold text-[.85rem] cursor-pointer bg-transparent border-none hover:underline"
            >
              No tenes cuenta? Registrate
            </button>
          ) : (
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess('') }}
              className="text-primary font-semibold text-[.85rem] cursor-pointer bg-transparent border-none hover:underline"
            >
              Ya tenes cuenta? Inicia sesion
            </button>
          )}
        </div>

        {/* Skip for demo */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <a
            href="/?demo=1"
            className="text-gray-400 font-medium text-[.8rem] cursor-pointer hover:text-primary hover:underline transition-colors"
          >
            Saltar para demo &rarr;
          </a>
        </div>
      </div>

      {/* Bottom tagline */}
      <div className="absolute bottom-6 text-white/50 text-[.78rem]">
        Hecho para uno. Potenciado por datos. Coacheado por IA.
      </div>
    </div>
  )
}
