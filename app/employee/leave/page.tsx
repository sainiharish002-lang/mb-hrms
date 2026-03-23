'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function EmployeeLeave() {
  const [form, setForm]       = useState({ leave_type: 'casual', from_date: '', to_date: '', reason: '' })
  const [leaves, setLeaves]   = useState<any[]>([])
  const [balance, setBalance] = useState<any>(null)
  const [empId, setEmpId]     = useState('')
  const [empName, setEmpName] = useState('')
  const [msg, setMsg]         = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [loading, setLoading] = useState(false)

  async function fetchData(eid: string, ename: string) {
    const supabase = createClient()

    // Leave history
    const { data: leaveData } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('emp_id', eid)
      .order('created_at', { ascending: false })

    setLeaves(leaveData || [])

    // Leave policy
    const { data: policy } = await supabase
      .from('leave_policy')
      .select('annual_days, public_holidays')
      .single()

    const approved = (leaveData || []).filter(l => l.status === 'approved')
    const casual   = approved.filter(l => l.type === 'casual').reduce((s, l) => s + (l.days || 0), 0)
    const sick     = approved.filter(l => l.type === 'sick').reduce((s, l) => s + (l.days || 0), 0)
    const annual   = approved.filter(l => l.type === 'annual').reduce((s, l) => s + (l.days || 0), 0)
    const unpaid   = approved.filter(l => l.type === 'unpaid').reduce((s, l) => s + (l.days || 0), 0)
    const totalUsed = casual + sick + annual

    const totalAllowed = policy?.annual_days || 24

    setBalance({
      total: totalAllowed,
      used: totalUsed,
      remaining: Math.max(0, totalAllowed - totalUsed),
      casual, sick, annual, unpaid,
      ph: policy?.public_holidays || 12,
    })
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: emp } = await supabase
        .from('employees')
        .select('id, name')
        .eq('email', user.email)
        .single()

      if (!emp) return
      setEmpId(emp.id)
      setEmpName(emp.name)
      await fetchData(emp.id, emp.name)
    }
    load()
  }, [])

  function calcDays(from: string, to: string) {
    if (!from || !to) return 0
    return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  async function applyLeave() {
    setMsg('')
    if (!form.from_date || !form.to_date || !form.reason) {
      setMsg('Sab fields fill karo'); setMsgType('error'); return
    }
    if (new Date(form.to_date) < new Date(form.from_date)) {
      setMsg('To date, From date se pehle nahi ho sakti'); setMsgType('error'); return
    }

    setLoading(true)
    const supabase = createClient()
    const days = calcDays(form.from_date, form.to_date)

    const { error } = await supabase.from('leave_requests').insert({
      emp_id: empId, emp_name: empName,
      type: form.leave_type,
      from_date: form.from_date, to_date: form.to_date,
      days, reason: form.reason, status: 'pending',
    })

    if (error) {
      setMsg('Error: ' + error.message); setMsgType('error')
    } else {
      setMsg('✅ Leave request submit ho gayi! Admin approve karega.')
      setMsgType('success')
      setForm({ leave_type: 'casual', from_date: '', to_date: '', reason: '' })
      await fetchData(empId, empName)
    }
    setLoading(false)
  }

  const statusStyle: any = {
    pending:  { bg: '#fef9c3', color: '#ca8a04' },
    approved: { bg: '#dcfce7', color: '#16a34a' },
    rejected: { bg: '#fee2e2', color: '#dc2626' },
  }

  const leaveTypes: any = {
    casual: 'Casual Leave', sick: 'Sick Leave',
    annual: 'Annual Leave', unpaid: 'Unpaid Leave',
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🌴 Leave Management</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>Employee ID: {empId || '—'}</p>

      {/* Leave Balance Cards */}
      {balance && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>📊 Leave Balance (This Year)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Allowed', value: balance.total,     bg: '#EFF6FF', color: '#1E6FD9', icon: '📋' },
              { label: 'Used',          value: balance.used,      bg: '#FEF9C3', color: '#ca8a04', icon: '✅' },
              { label: 'Remaining',     value: balance.remaining, bg: '#DCFCE7', color: '#16a34a', icon: '🟢' },
              { label: 'Unpaid Used',   value: balance.unpaid,    bg: '#FEE2E2', color: '#dc2626', icon: '⚠️' },
              { label: 'Public Holidays', value: balance.ph,      bg: '#F3E8FF', color: '#7c3aed', icon: '🎉' },
            ].map(b => (
              <div key={b.label} style={{ background: b.bg, borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{b.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: b.color }}>{b.value}</div>
                <div style={{ fontSize: 11, color: b.color, fontWeight: 600, marginTop: 2 }}>{b.label}</div>
              </div>
            ))}
          </div>

          {/* Leave Type Breakdown */}
          <div style={{ background: 'white', borderRadius: 12, padding: '16px 20px', marginTop: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>BREAKDOWN BY TYPE (Approved)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Casual', value: balance.casual },
                { label: 'Sick',   value: balance.sick },
                { label: 'Annual', value: balance.annual },
                { label: 'Unpaid', value: balance.unpaid },
              ].map(b => (
                <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#555' }}>{b.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{b.value} days</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Apply Form */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Nayi Leave Request</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Leave Type</label>
            <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <option value="casual">Casual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="annual">Annual Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {form.from_date && form.to_date && (
              <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#1E6FD9', fontWeight: 600 }}>
                📅 {calcDays(form.from_date, form.to_date)} din
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>From Date</label>
            <input type="date" value={form.from_date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm({ ...form, from_date: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>To Date</label>
            <input type="date" value={form.to_date}
              min={form.from_date || new Date().toISOString().split('T')[0]}
              onChange={e => setForm({ ...form, to_date: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Reason</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              placeholder="Leave ka reason likho..." rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        {msg && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: msgType === 'success' ? '#dcfce7' : '#fee2e2',
            color: msgType === 'success' ? '#16a34a' : '#dc2626' }}>
            {msg}
          </div>
        )}

        <button onClick={applyLeave} disabled={loading || !empId}
          style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#1E6FD9',
            color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            opacity: loading || !empId ? 0.6 : 1 }}>
          {loading ? 'Submit ho raha hai...' : '📤 Apply Leave'}
        </button>
      </div>

      {/* Leave History */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Leave History</h2>
        {leaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>
            <div style={{ fontSize: 32 }}>🌴</div>
            <div style={{ marginTop: 8, fontSize: 13 }}>Koi leave request nahi</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Type', 'From', 'To', 'Days', 'Reason', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaves.map((l, i) => {
                const ss = statusStyle[l.status] || { bg: '#f1f5f9', color: '#64748b' }
                return (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{leaveTypes[l.type] || l.type}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>{new Date(l.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>{new Date(l.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{l.days}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#666' }}>{l.reason}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color }}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}