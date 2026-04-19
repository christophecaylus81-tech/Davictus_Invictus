import { useEffect, useRef, useState } from 'react'
import { api } from '../api/fusionApi'

interface Props {
  onClose: () => void
  onCaptured: () => void
}

export default function QuickCaptureModal({ onClose, onCaptured }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const capture = async () => {
    if (!value.trim() || sending) return
    setSending(true)
    try {
      await api.inbox.capture(value.trim())
      setDone(true)
      setTimeout(() => onCaptured(), 500)
    } finally { setSending(false) }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5,7,15,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh', zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="slide-down"
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px var(--accent-dim)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '13px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ color: 'var(--accent)', fontSize: 15 }}>◈</span>
          <span className="t-label" style={{ letterSpacing: '0.05em' }}>Capturer dans l'Inbox</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <kbd style={{
              fontSize: 10, color: 'var(--text-dim)',
              background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '2px 6px'
            }}>Entrée</kbd>
            <kbd style={{
              fontSize: 10, color: 'var(--text-dim)',
              background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '2px 6px'
            }}>Esc</kbd>
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: '16px 18px' }}>
          <textarea
            ref={ref}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void capture() }
            }}
            placeholder="Idée, tâche, information… (Entrée pour capturer, Shift+Entrée pour nouvelle ligne)"
            rows={3}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              outline: 'none', color: 'var(--text-primary)', fontSize: 15,
              resize: 'none', lineHeight: 1.6, fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span className="t-small">Classifié automatiquement par Davitus</span>
          <button
            onClick={capture}
            disabled={!value.trim() || sending || done}
            className="btn btn-primary"
            style={{
              background: done ? 'var(--success-dim)' : undefined,
              color: done ? 'var(--success)' : undefined,
              minWidth: 100
            }}
          >
            {done ? '✓ Capturé' : sending ? '…' : 'Capturer'}
          </button>
        </div>
      </div>
    </div>
  )
}
