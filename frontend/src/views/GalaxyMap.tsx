import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SpaceBackground from '../components/SpaceBackground'
import { api, type Task, type InboxItem } from '../api/fusionApi'

interface GalaxyDef {
  id: string
  to: string
  label: string
  sub: string
  color: string
  glow: string
  size: number
  // position as % of container
  cx: number
  cy: number
}

const GALAXIES: GalaxyDef[] = [
  {
    id: 'today',
    to: '/today',
    label: 'Aujourd\'hui',
    sub: 'Centre de contrôle',
    color: '#7c6fff',
    glow: 'rgba(108,99,255,0.5)',
    size: 160,
    cx: 50, cy: 38,
  },
  {
    id: 'inbox',
    to: '/inbox',
    label: 'Inbox',
    sub: 'Messages & idées',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)',
    size: 100,
    cx: 22, cy: 62,
  },
  {
    id: 'tasks',
    to: '/tasks',
    label: 'Tâches',
    sub: 'Actions en cours',
    color: '#38bdf8',
    glow: 'rgba(56,189,248,0.4)',
    size: 110,
    cx: 40, cy: 72,
  },
  {
    id: 'projects',
    to: '/projects',
    label: 'Projets',
    sub: 'Constellations',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.4)',
    size: 120,
    cx: 64, cy: 68,
  },
  {
    id: 'kanban',
    to: '/kanban',
    label: 'Kanban',
    sub: 'Orchestrateur',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.4)',
    size: 90,
    cx: 80, cy: 48,
  },
]

// Connecting lines between galaxies (pairs of ids)
const CONNECTIONS: [string, string][] = [
  ['today', 'inbox'],
  ['today', 'projects'],
  ['today', 'kanban'],
  ['projects', 'tasks'],
]

function Galaxy({ def, badge, hovered, onClick, onEnter, onLeave }: {
  def: GalaxyDef
  badge?: number
  hovered: boolean
  onClick: () => void
  onEnter: () => void
  onLeave: () => void
}) {
  const r = def.size / 2
  const scale = hovered ? 1.12 : 1

  return (
    <div
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: 'absolute',
        left: `${def.cx}%`,
        top: `${def.cy}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: hovered ? 10 : 1,
      }}
    >
      {/* Outer glow ring */}
      <div style={{
        position: 'absolute',
        width: def.size + 40,
        height: def.size + 40,
        borderRadius: '50%',
        border: `1px solid ${def.color}30`,
        top: -20, left: -20,
        animation: `galaxy-pulse ${4 + def.size / 50}s ease-in-out infinite`,
        '--g-shadow-base': `0 0 ${def.size * 0.3}px ${def.glow}`,
        '--g-shadow-pulse': `0 0 ${def.size * 0.6}px ${def.glow}, 0 0 ${def.size}px ${def.color}20`,
      } as React.CSSProperties} />

      {/* Second ring */}
      <div style={{
        position: 'absolute',
        width: def.size + 70,
        height: def.size + 70,
        borderRadius: '50%',
        border: `1px solid ${def.color}15`,
        top: -35, left: -35,
        animation: `galaxy-pulse ${5 + def.size / 40}s 1s ease-in-out infinite`,
      }} />

      {/* Main galaxy orb */}
      <div style={{
        width: def.size,
        height: def.size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${def.color}60 0%, ${def.color}20 40%, ${def.color}08 70%, transparent 100%)`,
        boxShadow: [
          `0 0 ${r * 0.4}px ${def.glow}`,
          `0 0 ${r * 0.8}px ${def.color}30`,
          `inset 0 0 ${r * 0.4}px ${def.color}20`,
        ].join(', '),
        border: `1px solid ${def.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        animation: `float ${5 + def.size / 60}s ease-in-out infinite`,
        animationDelay: `${def.cx * 0.05}s`,
      }}>
        {/* Inner nebula swirl */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `conic-gradient(from ${def.cx * 3}deg, ${def.color}15, transparent 60%, ${def.color}08, transparent)`,
          animation: `orbit 20s linear infinite`,
          '--orbit-r': '0px',
        } as React.CSSProperties} />

        {/* Core bright spot */}
        <div style={{
          width: r * 0.35,
          height: r * 0.35,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${def.color}ff 0%, ${def.color}80 50%, transparent 100%)`,
          boxShadow: `0 0 ${r * 0.3}px ${def.color}`,
          zIndex: 1,
        }} />

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <div style={{
            position: 'absolute', top: r * 0.1, right: r * 0.1,
            background: def.color,
            color: '#000', fontWeight: 800, fontSize: 11,
            width: 22, height: 22, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 8px ${def.glow}`,
            zIndex: 2,
          }}>
            {badge > 9 ? '9+' : badge}
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ marginTop: 14, textAlign: 'center', pointerEvents: 'none' }}>
        <p style={{
          color: hovered ? def.color : '#c8d0e8',
          fontWeight: 700, fontSize: 14,
          textShadow: hovered ? `0 0 20px ${def.glow}` : 'none',
          transition: 'color 0.2s, text-shadow 0.2s',
          letterSpacing: '0.03em',
        }}>
          {def.label}
        </p>
        <p style={{
          color: '#4a5570', fontSize: 11, marginTop: 2,
          opacity: hovered ? 1 : 0.7, transition: 'opacity 0.2s',
          letterSpacing: '0.05em',
        }}>
          {def.sub}
        </p>
      </div>
    </div>
  )
}

function ConnectionLines({ hovered }: { hovered: string | null }) {
  const posMap = Object.fromEntries(GALAXIES.map(g => [g.id, { x: g.cx, y: g.cy, color: g.color }]))

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {CONNECTIONS.map(([a, b]) => {
        const pa = posMap[a]!
        const pb = posMap[b]!
        const isActive = hovered === a || hovered === b
        return (
          <line
            key={`${a}-${b}`}
            x1={pa.x} y1={pa.y}
            x2={pb.x} y2={pb.y}
            stroke={isActive ? pa.color : 'rgba(255,255,255,0.05)'}
            strokeWidth={isActive ? 0.15 : 0.08}
            strokeDasharray={isActive ? '0.8 0.4' : '0.5 0.5'}
            style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
          />
        )
      })}
    </svg>
  )
}

export default function GalaxyMap({ onCapture }: { onCapture: () => void }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<string | null>(null)
  const [inboxCount, setInboxCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        await api.health()
        setOnline(true)
        const [inbox, tasks] = await Promise.all([api.inbox.list(100), api.tasks.list()])
        setInboxCount((inbox as InboxItem[]).filter(i => i.status === 'captured').length)
        setTaskCount((tasks as Task[]).filter(t => ['todo', 'next', 'in_progress'].includes(t.status)).length)
      } catch {
        setOnline(false)
      }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const badgeMap: Record<string, number> = {
    inbox: inboxCount,
    tasks: taskCount,
  }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#02040d', overflow: 'hidden',
    }}>
      <SpaceBackground count={250} />

      {/* Davitus Invictus — logo centré, fond noir dissous par screen */}
      <img
        src="/davitus-logo.png"
        alt=""
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -58%)',
          width: '52vmin',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: 0.55,
          zIndex: 0,
        }}
      />

      <ConnectionLines hovered={hovered} />

      {/* Galaxies */}
      {GALAXIES.map(g => (
        <Galaxy
          key={g.id}
          def={g}
          badge={badgeMap[g.id]}
          hovered={hovered === g.id}
          onClick={() => navigate(g.to)}
          onEnter={() => setHovered(g.id)}
          onLeave={() => setHovered(null)}
        />
      ))}

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '20px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(2,4,13,0.9) 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 20,
      }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '0.2em', color: '#4a5570', marginBottom: 2, textTransform: 'uppercase' }}>
            Fusion Control Room
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#c8d0e8', textTransform: 'capitalize' }}>
            {today}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'all' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: online === true ? '#10b981' : online === false ? '#ef4444' : '#4a5570',
            boxShadow: online === true ? '0 0 8px #10b981' : 'none',
            animation: online === true ? 'pulse-green 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 12, color: '#4a5570' }}>
            {online === null ? '…' : online ? 'Davitus en ligne' : 'Hors ligne'}
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 28px',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
        background: 'linear-gradient(to top, rgba(2,4,13,0.9) 0%, transparent 100%)',
        zIndex: 20,
      }}>
        <button
          onClick={onCapture}
          style={{
            background: 'rgba(108,99,255,0.15)',
            border: '1px solid rgba(108,99,255,0.4)',
            borderRadius: 100,
            color: '#8b85ff', fontSize: 13, fontWeight: 600,
            padding: '9px 22px', cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s',
            boxShadow: '0 0 20px rgba(108,99,255,0.2)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,99,255,0.25)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(108,99,255,0.4)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,99,255,0.15)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(108,99,255,0.2)'
          }}
        >
          <span>◈</span>
          Capturer dans l'Inbox
          <kbd style={{ fontSize: 10, opacity: 0.6, background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '1px 5px', border: '1px solid rgba(255,255,255,0.1)' }}>⌘K</kbd>
        </button>
      </div>

      {/* Hover tooltip */}
      {hovered && (() => {
        const g = GALAXIES.find(g => g.id === hovered)!
        return (
          <div style={{
            position: 'absolute', top: 24, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(8,11,20,0.9)', backdropFilter: 'blur(12px)',
            border: `1px solid ${g.color}30`,
            borderRadius: 100, padding: '6px 18px',
            color: g.color, fontSize: 12, fontWeight: 600,
            pointerEvents: 'none', zIndex: 30,
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 20px ${g.color}20`,
            animation: 'fade-in 0.15s ease',
          }}>
            → Naviguer vers {g.label}
          </div>
        )
      })()}
    </div>
  )
}
