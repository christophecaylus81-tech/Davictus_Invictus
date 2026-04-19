import { useEffect, useRef, useState } from 'react'
import { api, type Task, type Project, type TaskStatus } from '../api/fusionApi'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  todo:        { label: 'À faire',  cls: 'badge-neutral' },
  next:        { label: 'Suivant',  cls: 'badge-info'    },
  in_progress: { label: 'En cours', cls: 'badge-accent'  },
  done:        { label: 'Terminé',  cls: 'badge-success' },
  cancelled:   { label: 'Annulé',   cls: 'badge-danger'  },
}
const STATUS_CYCLE: Record<string, TaskStatus> = {
  todo: 'next', next: 'in_progress', in_progress: 'done', done: 'todo'
}

function InlineAdd({ projectId, onAdded }: { projectId?: string; onAdded: (t: Task) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) ref.current?.focus() }, [open])

  const save = async () => {
    if (!value.trim() || saving) return
    setSaving(true)
    try {
      const task = await api.tasks.create({ title: value.trim(), projectId, status: 'todo' })
      onAdded(task); setValue(''); setOpen(false)
    } finally { setSaving(false) }
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{
        background: 'transparent', border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius-sm)', padding: '7px 14px', fontSize: 13,
        color: 'var(--text-muted)', cursor: 'pointer', width: '100%',
        textAlign: 'left', marginTop: 4, transition: 'all 0.15s'
      }}
    >
      + Nouvelle tâche
    </button>
  )

  return (
    <div style={{
      display: 'flex', gap: 8, marginTop: 4, alignItems: 'center',
      background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)',
      borderRadius: 'var(--radius-sm)', padding: '7px 12px'
    }}>
      <input
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') { setOpen(false); setValue('') }
        }}
        placeholder="Titre de la tâche…"
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit'
        }}
      />
      <button onClick={save} disabled={!value.trim() || saving} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}>
        {saving ? '…' : 'Ajouter'}
      </button>
      <button onClick={() => { setOpen(false); setValue('') }} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 16 }}>×</button>
    </div>
  )
}

function TaskRow({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, s: TaskStatus) => void }) {
  const [busy, setBusy] = useState(false)
  const meta = STATUS_META[task.status] ?? STATUS_META.todo
  const next = STATUS_CYCLE[task.status]

  const cycle = async () => {
    if (busy || !next) return
    setBusy(true)
    try { await onStatusChange(task.id, next) }
    finally { setBusy(false) }
  }

  return (
    <div className="task-row">
      <button
        onClick={cycle}
        disabled={busy || task.status === 'cancelled'}
        className={`badge ${meta.cls}`}
        style={{ border: 'none', cursor: next ? 'pointer' : 'default', opacity: busy ? 0.5 : 1 }}
        title={next ? `→ ${STATUS_META[next]?.label}` : undefined}
      >
        {busy ? '…' : meta.label}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {task.title}
        </p>
        {task.notes && (
          <p className="t-small" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.notes}
          </p>
        )}
      </div>
    </div>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')

  useEffect(() => {
    Promise.all([api.tasks.list(), api.projects.list()])
      .then(([t, p]) => { setTasks(t); setProjects(p) })
      .finally(() => setLoading(false))
  }, [])

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    const updated = await api.tasks.updateStatus(id, status)
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
  }

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

  const filtered = tasks.filter(t => {
    if (filter === 'active') return ['todo', 'next', 'in_progress'].includes(t.status)
    if (filter === 'done') return t.status === 'done'
    return true
  })

  const byProject = filtered.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.projectId ?? '__'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const tabs = [
    { key: 'active' as const, label: 'Actives' },
    { key: 'done'   as const, label: 'Terminées' },
    { key: 'all'    as const, label: 'Toutes' },
  ]

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="page-title">Tâches</h1>
            <p className="page-sub">{filtered.length} tâches · {projects.filter(p => p.status === 'active').length} projets actifs</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13,
            fontWeight: filter === t.key ? 600 : 400, cursor: 'pointer',
            background: filter === t.key ? 'var(--accent-dim)' : 'transparent',
            color: filter === t.key ? 'var(--accent-light)' : 'var(--text-muted)',
            transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Standalone add */}
      {filter === 'active' && !loading && (
        <div style={{ marginBottom: 24 }}>
          <InlineAdd onAdded={t => setTasks(prev => [t, ...prev])} />
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 14 }}>Aucune tâche{filter === 'active' ? ' active' : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {Object.entries(byProject).map(([pid, ptasks]) => {
            const project = pid !== '__' ? projectMap[pid] : null
            return (
              <div key={pid}>
                {project && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13 }}>▤</span>
                    <span style={{ color: 'var(--accent-light)', fontSize: 14, fontWeight: 600 }}>{project.title}</span>
                    <span className="badge badge-accent" style={{ fontSize: 10 }}>{project.status}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginLeft: project ? 20 : 0 }}>
                  {ptasks.map(t => (
                    <TaskRow key={t.id} task={t} onStatusChange={handleStatusChange} />
                  ))}
                  {filter === 'active' && (
                    <InlineAdd projectId={project?.id} onAdded={task => setTasks(prev => [task, ...prev])} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
