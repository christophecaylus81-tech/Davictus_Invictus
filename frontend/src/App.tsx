import { useEffect, useState, useCallback } from 'react'
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import GalaxyMap from './views/GalaxyMap'
import Today from './views/Today'
import Inbox from './views/Inbox'
import Kanban from './views/Kanban'
import Tasks from './views/Tasks'
import Projects from './views/Projects'
import Admin from './views/Admin'
import QuickCaptureModal from './components/QuickCaptureModal'
import { api } from './api/fusionApi'

const NAV = [
  { to: '/',         label: 'Univers',      icon: '✦' },
  { to: '/today',    label: 'Aujourd\'hui', icon: '◉' },
  { to: '/inbox',    label: 'Inbox',        icon: '◈' },
  { to: '/tasks',    label: 'Tâches',       icon: '◎' },
  { to: '/projects', label: 'Projets',      icon: '⬡' },
  { to: '/kanban',   label: 'Kanban',       icon: '▦' },
  { to: '/admin',    label: 'Admin',        icon: '⚙' },
]

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [inboxBadge, setInboxBadge] = useState(0)
  const location = useLocation()

  const isHome = location.pathname === '/' || location.pathname === '/dashboard'

  useEffect(() => {
    const refresh = async () => {
      try {
        const items = await api.inbox.list(100)
        setInboxBadge(items.filter(i => i.status === 'captured').length)
      } catch { /* ignore */ }
    }
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCaptureOpen(v => !v)
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '[') {
      e.preventDefault()
      setCollapsed(v => !v)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const sidebarW = collapsed ? 52 : 200

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: isHome ? 'rgba(2,4,13,0.7)' : 'var(--bg-base)',
        backdropFilter: isHome ? 'blur(12px)' : 'none',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden', zIndex: 50,
      }}>

        {/* Logo */}
        <div style={{
          padding: collapsed ? '18px 12px' : '18px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          minHeight: 60
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #7c6fff, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0,
            boxShadow: '0 2px 10px rgba(108,99,255,0.4)',
          }}>D</div>
          {!collapsed && (
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#c8d0e8', whiteSpace: 'nowrap' }}>Davitus</p>
              <p style={{ fontSize: 9, color: '#2d3a50', whiteSpace: 'nowrap', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Control Room</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(({ to, label, icon }) => {
            const exact = to === '/'
            const isActive = exact
              ? (location.pathname === '/' || location.pathname === '/dashboard')
              : location.pathname.startsWith(to)

            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, padding: collapsed ? '9px 12px' : '8px 10px',
                  borderRadius: 8, textDecoration: 'none',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(124,111,255,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(124,111,255,0.25)' : 'transparent'}`,
                  color: isActive ? '#a78bfa' : '#3d4f6b',
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s', position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'
                    ;(e.currentTarget as HTMLAnchorElement).style.color = '#8b9cb8'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLAnchorElement).style.color = '#3d4f6b'
                  }
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                {!collapsed && <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{label}</span>}

                {/* Inbox badge */}
                {to === '/inbox' && inboxBadge > 0 && (
                  <span style={{
                    ...(collapsed ? { position: 'absolute', top: 4, right: 4 } : {}),
                    minWidth: 17, height: 17, borderRadius: 9,
                    background: '#f59e0b', color: '#000',
                    fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', flexShrink: 0
                  }}>
                    {inboxBadge > 9 ? '9+' : inboxBadge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={() => setCaptureOpen(true)}
            title="Ctrl+K"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: collapsed ? '8px 12px' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: 'rgba(124,111,255,0.1)', border: '1px solid rgba(124,111,255,0.2)',
              borderRadius: 8, color: '#7c6fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', width: '100%', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>+</span>
            {!collapsed && <span>Capturer</span>}
            {!collapsed && <kbd style={{ marginLeft: 'auto', fontSize: 9, color: '#2d3a50', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 5px' }}>⌘K</kbd>}
          </button>

          <button
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Développer' : 'Réduire'}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: collapsed ? '7px 12px' : '7px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: 'transparent', border: 'none',
              borderRadius: 8, color: '#2d3a50', fontSize: 12,
              cursor: 'pointer', width: '100%', transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 13, transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s' }}>←</span>
            {!collapsed && <span>Réduire</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflow: 'auto', background: '#02040d', position: 'relative' }}>
        <Routes>
          <Route path="/" element={<GalaxyMap onCapture={() => setCaptureOpen(true)} />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/today" element={<Today onCapture={() => setCaptureOpen(true)} />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      {captureOpen && (
        <QuickCaptureModal
          onClose={() => setCaptureOpen(false)}
          onCaptured={() => {
            setCaptureOpen(false)
            api.inbox.list(100)
              .then(items => setInboxBadge(items.filter(i => i.status === 'captured').length))
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}
