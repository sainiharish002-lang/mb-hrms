'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'

export default function PayslipPage() {
  const supabase = createClient()
  const [employees, setEmps]     = useState<any[]>([])
  const [uploads, setUploads]    = useState<any[]>([])
  const [empId, setEmpId]        = useState('')
  const [month, setMonth]        = useState(new Date().toISOString().slice(0, 7))
  const [files, setFiles]        = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg]            = useState('')
  const [msgType, setMsgType]    = useState<'success'|'error'>('success')
  const [tab, setTab]            = useState<'upload'|'manage'>('upload')
  const fileRef                  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [empRes, uploadRes] = await Promise.all([
      supabase.from('employees').select('id, name, department').eq('status', 'active').order('name'),
      supabase.from('payslip_files').select('*').order('uploaded_at', { ascending: false }),
    ])
    setEmps(empRes.data || [])
    setUploads(uploadRes.data || [])
  }

  async function handleUpload() {
    setMsg('')
    if (!empId) { setMsg('Employee select karo'); setMsgType('error'); return }
    if (!month) { setMsg('Month select karo'); setMsgType('error'); return }
    if (!files || files.length === 0) { setMsg('File select karo'); setMsgType('error'); return }

    setUploading(true)
    const emp = employees.find(e => e.id === empId)
    let successCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type !== 'application/pdf') {
        setMsg('Sirf PDF files allowed hain'); setMsgType('error')
        continue
      }

      const filePath = `${empId}/${month}/${file.name}`

      // Upload to Supabase Storage
      const { error: storageErr } = await supabase.storage
        .from('payslips')
        .upload(filePath, file, { upsert: true })

      if (storageErr) {
        setMsg('Upload failed: ' + storageErr.message); setMsgType('error')
        continue
      }

      // Save record in DB
      await supabase.from('payslip_files').upsert({
        emp_id: empId,
        emp_name: emp?.name,
        month: month,
        file_path: filePath,
        file_name: file.name,
        uploaded_by: 'admin',
      }, { onConflict: 'emp_id,month' })

      successCount++
    }

    if (successCount > 0) {
      setMsg(`✅ ${successCount} payslip(s) successfully upload ho gaye!`)
      setMsgType('success')
      setEmpId('')
      setFiles(null)
      if (fileRef.current) fileRef.current.value = ''
      loadData()
    }
    setUploading(false)
  }

  async function handleDelete(id: string, filePath: string) {
    if (!confirm('Yeh payslip delete karna chahte ho?')) return
    await supabase.storage.from('payslips').remove([filePath])
    await supabase.from('payslip_files').delete().eq('id', id)
    loadData()
  }

  async function handleDownload(filePath: string, fileName: string) {
    const { data } = await supabase.storage.from('payslips').download(filePath)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group uploads by month
  const groupedByMonth = uploads.reduce((acc: any, u) => {
    if (!acc[u.month]) acc[u.month] = []
    acc[u.month].push(u)
    return acc
  }, {})

  return (
    <Layout>
      <div className="page">

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          {[
            { key: 'upload', label: '📤 Upload Payslips' },
            { key: 'manage', label: '📁 Manage Payslips' },
          ].map(t => (
            <div key={t.key} className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key as any)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Upload Tab */}
        {tab === 'upload' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">📤 Employee Payslip Upload</div>
              <div className="card-subtitle">Employee ke liye PDF payslip upload karo</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <select className="form-select" value={empId} onChange={e => setEmpId(e.target.value)}>
                    <option value="">Select Employee</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Month *</label>
                  <input type="month" className="form-input" value={month}
                    onChange={e => setMonth(e.target.value)} />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">PDF Payslip *</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: '2px dashed #CBD5E1', borderRadius: 10, padding: 32,
                      textAlign: 'center', cursor: 'pointer', background: '#f8fafc',
                      transition: 'all 0.2s'
                    }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); setFiles(e.dataTransfer.files) }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                      {files && files.length > 0
                        ? `${files.length} file(s) selected: ${Array.from(files).map(f => f.name).join(', ')}`
                        : 'Click karo ya drag & drop karo'}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      Sirf PDF files — max 10MB
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => setFiles(e.target.files)}
                    />
                  </div>
                </div>
              </div>

              {msg && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  background: msgType === 'success' ? '#dcfce7' : '#fee2e2',
                  color: msgType === 'success' ? '#16a34a' : '#dc2626'
                }}>
                  {msg}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn btn-primary"
                style={{ marginTop: 16 }}
              >
                {uploading ? '⏳ Upload ho raha hai...' : '📤 Upload Payslip'}
              </button>
            </div>
          </div>
        )}

        {/* Manage Tab */}
        {tab === 'manage' && (
          <div>
            {Object.keys(groupedByMonth).length === 0 ? (
              <div className="card">
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 40 }}>📁</div>
                  <div style={{ marginTop: 12, color: '#666', fontSize: 14 }}>Abhi koi payslip upload nahi hua</div>
                </div>
              </div>
            ) : (
              Object.keys(groupedByMonth).sort().reverse().map(m => (
                <div key={m} className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header">
                    <div className="card-title">
                      📅 {new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </div>
                    <div className="card-subtitle">{groupedByMonth[m].length} payslip(s)</div>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>File Name</th>
                        <th>Uploaded</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByMonth[m].map((u: any) => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{u.emp_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.emp_id}</div>
                          </td>
                          <td style={{ fontSize: 12, color: '#555' }}>📄 {u.file_name}</td>
                          <td style={{ fontSize: 12, color: '#94a3b8' }}>
                            {new Date(u.uploaded_at).toLocaleDateString('en-IN')}
                          </td>
                          <td>
                            <button
                              className="action-btn edit"
                              onClick={() => handleDownload(u.file_path, u.file_name)}
                            >
                              ⬇️ Download
                            </button>
                            {' '}
                            <button
                              className="action-btn delete"
                              onClick={() => handleDelete(u.id, u.file_path)}
                            >
                              🗑 Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}