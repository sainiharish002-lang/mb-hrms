'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { calculatePayroll } from '@/lib/attendance'

function fmtCurrency(n: number) { return '₹' + Number(n).toLocaleString('en-IN') }
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function PayslipPage() {
  const supabase = createClient()
  const now      = new Date()
  const [employees, setEmps] = useState<any[]>([])
  const [empId, setEmpId]    = useState('')
  const [month, setMonth]    = useState(now.getMonth()+1)
  const [year,  setYear]     = useState(now.getFullYear())
  const [slip,  setSlip]     = useState<any>(null)

  useEffect(()=>{
    supabase.from('employees').select('*').eq('status','active').order('name')
      .then(({data})=>setEmps(data||[]))
  },[])

  async function generate() {
    if (!empId) return alert('Select employee')
    const emp = employees.find(e=>e.id===empId)
    if (!emp) return

    const daysInMonth = new Date(year, month, 0).getDate()
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end   = `${year}-${String(month).padStart(2,'0')}-${daysInMonth}`

    const { data: att } = await supabase.from('attendance').select('status,ot_hours')
      .eq('emp_id', empId).gte('date', start).lte('date', end)

    const present = (att||[]).filter((a:any)=>a.status==='Full Day').length
                  + (att||[]).filter((a:any)=>a.status==='Half Day').length * 0.5
    const otHours = (att||[]).reduce((s:number,a:any)=>s+(a.ot_hours||0),0)
    const calc    = calculatePayroll(emp.salary, Math.round(present), daysInMonth, otHours)

    setSlip({ emp, month, year, period:`${MONTHS[month-1]} ${year}`,
      daysPresent: Math.round(present), daysInMonth, otHours, ...calc })
  }

  return (
    <Layout>
      <div className="page">
        {/* Controls */}
        <div className="card no-print">
          <div className="card-body">
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div className="form-group">
                <label className="form-label">Employee</label>
                <select className="form-select" style={{ minWidth:200 }} value={empId} onChange={e=>setEmpId(e.target.value)}>
                  <option value="">Select Employee</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                </select>
              </div>
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
              <button className="btn btn-primary" onClick={generate}>Generate Payslip</button>
              {slip && <button className="btn btn-outline" onClick={()=>window.print()}>🖨️ Print</button>}
            </div>
          </div>
        </div>

        {/* Payslip */}
        {slip && (
          <div className="card" id="payslip-content" style={{ maxWidth:640, margin:'0 auto' }}>
            {/* Header */}
            <div style={{ background:'var(--navy)', padding:'28px 32px', borderRadius:'14px 14px 0 0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                <div style={{ width:40,height:40,background:'linear-gradient(135deg,#1E6FD9,#3B8EFF)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:14 }}>MB</div>
                <div>
                  <div style={{ color:'white',fontWeight:700,fontSize:15 }}>Motionbrains Private Limited</div>
                  <div style={{ color:'rgba(255,255,255,.5)',fontSize:11 }}>Plot No. 34-A, Apna Angan, V.K.I.A., Jaipur – 302013</div>
                </div>
              </div>
              <div style={{ color:'rgba(255,255,255,.7)',fontSize:13 }}>Salary Slip — <strong style={{ color:'white' }}>{slip.period}</strong></div>
            </div>

            <div className="card-body">
              {/* Employee info */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px', marginBottom:20, padding:'16px', background:'var(--gray-50)', borderRadius:10 }}>
                {[
                  ['Employee ID', slip.emp.id],
                  ['Name', slip.emp.name],
                  ['Designation', slip.emp.designation],
                  ['Department', slip.emp.department],
                  ['Pay Period', slip.period],
                  ['Days Worked', `${slip.daysPresent} / ${slip.daysInMonth}`],
                ].map(([label,val])=>(
                  <div key={label}>
                    <div style={{ fontSize:10, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:.5 }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Earnings */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Earnings</div>
                {[
                  { label:'Basic Salary (50%)',       amt: slip.basic },
                  { label:'HRA (30%)',                amt: slip.hra },
                  { label:'Transport Allowance (10%)',amt: slip.transport },
                  { label:'Other Allowances (10%)',   amt: slip.other_allow },
                ].map(r=>(
                  <div key={r.label} className="payroll-row">
                    <span className="payroll-row-label">{r.label}</span>
                    <span className="payroll-amount credit">{fmtCurrency(r.amt)}</span>
                  </div>
                ))}
                <div className="payroll-row" style={{ background:'var(--blue-light)' }}>
                  <span style={{ fontWeight:700 }}>Gross Salary</span>
                  <span className="payroll-amount neutral">{fmtCurrency(slip.gross)}</span>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 }}>Deductions</div>
                {[
                  { label:'PF Contribution (12%)', amt: slip.pf_deduction },
                  { label:'TDS',                   amt: slip.tds },
                  ...(slip.lop_deduction>0 ? [{ label:'LOP Deduction', amt: slip.lop_deduction }] : []),
                ].map(r=>(
                  <div key={r.label} className="payroll-row">
                    <span className="payroll-row-label">{r.label}</span>
                    <span className="payroll-amount debit">-{fmtCurrency(r.amt)}</span>
                  </div>
                ))}
              </div>

              {/* Net */}
              <div style={{ padding:'20px', background:'var(--navy)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:.5 }}>Net Pay</div>
                  <div style={{ fontSize:13, color:'white', marginTop:2 }}>Amount Payable</div>
                </div>
                <div style={{ fontSize:26, fontWeight:700, fontFamily:'DM Mono', color:'#00D9A3' }}>{fmtCurrency(slip.net)}</div>
              </div>

              <div style={{ marginTop:16, fontSize:11, color:'var(--gray-400)', textAlign:'center' }}>
                This is a computer-generated payslip. No signature required.
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
