declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      VITE_API_URL?: string
    }
  }
}

const runtimeApiUrl = window.__RUNTIME_CONFIG__?.VITE_API_URL
const buildTimeApiUrl = import.meta.env.VITE_API_URL
const BASE = (runtimeApiUrl ?? buildTimeApiUrl ?? '').replace(/\/$/, '')

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface InboxItem {
  id: string
  source: string
  content: string
  status: 'captured' | 'processed' | 'archived' | 'deleted'
  gtdBucket?: string
  classificationReason?: string
  taskId?: string
  projectId?: string
  createdAt: string
  processedAt?: string
}

export interface Task {
  id: string
  title: string
  notes?: string
  status: 'todo' | 'next' | 'in_progress' | 'done' | 'cancelled'
  priority: number
  projectId?: string
  createdAt: string
}

export interface Project {
  id: string
  title: string
  description?: string
  status: 'active' | 'on_hold' | 'completed' | 'cancelled'
  createdAt: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  health: () => get<{ status: string }>('/health'),

  inbox: {
    list: (limit = 50) => get<InboxItem[]>(`/api/inbox?limit=${limit}`),
    process: (id: string) => post<InboxItem>(`/api/inbox/${id}/process`, {}),
    capture: (content: string) =>
      post<InboxItem>('/api/inbox', { source: 'web', content, processNow: true })
  },

  tasks: {
    list: () => get<Task[]>('/api/tasks')
  },

  projects: {
    list: () => get<Project[]>('/api/projects')
  }
}
