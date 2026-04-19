import { useEffect, useState } from 'react'

interface Credential {
  key: string
  label: string
  category: 'api' | 'oauth' | 'webhook' | 'other'
  description?: string
  updatedAt: string
}

interface CredentialForm {
  key: string
  label: string
  category: Credential['category']
  description: string
  value: string
}

const CATEGORY_LABELS: Record<string, string> = {
  api:     'Clé API',
  oauth:   'OAuth',
  webhook: 'Webhook',
  other:   'Autre',
}

const CATEGORY_COLORS: Record<string, string> = {
  api:     '#38bdf8',
  oauth:   '#a78bfa',
  webhook: '#10b981',
  other:   '#f59e0b',
}

const VPS_PRESETS = [
  { key: 'VPS_HOST', label: 'VPS Host / IP',   category: 'other' as const, description: 'ex: 51.254.200.78 ou monserveur.com' },
  { key: 'VPS_USER', label: 'VPS Utilisateur', category: 'other' as const, description: 'ex: ubuntu, root' },
  { key: 'VPS_SSH_KEY', label: 'Clé SSH privée (PEM)', category: 'other' as const, description: 'Contenu de ~/.ssh/id_ed25519 ou id_rsa — utilisé pour le déploiement automatique' },
]

const PRESETS = [
  { key: 'GOOGLE_CLIENT_ID',     label: 'Google Client ID',     category: 'oauth' as const, description: 'OAuth2 Google Cloud Console' },
  { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', category: 'oauth' as const, description: 'OAuth2 Google Cloud Console' },
  { key: 'DEEPSEEK_API_KEY',     label: 'DeepSeek API Key',     category: 'api'   as const, description: 'api.deepseek.com' },
  { key: 'QWEN_API_KEY',         label: 'Qwen API Key',         category: 'api'   as const, description: 'dashscope.aliyuncs.com' },
  { key: 'ANTHROPIC_API_KEY',    label: 'Anthropic API Key',    category: 'api'   as const, description: 'claude.ai / api.anthropic.com' },
  { key: 'OPENAI_API_KEY',       label: 'OpenAI API Key',       category: 'api'   as const, description: 'api.openai.com — transcription vocale' },
  { key: 'TELEGRAM_BOT_TOKEN',   label: 'Telegram Bot Token',   category: 'api'   as const, description: 'BotFather token' },
  { key: 'GEMINI_API_KEY',        label: 'Gemini API Key',        category: 'api'   as const, description: 'aistudio.google.com — Gemini Flash (veille) + Pro (rapports)' },
  { key: 'GEMINI_FLASH_MODEL',   label: 'Gemini Flash Model',    category: 'api'   as const, description: 'Veille & synthèse rapide — ex: gemini-2.0-flash' },
  { key: 'GEMINI_PRO_MODEL',     label: 'Gemini Pro Model',      category: 'api'   as const, description: 'Rapports longs & recherche — ex: gemini-2.5-pro' },
  { key: 'QWEN_CODER_MODEL',     label: 'Qwen Coder Model',      category: 'api'   as const, description: 'Génération de code — ex: qwen-coder-plus' },
  { key: 'OPENAI_MANAGER_MODEL', label: 'GPT Manager Model',     category: 'api'   as const, description: 'Orchestrateur — ex: gpt-4o-mini, gpt-4.1-mini' },
  { key: 'N8N_API_KEY',          label: 'N8N API Key',          category: 'api'     as const, description: 'Settings → n8n API → Create API key' },
  { key: 'N8N_WEBHOOK_URL',      label: 'N8N Webhook URL',      category: 'webhook' as const, description: 'URL webhook d\'un workflow N8N' },
]

export default function Admin() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [editKey, setEditKey] = useState<string | null>(null)
  const [form, setForm] = useState<CredentialForm>({ key: '', label: '', category: 'api', description: '', value: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/credentials')
    if (res.ok) setCredentials(await res.json() as Credential[])
  }

  const checkGoogle = async () => {
    try {
      const res = await fetch('/api/google/status')
      if (res.ok) {
        const data = await res.json() as { connected: boolean }
        setGoogleConnected(data.connected)
      }
    } catch {
      setGoogleConnected(false)
    }
  }

  useEffect(() => {
    void load()
    void checkGoogle()
  }, [])

  const startEdit = (preset: typeof PRESETS[0]) => {
    setEditKey(preset.key)
    setForm({ key: preset.key, label: preset.label, category: preset.category, description: preset.description ?? '', value: '' })
    setMsg(null)
  }

  const startCustom = () => {
    setEditKey('__new__')
    setForm({ key: '', label: '', category: 'api', description: '', value: '' })
    setMsg(null)
  }

  const save = async () => {
    if (!form.key || !form.label || !form.value) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/credentials/${encodeURIComponent(form.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: form.value, label: form.label, category: form.category, description: form.description }),
      })
      if (res.ok) {
        setMsg({ text: 'Clé sauvegardée et chiffrée.', ok: true })
        setEditKey(null)
        await load()
      } else {
        setMsg({ text: 'Erreur lors de la sauvegarde.', ok: false })
      }
    } finally {
      setSaving(false)
    }
  }

  const remove = async (key: string) => {
    if (!confirm(`Supprimer "${key}" ?`)) return
    await fetch(`/api/admin/credentials/${encodeURIComponent(key)}`, { method: 'DELETE' })
    await load()
  }

  const configuredKeys = new Set(credentials.map(c => c.key))

  return (
    <div style={{ padding: '32px 40px', maxWidth: 860, margin: '0 auto', color: '#c8d0e8' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8f0ff', marginBottom: 4 }}>
        Gestionnaire de credentials
      </h1>
      <p style={{ fontSize: 13, color: '#4a5570', marginBottom: 32 }}>
        Toutes les valeurs sont chiffrées AES-256-GCM avant stockage. Elles ne sont jamais affichées en clair.
      </p>

      {/* Connexions OAuth */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#7c6fff', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Connexions
      </h2>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${googleConnected ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: 10, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 28 }}>G</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: googleConnected ? '#10b981' : '#c8d0e8' }}>
              Google Workspace
            </p>
            <p style={{ fontSize: 11, color: '#4a5570', marginTop: 2 }}>
              Gmail · Calendar · Tasks · Drive
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {googleConnected === true && (
              <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '3px 10px' }}>
                ✓ Connecté
              </span>
            )}
            {googleConnected === false && (
              <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '3px 10px' }}>
                Non connecté
              </span>
            )}
            <a
              href="/auth/google"
              style={{
                background: googleConnected ? 'rgba(255,255,255,0.04)' : 'rgba(124,111,255,0.15)',
                border: `1px solid ${googleConnected ? 'rgba(255,255,255,0.1)' : 'rgba(124,111,255,0.4)'}`,
                borderRadius: 6, color: googleConnected ? '#4a5570' : '#a78bfa',
                fontSize: 12, fontWeight: 600, padding: '6px 14px',
                textDecoration: 'none', display: 'inline-block',
              }}
            >
              {googleConnected ? 'Reconnecter' : 'Connecter'}
            </a>
          </div>
        </div>
      </div>

      {/* VPS / Infrastructure */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Infrastructure VPS
      </h2>
      <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8 }}>
        <p style={{ fontSize: 12, color: '#92400e', marginBottom: 6 }}>
          Pour activer le déploiement en 1 clic depuis l'UI, configure l'hôte et la clé SSH.
        </p>
        <p style={{ fontSize: 11, color: '#4a5570' }}>
          La clé privée est chiffrée AES-256 avant stockage. Commande pour générer une clé : <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>ssh-keygen -t ed25519 -f ~/.ssh/davitus</code>
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 32 }}>
        {VPS_PRESETS.map(preset => {
          const configured = configuredKeys.has(preset.key)
          return (
            <div key={preset.key} style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${configured ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 10, padding: '14px 16px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: configured ? '#f59e0b' : '#c8d0e8' }}>{preset.label}</p>
                <p style={{ fontSize: 11, color: '#4a5570', marginTop: 2 }}>{preset.description}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {configured && (
                  <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 8px' }}>
                    ✓ Configuré
                  </span>
                )}
                <button
                  onClick={() => startEdit(preset)}
                  style={{
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 6, color: '#f59e0b', fontSize: 11, fontWeight: 600,
                    padding: '4px 10px', cursor: 'pointer',
                  }}
                >
                  {configured ? 'Modifier' : 'Configurer'}
                </button>
                {configured && (
                  <button
                    onClick={() => remove(preset.key)}
                    style={{ background: 'none', border: 'none', color: '#4a5570', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Presets */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#7c6fff', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Intégrations
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
        {PRESETS.map(preset => {
          const configured = configuredKeys.has(preset.key)
          const c = CATEGORY_COLORS[preset.category]
          return (
            <div key={preset.key} style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${configured ? c + '40' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 10, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: configured ? c : '#c8d0e8' }}>{preset.label}</p>
                <p style={{ fontSize: 11, color: '#4a5570', marginTop: 2 }}>{preset.description}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {configured && (
                  <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 8px' }}>
                    ✓ Configuré
                  </span>
                )}
                <button
                  onClick={() => startEdit(preset)}
                  style={{
                    background: 'rgba(124,111,255,0.12)', border: '1px solid rgba(124,111,255,0.3)',
                    borderRadius: 6, color: '#7c6fff', fontSize: 11, fontWeight: 600,
                    padding: '4px 10px', cursor: 'pointer',
                  }}
                >
                  {configured ? 'Modifier' : 'Configurer'}
                </button>
                {configured && (
                  <button
                    onClick={() => remove(preset.key)}
                    style={{ background: 'none', border: 'none', color: '#4a5570', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Credentials configurées non-preset */}
      {credentials.filter(c => !PRESETS.find(p => p.key === c.key)).length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#7c6fff', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Autres credentials
          </h2>
          {credentials.filter(c => !PRESETS.find(p => p.key === c.key)).map(cred => (
            <div key={cred.key} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{cred.label}</p>
                <p style={{ fontSize: 11, color: '#4a5570' }}>{cred.key} · {CATEGORY_LABELS[cred.category]}</p>
              </div>
              <button onClick={() => remove(cred.key)} style={{ background: 'none', border: 'none', color: '#4a5570', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </>
      )}

      <button
        onClick={startCustom}
        style={{
          marginTop: 8, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 10, color: '#4a5570', fontSize: 13, padding: '10px 20px',
          cursor: 'pointer', width: '100%', transition: 'all 0.15s',
        }}
      >
        + Ajouter une credential personnalisée
      </button>

      {/* Modal */}
      {editKey && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: '#0d1220', border: '1px solid rgba(124,111,255,0.3)',
            borderRadius: 16, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#e8f0ff' }}>
              {editKey === '__new__' ? 'Nouvelle credential' : form.label}
            </h3>

            {editKey === '__new__' && (
              <>
                <label style={{ fontSize: 12, color: '#4a5570', display: 'block', marginBottom: 4 }}>Clé (identifiant unique)</label>
                <input
                  value={form.key}
                  onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/\s/g, '_') }))}
                  placeholder="ex: MY_SERVICE_KEY"
                  style={inputStyle}
                />
                <label style={{ fontSize: 12, color: '#4a5570', display: 'block', marginBottom: 4, marginTop: 12 }}>Label</label>
                <input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Nom affiché"
                  style={inputStyle}
                />
              </>
            )}

            <label style={{ fontSize: 12, color: '#4a5570', display: 'block', marginBottom: 4, marginTop: editKey === '__new__' ? 12 : 0 }}>
              Valeur (sera chiffrée)
            </label>
            {form.key === 'VPS_SSH_KEY' ? (
              <textarea
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
                rows={8}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                autoComplete="off"
              />
            ) : (
              <input
                type="password"
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder="••••••••••••••••"
                style={inputStyle}
                autoComplete="off"
              />
            )}

            {msg && (
              <p style={{ fontSize: 12, color: msg.ok ? '#10b981' : '#ef4444', marginTop: 10 }}>{msg.text}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditKey(null)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#4a5570', padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving || !form.value}
                style={{
                  background: 'rgba(124,111,255,0.2)', border: '1px solid rgba(124,111,255,0.5)',
                  borderRadius: 8, color: '#a78bfa', padding: '8px 20px',
                  cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600,
                  opacity: (!form.value) ? 0.5 : 1,
                }}
              >
                {saving ? 'Chiffrement...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#c8d0e8', fontSize: 13, padding: '10px 12px',
  outline: 'none', boxSizing: 'border-box', marginBottom: 4,
  fontFamily: 'monospace',
}
