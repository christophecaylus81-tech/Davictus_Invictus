import { google } from 'googleapis'
import type { GoogleAuthService } from './GoogleAuthService'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  location?: string | undefined
  description?: string | undefined
  isAllDay: boolean
}

export interface CreateEventInput {
  title: string
  start: Date
  end: Date
  location?: string
  description?: string
}

export class GoogleCalendarService {
  constructor(private readonly auth: GoogleAuthService) {}

  async getTodayEvents(): Promise<CalendarEvent[]> {
    const client = await this.auth.getAuthenticatedClient()
    const calendar = google.calendar({ version: 'v3', auth: client })

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    })

    return (res.data.items ?? []).map(event => {
      const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)
      return {
        id: event.id ?? '',
        title: event.summary ?? '(sans titre)',
        start: new Date(event.start?.dateTime ?? event.start?.date ?? Date.now()),
        end: new Date(event.end?.dateTime ?? event.end?.date ?? Date.now()),
        location: event.location ?? undefined,
        description: event.description ?? undefined,
        isAllDay,
      }
    })
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const client = await this.auth.getAuthenticatedClient()
    const calendar = google.calendar({ version: 'v3', auth: client })

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.title,
        start: { dateTime: input.start.toISOString(), timeZone: 'Europe/Paris' },
        end:   { dateTime: input.end.toISOString(),   timeZone: 'Europe/Paris' },
        ...(input.location    ? { location: input.location }       : {}),
        ...(input.description ? { description: input.description } : {}),
      },
    })

    const event = res.data
    return {
      id:    event.id ?? '',
      title: event.summary ?? input.title,
      start: new Date(event.start?.dateTime ?? input.start.toISOString()),
      end:   new Date(event.end?.dateTime   ?? input.end.toISOString()),
      location:    event.location    ?? undefined,
      description: event.description ?? undefined,
      isAllDay: false,
    }
  }

  async getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
    const client = await this.auth.getAuthenticatedClient()
    const calendar = google.calendar({ version: 'v3', auth: client })

    const now = new Date()
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 30,
    })

    return (res.data.items ?? []).map(event => ({
      id: event.id ?? '',
      title: event.summary ?? '(sans titre)',
      start: new Date(event.start?.dateTime ?? event.start?.date ?? Date.now()),
      end: new Date(event.end?.dateTime ?? event.end?.date ?? Date.now()),
      location: event.location ?? undefined,
      description: event.description ?? undefined,
      isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
    }))
  }
}
