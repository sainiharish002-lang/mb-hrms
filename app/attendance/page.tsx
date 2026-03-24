'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { calculateAttendance } from '@/lib/attendance'
import type { Employee, AttendanceRecord } from '@/types'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Full Day': 'badge-fullday', 'Half Day': 'badge-halfday',
    'Leave': 'badge-lop', 'Absent': 'badge-absent',
  }
  return <span className={`badge ${map[status]||'badge-absent'}`}>{status}</span>
}

interface AttRow { check_in: string; check_out: string; remarks: string }
interface ShiftRow { shift_start: string; shift_end: string; grace_minutes: number }

export default function AttendancePage() {
  const supabase = createClient()
  const today    = new Date().toISOString().split('T')[0]

  const [tab, setTab]             = useState<'mark'|'report'|'shifts'>('mark')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows]           = useState<Record<string, AttRow>>({})
  const [shifts, setShifts]       = useState<Record<string, ShiftRow>>({})
  const [shiftSaving, setShiftSaving] = useState(false)
  const [shiftMsg, setShiftMsg]   = useState('')
  const [date, setDate]           = useState(today)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [policy, setPolicy]       = useState<any>(null)

  const [repMonth, setRepMonth]   = useState(new Date().getMonth() + 1)
  const [repYear,  setRepYear]    = useState(new Date().getFullYear())
  const [repData,  setRepData]    = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [empRes, polRes] = await Promise.all([
        supabase.from('employees').select('*').eq('status','active').order('name'),
        supabase.from('leave_policy').select('*').eq('id',1).single(),
      ])
      const emps = empRes.data || []
      setEmployees(emps)
      setPolicy(polRes.data)

      // Employee shifts load karo
      const { data: shiftData } = await supabase
        .from('employee_shifts')
        .select('*')
        .in('emp_id', emps.map((e:any) => e.id))

      const shiftMap: Record<string, ShiftRow> = {}
      // Default shifts set karo
      emps.forEach((e:any) => {
        shiftMap[e.id] = {
          shift_start:   polRes.data?.shift_start   || '09:00',
          shift_end:     polRes.data?.shift_end     || '18:00',
          grace_minutes: polRes.data?.grace_minutes || 15,
        }
      })
      // Custom shifts override karo
      ;(shiftData || []).forEach((s:any) => {
        shiftMap[s.emp_id] = {
          shift_start:   s.shift_start,
          shift_end:     s.shift_end,
          grace_minutes: s.grace_minutes,
        }
      })
      setShifts(shiftMap)
    }
    load()
  }, [])

  useEffect(() => {
    if (!date) return
    supabase.from('attendance').select('*').eq('date', date)
      .then(({ data }) => {
        const map: Record<string, AttRow> = {}
        ;(data||[]).forEach((r:any) => {
          map[r.emp_id] = { check_in: r.check_in||'', check_out: r.check_out||'', remarks: r.remarks||'' }
        })
        setRows(map)
      })
  }, [date])

  function updateRow(empId: string, field: keyof AttRow, value: string) {
    setRows(prev => ({ ...prev, [empId]: { ...(prev[empId]||{check_in:'',check_out:'',remarks:''}), [field]: value } }))
  }

  function updateShift(empId: string, field: keyof ShiftRow, value: string | number) {
    setShifts(prev => ({ ...prev, [empId]: { ...(prev[empId]||{shift_start:'09:00',shift_end:'18:00',grace_minutes:15}), [field]: value } }))
  }

  function preview(empId: string) {
    const r = rows[empId]
    if (!r?.check_in) return null
    const s = shifts[empId]
    return calculateAttendance(r.check_in||null, r.check_out||null, {
      shift_start: s?.shift_start || policy?.shift_start,
      shift_end:   s?.shift_end   || policy?.shift_end,
      grace_minutes: s?.grace_minutes ?? policy?.grace_minutes,
      late_threshold_mins: policy?.late_threshold_mins,
      min_hours_full_day:  policy?.min_hours_full_day,
      min_hours_half_day:  policy?.min_hours_half_day,
    })
  }

  async function saveAll() {
    setSaving(true); setMsg('')
    const records = employees.map(emp => {
      const r = rows[emp.id] || { check_in:'', check_out:'', remarks:'' }
      const s = shifts[emp.id]
      const calc = calculateAttendance(r.check_in||null, r.check_out||null, {
        shift_start: s?.shift_start || policy?.shift_start,
        shift_end:   s?.shift_end   || policy?.shift_end,
        grace_minutes: s?.grace_minutes ?? policy?.grace_minutes,
        late_threshold_mins: policy?.late_threshold_mins,
        min_hours_full_day:  policy?.min_hours_full_day,
        min_hours_half_day:  policy?.min_hours_half_day,
      })
      return {
        emp_id: emp.id, emp_name: emp.name, date,
        check_in: r.check_in||null, check_out: r.check_out||null,
        status: calc.status, hours_worked: calc.hours_worked,
        ot_hours: calc.ot_hours, st_hours: calc.st_hours,
        late_mins: calc.late_mins, is_night_shift: calc.is_night_shift,
        remarks: r.remarks||'', source: 'manual',
      }
    })
    const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'emp_id,date' })
    setSaving(false)
    setMsg(error ? `❌ ${error.message}` : `✅ Attendance saved for ${date}`)
    setTimeout(() => setMsg(''), 4000)
  }

  async function saveShifts() {
    setShiftSaving(true); setShiftMsg('')
    const records = employees.map(emp => ({
      emp_id: emp.id,
      emp_name: emp.name,
      shift_start: shifts[emp.id]?.shift_start || '09:00',
      shift_end:   shifts[emp.id]?.shift_end   || '18:00',
      grace_minutes: shifts[emp.id]?.grace_minutes ?? 15,
    }))
    const { error } = await supabase
      .from('employee_shifts')
      .upsert(records, { onConflict: 'emp_id' })
    setShiftSaving(false)
    setShiftMsg(error ? `❌ ${error.message}` : '✅ Sab employees ke shifts save ho gaye!')
    setTimeout(() => setShiftMsg(''), 4000)
  }

  async function resetToDefault(empId: string) {
    setShifts(prev => ({
      ...prev,
      [empId]: {
        shift_start:   policy?.shift_start   || '09:00',
        shift_end:     policy?.shift_end     || '18:00',
        grace_minutes: policy?.grace_minutes || 15,
      }
    }))
  }

  async function loadReport() {
    const start = `${repYear}-${String(repMonth).padStart(2,'0')}-01`
    const end   = new Date(repYear, repMonth, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('attendance')
      .select('*,employees(name,department,color)')
      .gte('date', start).lte('date', end)
      .order('emp_id').order('date')

    const byEmp: Record<string, any> = {}
    ;(data||[]).forEach((r:any) => {
      if (!byEmp[r.emp_id]) byEmp[r.emp_id] = { ...r.employees, emp_id: r.emp_id, records:[] }
      byEmp[r.emp_id].records.push(r)
    })
    const summary = Object.values(byEmp).map((e:any) => ({
      ...e,
      full_days:  e.records.filter((r:any)=>r.status==='Full Day').length,
      half_days:  e.records.filter((r:any)=>r.status==='Half Day').length,
      leaves:     e.records.filter((r:any)=>r.status==='Leave').length,
      absent:     e.records.filter((r:any)=>r.status==='Absent').length,
      total_ot:   e.records.reduce((s:number,r:any)=>s+(r.ot_hours||0),0).toFixed(1),
      total_st:   e.records.reduce((s:number,r:any)=>s+(r.st_hours||0),0).toFixed(1),
      late_count: e.records.filter((r:any)=>r.late_mins>0).length,
    }))
    setRepData(summary)
  }

  function getInitials(name:string) { return name?.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <Layout>
      <div className="page">
        {/* TABS */}
        <div className="tabs" style={{ marginBottom:20 }}>
          <div className={`tab${tab==='mark'?' active':''}`} onClick={()=>setTab('mark')}>📅 Mark Attendance</div>
          <div className={`tab${tab==='shifts'?' active':''}`} onClick={()=>setTab('shifts')}>⏰ Shift Settings</div>
          <div className={`tab${tab==='report'?' active':''}`} onClick={()=>{setTab('report');loadReport()}}>📋 Attendance Report</div>
        </div>

        {/* ── MARK ATTENDANCE ── */}
        {tab === 'mark' && (
          <>
            <div className="policy-box" style={{ marginBottom:16 }}>
              <strong>⚠️ Policy: </strong>
              Missing checkout → <strong>Leave</strong> &nbsp;|&nbsp;
              &lt;4.5h → Leave/LOP &nbsp;|&nbsp;
              4.5–9h → Half Day &nbsp;|&nbsp;
              9h+ → Full Day &nbsp;|&nbsp;
              45+ min late → Half Day
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <input type="date" value={date}
                onChange={e=>setDate(e.target.value)}
                className="form-input" style={{ width:180 }}
              />
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                {msg && <span style={{ fontSize:13, fontWeight:600, color: msg.startsWith('✅')?'var(--green)':'var(--red)' }}>{msg}</span>}
                <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Attendance'}
                </button>
              </div>
            </div>

            <div className="card">
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Shift</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Hours</th>
                      <th>Overtime</th>
                      <th>Late By</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const r = rows[emp.id] || { check_in:'', check_out:'', remarks:'' }
                      const p = preview(emp.id)
                      const s = shifts[emp.id]
                      const isMissingOut = r.check_in && !r.check_out
                      const status = p?.status || (r.check_in ? 'Leave' : 'Absent')
                      return (
                        <tr key={emp.id}>
                          <td>
                            <div className="emp-cell">
                              <div className="emp-av" style={{ background: emp.color||'var(--blue-accent)' }}>
                                {getInitials(emp.name)}
                              </div>
                              <div>
                                <div className="emp-fullname">{emp.name}</div>
                                <div className="emp-dept">{emp.department}</div>
                              </div>
                            </div>
                          </td>
                          {/* Shift timing display */}
                          <td style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'DM Mono' }}>
                            {s?.shift_start || '09:00'} – {s?.shift_end || '18:00'}
                          </td>
                          <td>
                            <input type="time" value={r.check_in}
                              onChange={e=>updateRow(emp.id,'check_in',e.target.value)}
                              className="form-input" style={{ width:120, padding:'6px 10px' }}
                            />
                          </td>
                          <td>
                            <div>
                              <input type="time" value={r.check_out}
                                onChange={e=>updateRow(emp.id,'check_out',e.target.value)}
                                className="form-input"
                                style={{ width:120, padding:'6px 10px',
                                  borderColor: isMissingOut ? 'var(--red)' : undefined,
                                  background:  isMissingOut ? 'var(--red-light)' : undefined,
                                }}
                              />
                              {isMissingOut && (
                                <div style={{ fontSize:10, color:'var(--red)', marginTop:3, fontWeight:600 }}>
                                  ⚠ Missing → Leave
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="mono" style={{ color: p?.is_night_shift ? 'var(--purple)':'inherit' }}>
                            {p?.hours_worked ? `${p.hours_worked}h` : '—'}
                            {p?.is_night_shift && ' 🌙'}
                          </td>
                          <td>
                            {p?.ot_hours && p.ot_hours > 0
                              ? <span style={{ color:'var(--green)', fontWeight:700, fontFamily:'DM Mono' }}>+{p.ot_hours}h</span>
                              : <span style={{ color:'var(--gray-200)' }}>—</span>}
                          </td>
                          <td>
                            {p?.late_mins && p.late_mins > 0
                              ? <span style={{ color: p.late_mins>=45?'var(--red)':'var(--amber)', fontWeight:600, fontSize:12 }}>
                                  +{p.late_mins}m{p.late_mins>=45?' → Half Day':''}
                                </span>
                              : <span style={{ color:'var(--gray-200)' }}>—</span>}
                          </td>
                          <td><StatusBadge status={status} /></td>
                          <td>
                            <input type="text" value={r.remarks} placeholder="Note..."
                              onChange={e=>updateRow(emp.id,'remarks',e.target.value)}
                              className="form-input" style={{ width:100, padding:'6px 10px', fontSize:11 }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── SHIFT SETTINGS TAB ── */}
        {tab === 'shifts' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>⏰ Employee Shift Settings</div>
                <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>
                  Default: {policy?.shift_start||'09:00'} – {policy?.shift_end||'18:00'} | Grace: {policy?.grace_minutes||15} min
                </div>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                {shiftMsg && <span style={{ fontSize:13, fontWeight:600, color: shiftMsg.startsWith('✅')?'var(--green)':'var(--red)' }}>{shiftMsg}</span>}
                <button className="btn btn-primary" onClick={saveShifts} disabled={shiftSaving}>
                  {shiftSaving ? 'Saving...' : '💾 Save All Shifts'}
                </button>
              </div>
            </div>

            <div className="card">
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Shift Start ⏰</th>
                      <th>Shift End ⏰</th>
                      <th>Grace (mins)</th>
                      <th>Working Hours</th>
                      <th>Reset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const s = shifts[emp.id] || { shift_start:'09:00', shift_end:'18:00', grace_minutes:15 }
                      const isDefault =
                        s.shift_start === (policy?.shift_start||'09:00') &&
                        s.shift_end   === (policy?.shift_end||'18:00')

                      // Working hours calculate karo
                      const [sh, sm] = s.shift_start.split(':').map(Number)
                      const [eh, em] = s.shift_end.split(':').map(Number)
                      const workHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60

                      return (
                        <tr key={emp.id}>
                          <td>
                            <div className="emp-cell">
                              <div className="emp-av" style={{ background: emp.color||'var(--blue-accent)' }}>
                                {getInitials(emp.name)}
                              </div>
                              <div>
                                <div className="emp-fullname">{emp.name}</div>
                                <div className="emp-dept">{emp.department}</div>
                              </div>
                            </div>
                          </td>

                          {/* Shift Start */}
                          <td>
                            <input
                              type="time"
                              value={s.shift_start}
                              onChange={e => updateShift(emp.id, 'shift_start', e.target.value)}
                              className="form-input"
                              style={{ width:120, padding:'6px 10px' }}
                            />
                          </td>

                          {/* Shift End */}
                          <td>
                            <input
                              type="time"
                              value={s.shift_end}
                              onChange={e => updateShift(emp.id, 'shift_end', e.target.value)}
                              className="form-input"
                              style={{ width:120, padding:'6px 10px' }}
                            />
                          </td>

                          {/* Grace Minutes */}
                          <td>
                            <input
                              type="number"
                              value={s.grace_minutes}
                              min={0} max={60}
                              onChange={e => updateShift(emp.id, 'grace_minutes', Number(e.target.value))}
                              className="form-input"
                              style={{ width:80, padding:'6px 10px' }}
                            />
                          </td>

                          {/* Working Hours */}
                          <td>
                            <span style={{
                              fontFamily:'DM Mono', fontWeight:600,
                              color: workHours >= 9 ? 'var(--green)' : workHours >= 8 ? 'var(--amber)' : 'var(--red)'
                            }}>
                              {workHours.toFixed(1)}h
                            </span>
                          </td>

                          {/* Reset to Default */}
                          <td>
                            {!isDefault ? (
                              <button
                                onClick={() => resetToDefault(emp.id)}
                                style={{ padding:'4px 10px', borderRadius:6, background:'var(--gray-100)', border:'1px solid var(--gray-200)', fontSize:11, cursor:'pointer', color:'var(--gray-600)' }}
                              >
                                ↩ Reset
                              </button>
                            ) : (
                              <span style={{ fontSize:11, color:'var(--gray-300)' }}>Default</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── REPORT TAB ── */}
        {tab === 'report' && (
          <>
            <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center' }}>
              <select className="filter-select" value={repMonth} onChange={e=>{setRepMonth(Number(e.target.value));setRepData([])}}>
                {months.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="filter-select" value={repYear} onChange={e=>{setRepYear(Number(e.target.value));setRepData([])}}>
                {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button className="btn btn-primary" onClick={loadReport}>Load Report</button>
            </div>

            <div className="card">
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th><th>Full Days</th><th>Half Days</th>
                      <th>Leave</th><th>Absent</th><th>Total OT</th>
                      <th>Short Time</th><th>Late Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repData.map((e:any) => (
                      <tr key={e.emp_id}>
                        <td>
                          <div className="emp-cell">
                            <div className="emp-av" style={{ background: e.color||'var(--blue-accent)' }}>
                              {getInitials(e.name)}
                            </div>
                            <div>
                              <div className="emp-fullname">{e.name}</div>
                              <div className="emp-dept">{e.department}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color:'var(--green)', fontWeight:700 }}>{e.full_days}</td>
                        <td style={{ color:'var(--amber)', fontWeight:600 }}>{e.half_days}</td>
                        <td style={{ color:'var(--red)', fontWeight:600 }}>{e.leaves}</td>
                        <td style={{ color:'var(--gray-400)' }}>{e.absent}</td>
                        <td style={{ color:'var(--green)', fontFamily:'DM Mono' }}>{e.total_ot}h</td>
                        <td style={{ color:'var(--amber)', fontFamily:'DM Mono' }}>{e.total_st}h</td>
                        <td>{e.late_count > 3
                          ? <span style={{ color:'var(--red)', fontWeight:700 }}>{e.late_count} ⚠</span>
                          : e.late_count}
                        </td>
                      </tr>
                    ))}
                    {repData.length === 0 && (
                      <tr><td colSpan={8} className="empty-state">Select month and click Load Report</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}