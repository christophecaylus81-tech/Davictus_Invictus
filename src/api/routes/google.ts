import { Router } from 'express'
import type { GoogleAuthService } from '../../integrations/google/GoogleAuthService'
import type { GmailService } from '../../integrations/google/GmailService'
import type { GoogleCalendarService } from '../../integrations/google/GoogleCalendarService'
import type { GoogleTasksService } from '../../integrations/google/GoogleTasksService'

export function googleRouter(
  auth: GoogleAuthService,
  gmail: GmailService,
  calendar: GoogleCalendarService,
  tasks: GoogleTasksService
): Router {
  const r = Router()

  // ── OAuth2 flow ──────────────────────────────────────────────────────────────
  r.get('/auth/google', async (_req, res) => {
    try {
      const url = await auth.getAuthUrl()
      res.redirect(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      res.status(500).send(`<pre>${msg}</pre>`)
    }
  })

  r.get('/auth/google/callback', async (req, res) => {
    const code = req.query['code'] as string | undefined
    if (!code) {
      res.status(400).send('Code OAuth manquant.')
      return
    }
    try {
      await auth.handleCallback(code)
      res.send(`
        <html><body style="font-family:sans-serif;background:#02040d;color:#c8d0e8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#10b981">✓ Google connecté</h2>
            <p>Fusion a accès à Gmail, Calendar, Tasks et Drive.</p>
            <p style="color:#4a5570;font-size:12px">Tu peux fermer cette fenêtre.</p>
          </div>
        </body></html>
      `)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      res.status(500).send(`<pre>Erreur: ${msg}</pre>`)
    }
  })

  // ── Status ───────────────────────────────────────────────────────────────────
  r.get('/api/google/status', async (_req, res) => {
    const connected = await auth.isConnected()
    res.json({ connected })
  })

  // ── Gmail ────────────────────────────────────────────────────────────────────
  r.get('/api/google/gmail/unread', async (_req, res) => {
    try {
      const messages = await gmail.getUnreadMessages(20)
      res.json(messages)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      res.status(500).json({ error: msg })
    }
  })

  // ── Calendar ─────────────────────────────────────────────────────────────────
  r.get('/api/google/calendar/today', async (_req, res) => {
    try {
      const events = await calendar.getTodayEvents()
      res.json(events)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      res.status(500).json({ error: msg })
    }
  })

  r.get('/api/google/calendar/upcoming', async (req, res) => {
    const days = Number(req.query['days'] ?? 7)
    try {
      const events = await calendar.getUpcomingEvents(days)
      res.json(events)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      res.status(500).json({ error: msg })
    }
  })

  // ── Tasks ────────────────────────────────────────────────────────────────────
  r.get('/api/google/tasks', async (_req, res) => {
    try {
      const taskList = await tasks.getAllTasks()
      res.json(taskList)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      res.status(500).json({ error: msg })
    }
  })

  r.post('/api/google/tasks/:listId/:taskId/complete', async (req, res) => {
    try {
      await tasks.completeTask(req.params.taskId, req.params.listId)
      res.json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      res.status(500).json({ error: msg })
    }
  })

  return r
}
