'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  // Simple credentials check (same as original HTML)
  async function handleLogin() {
    setError('')
    setLoading(true)

    // Admin login (non-Supabase Auth — simple check)
    if (username === 'admin' && password === 'admin123') {
      // Store session in cookie via Supabase anon sign-in
      // For production: use Supabase Auth with real email accounts
      document.cookie = 'mb_role=admin; path=/'
      document.cookie = 'mb_user=Admin; path=/'
      router.push('/dashboard')
      return
    }

    if (username === 'hr' && password === 'hr123') {
      document.cookie = 'mb_role=hr; path=/'
      document.cookie = 'mb_user=HR Manager; path=/'
      router.push('/dashboard')
      return
    }

    // Employee login — check employee ID against Supabase
    if (username.toUpperCase().startsWith('MB')) {
      const supabase = createClient()
      const { data } = await supabase
        .from('employees')
        .select('id, name')
        .eq('id', username.toUpperCase())
        .single()

      if (data && password === 'emp123') {
        document.cookie = `mb_role=employee; path=/`
        document.cookie = `mb_user=${data.name}; path=/`
        document.cookie = `mb_emp_id=${data.id}; path=/`
        router.push('/dashboard')
        return
      }
    }

    setError('Invalid username or password')
    setLoading(false)
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
            <label className="form-label">Username</label>
            <input
              className="form-input"
              placeholder="admin / hr / MB001"
              value={username}
              onChange={e => setUsername(e.target.value)}
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
              ❌ {error}
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
        </div>

        {/* Demo credentials */}
        <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--blue-pale)', borderRadius: 8, fontSize: 11, color: 'var(--gray-600)' }}>
          <strong>Demo:</strong> admin / admin123 &nbsp;|&nbsp; hr / hr123 &nbsp;|&nbsp; MB001 / emp123
        </div>
      </div>
    </div>
  )
}
