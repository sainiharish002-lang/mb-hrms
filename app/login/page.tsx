'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    if (!email) { setError('Email daalo'); return }
    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--navy)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sora', sans-serif"
    }}>
      <div style={{
        background: 'white', borderRadius: 16,
        padding: '40px 36px', width: 360,
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #1E6FD9, #3B8EFF)',
            borderRadius: 14, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white'
          }}>MB</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)' }}>Motionbrains HRMS</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>HR & Payroll System</div>
        </div>

        {sent ? (
          /* Success State */
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)' }}>
              Magic Link Bheja Gaya!
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 8 }}>
              <strong>{email}</strong> pe link check karo aur click karo.
            </div>
            <button
              style={{ marginTop: 20, fontSize: 12, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setSent(false); setEmail('') }}
            >
              Doosra email use karo
            </button>
          </div>
        ) : (
          /* Login Form */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@motionbrains.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                ❌ {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Bhej raha hoon...' : 'Magic Link Bhejo →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}