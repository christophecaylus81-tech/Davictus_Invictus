import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import Dashboard from './views/Dashboard'
import Inbox from './views/Inbox'
import Tasks from './views/Tasks'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { to: '/inbox',     label: 'Inbox',     icon: '◈' },
  { to: '/tasks',     label: 'Tâches',    icon: '◎' },
]

export default function App() {
  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '24px 0', gap: 16, background: '#0a0c14',
        borderRight: '1px solid #1e2130', flexShrink: 0
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: '#6c63ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 8
        }}>F</div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} title={label} style={({ isActive }) => ({
              width: 40, height: 40, borderRadius: 10, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18,
              textDecoration: 'none', transition: 'all 0.15s',
              background: isActive ? '#1e1b4b' : 'transparent',
              color: isActive ? '#fff' : '#475569'
            })}>
              {icon}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#0d0f18' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </main>
    </div>
  )
}
