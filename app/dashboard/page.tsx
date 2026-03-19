'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import Link from 'next/link'

function fmtCurrency(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(0) + 'K'
  return '₹' + n
}

export default function Dashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState({ total: 0, onLeave: 0, pending: 0, grossPayroll: 0 })
  const [recentLeaves, setRecentLeaves] = useState<any[]>([])
  const [topPerformers, setTopPerformers] = useState<any[]>([])
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
useEffect(() => {
    async function load() {
      // ✅ Auth + Role check
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        window.location.href = '/employee/dashboard'
        return
      }

      // Baaki existing code same rahega
      const [empRes, leaveRes, pendingRes, apprRes, todayAttRes] = await Promise.all([
      const [empRes, leaveRes, pendingRes, apprRes, todayAttRes] = await Promise.all([
        supabase.from('employees').select('id,salary,status').eq('status','active'),
        supabase.from('leave_requests').select('*').eq('status','approved')
          .eq('from_date', today).limit(5),
        supabase.from('leave_requests').select('id',{count:'exact'}).eq('status','pending'),
        supabase.from('appraisals').select('emp_id,q1,q2,q3,q4,employees(name,designation,color)').eq('year', new Date().getFullYear()),
        supabase.from('attendance').select('emp_id,status').eq('date', today),
      ])

      const emps = empRes.data || []
      const gross = emps.reduce((s:number,e:any) => s + (e.salary||0), 0)
      const onLeaveToday = (todayAttRes.data||[]).filter((r:any) => r.status === 'Leave' || r.status === 'Absent').length

      setStats({
        total: emps.length,
        onLeave: onLeaveToday,
        pending: pendingRes.count || 0,
        grossPayroll: gross,
      })

      setRecentLeaves(leaveRes.data || [])

      // Top performers by avg score
      const performers = (apprRes.data || []).map((a:any) => {
        const scores = [a.q1,a.q2,a.q3,a.q4].filter((s:number)=>s>0)
        const avg = scores.length ? Math.round(scores.reduce((x:number,y:number)=>x+y,0)/scores.length) : 0
        return { ...a, avg, name: a.employees?.name, designation: a.employees?.designation, color: a.employees?.color }
      }).sort((a:any,b:any)=>b.avg-a.avg).slice(0,5)

      setTopPerformers(performers)
    }
    load()
  }, [])

  function getInitials(name:string) { return name?.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  function getPerfColor(s:number) { return s>=90?'var(--green)':s>=75?'var(--blue-accent)':'var(--amber)' }

  return (
    <Layout>
      <div className="page">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card blue">
            <div className="stat-header">
              <div className="stat-label">Total Employees</div>
              <div className="stat-icon blue">👥</div>
            </div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-footer">
              <span className="stat-change up">Active</span>
              <span className="stat-period">team members</span>
            </div>
          </div>

          <div className="stat-card green">
            <div className="stat-header">
              <div className="stat-label">Gross Payroll</div>
              <div className="stat-icon green">💰</div>
            </div>
            <div className="stat-value">{fmtCurrency(stats.grossPayroll)}</div>
            <div className="stat-footer">
              <span className="stat-change up">Monthly</span>
              <span className="stat-period">total salary</span>
            </div>
          </div>

          <div className="stat-card amber">
            <div className="stat-header">
              <div className="stat-label">On Leave Today</div>
              <div className="stat-icon amber">🌿</div>
            </div>
            <div className="stat-value">{stats.onLeave}</div>
            <div className="stat-footer">
              <span className="stat-change down">Absent</span>
              <span className="stat-period">today</span>
            </div>
          </div>

          <div className="stat-card purple">
            <div className="stat-header">
              <div className="stat-label">Pending Leaves</div>
              <div className="stat-icon purple">📋</div>
            </div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-footer">
              <span className={`stat-change ${stats.pending>0?'down':'up'}`}>
                {stats.pending>0?'Needs Action':'Clear'}
              </span>
              <span className="stat-period">awaiting approval</span>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Quick Actions</div>
                <div className="card-subtitle">Common tasks</div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { href:'/attendance', icon:'📅', label:'Mark Attendance', color:'var(--blue-light)' },
                  { href:'/payroll',    icon:'💳', label:'Run Payroll',     color:'var(--green-light)' },
                  { href:'/payslip',    icon:'📄', label:'Payslip',         color:'var(--purple-light)' },
                  { href:'/leave',      icon:'🌿', label:'Leave',           color:'var(--amber-light)' },
                  { href:'/employees',  icon:'👤', label:'Add Employee',    color:'var(--blue-light)' },
                  { href:'/biometric',  icon:'🖐️', label:'Biometric Sync',  color:'var(--green-light)' },
                ].map(a => (
                  <Link key={a.href} href={a.href} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'12px 14px', borderRadius:'var(--radius-sm)',
                    background: a.color, textDecoration:'none', color:'var(--gray-800)'
                  }}>
                    <span style={{ fontSize:18 }}>{a.icon}</span>
                    <span style={{ fontSize:12, fontWeight:600 }}>{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Leave Today */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Leave Today</div>
                <div className="card-subtitle">Active absences — {today}</div>
              </div>
              <Link href="/leave" className="card-action">All →</Link>
            </div>
            <div className="card-body">
              {recentLeaves.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">🌿</div>
                  <p>No leaves today</p>
                </div>
              ) : (
                recentLeaves.map((l:any) => (
                  <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--gray-100)' }}>
                    <div className="emp-av" style={{ background:'var(--amber)', fontSize:11 }}>
                      {getInitials(l.emp_name)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{l.emp_name}</div>
                      <div style={{ fontSize:11, color:'var(--gray-400)' }}>{l.type} — {l.days} day(s)</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Performers</div>
              <div className="card-subtitle">Current appraisal cycle</div>
            </div>
            <Link href="/appraisal" className="card-action">View All →</Link>
          </div>
          <div className="card-body">
            {topPerformers.length === 0 ? (
              <div className="empty-state"><div className="icon">📊</div><p>No appraisal data yet</p></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Avg Score</th></tr></thead>
                <tbody>
                  {topPerformers.map((p:any) => (
                    <tr key={p.emp_id}>
                      <td>
                        <div className="emp-cell">
                          <div className="emp-av" style={{ background: p.color||'var(--blue-accent)' }}>
                            {getInitials(p.name)}
                          </div>
                          <div>
                            <div className="emp-fullname">{p.name}</div>
                            <div className="emp-dept">{p.designation}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{p.q1||'—'}</td>
                      <td className="mono">{p.q2||'—'}</td>
                      <td className="mono">{p.q3||'—'}</td>
                      <td className="mono">{p.q4||'—'}</td>
                      <td>
                        <span style={{ fontWeight:700, fontFamily:'DM Mono', color: getPerfColor(p.avg) }}>
                          {p.avg}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
