'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function sendMagicLink() {
    if (!email) return
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') sendMagicLink()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-accent">
      <div className="bg-card rounded-[20px] p-12 px-10 w-[420px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,.2)] text-center fade-scale">
        {!sent ? (
          <>
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
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full py-3.5 px-[18px] border-[1.5px] border-gray-200 rounded-[12px] text-base text-center transition-all duration-200 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,165,233,.15)]"
            />

            {error && (
              <div className="text-danger text-[.82rem] mt-3">{error}</div>
            )}

            {/* Submit Button */}
            <button
              onClick={sendMagicLink}
              disabled={loading || !email}
              className="w-full py-3.5 rounded-[12px] border-none bg-primary text-white font-bold text-base cursor-pointer mt-4 transition-all duration-200 hover:bg-primary-dark active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : 'Enviar Link Magico'}
            </button>

            {/* Divider */}
            <div className="text-gray-400 text-[.8rem] my-5">Sin contrasena</div>
            <div className="text-gray-500 text-[.85rem] leading-relaxed">
              Te enviamos un link seguro a tu email.<br />
              Hace click para ingresar al instante.
            </div>

            {/* Skip for demo */}
            <div className="mt-5">
              <a
                href="/?demo=1"
                className="text-primary font-semibold text-[.82rem] cursor-pointer hover:underline"
              >
                Saltar para demo &rarr;
              </a>
            </div>
          </>
        ) : (
          /* Check Inbox State */
          <div className="text-center">
            <div className="text-[3rem] mb-3">&#x2709;&#xFE0F;</div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">
              Revisa tu bandeja de entrada
            </h3>
            <p className="text-gray-500 text-[.9rem] leading-relaxed">
              Enviamos un link magico a<br />
              <strong className="text-gray-800">{email}</strong>
            </p>
            <p className="mt-3 text-[.82rem] text-gray-400 leading-relaxed">
              Hace click en el link del email para ingresar.<br />
              Revisa spam si no lo ves.
            </p>
            <button
              onClick={() => sendMagicLink()}
              className="text-primary cursor-pointer font-semibold text-[.85rem] mt-4 inline-block bg-transparent border-none"
            >
              Reenviar email
            </button>
            <div className="mt-5">
              <button
                onClick={() => setSent(false)}
                className="w-full py-3.5 rounded-[12px] border-none bg-gray-100 text-gray-700 font-semibold text-base cursor-pointer"
              >
                &larr; Usar otro email
              </button>
            </div>
            <div className="mt-4">
              <a
                href="/?demo=1"
                className="text-primary cursor-pointer text-[.82rem] font-semibold hover:underline"
              >
                Saltear (demo) &rarr;
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Bottom tagline */}
      <div className="absolute bottom-6 text-white/50 text-[.78rem]">
        Hecho para uno. Potenciado por datos. Coacheado por IA.
      </div>
    </div>
  )
}
