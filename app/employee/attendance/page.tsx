'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function EmployeeAttendance() {
  const [records, setRecords]   = useState<any[]>([])
  const [summary, setSummary]   = useState({ full: 0, half: 0, leave: 0, absent: 0 })
  const [loading, setLoading]   = useState(true)
  const [empId, setEmpId]       = useState('')
  const [month, setMonth]       = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Employee ID dhundo email se
      const { data: emp } = await supabase
        .from('employees')
        .select('id, name')
        .eq('email', user.email)
        .single()

      if (!emp) { setLoading(false); return }
      setEmpId(emp.id)

      const from = `${month}-01`
      const to   = `${month}-31`

      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('emp_id', emp.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })

      const rows = data || []
      setRecords(rows)

      // Summary calculate karo
      setSummary({
        full:   rows.filter(r => r.status === 'Full Day').length,
        half:   rows.filter(r => r.status === 'Half Day').length,
        leave:  rows.filter(r => r.status === 'Leave').length,
        absent: rows.filter(r => r.status === 'Absent').length,
      })

      setLoading(false)
    }
    load()
  }, [month])

  const statusColor: any = {
    'Full Day': { bg: '#dcfce7', color: '#16a34a' },
    'Half Day': { bg: '#fef9c3', color: '#ca8a04' },
    'Leave':    { bg: '#dbeafe', color: '#2563eb' },
    'Absent':   { bg: '#fee2e2', color: '#dc2626' },
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📅 My Attendance</h1>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>Employee ID: {empId || '—'}</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Full Day', value: summary.full,   bg: '#dcfce7', color: '#16a34a', icon: '✅' },
          { label: 'Half Day', value: summary.half,   bg: '#fef9c3', color: '#ca8a04', icon: '🕐' },
          { label: 'Leave',    value: summary.leave,  bg: '#dbeafe', color: '#2563eb', icon: '🌴' },
          { label: 'Absent',   value: summary.absent, bg: '#fee2e2', color: '#dc2626', icon: '❌' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Date', 'Day', 'Check In', 'Check Out', 'Hours', 'Late (mins)', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#999' }}>Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#999' }}>
                Is mahine koi record nahi hai
              </td></tr>
            ) : records.map((r, i) => {
              const date = new Date(r.date)
              const day = date.toLocaleDateString('en-IN', { weekday: 'short' })
              const sc = statusColor[r.status] || { bg: '#f1f5f9', color: '#64748b' }
              return (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{day}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>{r.check_in || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>{r.check_out || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{r.late_mins ? `${r.late_mins} min` : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.color
                    }}>{r.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* No Employee Found */}
      {!loading && !empId && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ marginTop: 8 }}>Tumhara employee record nahi mila. Admin se contact karo.</div>
        </div>
      )}
    </div>
  )
}