'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Layout from '@/components/Layout'
import type { Employee } from '@/types'

const COLORS = ['#1E6FD9','#6C5CE7','#0DBF7E','#F5A623','#F04A4A','#3B8EFF','#A29BFE','#00D9A3']
const DEPTS  = ['Design','Production','Marketing','Accounts','Sales','HR','IT','Operations']

function fmtCurrency(n: number) { return '₹' + Number(n).toLocaleString('en-IN') }
function getInitials(name: string) { return name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }

const EMPTY_EMP: Partial<Employee> = {
  id:'', name:'', designation:'', department:'', salary:0, status:'active', email:'', phone:'', color: COLORS[0]
}

export default function EmployeesPage() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('')
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState<Partial<Employee>>(EMPTY_EMP)
  const [isNew, setIsNew]         = useState(true)
  const [saving, setSaving]       = useState(false)

  async function load() {
    let q = supabase.from('employees').select('*').order('name')
    if (filter) q = q.eq('status', filter)
    const { data } = await q
    setEmployees(data || [])
  }

  useEffect(() => { load() }, [filter])

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.id.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    // Auto-generate next ID
    const maxNum = employees.reduce((mx, e) => {
      const n = parseInt(e.id.replace(/\D/g,'')) || 0
      return Math.max(mx, n)
    }, 0)
    const nextId = 'MB' + String(maxNum + 1).padStart(3, '0')
    setEditing({ ...EMPTY_EMP, id: nextId, color: COLORS[employees.length % COLORS.length] })
    setIsNew(true)
    setModal(true)
  }

  function openEdit(emp: Employee) {
    setEditing({ ...emp })
    setIsNew(false)
    setModal(true)
  }

  async function save() {
    if (!editing.id || !editing.name) return alert('ID and Name required')
    setSaving(true)
    if (isNew) {
      await supabase.from('employees').insert(editing)
    } else {
      await supabase.from('employees').update(editing).eq('id', editing.id!)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this employee? This will also delete their attendance and leave records.')) return
    await supabase.from('employees').delete().eq('id', id)
    load()
  }

  return (
    <Layout>
      <div className="page">
        {/* Search + Add */}
        <div className="search-bar">
          <input className="search-input" placeholder="Search name, ID, department..."
            value={search} onChange={e=>setSearch(e.target.value)} />
          <select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="leave">On Leave</option>
            <option value="wfh">WFH</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Employee</button>
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">All Employees</div>
              <div className="card-subtitle">{filtered.length} employees</div>
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Department</th><th>Designation</th>
                  <th>Salary</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="emp-cell">
                        <div className="emp-av" style={{ background: emp.color||'var(--blue-accent)' }}>
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          <div className="emp-fullname">{emp.name}</div>
                          <div className="emp-dept">{emp.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td className="mono">{fmtCurrency(emp.salary)}</td>
                    <td><span className={`badge badge-${emp.status}`}>{emp.status}</span></td>
                    <td>
                      <button className="action-btn edit" onClick={()=>openEdit(emp)}>✏️ Edit</button>
                      {' '}
                      <button className="action-btn delete" onClick={()=>del(emp.id)}>🗑 Delete</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="empty-state"><div className="icon">👥</div><p>No employees found</p></div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL */}
        {modal && (
          <div className="modal-overlay open" onClick={e=>{ if(e.target===e.currentTarget) setModal(false) }}>
            <div className="modal">
              <div className="modal-header">
                <div className="modal-title">{isNew ? '+ Add Employee' : 'Edit Employee'}</div>
                <button className="modal-close" onClick={()=>setModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid cols-2">
                  <div className="form-group">
                    <label className="form-label">Employee ID *</label>
                    <input className="form-input" value={editing.id||''} readOnly={!isNew}
                      onChange={e=>setEditing({...editing,id:e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={editing.name||''}
                      onChange={e=>setEditing({...editing,name:e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input className="form-input" value={editing.designation||''}
                      onChange={e=>setEditing({...editing,designation:e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select className="form-select" value={editing.department||''}
                      onChange={e=>setEditing({...editing,department:e.target.value})}>
                      <option value="">Select...</option>
                      {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary (₹)</label>
                    <input className="form-input" type="number" value={editing.salary||0}
                      onChange={e=>setEditing({...editing,salary:Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={editing.status||'active'}
                      onChange={e=>setEditing({...editing,status:e.target.value as any})}>
                      <option value="active">Active</option>
                      <option value="leave">On Leave</option>
                      <option value="wfh">WFH</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={editing.phone||''}
                      onChange={e=>setEditing({...editing,phone:e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={editing.email||''}
                      onChange={e=>setEditing({...editing,email:e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Avatar Color</label>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                      {COLORS.map(c=>(
                        <div key={c} onClick={()=>setEditing({...editing,color:c})}
                          style={{ width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer',
                            border: editing.color===c ? '3px solid var(--gray-800)' : '2px solid transparent' }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={()=>setModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving...' : isNew ? 'Add Employee' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
