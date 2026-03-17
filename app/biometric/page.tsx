'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { calculateAttendance } from '@/lib/attendance'

interface PreviewRow {
  bioName: string
  empId: string | null
  empName: string
  date: string
  checkIn: string
  checkOut: string | null
  punches: number
  hours: number
  status: string
  ot: number
  matched: boolean
}

function parseBioFile(text: string) {
  const punches: { bioName: string; dateTime: Date }[] = []
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 7) continue
    const dateIdx = parts.findIndex(p => /\d{4}\/\d{2}\/\d{2}/.test(p))
    if (dateIdx < 0) continue
    const dtStr = parts[dateIdx] + 'T' + (parts[dateIdx+1]||'00:00:00')
    const dt = new Date(dtStr.replace(/\//g,'-'))
    if (isNaN(dt.getTime())) continue
    const bioName = parts.slice(3, dateIdx - 2).join(' ').trim().toLowerCase()
    if (bioName) punches.push({ bioName, dateTime: dt })
  }
  return punches
}

function groupPunches(punches: { bioName: string; dateTime: Date }[]) {
  const map: Record<string, { bioName:string; date:string; checkIn:string; checkOut:string|null; count:number }> = {}
  for (const p of punches) {
    const date = p.dateTime.toISOString().split('T')[0]
    const key  = `${p.bioName}|||${date}`
    const time = p.dateTime.toTimeString().slice(0,5)
    if (!map[key]) map[key] = { bioName: p.bioName, date, checkIn: time, checkOut: null, count: 0 }
    map[key].count++
    if (time > map[key].checkIn) map[key].checkOut = time
  }
  return Object.values(map)
}

export default function BiometricPage() {
  const supabase   = createClient()
  const fileRef    = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview,  setPreview]  = useState<PreviewRow[]>([])
  const [unmatched,setUnmatched]= useState<string[]>([])
  const [mapping,  setMapping]  = useState<Record<string,string>>({})
  const [importing,setImporting]= useState(false)
  const [result,   setResult]   = useState<any>(null)
  const [history,  setHistory]  = useState<any[]>([])
  const [fileName, setFileName] = useState('')
  const [policy,   setPolicy]   = useState<any>(null)

  useEffect(() => {
    supabase.from('leave_policy').select('*').eq('id',1).single().then(({data})=>setPolicy(data))
    loadHistory()
  }, [])

  async function loadHistory() {
    const { data } = await supabase.from('biometric_imports').select('*').order('imported_at',{ascending:false}).limit(10)
    setHistory(data||[])
  }

  async function processFile(file: File) {
    setFileName(file.name)
    setResult(null); setPreview([])
    const text    = await file.text()
    const punches = parseBioFile(text)
    const daily   = groupPunches(punches)

    const { data: emps } = await supabase.from('employees').select('id,name')
    const nameMap: Record<string,string> = {}
    ;(emps||[]).forEach((e:any)=>{
      nameMap[e.name.trim().toLowerCase()] = e.id
      nameMap[e.name.split(' ')[0].toLowerCase()] = e.id
    })

    const rows: PreviewRow[] = []
    const noMatch = new Set<string>()

    for (const d of daily) {
      let empId = nameMap[d.bioName]
      if (!empId) {
        for (const [k,v] of Object.entries(nameMap)) {
          if (k.includes(d.bioName) || d.bioName.includes(k)) { empId = v; break }
        }
      }
      const emp = (emps||[]).find((e:any)=>e.id===empId)
      const calc = calculateAttendance(d.checkIn, d.checkOut, {
        shift_start: policy?.shift_start, shift_end: policy?.shift_end,
        grace_minutes: policy?.grace_minutes, late_threshold_mins: policy?.late_threshold_mins,
        min_hours_full_day: policy?.min_hours_full_day, min_hours_half_day: policy?.min_hours_half_day,
      })

      rows.push({
        bioName: d.bioName, empId: empId||null, empName: emp?.name||d.bioName,
        date: d.date, checkIn: d.checkIn, checkOut: d.checkOut||null,
        punches: d.count, hours: calc.hours_worked, status: calc.status, ot: calc.ot_hours,
        matched: !!empId,
      })
      if (!empId) noMatch.add(d.bioName)
    }

    setPreview(rows.slice(0,200))
    setUnmatched(Array.from(noMatch))
  }

  async function confirmImport() {
    setImporting(true)
    const finalRows = preview.map(r => ({
      ...r,
      empId: mapping[r.bioName] || r.empId,
    })).filter(r => r.empId)

    const records = finalRows.map(r => {
      const calc = calculateAttendance(r.checkIn, r.checkOut, {
        shift_start: policy?.shift_start, shift_end: policy?.shift_end,
        grace_minutes: policy?.grace_minutes, late_threshold_mins: policy?.late_threshold_mins,
      })
      return {
        emp_id: r.empId, emp_name: r.empName, date: r.date,
        check_in: r.checkIn, check_out: r.checkOut,
        status: calc.status, hours_worked: calc.hours_worked,
        ot_hours: calc.ot_hours, st_hours: calc.st_hours,
        late_mins: calc.late_mins, is_night_shift: calc.is_night_shift,
        remarks: `Biometric (${r.punches} punches)`, source: 'biometric',
      }
    })

    const { error } = await supabase.from('attendance').upsert(records, { onConflict:'emp_id,date' })

    await supabase.from('biometric_imports').insert({
      file_name: fileName, total_punches: preview.reduce((s,r)=>s+r.punches,0),
      records_saved: records.length, unmatched: unmatched.length,
    })

    setImporting(false)
    setResult({ saved: records.length, error: error?.message })
    loadHistory()
  }

  function StatusBadge({ s }: { s:string }) {
    const colors: Record<string,string> = {
      'Full Day':'var(--green)','Half Day':'var(--amber)','Leave':'var(--red)','Absent':'var(--gray-400)'
    }
    return <span style={{ fontSize:11, fontWeight:600, color: colors[s]||'gray' }}>{s}</span>
  }

  return (
    <Layout>
      <div className="page">
        <div className="policy-box">
          <strong>Biometric Rule: </strong>
          First punch of day = Check-In &nbsp;|&nbsp; Last punch = Check-Out &nbsp;|&nbsp;
          <strong>Missing checkout → Leave</strong> &nbsp;|&nbsp;
          Night shift auto-detected &nbsp;|&nbsp; OT calculated automatically
        </div>

        {/* Upload Zone */}
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">🖐️ Biometric Data Import</div>
            <div className="card-subtitle">Upload .txt export from eSSL / ZKTeco device</div></div>
          </div>
          <div className="card-body">
            <div
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)processFile(f)}}
              onClick={()=>fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging?'var(--blue-accent)':'var(--gray-200)'}`,
                borderRadius: 12, padding: '40px 20px', textAlign:'center',
                cursor:'pointer', background: dragging?'var(--blue-pale)':'var(--gray-50)',
                transition:'all .2s'
              }}
            >
              <div style={{ fontSize:36, marginBottom:12 }}>🖐️</div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)' }}>
                {fileName ? `📄 ${fileName}` : 'Drag & drop your biometric .txt file here'}
              </div>
              <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:6 }}>or click to browse</div>
            </div>
            <input ref={fileRef} type="file" accept=".txt" style={{ display:'none' }}
              onChange={e=>{ const f=e.target.files?.[0]; if(f) processFile(f) }} />
          </div>
        </div>

        {/* Unmatched names */}
        {unmatched.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div><div className="card-title">⚠️ Unmatched Names — Map Manually</div>
              <div className="card-subtitle">{unmatched.length} biometric names not found</div></div>
            </div>
            <div className="card-body">
              {unmatched.map(name => (
                <div key={name} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                  <span style={{ fontFamily:'DM Mono', fontSize:13, width:160 }}>{name}</span>
                  <span style={{ color:'var(--gray-400)' }}>→</span>
                  <select className="form-select" style={{ maxWidth:220 }}
                    value={mapping[name]||''} onChange={e=>setMapping({...mapping,[name]:e.target.value})}>
                    <option value="">Skip this name</option>
                    {/* Will be populated from employees */}
                  </select>
                  <span style={{ fontSize:11, color:'var(--gray-400)' }}>Leave blank to skip</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview Table */}
        {preview.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">📋 Preview ({preview.length} records)</div>
                <div className="card-subtitle">
                  Matched: {preview.filter(r=>r.matched).length} &nbsp;|&nbsp;
                  Unmatched: {preview.filter(r=>!r.matched).length}
                </div>
              </div>
              <button className="btn btn-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'Importing...' : '✓ Confirm Import'}
              </button>
            </div>
            <div style={{ overflowX:'auto', maxHeight:420, overflowY:'auto' }}>
              <table className="data-table">
                <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                  <tr>
                    <th>Bio Name</th><th>Employee</th><th>Date</th>
                    <th>Check In</th><th>Check Out</th><th>Punches</th>
                    <th>Hours</th><th>OT</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r,i)=>(
                    <tr key={i} style={{ opacity: r.matched?1:0.5 }}>
                      <td style={{ fontFamily:'DM Mono', fontSize:12 }}>{r.bioName}</td>
                      <td>
                        {r.matched
                          ? <span style={{ color:'var(--green)', fontWeight:600 }}>✓ {r.empName}</span>
                          : <span style={{ color:'var(--red)' }}>✗ Not found</span>
                        }
                      </td>
                      <td style={{ fontFamily:'DM Mono', fontSize:12 }}>{r.date}</td>
                      <td style={{ fontFamily:'DM Mono', color:'var(--blue-accent)' }}>{r.checkIn}</td>
                      <td style={{ fontFamily:'DM Mono', color: r.checkOut?'var(--green)':'var(--red)' }}>
                        {r.checkOut || '⚠ Missing → Leave'}
                      </td>
                      <td style={{ textAlign:'center' }}>{r.punches}</td>
                      <td style={{ fontFamily:'DM Mono' }}>{r.hours}h</td>
                      <td style={{ color:'var(--green)', fontFamily:'DM Mono' }}>{r.ot>0?`+${r.ot}h`:'—'}</td>
                      <td><StatusBadge s={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            padding:'16px 20px', borderRadius:10, marginBottom:20,
            background: result.error?'var(--red-light)':'var(--green-light)',
            color: result.error?'var(--red)':'var(--green)',
            fontWeight:600, fontSize:14,
          }}>
            {result.error ? `❌ Error: ${result.error}` : `✅ Import complete! ${result.saved} attendance records saved.`}
          </div>
        )}

        {/* Import History */}
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">📁 Import History</div></div>
          </div>
          <table className="data-table">
            <thead><tr><th>File</th><th>Total Punches</th><th>Records Saved</th><th>Unmatched</th><th>Imported At</th></tr></thead>
            <tbody>
              {history.map(h=>(
                <tr key={h.id}>
                  <td style={{ fontFamily:'DM Mono', fontSize:12 }}>{h.file_name}</td>
                  <td className="mono">{h.total_punches}</td>
                  <td className="mono" style={{ color:'var(--green)' }}>{h.records_saved}</td>
                  <td className="mono" style={{ color: h.unmatched>0?'var(--amber)':'var(--green)' }}>{h.unmatched}</td>
                  <td style={{ fontSize:12, color:'var(--gray-400)' }}>{new Date(h.imported_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {history.length===0&&<tr><td colSpan={5}><div className="empty-state"><div className="icon">📁</div><p>No imports yet</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
