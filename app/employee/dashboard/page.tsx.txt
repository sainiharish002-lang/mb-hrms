'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function EmployeeDashboard() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Login nahi hai toh login page pe bhejo
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Pending/inactive toh login pe bhejo
      if (!profile || profile.status === 'pending' || profile.status === 'inactive') {
        router.push('/login')
        return
      }

      // Admin ko admin dashboard pe bhejo
      if (profile.role === 'admin') {
        router.push('/dashboard')
        return
      }

      setData(profile)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f7fa' }}>
      <div>Loading...</div>
    </div>
  )

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        👋 Welcome, {data?.full_name || 'Employee'}
      </h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Aaj ka overview</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          { icon: '📅', label: 'Attendance', href: '/employee/attendance', color: '#EFF6FF', border: '#BFDBFE' },
          { icon: '🌴', label: 'Leave Apply', href: '/employee/leave', color: '#F0FDF4', border: '#BBF7D0' },
          { icon: '💰', label: 'Payslip', href: '/employee/payslip', color: '#FFFBEB', border: '#FDE68A' },
          { icon: '👤', label: 'My Profile', href: '/employee/profile', color: '#FDF4FF', border: '#E9D5FF' },
        ].map(card => (
          <a key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: card.color, border: `1px solid ${card.border}`,
              borderRadius: 12, padding: 24, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{card.label}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}