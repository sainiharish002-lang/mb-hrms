'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { calculatePayroll } from '@/lib/attendance'
import type { Employee } from '@/types'

function fmtCurrency(n: number) { return '₹' + Number(n).toLocaleString('en-IN') }
function getInitials(name: string) { return name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function PayrollPage() {
  const supabase = createClient()
  const now = new Date()
  const [tab, setTab]         = useState<'run'|'history'>('run')
  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [year, setYear]       = useState(now.getFullYear())
  const [employees, setEmps]  = useState<Employee[]>([])
  const [payrollData, setPayrollData] = useState<any[]>([])
  const [processing, setProcessing]   = useState(false)
  const [history, setHistory]         = useState<any[]>([])

  useEffect(() => {
    supabase.from('employees').select('*').eq('status','active').order('name')
      .then(({ data }) => setEmps(data || []))
  }, [])

  async function calculateAll() {
    const daysInMonth = new Date(year, month, 0).getDate()
    const startDate   = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate     = `${year}-${String(month).padStart(2,'0')}-${daysInMonth}`

    const { data: attData } = await supabase
      .from('attendance')
      .select('emp_id,status,ot_hours')
      .gte('date', startDate).lte('date', endDate)

    const rows = employees.map(emp => {
      const empAtt   = (attData||[]).filter((a:any) => a.emp_id === emp.id)
      const present  = empAtt.filter((a:any)=>a.status==='Full Day').length
                     + empAtt.filter((a:any)=>a.status==='Half Day').length * 0.5
      const otHours  = empAtt.reduce((s:number,a:any)=>s+(a.ot_hours||0),0)
      const daysPresent = Math.round(present)
      const calc     = calculatePayroll(emp.salary, daysPresent, daysInMonth, otHours)

      return {
        emp_id:      emp.id,
        emp_name:    emp.name,
        color:       emp.color,
        salary:      emp.salary,
        days_present: daysPresent,
        days_absent:  daysInMonth - daysPresent,
        ot_hours:    Math.round(otHours * 10) / 10,
        period:      `${MONTHS[month-1]} ${year}`,
        month, year,
        ...calc,
        status: 'draft',
      }
    })
    setPayrollData(rows)
  }

  async function processPayroll() {
    if (!payrollData.length) return alert('Calculate payroll first')
    if (!confirm(`Process payroll for ${MONTHS[month-1]} ${year}? This will save to Supabase.`)) return
    setProcessing(true)
    const records = payrollData.map(r => ({ ...r, status:'paid', processed_on: new Date().toISOString().split('T')[0] }))
    await supabase.from('payroll').upsert(records, { onConflict:'emp_id,month,year' })
    setProcessing(false)
    alert('✅ Payroll processed!')
    loadHistory()
  }

  async function loadHistory() {
    const { data } = await supabase.from('payroll').select('*').order('year',{ascending:false}).order('month',{ascending:false})
    setHistory(data || [])
  }

  const totalGross = payrollData.reduce((s,r)=>s+r.gross,0)
  const totalNet   = payrollData.reduce((s,r)=>s+r.net,0)

  return (
    <Layout>
      <div className="page">
        <div className="tabs" style={{ marginBottom:20 }}>
          <div className={`tab${tab==='run'?' active':''}`} onClick={()=>setTab('run')}>Run Payroll</div>
          <div className={`tab${tab==='history'?' active':''}`} onClick={()=>{setTab('history');loadHistory()}}>Payroll History</div>
        </div>

        {tab === 'run' && (
          <>
            {/* Controls */}
            <div className="card">
              <div className="card-body">
                <div style={{ display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
                  <div className="form-group">
                    <label className="form-label">Month</label>
                    <select className="form-select" value={month} onChange={e=>setMonth(Number(e.target.value))}>
                      {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <select className="form-select" value={year} onChange={e=>setYear(Number(e.target.value))}>
                      {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={calculateAll}>🔢 Calculate</button>
                  {payrollData.length > 0 && (
                    <button className="btn btn-green" onClick={processPayroll} disabled={processing}>
                      {processing ? 'Processing...' : '✓ Process Payroll'}
                    </button>
                  )}
                </div>

                {payrollData.length > 0 && (
                  <div style={{ display:'flex', gap:20, marginTop:16, flexWrap:'wrap' }}>
                    <div style={{ padding:'12px 20px', background:'var(--green-light)', borderRadius:10 }}>
                      <div style={{ fontSize:11, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.5px' }}>Total Gross</div>
                      <div style={{ fontSize:20, fontWeight:700, fontFamily:'DM Mono', color:'var(--green)' }}>{fmtCurrency(totalGross)}</div>
                    </div>
                    <div style={{ padding:'12px 20px', background:'var(--blue-light)', borderRadius:10 }}>
                      <div style={{ fontSize:11, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.5px' }}>Total Net</div>
                      <div style={{ fontSize:20, fontWeight:700, fontFamily:'DM Mono', color:'var(--blue-accent)' }}>{fmtCurrency(totalNet)}</div>
                    </div>
                    <div style={{ padding:'12px 20px', background:'var(--gray-50)', borderRadius:10 }}>
                      <div style={{ fontSize:11, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.5px' }}>Employees</div>
                      <div style={{ fontSize:20, fontWeight:700, fontFamily:'DM Mono' }}>{payrollData.length}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payroll Table */}
            {payrollData.length > 0 && (
              <div className="card">
                <div style={{ overflowX:'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th><th>Days Present</th><th>Gross</th>
                        <th>Basic</th><th>HRA</th><th>PF (12%)</th><th>TDS</th><th>LOP</th>
                        <th>Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollData.map(r => (
                        <tr key={r.emp_id}>
                          <td>
                            <div className="emp-cell">
                              <div className="emp-av" style={{ background: r.color||'var(--blue-accent)' }}>
                                {getInitials(r.emp_name)}
                              </div>
                              <div><div className="emp-fullname">{r.emp_name}</div>
                              <div className="emp-dept">{r.days_present}/{new Date(year,month,0).getDate()} days</div></div>
                            </div>
                          </td>
                          <td className="mono">{r.days_present}</td>
                          <td className="mono">{fmtCurrency(r.gross)}</td>
                          <td className="mono">{fmtCurrency(r.basic)}</td>
                          <td className="mono">{fmtCurrency(r.hra)}</td>
                          <td className="mono" style={{ color:'var(--red)' }}>-{fmtCurrency(r.pf_deduction)}</td>
                          <td className="mono" style={{ color:'var(--red)' }}>-{fmtCurrency(r.tds)}</td>
                          <td className="mono" style={{ color:'var(--amber)' }}>{r.lop_deduction>0?`-${fmtCurrency(r.lop_deduction)}`:'—'}</td>
                          <td className="mono" style={{ fontWeight:700, color:'var(--green)' }}>{fmtCurrency(r.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <div className="card">
            <div className="card-header"><div className="card-title">Payroll History</div></div>
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Period</th><th>Gross</th><th>Net</th><th>PF</th><th>TDS</th><th>Status</th></tr></thead>
                <tbody>
                  {history.map(r=>(
                    <tr key={r.id}>
                      <td style={{ fontWeight:600 }}>{r.emp_name}</td>
                      <td>{r.period}</td>
                      <td className="mono">{fmtCurrency(r.gross)}</td>
                      <td className="mono" style={{ color:'var(--green)', fontWeight:700 }}>{fmtCurrency(r.net)}</td>
                      <td className="mono" style={{ color:'var(--red)' }}>{fmtCurrency(r.pf_deduction)}</td>
                      <td className="mono">{fmtCurrency(r.tds)}</td>
                      <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    </tr>
                  ))}
                  {history.length===0&&<tr><td colSpan={7}><div className="empty-state"><div className="icon">💰</div><p>No payroll history yet</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
