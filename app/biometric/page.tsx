'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { calculateAttendance } from '@/lib/attendance'

declare const XLSX: any

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

// ── TXT Parser ──
function parseTxtFile(text: string) {
  const punches: { bioName: string; dateTime: Date }[] = []
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 7) continue
    const dateIdx = parts.findIndex(p => /\d{4}\/\d{2}\/\d{2}/.test(p))
    if (dateIdx < 0) continue
    const dtStr = parts[dateIdx] + 'T' + (parts[dateIdx + 1] || '00:00:00')
    const dt = new Date(dtStr.replace(/\//g, '-'))
    if (isNaN(dt.getTime())) continue
    const bioName = parts.slice(3, dateIdx - 2).join(' ').trim().toLowerCase()
    if (bioName) punches.push({ bioName, dateTime: dt })
  }
  return punches
}

// ── CSV Parser ──
function parseCsvFile(text: string) {
  const punches: { bioName: string; dateTime: Date }[] = []
  const lines = text.split('\n').slice(1) // skip header
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 3) continue
    // Expected: Name, Date, Time OR Name, DateTime
    const name = cols[0]?.toLowerCase()
    if (!name) continue
    let dt: Date
    if (cols[2]) {
      dt = new Date(`${cols[1]}T${cols[2]}`)
    } else {
      dt = new Date(cols[1])
    }
    if (isNaN(dt.getTime())) continue
    punches.push({ bioName: name.trim(), dateTime: dt })
  }
  return punches
}

// ── Excel Parser ──
// ── Excel Parser — eSSL Monthly Punch Report ──
async function parseExcelFile(file: File): Promise<{ bioName: string; dateTime: Date }[]> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

      const punches: { bioName: string; dateTime: Date }[] = []
      let currentName = ''

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const col0 = String(row[0] || '').trim()
        const col1 = String(row[1] || '').trim()
        const col2 = String(row[2] || '').trim()
        const col6 = String(row[6] || '').trim()

        // Employee name row detect karo (CardNo row)
        if (col0 && col0 !== 'CardNo' && /^\d+$/.test(col0) && col1) {
          currentName = col1.trim()
          continue
        }

        // Date + Swipe record row
        if (!col0 && col2 && col6 && currentName) {
          // Date parse — format: MM/DD/YYYY
          const dateParts = col2.split('/')
          if (dateParts.length !== 3) continue
          const dateStr = `${dateParts[2]}-${dateParts[0].padStart(2,'0')}-${dateParts[1].padStart(2,'0')}`

          // Swipe record se sab times nikalo
          // Format: 09:33(1 Fp)16:32(1 Fp)16:32(1 Fp)
          const timeMatches = col6.match(/(\d{2}:\d{2})/g)
          if (!timeMatches || timeMatches.length === 0) continue

          // Unique times sort karo
          const uniqueTimes = [...new Set(timeMatches)].sort()

          // First punch = Check In
          const checkIn = uniqueTimes[0]
          const dtIn = new Date(`${dateStr}T${checkIn}:00`)
          if (!isNaN(dtIn.getTime())) {
            punches.push({ bioName: currentName.toLowerCase(), dateTime: dtIn })
          }

          // Last punch = Check Out (agar alag hai checkIn se)
          const checkOut = uniqueTimes[uniqueTimes.length - 1]
          if (checkOut !== checkIn) {
            const dtOut = new Date(`${dateStr}T${checkOut}:00`)
            if (!isNaN(dtOut.getTime())) {
              punches.push({ bioName: currentName.toLowerCase(), dateTime: dtOut })
            }
          }
        }
      }
      resolve(punches)
    }
    reader.readAsArrayBuffer(file)
  })
}

// ── Group Punches ──
// ── Group Punches ──
function groupPunches(punches: { bioName: string; dateTime: Date }[]) {
  const map: Record<string, {
    bioName: string; date: string; checkIn: string; checkOut: string | null; count: number
  }> = {}

  for (const p of punches) {
    const date = p.dateTime.toISOString().split('T')[0]
    const key  = `${p.bioName}|||${date}`
    const time = p.dateTime.toTimeString().slice(0, 5)

    if (!map[key]) {
      map[key] = { bioName: p.bioName, date, checkIn: time, checkOut: null, count: 1 }
    } else {
      map[key].count++
      // Earliest = checkIn, Latest = checkOut
      if (time < map[key].checkIn) map[key].checkIn = time
      if (time > (map[key].checkOut || map[key].checkIn)) map[key].checkOut = time
    }
  }

  return Object.values(map)
}

export default function BiometricPage() {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [dragging,  setDragging]  = useState(false)
  const [preview,   setPreview]   = useState<PreviewRow[]>([])
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [mapping,   setMapping]   = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result,    setResult]    = useState<any>(null)
  const [history,   setHistory]   = useState<any[]>([])
  const [fileName,  setFileName]  = useState('')
  const [policy,    setPolicy]    = useState<any>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [fileType,  setFileType]  = useState('')

  useEffect(() => {
    // SheetJS load
    if (!document.getElementById('xlsxscript')) {
      const s = document.createElement('script')
      s.id = 'xlsxscript'
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      document.head.appendChild(s)
    }
    supabase.from('leave_policy').select('*').eq('id', 1).single().then(({ data }) => setPolicy(data))
    supabase.from('employees').select('id,name').then(({ data }) => setEmployees(data || []))
    loadHistory()
  }, [])

  async function loadHistory() {
    const { data } = await supabase.from('biometric_imports').select('*').order('imported_at', { ascending: false }).limit(10)
    setHistory(data || [])
  }

  async function processFile(file: File) {
    setFileName(file.name)
    setResult(null)
    setPreview([])
    setUnmatched([])

    const ext = file.name.split('.').pop()?.toLowerCase()
    setFileType(ext || '')

    let punches: { bioName: string; dateTime: Date }[] = []

    try {
      if (ext === 'txt') {
        const text = await file.text()
        punches = parseTxtFile(text)
      } else if (ext === 'csv') {
        const text = await file.text()
        punches = parseCsvFile(text)
      } else if (ext === 'xlsx' || ext === 'xls') {
        punches = await parseExcelFile(file)
      } else if (ext === 'pdf') {
        alert('PDF se biometric data automatically parse nahi ho sakta. Please TXT, CSV ya Excel format use karo.')
        return
      }
    } catch (err: any) {
      alert('File parse error: ' + err.message)
      return
    }

    if (punches.length === 0) {
      alert('File mein koi valid punch data nahi mila. Format check karo.')
      return
    }

    const daily = groupPunches(punches)
    const nameMap: Record<string, string> = {}
    employees.forEach((e: any) => {
      nameMap[e.name.trim().toLowerCase()] = e.id
      nameMap[e.name.split(' ')[0].toLowerCase()] = e.id
    })

    const rows: PreviewRow[] = []
    const noMatch = new Set<string>()

    for (const d of daily) {
      let empId = nameMap[d.bioName]
      if (!empId) {
        for (const [k, v] of Object.entries(nameMap)) {
          if (k.includes(d.bioName) || d.bioName.includes(k)) { empId = v; break }
        }
      }
      const emp = employees.find((e: any) => e.id === empId)
      const calc = calculateAttendance(d.checkIn, d.checkOut, {
        shift_start: policy?.shift_start,
        shift_end: policy?.shift_end,
        grace_minutes: policy?.grace_minutes,
        late_threshold_mins: policy?.late_threshold_mins,
        min_hours_full_day: policy?.min_hours_full_day,
        min_hours_half_day: policy?.min_hours_half_day,
      })
      rows.push({
        bioName: d.bioName, empId: empId || null,
        empName: emp?.name || d.bioName,
        date: d.date, checkIn: d.checkIn, checkOut: d.checkOut || null,
        punches: d.count, hours: calc.hours_worked,
        status: calc.status, ot: calc.ot_hours, matched: !!empId,
      })
      if (!empId) noMatch.add(d.bioName)
    }

    setPreview(rows.slice(0, 200))
    setUnmatched(Array.from(noMatch))
  }

  async function confirmImport() {
    setImporting(true)
    const finalRows = preview.map(r => ({
      ...r, empId: mapping[r.bioName] || r.empId,
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

    const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'emp_id,date' })

    await supabase.from('biometric_imports').insert({
      file_name: fileName,
      total_punches: preview.reduce((s, r) => s + r.punches, 0),
      records_saved: records.length,
      unmatched: unmatched.length,
    })

    setImporting(false)
    setResult({ saved: records.length, error: error?.message })
    loadHistory()
  }

  const fileFormats: Record<string, { icon: string; color: string }> = {
    txt:  { icon: '📄', color: '#EFF6FF' },
    csv:  { icon: '📊', color: '#F0FDF4' },
    xlsx: { icon: '📗', color: '#F0FDF4' },
    xls:  { icon: '📗', color: '#F0FDF4' },
    pdf:  { icon: '📕', color: '#FEF2F2' },
  }

  function StatusBadge({ s }: { s: string }) {
    const colors: Record<string, string> = {
      'Full Day': 'var(--green)', 'Half Day': 'var(--amber)',
      'Leave': 'var(--red)', 'Absent': 'var(--gray-400)'
    }
    return <span style={{ fontSize: 11, fontWeight: 600, color: colors[s] || 'gray' }}>{s}</span>
  }

  return (
    <Layout>
      <div className="page">
        <div className="policy-box">
          <strong>Biometric Rule: </strong>
          First punch = Check-In &nbsp;|&nbsp; Last punch = Check-Out &nbsp;|&nbsp;
          <strong>Missing checkout → Leave</strong> &nbsp;|&nbsp; Night shift auto-detected
        </div>

        {/* Supported Formats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { ext: 'TXT',  icon: '📄', desc: 'eSSL/ZKTeco export',   color: '#EFF6FF', border: '#BFDBFE' },
            { ext: 'CSV',  icon: '📊', desc: 'Comma separated',       color: '#F0FDF4', border: '#BBF7D0' },
            { ext: 'XLSX', icon: '📗', desc: 'Excel spreadsheet',     color: '#F0FDF4', border: '#BBF7D0' },
            { ext: 'XLS',  icon: '📗', desc: 'Excel legacy',          color: '#F0FDF4', border: '#BBF7D0' },
            { ext: 'PDF',  icon: '📕', desc: 'Not supported (yet)',   color: '#FEF2F2', border: '#FECACA' },
          ].map(f => (
            <div key={f.ext} style={{ background: f.color, border: `1px solid ${f.border}`, borderRadius: 8, padding: '8px 14px', textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 20 }}>{f.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{f.ext}</div>
              <div style={{ fontSize: 10, color: '#666' }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Upload Zone */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🖐️ Biometric Data Import</div>
              <div className="card-subtitle">TXT, CSV, Excel file upload karo</div>
            </div>
          </div>
          <div className="card-body">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--blue-accent)' : 'var(--gray-200)'}`,
                borderRadius: 12, padding: '40px 20px', textAlign: 'center',
                cursor: 'pointer', background: dragging ? 'var(--blue-pale)' : 'var(--gray-50)',
                transition: 'all .2s'
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>
                {fileType ? (fileFormats[fileType]?.icon || '📄') : '🖐️'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)' }}>
                {fileName ? `📄 ${fileName}` : 'Drag & drop ya click karo'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
                Supported: .txt, .csv, .xlsx, .xls
              </div>
            </div>
            <input
              ref={fileRef} type="file"
              accept=".txt,.csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
            />
          </div>
        </div>

        {/* CSV/Excel Format Guide */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title">📋 File Format Guide</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={{ background: '#EFF6FF', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📄 TXT (eSSL/ZKTeco)</div>
                <code style={{ fontSize: 11, color: '#374151' }}>
                  1  1  1  Name  2026/03/20  09:05:00  1
                </code>
              </div>
              <div style={{ background: '#F0FDF4', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📊 CSV Format</div>
                <code style={{ fontSize: 11, color: '#374151' }}>
                  Name,Date,Time<br />
                  Archana,2026-03-20,09:05
                </code>
              </div>
              <div style={{ background: '#F0FDF4', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📗 Excel Format</div>
                <code style={{ fontSize: 11, color: '#374151' }}>
                  Columns: Name | Date | Time<br />
                  Row 1: Header, Row 2+: Data
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Unmatched */}
        {unmatched.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">⚠️ Unmatched Names</div>
                <div className="card-subtitle">{unmatched.length} names employee list mein nahi mile</div>
              </div>
            </div>
            <div className="card-body">
              {unmatched.map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'DM Mono', fontSize: 13, width: 160 }}>{name}</span>
                  <span style={{ color: 'var(--gray-400)' }}>→</span>
                  <select className="form-select" style={{ maxWidth: 220 }}
                    value={mapping[name] || ''} onChange={e => setMapping({ ...mapping, [name]: e.target.value })}>
                    <option value="">Skip this name</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">📋 Preview ({preview.length} records)</div>
                <div className="card-subtitle">
                  Matched: {preview.filter(r => r.matched).length} &nbsp;|&nbsp;
                  Unmatched: {preview.filter(r => !r.matched).length}
                </div>
              </div>
              <button className="btn btn-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'Importing...' : '✓ Confirm Import'}
              </button>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table className="data-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Bio Name</th><th>Employee</th><th>Date</th>
                    <th>Check In</th><th>Check Out</th><th>Punches</th>
                    <th>Hours</th><th>OT</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} style={{ opacity: r.matched ? 1 : 0.5 }}>
                      <td style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{r.bioName}</td>
                      <td>
                        {r.matched
                          ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ {r.empName}</span>
                          : <span style={{ color: 'var(--red)' }}>✗ Not found</span>}
                      </td>
                      <td style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{r.date}</td>
                      <td style={{ fontFamily: 'DM Mono', color: 'var(--blue-accent)' }}>{r.checkIn}</td>
                      <td style={{ fontFamily: 'DM Mono', color: r.checkOut ? 'var(--green)' : 'var(--red)' }}>
                        {r.checkOut || '⚠ Missing → Leave'}
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.punches}</td>
                      <td style={{ fontFamily: 'DM Mono' }}>{r.hours}h</td>
                      <td style={{ color: 'var(--green)', fontFamily: 'DM Mono' }}>{r.ot > 0 ? `+${r.ot}h` : '—'}</td>
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
            padding: '16px 20px', borderRadius: 10, marginTop: 16,
            background: result.error ? 'var(--red-light)' : 'var(--green-light)',
            color: result.error ? 'var(--red)' : 'var(--green)',
            fontWeight: 600, fontSize: 14,
          }}>
            {result.error ? `❌ Error: ${result.error}` : `✅ Import complete! ${result.saved} records saved.`}
          </div>
        )}

        {/* History */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title">📁 Import History</div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>File</th><th>Total Punches</th><th>Records Saved</th><th>Unmatched</th><th>Imported At</th></tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{h.file_name}</td>
                  <td className="mono">{h.total_punches}</td>
                  <td className="mono" style={{ color: 'var(--green)' }}>{h.records_saved}</td>
                  <td className="mono" style={{ color: h.unmatched > 0 ? 'var(--amber)' : 'var(--green)' }}>{h.unmatched}</td>
                  <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {new Date(h.imported_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><div className="icon">📁</div><p>No imports yet</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}