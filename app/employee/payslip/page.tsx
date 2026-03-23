'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function EmployeePayslip() {
  const [payslips, setPayslips] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [empData, setEmpData]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single()

      if (!emp) { setLoading(false); return }
      setEmpData(emp)

      const { data } = await supabase
        .from('payroll')
        .select('*')
        .eq('emp_id', emp.id)
        .order('month', { ascending: false })

      setPayslips(data || [])
      if (data && data.length > 0) setSelected(data[0])
      setLoading(false)
    }
    load()
  }, [])

  function printPayslip() {
    window.print()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div>Loading...</div>
    </div>
  )

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>💰 My Payslips</h1>

      {payslips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 12 }}>
          <div style={{ fontSize: 40 }}>📄</div>
          <div style={{ marginTop: 12, color: '#666' }}>Abhi koi payslip generate nahi hua</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Admin payroll run karega tab payslip aayega</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>

          {/* Month List */}
          <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', height: 'fit-content' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Select Month</div>
            {payslips.map((p, i) => (
              <div key={i} onClick={() => setSelected(p)}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginBottom: 4,
                  background: selected?.id === p.id ? '#EFF6FF' : 'transparent',
                  color: selected?.id === p.id ? '#1E6FD9' : '#333',
                  fontWeight: selected?.id === p.id ? 700 : 400,
                  borderLeft: selected?.id === p.id ? '3px solid #1E6FD9' : '3px solid transparent'
                }}>
                {new Date(p.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
            ))}
          </div>

          {/* Payslip Detail */}
          {selected && (
            <div id="payslip-print" style={{ background: 'white', borderRadius: 12, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '2px solid #f1f5f9' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'linear-gradient(135deg, #1E6FD9, #3B8EFF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: 'white'
                    }}>MB</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>Motionbrains Private Limited</div>
                      <div style={{ fontSize: 12, color: '#666' }}>Jaipur, Rajasthan</div>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1E6FD9' }}>PAYSLIP</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {new Date(selected.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </div>
                  <button onClick={printPayslip}
                    style={{ marginTop: 8, padding: '6px 14px', borderRadius: 6, background: '#1E6FD9', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer' }}>
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Employee Info */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Employee Name', value: empData?.name },
                  { label: 'Employee ID',   value: empData?.id },
                  { label: 'Department',    value: empData?.department },
                  { label: 'Designation',   value: empData?.designation },
                  { label: 'Days Worked',   value: `${selected.days_present} / ${selected.total_days}` },
                  { label: 'Working Month', value: new Date(selected.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{f.value || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Earnings & Deductions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Earnings */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 10, padding: '6px 10px', background: '#dcfce7', borderRadius: 6 }}>
                    💚 Earnings
                  </div>
                  {[
                    ['Basic Salary',     selected.basic],
                    ['HRA',              selected.hra],
                    ['Transport Allow.', selected.transport],
                    ['Other Allowance',  selected.other_allow],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                      <span style={{ color: '#555' }}>{label}</span>
                      <span style={{ fontWeight: 500 }}>₹{Number(val || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#16a34a' }}>
                    <span>Gross Salary</span>
                    <span>₹{Number(selected.gross || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: 10, padding: '6px 10px', background: '#fee2e2', borderRadius: 6 }}>
                    ❤️ Deductions
                  </div>
                  {[
                    ['PF (12%)',        selected.pf_deduction],
                    ['TDS',             selected.tds],
                    ['LOP Deduction',   selected.lop_deduction],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                      <span style={{ color: '#555' }}>{label}</span>
                      <span style={{ fontWeight: 500, color: '#dc2626' }}>₹{Number(val || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                    <span>Total Deductions</span>
                    <span>₹{Number((selected.pf_deduction || 0) + (selected.tds || 0) + (selected.lop_deduction || 0)).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div style={{
                background: 'linear-gradient(135deg, #1E6FD9, #3B8EFF)',
                borderRadius: 12, padding: '20px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600 }}>NET PAY</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>Take home salary</div>
                </div>
                <div style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>
                  ₹{Number(selected.net || 0).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                Yeh computer generated payslip hai — signature ki zaroorat nahi
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 
