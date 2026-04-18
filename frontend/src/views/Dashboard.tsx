import { useEffect, useState } from 'react'
import { api, type InboxItem, type Task, type Project } from '../api/fusionApi'

interface KPI { label: string; value: number | string; color: string; icon: string }

function KpiCard({ label, value, color, icon }: KPI) {
  return (
    <div style={{
      background: '#13162a', border: `1px solid #1e2130`, borderRadius: 12,
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <span style={{ fontSize: 32, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#22c55e' : '#ef4444',
      boxShadow: ok ? '0 0 6px #22c55e88' : '0 0 6px #ef444488'
    }} />
  )
}

export default function Dashboard() {
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [online, setOnline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        await api.health()
        setOnline(true)
        const [i, t, p] = await Promise.all([api.inbox.list(), api.tasks.list(), api.projects.list()])
        setInbox(i); setTasks(t); setProjects(p)
      } catch {
        setOnline(false)
      } finally {
        setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [])

  const pending = inbox.filter(i => i.status === 'captured').length
  const activeTasks = tasks.filter(t => ['todo', 'next', 'in_progress'].includes(t.status))
  const activeProjects = projects.filter(p => p.status === 'active')
  const doneLast7 = tasks.filter(t => {
    if (t.status !== 'done') return false
    return Date.now() - new Date(t.createdAt).getTime() < 7 * 86400_000
  }).length

  const kpis: KPI[] = [
    { label: 'Inbox en attente', value: pending, color: pending > 0 ? '#f59e0b' : '#22c55e', icon: '📥' },
    { label: 'Tâches actives', value: activeTasks.length, color: '#6c63ff', icon: '✅' },
    { label: 'Projets ouverts', value: activeProjects.length, color: '#38bdf8', icon: '📁' },
    { label: 'Validées 7 jours', value: doneLast7, color: '#22c55e', icon: '🏁' },
  ]

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4, textTransform: 'capitalize' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
          <StatusDot ok={online === true} />
          {online === null ? 'Connexion…' : online ? 'API connectée' : 'API hors ligne'}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#475569' }}>Chargement…</p>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {kpis.map(k => <KpiCard key={k.label} {...k} />)}
          </div>

          {/* Bottom split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Inbox récent */}
            <div style={{ background: '#13162a', border: '1px solid #1e2130', borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>INBOX RÉCENT</h2>
              {inbox.slice(0, 5).map(item => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1e2130'
                }}>
                  <span style={{ color: '#e2e8f0', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.content}
                  </span>
                  <span style={{
                    marginLeft: 12, fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: item.status === 'captured' ? '#451a03' : '#052e16',
                    color: item.status === 'captured' ? '#f59e0b' : '#22c55e'
                  }}>{item.status}</span>
                </div>
              ))}
              {inbox.length === 0 && <p style={{ color: '#475569', fontSize: 13 }}>Inbox vide</p>}
            </div>

            {/* Tâches actives */}
            <div style={{ background: '#13162a', border: '1px solid #1e2130', borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>TÂCHES ACTIVES</h2>
              {activeTasks.slice(0, 5).map(task => (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid #1e2130'
                }}>
                  <span style={{ fontSize: 13 }}>{task.status === 'in_progress' ? '🔄' : '▫️'}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </span>
                </div>
              ))}
              {activeTasks.length === 0 && <p style={{ color: '#475569', fontSize: 13 }}>Aucune tâche active</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
