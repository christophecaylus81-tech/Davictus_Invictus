import { useEffect, useState, useRef } from 'react'
import { api, type InboxItem } from '../api/fusionApi'

const BUCKET_COLORS: Record<string, { bg: string; color: string }> = {
  task:      { bg: '#1e3a5f', color: '#60a5fa' },
  project:   { bg: '#1e1b4b', color: '#a78bfa' },
  incubator: { bg: '#2d1b69', color: '#c4b5fd' },
  archive:   { bg: '#1e2130', color: '#94a3b8' },
  trash:     { bg: '#2d0f0f', color: '#f87171' },
}

const STATUS_COLORS: Record<string, string> = {
  captured:  '#f59e0b',
  processed: '#22c55e',
  archived:  '#94a3b8',
  deleted:   '#ef4444',
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60) return 'à l\'instant'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

export default function Inbox() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const data = await api.inbox.list(100)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCapture = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await api.inbox.capture(input.trim())
      setInput('')
      await load()
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleProcess = async (id: string) => {
    setProcessing(id)
    try {
      await api.inbox.process(id)
      await load()
    } finally {
      setProcessing(null)
    }
  }

  const pending = items.filter(i => i.status === 'captured')
  const done = items.filter(i => i.status !== 'captured')

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Inbox</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
        {pending.length} en attente · {items.length} total
      </p>

      {/* Capture */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 32,
        background: '#13162a', border: '1px solid #1e2130',
        borderRadius: 12, padding: '12px 16px'
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCapture()}
          placeholder="Capture une idée, tâche ou information…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e2e8f0', fontSize: 15
          }}
        />
        <button
          onClick={handleCapture}
          disabled={!input.trim() || sending}
          style={{
            background: '#6c63ff', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 20px', fontSize: 14,
            fontWeight: 600, cursor: sending ? 'wait' : 'pointer',
            opacity: !input.trim() ? 0.4 : 1
          }}>
          {sending ? '…' : 'Capturer'}
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#475569' }}>Chargement…</p>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.1em', marginBottom: 12 }}>
                EN ATTENTE
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(item => (
                  <div key={item.id} style={{
                    background: '#13162a', border: '1px solid #1e2130',
                    borderRadius: 10, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#e2e8f0', fontSize: 14, marginBottom: 4 }}>{item.content}</p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: '#475569', fontSize: 12 }}>{item.source}</span>
                        <span style={{ color: '#334155', fontSize: 12 }}>·</span>
                        <span style={{ color: '#475569', fontSize: 12 }}>{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleProcess(item.id)}
                      disabled={processing === item.id}
                      style={{
                        background: '#1e1b4b', color: '#a78bfa', border: '1px solid #3730a3',
                        borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer'
                      }}>
                      {processing === item.id ? '…' : 'Traiter'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Processed */}
          {done.length > 0 && (
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.1em', marginBottom: 12 }}>
                TRAITÉS
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {done.slice(0, 20).map(item => {
                  const bucket = BUCKET_COLORS[item.gtdBucket ?? ''] ?? { bg: '#1e2130', color: '#94a3b8' }
                  return (
                    <div key={item.id} style={{
                      background: '#0f1220', border: '1px solid #1a1d2e',
                      borderRadius: 10, padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 12
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#94a3b8', fontSize: 13 }}>{item.content}</p>
                        {item.classificationReason && (
                          <p style={{ color: '#475569', fontSize: 11, marginTop: 3 }}>{item.classificationReason}</p>
                        )}
                      </div>
                      {item.gtdBucket && (
                        <span style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 6,
                          background: bucket.bg, color: bucket.color
                        }}>{item.gtdBucket}</span>
                      )}
                      <span style={{ fontSize: 11, color: STATUS_COLORS[item.status] }}>
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
