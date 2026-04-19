import { google } from 'googleapis'
import type { GoogleAuthService } from './GoogleAuthService'

export interface GoogleTask {
  id: string
  title: string
  notes?: string | undefined
  due?: Date | undefined
  completed: boolean
  listId: string
  listTitle: string
}

export class GoogleTasksService {
  constructor(private readonly auth: GoogleAuthService) {}

  async getAllTasks(): Promise<GoogleTask[]> {
    const client = await this.auth.getAuthenticatedClient()
    const tasks = google.tasks({ version: 'v1', auth: client })

    const listsRes = await tasks.tasklists.list({ maxResults: 10 })
    const lists = listsRes.data.items ?? []

    const allTasks: GoogleTask[] = []

    for (const list of lists) {
      if (!list.id) continue
      const taskRes = await tasks.tasks.list({
        tasklist: list.id,
        showCompleted: false,
        maxResults: 50,
      })

      for (const task of taskRes.data.items ?? []) {
        if (!task.id || !task.title) continue
        allTasks.push({
          id: task.id,
          title: task.title,
          notes: task.notes ?? undefined,
          due: task.due ? new Date(task.due) : undefined,
          completed: task.status === 'completed',
          listId: list.id,
          listTitle: list.title ?? 'Ma liste',
        })
      }
    }

    return allTasks
  }

  async completeTask(taskId: string, listId: string): Promise<void> {
    const client = await this.auth.getAuthenticatedClient()
    const tasks = google.tasks({ version: 'v1', auth: client })
    await tasks.tasks.patch({
      tasklist: listId,
      task: taskId,
      requestBody: { status: 'completed' },
    })
  }
}
