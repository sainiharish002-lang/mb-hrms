'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [empName, setEmpName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, status')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role === 'admin') {
        router.push('/dashboard')
        return
      }
      if (profile.status === 'pending' || profile.status === 'inactive') {
        router.push('/login')
        return
      }
      setEmpName(profile.full_name || user.email || '')
      setLoading(false)
    }
    checkAuth()
  }, [])

  const navItems = [
    { href: '/employee/dashboard', icon: '🏠', label: 'Dashboard' },
    { href: '/employee/attendance', icon: '📅', label: 'Attendance' },
    { href: '/employee/leave', icon: '🌴', label: 'Leave' },
    { href: '/employee/payslip', icon: '💰', label: 'Payslip' },
    { href: '/employee/profile', icon: '👤', label: 'Profile' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--navy)' }}>
      <div style={{ color: 'white', fontSize: 16 }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Sora', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: 'var(--navy)', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, #1E6FD9, #3B8EFF)',
              borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white'
            }}>MB</div>
            <div>
              <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>MB HRMS</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Employee Portal</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {navItems.map(item => (
            <a key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 4,
              color: pathname === item.href ? 'white' : 'rgba(255,255,255,0.6)',
              background: pathname === item.href ? 'rgba(255,255,255,0.1)' : 'transparent',
              textDecoration: 'none', fontSize: 13, fontWeight: 500,
            }}>
              <span>{item.icon}</span>{item.label}
            </a>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 8 }}>
            👋 {empName}
          </div>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            style={{
              width: '100%', padding: '8px', borderRadius: 6,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer'
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', background: '#f5f7fa' }}>
        {children}
      </div>
    </div>
  )
}