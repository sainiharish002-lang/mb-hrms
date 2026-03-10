'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function ReportsPage() {
  const supabase = createClient()
  const now      = new Date()
  const [month, setMonth] = useState(now.getMonth()+1)
  const [year,  setYear]  = useState(now.getFullYear())

  async function exportCSV(type: string) {
    let rows: any[] = []
    let filename     = ''

    if (type === 'attendance') {
      const start = `${year}-${String(month).padStart(2,'0')}-01`
      const end   = new Date(year,month,0).toISOString().split('T')[0]
      const { data } = await supabase.from('attendance').select('*,employees(name,department)')
        .gte('date',start).lte('date',end).order('date').order('emp_id')
      rows = (data||[]).map((r:any)=>({
        Date: r.date, 'Emp ID': r.emp_id, Name: r.employees?.name,
        Dept: r.employees?.department, 'Check In': r.check_in||'', 'Check Out': r.check_out||'Missing',
        Status: r.status, Hours: r.hours_worked, OT: r.ot_hours, 'Late Mins': r.late_mins,
      }))
      filename = `attendance_${MONTHS[month-1]}_${year}.csv`
    }

    if (type === 'payroll') {
      const { data } = await supabase.from('payroll').select('*').eq('month',month).eq('year',year)
      rows = (data||[]).map((r:any)=>({
        Period: r.period, 'Emp ID': r.emp_id, Name: r.emp_name,
        Gross: r.gross, Basic: r.basic, HRA: r.hra,
        PF: r.pf_deduction, TDS: r.tds, LOP: r.lop_deduction, Net: r.net,
        Status: r.status,
      }))
      filename = `payroll_${MONTHS[month-1]}_${year}.csv`
    }

    if (type === 'leave') {
      const { data } = await supabase.from('leave_requests').select('*')
        .gte('from_date',`${year}-01-01`).lte('to_date',`${year}-12-31`)
      rows = (data||[]).map((r:any)=>({
        'Emp ID': r.emp_id, Name: r.emp_name, Type: r.type,
        From: r.from_date, To: r.to_date, Days: r.days,
        Status: r.status, Applied: r.applied_on, Reason: r.reason,
      }))
      filename = `leave_requests_${year}.csv`
    }

    if (!rows.length) return alert('No data found')

    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r=>headers.map(h=>JSON.stringify(r[h]??'')).join(','))].join('\n')
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = filename
    a.click()
  }

  const reports = [
    { icon:'📅', title:'Attendance Report',     sub:'Monthly check-in/out and status', type:'attendance', color:'var(--blue-light)' },
    { icon:'💰', title:'Payroll Report',         sub:'Monthly salary processing data',  type:'payroll',    color:'var(--green-light)' },
    { icon:'🌿', title:'Leave Report',           sub:'All leave requests this year',    type:'leave',      color:'var(--amber-light)' },
  ]

  return (
    <Layout>
      <div className="page">
        {/* Period selector */}
        <div style={{ display:'flex', gap:12, marginBottom:20 }}>
          <select className="filter-select" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="filter-select" value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="grid-3">
          {reports.map(r=>(
            <div key={r.type} className="card" style={{ cursor:'pointer' }} onClick={()=>exportCSV(r.type)}>
              <div className="card-body" style={{ textAlign:'center', padding:'32px 20px' }}>
                <div style={{ width:56,height:56,background:r.color,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 14px' }}>{r.icon}</div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{r.title}</div>
                <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:16 }}>{r.sub}</div>
                <div className="btn btn-outline" style={{ display:'inline-flex' }}>⬇ Export CSV</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
