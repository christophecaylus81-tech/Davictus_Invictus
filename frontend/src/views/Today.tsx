import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Task, type Project, type InboxItem } from '../api/fusionApi'

interface Props { onCapture: () => void }

function greeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonne soirée'
}

const STATUS_CYCLE: Record<string, string> = {
  todo: 'next', next: 'in_progress', in_progress: 'done'
}
const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  in_progress: { label: 'En cours',  cls: 'badge-accent',  dot: '#8b85ff' },
  next:        { label: 'Suivant',   cls: 'badge-info',    dot: '#38bdf8' },
  todo:        { label: 'À faire',   cls: 'badge-neutral', dot: '#4d5d78' },
}

function SkeletonCard({ h = 64 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 12 }} />
}

function KpiCard({ label, value, color, sub, onClick }: {
  label: string; value: number | string; color: string; sub?: string; onClick?: () => void
}) {
  return (
    <div className="kpi-card" onClick={onClick}>
      <p className="t-label">{label}</p>
      <p className="kpi-value" style={{ color }}>{value}</p>
      {sub && <p className="t-small" style={{ marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function FocusTask({ task, onAdvance }: { task: Task; onAdvance: (id: string, s: string) => void }) {
  const meta = STATUS_META[task.status] ?? STATUS_META.todo
  const next = STATUS_CYCLE[task.status]
  return (
    <div className="task-row" style={{ gap: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      <span className={`badge ${meta.cls}`}>{meta.label}</span>
      {next && (
        <button
          onClick={() => onAdvance(task.id, next)}
          className="btn btn-ghost"
          style={{ padding: '3px 8px', fontSize: 11 }}
        >→</button>
      )}
    </div>
  )
}

function ProjectBar({ project, tasks }: { project: Project; tasks: Task[] }) {
  const pt = tasks.filter(t => t.projectId === project.id)
  const done = pt.filter(t => t.status === 'done').length
  const pct = pt.length === 0 ? 0 : Math.round((done / pt.length) * 100)
  const active = pt.filter(t => ['todo', 'next', 'in_progress'].includes(t.status)).length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {project.title}
        </span>
        <span className="t-small" style={{ marginLeft: 10, flexShrink: 0 }}>
          {active > 0 ? `${active} active${active > 1 ? 's' : ''}` : pct === 100 ? '✓ terminé' : `${done}/${pt.length}`}
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

export default function Today({ onCapture }: Props) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [online, setOnline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      await api.health()
      setOnline(true)
      const [t, p, i] = await Promise.all([api.tasks.list(), api.projects.list(), api.inbox.list(100)])
      setTasks(t); setProjects(p); setInbox(i)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [])

  const handleAdvance = async (id: string, status: string) => {
    try {
      const updated = await api.tasks.updateStatus(id, status as Task['status'])
      setTasks(prev => prev.map(t => t.id === id ? updated : t))
    } catch { /* ignore */ }
  }

  const activeTasks = tasks
    .filter(t => ['in_progress', 'next', 'todo'].includes(t.status))
    .sort((a, b) => {
      const ord: Record<string, number> = { in_progress: 0, next: 1, todo: 2 }
      return (ord[a.status] ?? 3) - (ord[b.status] ?? 3)
    })

  const pending  = inbox.filter(i => i.status === 'captured')
  const activeProjects = projects.filter(p => p.status === 'active')
  const doneLast7 = tasks.filter(t => t.status === 'done' && Date.now() - new Date(t.createdAt).getTime() < 7 * 86400_000).length

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="page fade-in">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {greeting()}, Christophe
          </h1>
          <p className="t-body" style={{ marginTop: 3, textTransform: 'capitalize' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-dot ${online === true ? 'online' : online === false ? 'offline' : 'pending'}`} />
          <span className="t-small">
            {online === null ? 'Connexion…' : online ? 'Davitus en ligne' : 'API hors ligne'}
          </span>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} h={80} />)
        ) : (
          <>
            <KpiCard
              label="Inbox en attente"
              value={pending.length}
              color={pending.length > 0 ? 'var(--warning)' : 'var(--success)'}
              sub={pending.length === 0 ? 'Tout traité' : 'à classifier'}
              onClick={() => navigate('/inbox')}
            />
            <KpiCard
              label="Tâches actives"
              value={activeTasks.length}
              color="var(--accent-light)"
              sub={`${tasks.filter(t => t.status === 'in_progress').length} en cours`}
              onClick={() => navigate('/tasks')}
            />
            <KpiCard
              label="Projets ouverts"
              value={activeProjects.length}
              color="var(--info)"
              sub={`${projects.length} total`}
              onClick={() => navigate('/projects')}
            />
            <KpiCard
              label="Terminées (7j)"
              value={doneLast7}
              color="var(--success)"
              sub="tâches complétées"
            />
          </>
        )}
      </div>

      {/* ── Body grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

        {/* Colonne gauche */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Focus du jour */}
          <div className="card" style={{ padding: 20 }}>
            <div className="section-header">
              <span className="t-label">Focus du jour</span>
              {!loading && <span className="t-small">{activeTasks.length} tâches actives</span>}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[72, 72, 72].map((h, i) => <SkeletonCard key={i} h={h} />)}
              </div>
            ) : activeTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
                <p style={{ color: 'var(--success)', fontWeight: 600, fontSize: 15 }}>Toutes les tâches sont terminées</p>
                <p className="t-small" style={{ marginTop: 6 }}>Excellent travail aujourd'hui !</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeTasks.slice(0, 6).map(t => (
                  <FocusTask key={t.id} task={t} onAdvance={handleAdvance} />
                ))}
                {activeTasks.length > 6 && (
                  <button className="btn btn-ghost" onClick={() => navigate('/tasks')} style={{ marginTop: 4, fontSize: 13 }}>
                    + {activeTasks.length - 6} autres tâches →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Projets actifs */}
          <div className="card" style={{ padding: 20 }}>
            <div className="section-header">
              <span className="t-label">Projets actifs</span>
              <button className="btn btn-ghost" onClick={() => navigate('/projects')} style={{ fontSize: 12 }}>
                Voir tous →
              </button>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2].map(i => <SkeletonCard key={i} h={44} />)}
              </div>
            ) : activeProjects.length === 0 ? (
              <p className="t-small" style={{ padding: '12px 0' }}>Aucun projet actif</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {activeProjects.slice(0, 5).map(p => (
                  <ProjectBar key={p.id} project={p} tasks={tasks} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Inbox urgente */}
          {!loading && pending.length > 0 && (
            <div className="card" style={{
              padding: 18,
              borderColor: 'rgba(245,158,11,0.3)',
              background: 'rgba(245,158,11,0.05)'
            }}>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <span className="t-label" style={{ color: 'var(--warning)' }}>
                  Inbox ({pending.length})
                </span>
                <button className="btn btn-ghost" onClick={() => navigate('/inbox')} style={{ fontSize: 12, color: 'var(--warning)' }}>
                  Traiter →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pending.slice(0, 4).map(item => (
                  <div key={item.id} style={{
                    fontSize: 13, color: 'var(--text-secondary)',
                    padding: '7px 0',
                    borderBottom: '1px solid rgba(245,158,11,0.1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {item.content}
                  </div>
                ))}
                {pending.length > 4 && (
                  <p className="t-small" style={{ paddingTop: 4 }}>+ {pending.length - 4} autres…</p>
                )}
              </div>
            </div>
          )}

          {/* Actions rapides */}
          <div className="card" style={{ padding: 16 }}>
            <p className="t-label" style={{ marginBottom: 12 }}>Actions rapides</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" onClick={onCapture} style={{ width: '100%', justifyContent: 'center' }}>
                + Capturer dans l'Inbox
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/tasks')} style={{ width: '100%', justifyContent: 'center' }}>
                + Nouvelle tâche
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/kanban')} style={{ width: '100%', justifyContent: 'center' }}>
                Voir le Kanban
              </button>
            </div>
          </div>

          {/* Status API */}
          <div className="card" style={{ padding: 16 }}>
            <p className="t-label" style={{ marginBottom: 12 }}>Système</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'API Fusion', ok: online === true },
                { label: 'Davitus (Telegram)', ok: online === true },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="t-body" style={{ fontSize: 13 }}>{s.label}</span>
                  <span className={`badge ${s.ok ? 'badge-success' : 'badge-danger'}`}>
                    {s.ok ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
