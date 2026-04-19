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

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
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

export type TaskStatus = 'todo' | 'next' | 'in_progress' | 'done' | 'cancelled'

export interface Task {
  id: string
  title: string
  notes?: string
  status: TaskStatus
  priority: number
  projectId?: string
  dueDate?: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  title: string
  description?: string
  status: 'active' | 'on_hold' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface KanbanCard {
  id?: string
  title: string
  assignee?: string
  status?: string
  note?: string
}

export interface KanbanBoard {
  todo: KanbanCard[]
  inProgress: KanbanCard[]
  review: KanbanCard[]
  validated: KanbanCard[]
  rejected: KanbanCard[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  health: () => get<{ status: string }>('/health'),

  inbox: {
    list: async (limit = 50) => {
      const data = await get<{ items: InboxItem[] }>(`/api/inbox?limit=${limit}`)
      return data.items
    },
    process: (id: string) => post<InboxItem>(`/api/inbox/${id}/process`, {}),
    capture: (content: string) =>
      post<InboxItem>('/api/inbox', { source: 'web', content, processNow: true })
  },

  tasks: {
    list: async (params?: { limit?: number; projectId?: string }) => {
      const qs = new URLSearchParams()
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.projectId) qs.set('projectId', params.projectId)
      const data = await get<{ tasks: Task[] }>(`/api/tasks?${qs.toString()}`)
      return data.tasks
    },
    create: async (data: { title: string; projectId?: string; notes?: string; status?: TaskStatus; priority?: number }) => {
      const result = await post<{ task: Task }>('/api/tasks', data)
      return result.task
    },
    updateStatus: async (id: string, status: TaskStatus) => {
      const result = await patch<{ task: Task }>(`/api/tasks/${id}/status`, { status })
      return result.task
    }
  },

  projects: {
    list: async (limit = 50) => {
      const data = await get<{ projects: Project[] }>(`/api/projects?limit=${limit}`)
      return data.projects
    }
  },

  kanban: {
    get: async () => {
      const data = await get<{ board: KanbanBoard }>('/api/kanban')
      return data.board
    }
  }
}
