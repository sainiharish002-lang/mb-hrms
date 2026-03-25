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
  const pathname = usePathname()
  const router   = useRouter()
  const [pendingLeaves, setPendingLeaves] = useState(0)
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [isMobile, setIsMobile]           = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

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
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 40, backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* SIDEBAR */}
      <nav
        className="sidebar"
        style={{
          position: isMobile ? 'fixed' : 'sticky',
          top: 0, left: 0,
          height: '100vh',
          zIndex: 50,
          transform: isMobile
            ? sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'
            : 'translateX(0)',
          transition: 'transform 0.3s ease',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">MB</div>
            <div>
              <div className="logo-name">Motionbrains</div>
              <div className="logo-sub">HR & Payroll</div>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 20, cursor: 'pointer',
                padding: '4px 8px', marginLeft: 'auto'
              }}
            >✕</button>
          )}
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
      <div className="main" style={{ flex: 1, minWidth: 0 }}>

        {/* TOPBAR */}
        <header
          className="topbar"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: isMobile ? '10px 16px' : undefined,
          }}
        >
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none', border: 'none',
                fontSize: 22, cursor: 'pointer',
                color: 'var(--gray-800)', padding: '4px', flexShrink: 0,
              }}
            >☰</button>
          )}

          <div className="topbar-left" style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: isMobile ? 14 : undefined,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {pg.title}
            </h1>
            {!isMobile && <p>{pg.subtitle}</p>}
          </div>

          <div className="topbar-right" style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
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
            <button className="btn btn-danger no-print" onClick={handleLogout}>
              {isMobile ? '⏏' : 'Logout'}
            </button>
          </div>
        </header>

        <main style={{ padding: isMobile ? '12px' : undefined }}>
          {children}
        </main>
      </div>
    </div>
  )
}
