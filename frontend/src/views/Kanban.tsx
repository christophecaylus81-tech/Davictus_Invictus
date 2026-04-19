import { useEffect, useState } from 'react'
import { api, type KanbanBoard, type KanbanCard } from '../api/fusionApi'

const COLUMN_META: Array<{ key: keyof KanbanBoard; title: string; color: string; cls: string }> = [
  { key: 'todo',       title: 'À faire',        color: 'var(--text-muted)',    cls: 'badge-neutral' },
  { key: 'inProgress', title: 'En cours',        color: 'var(--accent-light)',  cls: 'badge-accent'  },
  { key: 'review',     title: 'Review',          color: 'var(--info)',          cls: 'badge-info'    },
  { key: 'validated',  title: 'Validé',          color: 'var(--success)',       cls: 'badge-success' },
  { key: 'rejected',   title: 'Rejeté',          color: 'var(--danger)',        cls: 'badge-danger'  },
]

function Card({ card }: { card: KanbanCard }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      transition: 'border-color 0.15s, transform 0.15s',
      cursor: 'default'
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'
      ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
      ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
    }}
    >
      {card.id && (
        <p className="t-mono" style={{ color: 'var(--text-dim)', marginBottom: 6 }}>{card.id}</p>
      )}
      <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
        {card.title}
      </p>
      {(card.assignee || card.note) && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {card.assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
                {card.assignee[0]?.toUpperCase()}
              </span>
              <span className="t-small">{card.assignee}</span>
            </div>
          )}
          {card.note && <p className="t-small" style={{ fontStyle: 'italic' }}>{card.note}</p>}
        </div>
      )}
    </div>
  )
}

export default function Kanban() {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.kanban.get()
      .then(setBoard)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const total = board ? Object.values(board).flat().length : 0

  return (
    <div style={{ padding: '28px 24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 className="page-title">Kanban</h1>
        <p className="page-sub" style={{ marginTop: 3 }}>
          Orchestrateur · <span className="t-mono" style={{ color: 'var(--text-muted)' }}>workspace/KANBAN.md</span>
          {board && ` · ${total} cartes`}
        </p>
      </div>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, flex: 1, alignItems: 'start' }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 300, borderRadius: 16 }} />)}
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--danger-dim)', border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)', padding: '16px 20px', color: 'var(--danger)', fontSize: 14
        }}>
          Erreur : {error}
        </div>
      )}

      {board && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))',
          gap: 12, flex: 1, alignItems: 'start', overflowX: 'auto'
        }}>
          {COLUMN_META.map(col => {
            const cards = board[col.key]
            return (
              <div key={col.key} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex', flexDirection: 'column',
                minHeight: 200, maxHeight: 'calc(100vh - 180px)', overflow: 'hidden'
              }}>
                {/* Column header */}
                <div style={{
                  padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid var(--border)', flexShrink: 0
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: col.color }}>{col.title}</span>
                  <span className={`badge ${col.cls}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                  {cards.length === 0 ? (
                    <div style={{
                      border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
                      padding: '20px 0', textAlign: 'center'
                    }}>
                      <p className="t-small">Vide</p>
                    </div>
                  ) : (
                    cards.map((card, i) => <Card key={`${col.key}-${card.id ?? i}`} card={card} />)
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
