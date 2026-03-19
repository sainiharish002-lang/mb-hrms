'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    setError('')
    if (!email || !password) { setError('Email aur password daalo'); return }
    setLoading(true)

    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError('Invalid email ya password')
      setLoading(false)
      return
    }

    // Status + Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', data.user.id)
      .single()

    if (profile?.status === 'pending') {
      await supabase.auth.signOut()
      setError('⏳ Tumhara account admin approval ke liye pending hai.')
      setLoading(false)
      return
    }

    if (profile?.status === 'inactive') {
      await supabase.auth.signOut()
      setError('🚫 Tumhara account deactivate kar diya gaya hai.')
      setLoading(false)
      return
    }

    if (profile?.role === 'admin') router.push('/dashboard')
    else router.push('/employee/dashboard')
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

        {/* Form */}
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
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>

          {/* Signup Link */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#666', margin: 0 }}>
            New employee?{' '}
            <a href="/signup" style={{ color: '#1E6FD9' }}>Sign up karo</a>
          </p>
        </div>
      </div>
    </div>
  )
}