'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { getLeaveBalance } from '@/lib/attendance'
import type { Employee, LeaveRequest } from '@/types'

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}
function getInitials(name: string) { return name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }

export default function LeavePage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'requests'|'apply'|'balance'|'policy'|'holidays'>('requests')
  const [leaves, setLeaves]         = useState<LeaveRequest[]>([])
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [policy, setPolicy]         = useState<any>(null)
  const [holidays, setHolidays]     = useState<any[]>([])
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Apply form
  const [form, setForm] = useState({
    emp_id:'', type:'annual', from_date:'', to_date:'', reason:'', contact:'', days:0
  })
  const [applyMsg, setApplyMsg] = useState('')
  const [saving, setSaving]     = useState(false)

  async function loadAll() {
    const [leaveRes, empRes, polRes, holRes] = await Promise.all([
      supabase.from('leave_requests').select('*').order('applied_on', { ascending:false }),
      supabase.from('employees').select('*').eq('status','active').order('name'),
      supabase.from('leave_policy').select('*').eq('id',1).single(),
      supabase.from('holidays').select('*').order('date'),
    ])
    setLeaves(leaveRes.data || [])
    setEmployees(empRes.data || [])
    setPolicy(polRes.data)
    setHolidays(holRes.data || [])
  }

  useEffect(() => { loadAll() }, [])

  // Auto-calculate days
  function calcDays(from: string, to: string) {
    if (!from || !to) return 0
    return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
  }

  async function submitLeave() {
    if (!form.emp_id || !form.from_date || !form.to_date || !form.reason) {
      return setApplyMsg('❌ Fill all required fields')
    }
    const days = calcDays(form.from_date, form.to_date)
    if (days <= 0) return setApplyMsg('❌ Invalid date range')

    const emp = employees.find(e => e.id === form.emp_id)
    if (!emp) return

    // Check balance
    const approved = leaves.filter(l => l.emp_id === form.emp_id && l.status === 'approved')
    const bal = getLeaveBalance(approved, policy?.annual_days, policy?.public_holidays)
    const paidTypes = ['annual','casual','sick']
    const willBeLOP = paidTypes.includes(form.type) && days > bal.remaining

    setSaving(true)
    const { error } = await supabase.from('leave_requests').insert({
      emp_id:   form.emp_id,
      emp_name: emp.name,
      type:     form.type,
      from_date: form.from_date,
      to_date:   form.to_date,
      days,
      reason:   form.reason,
      contact:  form.contact,
      status:   'pending',
    })
    setSaving(false)

    if (error) { setApplyMsg(`❌ ${error.message}`); return }

    setApplyMsg(willBeLOP
      ? `✅ Applied! ⚠️ Only ${bal.remaining} days available — ${days - bal.remaining} day(s) will be LOP`
      : `✅ Leave applied for ${days} day(s)`
    )
    setForm({ emp_id:'', type:'annual', from_date:'', to_date:'', reason:'', contact:'', days:0 })
    loadAll()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('leave_requests').update({ status, approved_by:'Admin', approved_on: new Date().toISOString().split('T')[0] }).eq('id',id)
    loadAll()
  }

  const filtered = leaves.filter(l =>
    (!search || l.emp_name.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || l.status === statusFilter)
  )

  return (
    <Layout>
      <div className="page">
        <div className="tabs" style={{ marginBottom:20 }}>
          {[
            { key:'requests', label:'📋 Requests' },
            { key:'apply',    label:'➕ Apply Leave' },
            { key:'balance',  label:'📊 Balance' },
            { key:'policy',   label:'⚙️ Policy' },
            { key:'holidays', label:'🎉 Holidays' },
          ].map(t => (
            <div key={t.key} className={`tab${tab===t.key?' active':''}`} onClick={()=>setTab(t.key as any)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* ── REQUESTS ── */}
        {tab === 'requests' && (
          <>
            <div className="search-bar">
              <input className="search-input" placeholder="Search employee..." value={search} onChange={e=>setSearch(e.target.value)} />
              <select className="filter-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Leave Requests</div>
                <div className="card-subtitle">{filtered.length} records</div>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Applied</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l.id}>
                        <td>{l.emp_name}</td>
                        <td><span className="badge badge-pending">{l.type}</span></td>
                        <td>{fmtDate(l.from_date)}</td>
                        <td>{fmtDate(l.to_date)}</td>
                        <td className="mono">{l.days}</td>
                        <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.reason}</td>
                        <td style={{ fontSize:11 }}>{fmtDate(l.applied_on||'')}</td>
                        <td><span className={`badge badge-${l.status}`}>{l.status}</span></td>
                        <td>
                          {l.status === 'pending' && <>
                            <button className="action-btn approve" onClick={()=>updateStatus(l.id!,'approved')}>✓ Approve</button>
                            {' '}
                            <button className="action-btn reject" onClick={()=>updateStatus(l.id!,'rejected')}>✗ Reject</button>
                          </>}
                          {l.status !== 'pending' && <span style={{ fontSize:11, color:'var(--gray-400)' }}>{l.approved_by||'—'}</span>}
                        </td>
                      </tr>
                    ))}
                    {filtered.length===0 && <tr><td colSpan={9}><div className="empty-state"><div className="icon">🌿</div><p>No leave requests</p></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── APPLY LEAVE ── */}
        {tab === 'apply' && (
          <div className="card">
            <div className="card-header"><div className="card-title">Apply Leave</div></div>
            <div className="card-body">
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <select className="form-select" value={form.emp_id} onChange={e=>setForm({...form,emp_id:e.target.value})}>
                    <option value="">Select Employee</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Type *</label>
                  <select className="form-select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                    <option value="annual">Annual Leave</option>
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="unpaid">Unpaid / LOP</option>
                    <option value="public-holiday">Public Holiday</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">From Date *</label>
                  <input type="date" className="form-input" value={form.from_date}
                    onChange={e=>setForm({...form,from_date:e.target.value,days:calcDays(e.target.value,form.to_date)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date *</label>
                  <input type="date" className="form-input" value={form.to_date}
                    onChange={e=>setForm({...form,to_date:e.target.value,days:calcDays(form.from_date,e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Days (auto)</label>
                  <input className="form-input" value={form.days || ''} readOnly style={{ background:'var(--gray-50)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact During Leave</label>
                  <input className="form-input" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="Phone" />
                </div>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Reason *</label>
                  <textarea className="form-textarea" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Reason for leave..." />
                </div>
              </div>
              {applyMsg && (
                <div style={{ margin:'16px 0', padding:'12px 16px', borderRadius:8,
                  background: applyMsg.startsWith('✅') ? 'var(--green-light)' : 'var(--red-light)',
                  color: applyMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)',
                  fontSize:13, fontWeight:600 }}>
                  {applyMsg}
                </div>
              )}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button className="btn btn-primary" onClick={submitLeave} disabled={saving}>
                  {saving ? 'Submitting...' : '✓ Submit Leave Request'}
                </button>
                <button className="btn btn-outline" onClick={()=>setForm({ emp_id:'', type:'annual', from_date:'', to_date:'', reason:'', contact:'', days:0 })}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BALANCE ── */}
        {tab === 'balance' && (
          <div className="card">
            <div className="card-header"><div className="card-title">Leave Balance</div><div className="card-subtitle">Per employee — {new Date().getFullYear()}</div></div>
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Annual Used</th><th>Public Holidays</th><th>Unpaid/LOP</th><th>Total Used</th><th>Remaining</th><th>Status</th></tr></thead>
                <tbody>
                  {employees.map(emp => {
                    const approvedLeaves = leaves.filter(l => l.emp_id === emp.id && l.status === 'approved')
                    const bal = getLeaveBalance(approvedLeaves, policy?.annual_days, policy?.public_holidays)
                    return (
                      <tr key={emp.id}>
                        <td>
                          <div className="emp-cell">
                            <div className="emp-av" style={{ background: emp.color||'var(--blue-accent)' }}>{getInitials(emp.name)}</div>
                            <div><div className="emp-fullname">{emp.name}</div><div className="emp-dept">{emp.department}</div></div>
                          </div>
                        </td>
                        <td className="mono">{bal.paid_used}</td>
                        <td className="mono">{bal.ph_used}</td>
                        <td className="mono">{bal.unpaid_used}</td>
                        <td className="mono">{bal.paid_used + bal.ph_used + bal.unpaid_used}</td>
                        <td className="mono" style={{ color: bal.remaining>5?'var(--green)':bal.remaining>0?'var(--amber)':'var(--red)', fontWeight:700 }}>{bal.remaining}</td>
                        <td>
                          {bal.lop_days > 0
                            ? <span className="badge badge-lop">LOP: {bal.lop_days}d</span>
                            : <span className="badge badge-active">OK</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── POLICY ── */}
        {tab === 'policy' && policy && (
          <div className="card">
            <div className="card-header"><div className="card-title">⚙️ Leave Policy — MotionBrains 2026</div></div>
            <div className="card-body">
              <div className="form-grid cols-2">
                {[
                  { label:'Annual Leave Days',    key:'annual_days',          note:'Sec. 2: Inclusive of casual & personal' },
                  { label:'Public Holidays',      key:'public_holidays',      note:'Sec. 2: 12 fixed holidays per year' },
                  { label:'Carry Forward (days)', key:'carry_forward',        note:'Sec. 10: Not allowed (0)' },
                  { label:'Grace Period (mins)',  key:'grace_minutes',        note:'Sec. 4: 15 min after shift start' },
                  { label:'Late → Half Day (mins)',key:'late_threshold_mins', note:'Sec. 4: 45+ min late = half day' },
                  { label:'Max Late/Month',       key:'max_late_per_month',   note:'Sec. 4: >3 lates = half day deduction' },
                  { label:'Shift Start',          key:'shift_start',          note:'Default office start time' },
                  { label:'Shift End',            key:'shift_end',            note:'Default office end time' },
                ].map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}</label>
                    <input className="form-input" value={(policy as any)[f.key]}
                      onChange={e=>setPolicy({...policy,[f.key]:e.target.value})} />
                    <span style={{ fontSize:10.5, color:'var(--gray-400)', marginTop:2 }}>{f.note}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={async()=>{
                await supabase.from('leave_policy').update(policy).eq('id',1)
                alert('Policy saved!')
              }}>💾 Save Policy</button>
            </div>
          </div>
        )}

        {/* ── HOLIDAYS ── */}
        {tab === 'holidays' && (
          <div className="card">
            <div className="card-header"><div className="card-title">🎉 Public Holidays 2026</div><div className="card-subtitle">MotionBrains Leave Policy</div></div>
            <table className="data-table">
              <thead><tr><th>#</th><th>Holiday</th><th>Date</th><th>Day</th><th>Type</th></tr></thead>
              <tbody>
                {holidays.map((h,i) => (
                  <tr key={h.id}>
                    <td style={{ color:'var(--gray-400)' }}>{i+1}</td>
                    <td style={{ fontWeight:600 }}>{h.name}</td>
                    <td className="mono">{fmtDate(h.date)}</td>
                    <td style={{ color:'var(--gray-400)' }}>{new Date(h.date).toLocaleDateString('en-IN',{weekday:'long'})}</td>
                    <td><span className="badge badge-pending">{h.type}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
