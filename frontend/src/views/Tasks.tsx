import { useEffect, useState } from 'react'
import { api, type Task, type Project } from '../api/fusionApi'

const STATUS_LABEL: Record<string, string> = {
  todo: 'À faire', next: 'Suivant', in_progress: 'En cours', done: 'Terminé', cancelled: 'Annulé'
}
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  todo:        { bg: '#1e2130', color: '#94a3b8' },
  next:        { bg: '#1e3a5f', color: '#60a5fa' },
  in_progress: { bg: '#1e1b4b', color: '#a78bfa' },
  done:        { bg: '#052e16', color: '#22c55e' },
  cancelled:   { bg: '#2d0f0f', color: '#f87171' },
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('active')

  useEffect(() => {
    Promise.all([api.tasks.list(), api.projects.list()])
      .then(([t, p]) => { setTasks(t); setProjects(p) })
      .finally(() => setLoading(false))
  }, [])

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

  const filtered = tasks.filter(t => {
    if (filter === 'active') return ['todo', 'next', 'in_progress'].includes(t.status)
    if (filter === 'done') return t.status === 'done'
    return true
  })

  const byProject = filtered.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.projectId ?? '__standalone__'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const tabs = [
    { key: 'active', label: 'Actives' },
    { key: 'done',   label: 'Terminées' },
    { key: 'all',    label: 'Toutes' },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>Tâches & Projets</h1>
        <span style={{ color: '#64748b', fontSize: 14 }}>{filtered.length} tâches · {projects.filter(p => p.status === 'active').length} projets</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#0a0c14', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13,
            fontWeight: filter === t.key ? 600 : 400, cursor: 'pointer',
            background: filter === t.key ? '#1e1b4b' : 'transparent',
            color: filter === t.key ? '#a78bfa' : '#64748b'
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#475569' }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#475569' }}>Aucune tâche</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(byProject).map(([projectId, ptasks]) => {
            const project = projectId !== '__standalone__' ? projectMap[projectId] : null
            return (
              <div key={projectId}>
                {project && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 14 }}>📁</span>
                    <span style={{ color: '#c4b5fd', fontSize: 14, fontWeight: 600 }}>{project.title}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 6,
                      background: '#1e1b4b', color: '#a78bfa'
                    }}>{project.status}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ptasks.map(task => {
                    const sc = STATUS_COLOR[task.status] ?? STATUS_COLOR.todo
                    return (
                      <div key={task.id} style={{
                        background: '#13162a', border: '1px solid #1e2130',
                        borderRadius: 10, padding: '12px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        marginLeft: project ? 24 : 0
                      }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: '#e2e8f0', fontSize: 14 }}>{task.title}</p>
                          {task.notes && (
                            <p style={{ color: '#475569', fontSize: 12, marginTop: 3 }}>{task.notes}</p>
                          )}
                        </div>
                        <span style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 6,
                          background: sc.bg, color: sc.color, whiteSpace: 'nowrap'
                        }}>{STATUS_LABEL[task.status]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
