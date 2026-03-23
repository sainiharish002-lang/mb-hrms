'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function EmployeeProfile() {
  const [emp, setEmp]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single()

      setEmp(data)
      setLoading(false)
    }
    load()
  }, [])

  function getInitials(name: string) {
    return name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: '#666' }}>Loading...</div>
    </div>
  )

  if (!emp) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ marginTop: 8, color: '#666' }}>Employee record nahi mila. Admin se contact karo.</div>
    </div>
  )

  const fields = [
    { label: 'Employee ID',  value: emp.id,          icon: '🪪' },
    { label: 'Full Name',    value: emp.name,         icon: '👤' },
    { label: 'Email',        value: emp.email,        icon: '📧' },
    { label: 'Phone',        value: emp.phone,        icon: '📱' },
    { label: 'Department',   value: emp.department,   icon: '🏢' },
    { label: 'Designation',  value: emp.designation,  icon: '💼' },
    { label: 'Join Date',    value: emp.join_date ? new Date(emp.join_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—', icon: '📅' },
    { label: 'Status',       value: emp.status,       icon: '🟢' },
  ]

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>👤 My Profile</h1>

      {/* Profile Card */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', maxWidth: 700 }}>

        {/* Top Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1E6FD9, #3B8EFF)',
          padding: '32px 28px 60px',
          position: 'relative'
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Motionbrains Private Limited</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginTop: 4 }}>Employee Profile</div>
        </div>

        {/* Avatar + Name */}
        <div style={{ padding: '0 28px', marginTop: -40, marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: emp.color || '#1E6FD9',
            border: '4px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            {getInitials(emp.name)}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>{emp.name}</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{emp.designation} — {emp.department}</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#f1f5f9', margin: '0 28px' }} />

        {/* Info Grid */}
        <div style={{ padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Personal Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {fields.map(f => (
              <div key={f.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                  {f.icon} {f.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                  {f.value || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Salary Section — Blurred */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Salary Information
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>💰 Monthly CTC</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1E6FD9' }}>
                ₹{emp.salary?.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{
              background: '#dcfce7', color: '#16a34a',
              padding: '6px 14px', borderRadius: 20,
              fontSize: 12, fontWeight: 600
            }}>
              ● {emp.status === 'active' ? 'Active' : emp.status}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
