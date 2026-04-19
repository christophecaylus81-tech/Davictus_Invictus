import { useEffect, useState, useRef, useCallback } from 'react'
import SpaceBackground from '../components/SpaceBackground'
import { api, type Project, type Task, type TaskStatus } from '../api/fusionApi'

const STATUS_META: Record<string, { label: string; color: string }> = {
  todo:        { label: 'À faire',   color: '#4a5570' },
  next:        { label: 'Suivant',   color: '#38bdf8' },
  in_progress: { label: 'En cours',  color: '#7c6fff' },
  done:        { label: 'Terminé',   color: '#10b981' },
  cancelled:   { label: 'Annulé',    color: '#ef4444' },
}

const PROJECT_COLORS = [
  '#10b981', '#7c6fff', '#38bdf8', '#f59e0b', '#a78bfa',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

interface ConstellationNode {
  project: Project
  tasks: Task[]
  x: number
  y: number
  color: string
  r: number
}

interface TaskNode {
  task: Task
  x: number
  y: number
  r: number
}

function buildConstellation(projects: Project[], tasks: Task[], w: number, h: number): ConstellationNode[] {
  const active = projects.filter(p => p.status === 'active')
  const count = active.length

  if (count === 0) return []

  // Place projects in a spiral/cluster pattern
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) * 0.3

  return active.map((project, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const spread = count === 1 ? 0 : radius
    const x = cx + Math.cos(angle) * spread
    const y = cy + Math.sin(angle) * spread
    const pt = tasks.filter(t => t.projectId === project.id)
    const done = pt.filter(t => t.status === 'done').length
    const pct = pt.length === 0 ? 0 : done / pt.length
    const r = 24 + pt.length * 2.5 // size grows with task count
    return {
      project, tasks: pt, x, y,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length]!,
      r: Math.min(r, 50),
      _pct: pct,
    } as ConstellationNode & { _pct: number }
  })
}

function getTaskNodes(node: ConstellationNode): TaskNode[] {
  const active = node.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')
  const count = active.length
  if (count === 0) return []
  const taskR = 100 + count * 5
  return active.map((task, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    return {
      task,
      x: node.x + Math.cos(angle) * taskR,
      y: node.y + Math.sin(angle) * taskR,
      r: 7,
    }
  })
}

export default function Projects() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [dims, setDims] = useState({ w: 1000, h: 700 })
  const [showAll, setShowAll] = useState(false)

  const load = async () => {
    const [p, t] = await Promise.all([api.projects.list(), api.tasks.list()])
    setProjects(p); setTasks(t); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateDims = useCallback(() => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      setDims({ w: rect.width, h: rect.height })
    }
  }, [])

  useEffect(() => {
    updateDims()
    window.addEventListener('resize', updateDims)
    return () => window.removeEventListener('resize', updateDims)
  }, [updateDims])

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      const updated = await api.tasks.updateStatus(taskId, status)
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    } catch { /* ignore */ }
  }

  const displayedProjects = showAll ? projects : projects.filter(p => p.status === 'active')
  const nodes = buildConstellation(displayedProjects, tasks, dims.w, dims.h)
  const selectedNode = selected ? nodes.find(n => n.project.id === selected) ?? null : null
  const taskNodes = selectedNode ? getTaskNodes(selectedNode) : []

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#02040d' }}>
      <SpaceBackground count={180} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '20px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(2,4,13,0.95) 0%, transparent 100%)',
        zIndex: 20, pointerEvents: 'none'
      }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '0.2em', color: '#4a5570', textTransform: 'uppercase', marginBottom: 2 }}>
            Constellations
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#c8d0e8' }}>
            {loading ? '…' : `${displayedProjects.filter(p => p.status === 'active').length} projets actifs`}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'all' }}>
          <button
            onClick={() => setShowAll(v => !v)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 100, color: '#8b9cb8', fontSize: 12, fontWeight: 500,
              padding: '6px 14px', cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}
          >
            {showAll ? 'Actifs uniquement' : 'Tous les projets'}
          </button>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 100, color: '#8b9cb8', fontSize: 12, fontWeight: 500,
                padding: '6px 14px', cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}
            >
              ← Retour
            </button>
          )}
        </div>
      </div>

      {/* SVG constellation */}
      <svg
        ref={svgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Constellation lines project → tasks */}
        {selectedNode && taskNodes.map(tn => (
          <line
            key={`line-${tn.task.id}`}
            x1={selectedNode.x} y1={selectedNode.y}
            x2={tn.x} y2={tn.y}
            stroke={selectedNode.color}
            strokeWidth={0.8}
            strokeOpacity={0.3}
            strokeDasharray="4 4"
          />
        ))}

        {/* Cross-project connection lines (subtle) */}
        {!selected && nodes.map((a, i) => nodes.slice(i + 1).map(b => (
          <line
            key={`${a.project.id}-${b.project.id}`}
            x1={a.x} y1={a.y}
            x2={b.x} y2={b.y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={0.5}
          />
        )))}

        {/* Task stars (when a project is selected) */}
        {taskNodes.map((tn, i) => {
          const meta = STATUS_META[tn.task.status] ?? STATUS_META.todo
          const isNext = tn.task.status === 'next' || tn.task.status === 'in_progress'
          return (
            <g
              key={tn.task.id}
              style={{ cursor: 'pointer', animation: `star-appear 0.4s ${i * 0.06}s ease both` }}
              onClick={() => {
                const next: Record<string, TaskStatus> = { todo: 'next', next: 'in_progress', in_progress: 'done' }
                const n = next[tn.task.status]
                if (n) void handleStatusChange(tn.task.id, n)
              }}
            >
              {/* Glow */}
              {isNext && (
                <circle cx={tn.x} cy={tn.y} r={tn.r + 6} fill={meta.color} fillOpacity={0.1}>
                  <animate attributeName="r" values={`${tn.r + 4};${tn.r + 10};${tn.r + 4}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={tn.x} cy={tn.y} r={tn.r}
                fill={meta.color}
                fillOpacity={tn.task.status === 'todo' ? 0.4 : 0.8}
                stroke={meta.color}
                strokeWidth={0.5}
                strokeOpacity={0.6}
              />
              {/* Task label */}
              <text
                x={tn.x} y={tn.y + tn.r + 14}
                textAnchor="middle"
                fontSize={10}
                fill="#8b9cb8"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {tn.task.title.length > 22 ? tn.task.title.slice(0, 22) + '…' : tn.task.title}
              </text>
              <text
                x={tn.x} y={tn.y + tn.r + 24}
                textAnchor="middle"
                fontSize={9}
                fill={meta.color}
                fillOpacity={0.7}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {meta.label}
              </text>
            </g>
          )
        })}

        {/* Project galaxies */}
        {nodes.map(node => {
          const isSelected = selected === node.project.id
          const isHovered = hovered === node.project.id
          const pt = node.tasks
          const done = pt.filter(t => t.status === 'done').length
          const pct = pt.length === 0 ? 0 : (done / pt.length)
          const activeTasks = pt.filter(t => ['todo', 'next', 'in_progress'].includes(t.status)).length
          const dim = selected && !isSelected ? 0.2 : 1

          return (
            <g
              key={node.project.id}
              style={{ cursor: 'pointer', opacity: dim, transition: 'opacity 0.4s' }}
              onClick={() => setSelected(isSelected ? null : node.project.id)}
              onMouseEnter={() => setHovered(node.project.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Outer glow rings */}
              <circle cx={node.x} cy={node.y} r={node.r + 20} fill="none" stroke={node.color} strokeWidth={0.3} strokeOpacity={0.2}>
                <animate attributeName="r" values={`${node.r + 18};${node.r + 26};${node.r + 18}`} dur={`${4 + node.r * 0.05}s`} repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.2;0.05;0.2" dur={`${4 + node.r * 0.05}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={node.x} cy={node.y} r={node.r + 8} fill="none" stroke={node.color} strokeWidth={0.5} strokeOpacity={isSelected || isHovered ? 0.5 : 0.15} style={{ transition: 'stroke-opacity 0.3s' }} />

              {/* Main orb */}
              <circle
                cx={node.x} cy={node.y} r={node.r}
                fill={node.color}
                fillOpacity={isSelected ? 0.3 : isHovered ? 0.25 : 0.15}
                stroke={node.color}
                strokeWidth={isSelected ? 1.5 : 1}
                strokeOpacity={isSelected ? 0.9 : isHovered ? 0.7 : 0.4}
                style={{ transition: 'all 0.3s' }}
              />

              {/* Progress arc */}
              {pt.length > 0 && (
                <circle
                  cx={node.x} cy={node.y} r={node.r - 3}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={3}
                  strokeOpacity={0.7}
                  strokeDasharray={`${pct * 2 * Math.PI * (node.r - 3)} ${2 * Math.PI * (node.r - 3)}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${node.x} ${node.y})`}
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              )}

              {/* Core */}
              <circle cx={node.x} cy={node.y} r={node.r * 0.25} fill={node.color} fillOpacity={0.9}>
                <animate attributeName="r" values={`${node.r * 0.22};${node.r * 0.28};${node.r * 0.22}`} dur="3s" repeatCount="indefinite" />
              </circle>

              {/* Project name */}
              <text
                x={node.x} y={node.y + node.r + 18}
                textAnchor="middle" fontSize={13} fontWeight={700}
                fill={isSelected || isHovered ? node.color : '#c8d0e8'}
                style={{ transition: 'fill 0.2s', pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.project.title}
              </text>

              {/* Subtask count */}
              <text
                x={node.x} y={node.y + node.r + 32}
                textAnchor="middle" fontSize={10}
                fill="#4a5570"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {activeTasks > 0 ? `${activeTasks} tâche${activeTasks > 1 ? 's' : ''} active${activeTasks > 1 ? 's' : ''}` : done === pt.length && pt.length > 0 ? '✓ Terminé' : 'Aucune tâche'}
              </text>

              {/* Percent in center */}
              {pt.length > 0 && (
                <text
                  x={node.x} y={node.y + 4}
                  textAnchor="middle" fontSize={10} fontWeight={700}
                  fill={node.color}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {Math.round(pct * 100)}%
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Empty state */}
      {!loading && nodes.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#4a5570', gap: 12, zIndex: 10
        }}>
          <p style={{ fontSize: 40, opacity: 0.5 }}>✦</p>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Aucun projet actif</p>
          <p style={{ fontSize: 13 }}>Les projets apparaîtront ici comme des constellations</p>
        </div>
      )}

      {/* Selected project panel */}
      {selectedNode && (
        <div style={{
          position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
          width: 280, background: 'rgba(8,11,20,0.9)', backdropFilter: 'blur(16px)',
          border: `1px solid ${selectedNode.color}30`,
          borderRadius: 16, padding: 20, zIndex: 20,
          boxShadow: `0 4px 40px rgba(0,0,0,0.6), 0 0 30px ${selectedNode.color}15`,
          animation: 'fade-in 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedNode.color, boxShadow: `0 0 8px ${selectedNode.color}` }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#c8d0e8' }}>{selectedNode.project.title}</h2>
          </div>

          {selectedNode.project.description && (
            <p style={{ fontSize: 12, color: '#4a5570', marginBottom: 14, lineHeight: 1.5 }}>
              {selectedNode.project.description}
            </p>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${selectedNode.tasks.length === 0 ? 0 : Math.round(selectedNode.tasks.filter(t => t.status === 'done').length / selectedNode.tasks.length * 100)}%`,
                background: selectedNode.color, borderRadius: 3, transition: 'width 0.5s'
              }} />
            </div>
            <p style={{ fontSize: 11, color: '#4a5570', marginTop: 5, textAlign: 'right' }}>
              {selectedNode.tasks.filter(t => t.status === 'done').length}/{selectedNode.tasks.length} terminées
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {taskNodes.map(tn => {
              const meta = STATUS_META[tn.task.status] ?? STATUS_META.todo
              const next: Record<string, TaskStatus> = { todo: 'next', next: 'in_progress', in_progress: 'done' }
              const nextStatus = next[tn.task.status]
              return (
                <div key={tn.task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: '#8b9cb8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tn.task.title}
                  </span>
                  {nextStatus && (
                    <button
                      onClick={() => void handleStatusChange(tn.task.id, nextStatus)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: meta.color, cursor: 'pointer', fontSize: 14, flexShrink: 0,
                        padding: '0 2px'
                      }}
                      title={`→ ${STATUS_META[nextStatus]?.label}`}
                    >→</button>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={() => setSelected(null)}
            style={{
              marginTop: 14, width: '100%', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
              color: '#4a5570', fontSize: 12, padding: '7px 0', cursor: 'pointer',
            }}
          >
            Fermer ×
          </button>
        </div>
      )}
    </div>
  )
}
