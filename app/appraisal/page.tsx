'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'

function getInitials(name: string) { return name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }

export default function AppraisalPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'overview'|'rate'>('overview')
  const [appraisals, setAppraisals] = useState<any[]>([])
  const [employees, setEmployees]   = useState<any[]>([])
  const [form, setForm] = useState({ emp_id:'', q1:0, q2:0, q3:0, q4:0, kpi:0, feedback:'' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const yr = new Date().getFullYear()
    const [empRes, aprRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status','active').order('name'),
      supabase.from('appraisals').select('*,employees(name,designation,department,color)').eq('year',yr),
    ])
    setEmployees(empRes.data||[])
    setAppraisals(aprRes.data||[])
  }

  useEffect(()=>{ load() },[])

  async function save() {
    if (!form.emp_id) return alert('Select employee')
    const emp = employees.find(e=>e.id===form.emp_id)
    setSaving(true)
    await supabase.from('appraisals').upsert({
      ...form, year: new Date().getFullYear(), emp_id: form.emp_id
    }, { onConflict:'emp_id,year' })
    setSaving(false)
    setForm({ emp_id:'', q1:0, q2:0, q3:0, q4:0, kpi:0, feedback:'' })
    load()
    alert('✅ Appraisal saved!')
  }

  function avg(a: any) {
    const s = [a.q1,a.q2,a.q3,a.q4].filter(x=>x>0)
    return s.length ? Math.round(s.reduce((x:number,y:number)=>x+y,0)/s.length) : 0
  }
  function color(s: number) { return s>=90?'var(--green)':s>=75?'var(--blue-accent)':'var(--amber)' }
  function label(s: number) { return s>=90?'Excellent':s>=75?'Good':'Needs Work' }

  return (
    <Layout>
      <div className="page">
        <div className="tabs" style={{ marginBottom:20 }}>
          <div className={`tab${tab==='overview'?' active':''}`} onClick={()=>setTab('overview')}>Overview</div>
          <div className={`tab${tab==='rate'?' active':''}`} onClick={()=>setTab('rate')}>Rate Employee</div>
        </div>

        {tab === 'overview' && (
          <div className="card">
            <div className="card-header"><div className="card-title">Performance Ratings {new Date().getFullYear()}</div></div>
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Dept</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>KPI</th><th>Avg</th><th>Rating</th></tr></thead>
                <tbody>
                  {appraisals.sort((a,b)=>avg(b)-avg(a)).map(a=>(
                    <tr key={a.id}>
                      <td>
                        <div className="emp-cell">
                          <div className="emp-av" style={{ background: a.employees?.color||'var(--blue-accent)' }}>
                            {getInitials(a.employees?.name)}
                          </div>
                          <div><div className="emp-fullname">{a.employees?.name}</div>
                          <div className="emp-dept">{a.employees?.designation}</div></div>
                        </div>
                      </td>
                      <td>{a.employees?.department}</td>
                      <td className="mono">{a.q1||'—'}</td>
                      <td className="mono">{a.q2||'—'}</td>
                      <td className="mono">{a.q3||'—'}</td>
                      <td className="mono">{a.q4||'—'}</td>
                      <td className="mono">{a.kpi||'—'}</td>
                      <td style={{ fontWeight:700, fontFamily:'DM Mono', color: color(avg(a)) }}>{avg(a)}</td>
                      <td><span style={{ fontSize:11, fontWeight:700, color: color(avg(a)) }}>{label(avg(a))}</span></td>
                    </tr>
                  ))}
                  {appraisals.length===0&&<tr><td colSpan={9}><div className="empty-state"><div className="icon">📊</div><p>No appraisals yet</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'rate' && (
          <div className="card">
            <div className="card-header"><div className="card-title">Rate Employee</div></div>
            <div className="card-body">
              <div className="form-grid cols-2">
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Employee</label>
                  <select className="form-select" value={form.emp_id} onChange={e=>setForm({...form,emp_id:e.target.value})}>
                    <option value="">Select Employee</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                {(['q1','q2','q3','q4','kpi'] as const).map(k=>(
                  <div key={k} className="form-group">
                    <label className="form-label">{k.toUpperCase()} Score (0-100)</label>
                    <input className="form-input" type="number" min={0} max={100}
                      value={form[k]} onChange={e=>setForm({...form,[k]:Number(e.target.value)})} />
                  </div>
                ))}
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Feedback</label>
                  <textarea className="form-textarea" value={form.feedback}
                    onChange={e=>setForm({...form,feedback:e.target.value})} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={save} disabled={saving}>
                {saving?'Saving...':'💾 Save Appraisal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
