import { useEffect, useState, useRef } from 'react'
import { api, type InboxItem } from '../api/fusionApi'

const BUCKET_META: Record<string, { cls: string; label: string }> = {
  task:      { cls: 'badge-info',     label: 'Tâche' },
  project:   { cls: 'badge-accent',   label: 'Projet' },
  incubator: { cls: 'badge-accent',   label: 'Incubateur' },
  archive:   { cls: 'badge-neutral',  label: 'Archive' },
  trash:     { cls: 'badge-danger',   label: 'Corbeille' },
}

function timeAgo(date: string) {
  const s = (Date.now() - new Date(date).getTime()) / 1000
  if (s < 60) return 'à l\'instant'
  if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}j`
}

export default function Inbox() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'processed' | 'all'>('pending')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try { setItems(await api.inbox.list(100)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCapture = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    try { await api.inbox.capture(input.trim()); setInput(''); await load() }
    finally { setSending(false); inputRef.current?.focus() }
  }

  const handleProcess = async (id: string) => {
    setProcessing(id)
    try { await api.inbox.process(id); await load() }
    finally { setProcessing(null) }
  }

  const pending   = items.filter(i => i.status === 'captured')
  const processed = items.filter(i => i.status !== 'captured')
  const displayed = filter === 'pending' ? pending : filter === 'processed' ? processed : items

  const tabs = [
    { key: 'pending'   as const, label: 'En attente', count: pending.length },
    { key: 'processed' as const, label: 'Traités',    count: processed.length },
    { key: 'all'       as const, label: 'Tous',       count: items.length },
  ]

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="page-title">Inbox GTD</h1>
            <p className="page-sub">{pending.length} en attente · {items.length} total</p>
          </div>
        </div>
      </div>

      {/* Capture */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>◈</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleCapture()}
          placeholder="Capture une idée, tâche ou information…"
          className="input"
          style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: 15 }}
        />
        <button
          onClick={handleCapture}
          disabled={!input.trim() || sending}
          className="btn btn-primary"
          style={{ flexShrink: 0 }}
        >
          {sending ? '…' : 'Capturer'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13,
              fontWeight: filter === t.key ? 600 : 400, cursor: 'pointer',
              background: filter === t.key ? 'var(--accent-dim)' : 'transparent',
              color: filter === t.key ? 'var(--accent-light)' : 'var(--text-muted)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: filter === t.key ? 'var(--accent-light)' : 'rgba(255,255,255,0.1)',
                color: filter === t.key ? 'var(--bg-base)' : 'var(--text-muted)',
                borderRadius: 100, fontSize: 10, fontWeight: 700,
                padding: '1px 5px', minWidth: 18, textAlign: 'center'
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[80, 80, 80, 60, 60].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h, borderRadius: 12 }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          {filter === 'pending' ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 14, color: 'var(--success)' }}>✓</div>
              <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--success)' }}>Inbox vide</p>
              <p className="t-small" style={{ marginTop: 6 }}>Toutes les entrées ont été traitées.</p>
            </>
          ) : (
            <p className="t-body">Aucun élément</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {displayed.map(item => {
            const isPending = item.status === 'captured'
            const bucket = BUCKET_META[item.gtdBucket ?? '']
            return (
              <div
                key={item.id}
                className="inbox-item"
                style={isPending ? { borderLeftColor: 'var(--warning)', borderLeftWidth: 2 } : {}}
              >
                {/* Source */}
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0, marginTop: 1,
                  background: isPending ? 'var(--warning-dim)' : 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: isPending ? 'var(--warning)' : 'var(--text-muted)'
                }}>
                  {item.source === 'telegram' ? '✈' : item.source === 'web' ? '⊕' : '○'}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 14,
                    color: isPending ? 'var(--text-primary)' : 'var(--text-secondary)',
                    lineHeight: 1.4, marginBottom: 5
                  }}>
                    {item.content}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="t-small">{timeAgo(item.createdAt)}</span>
                    {bucket && (
                      <span className={`badge ${bucket.cls}`}>{bucket.label}</span>
                    )}
                    {item.classificationReason && (
                      <span className="t-small" style={{ fontStyle: 'italic' }}>{item.classificationReason}</span>
                    )}
                  </div>
                </div>

                {/* Action */}
                {isPending && (
                  <button
                    onClick={() => void handleProcess(item.id)}
                    disabled={processing === item.id}
                    className="btn btn-secondary"
                    style={{ flexShrink: 0, fontSize: 12 }}
                  >
                    {processing === item.id ? '…' : 'Traiter →'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
