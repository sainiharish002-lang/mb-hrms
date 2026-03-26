'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',  icon: '⊞',  label: 'Dashboard' },
  { href: '/employees',  icon: '👥',  label: 'Employees' },
  { href: '/payroll',    icon: '💰',  label: 'Payroll' },
  { href: '/attendance', icon: '📅',  label: 'Attendance' },
  { href: '/leave',      icon: '🌿',  label: 'Leave Management' },
  { href: '/appraisal',  icon: '📊',  label: 'Appraisals' },
  { href: '/biometric',  icon: '🖐️',  label: 'Biometric Sync' },
  { href: '/payslip',    icon: '🧾',  label: 'Payslip Generator' },
  { href: '/reports',    icon: '📋',  label: 'Reports' },
]

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':  { title: 'HR & Payroll Dashboard', subtitle: 'Overview — Motionbrains Private Limited' },
  '/employees':  { title: 'Employee Management', subtitle: 'Add, edit and manage your team' },
  '/payroll':    { title: 'Payroll Processing', subtitle: 'Calculate and process monthly payroll' },
  '/attendance': { title: 'Attendance Management', subtitle: 'Mark and track daily attendance' },
  '/leave':      { title: 'Leave Management', subtitle: 'Leave requests and approvals' },
  '/appraisal':  { title: 'Performance Appraisals', subtitle: 'Rate and track employee performance' },
  '/biometric':  { title: 'Biometric Sync', subtitle: 'Import attendance from biometric device' },
  '/payslip':    { title: 'Payslip Generator', subtitle: 'Generate and print employee payslips' },
  '/reports':    { title: 'Reports & Analytics', subtitle: 'Insights and data exports' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [pendingLeaves, setPendingLeaves] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('leave_requests').select('id', { count: 'exact' })
      .eq('status', 'pending')
      .then(({ count }) => setPendingLeaves(count || 0))
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const pg = PAGE_TITLES[pathname] || { title: 'Motionbrains HRMS', subtitle: '' }

  return (
    <div style={{ display: 'flex' }}>
      {/* SIDEBAR */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">MB</div>
            <div>
              <div className="logo-name">Motionbrains</div>
              <div className="logo-sub">HR & Payroll</div>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-label">Main Menu</div>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${pathname === item.href ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
              {item.href === '/leave' && pendingLeaves > 0 && (
                <span className="nav-badge">{pendingLeaves}</span>
              )}
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">A</div>
            <div>
              <div className="user-name">Admin</div>
              <div className="user-role">HR Manager</div>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h1>{pg.title}</h1>
            <p>{pg.subtitle}</p>
          </div>
          <div className="topbar-right">
            <Link href="/leave" className="btn btn-outline no-print" style={{ position: 'relative' }}>
              🔔
              {pendingLeaves > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--red)', border: '2px solid white'
                }} />
              )}
            </Link>
            <button className="btn btn-danger no-print" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  )
}
