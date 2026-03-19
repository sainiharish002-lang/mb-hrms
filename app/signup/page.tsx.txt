'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm_password: '' })
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    setError('')
    if (!form.full_name || !form.email || !form.password) {
      setError('Sab fields fill karo'); return
    }
    if (form.password !== form.confirm_password) {
      setError('Password match nahi kar raha'); return
    }
    if (form.password.length < 6) {
      setError('Password kam se kam 6 characters ka hona chahiye'); return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          role: 'employee',
          status: 'pending',
        }
      }
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--navy)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sora', sans-serif"
    }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '40px 36px', width: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Request Submit Ho Gayi!</div>
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
          Tumhara account admin ke paas approval ke liye bheja gaya hai.<br />
          Approve hone ke baad tum login kar sakoge.
        </div>
        <a href="/login" style={{ display: 'block', marginTop: 20, color: '#1E6FD9', fontSize: 13 }}>
          Login page pe jao
        </a>
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--navy)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sora', sans-serif"
    }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '40px 36px', width: 380, boxShadow: 'var(--shadow-lg)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #1E6FD9, #3B8EFF)',
            borderRadius: 14, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white'
          }}>MB</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)' }}>Employee Sign Up</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Motionbrains HRMS</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              placeholder="Poora naam"
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@motionbrains.in"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Password dobara daalo"
              value={form.confirm_password}
              onChange={e => setForm({ ...form, confirm_password: e.target.value })}
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
            onClick={handleSignup}
            disabled={loading}
          >
            {loading ? 'Submit ho raha hai...' : 'Sign Up →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#666', margin: 0 }}>
            Already account hai?{' '}
            <a href="/login" style={{ color: '#1E6FD9' }}>Login karo</a>
          </p>
        </div>
      </div>
    </div>
  )
}