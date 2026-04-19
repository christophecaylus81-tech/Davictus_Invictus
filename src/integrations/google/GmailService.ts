import { google } from 'googleapis'
import type { GoogleAuthService } from './GoogleAuthService'

export interface GmailMessage {
  id: string
  subject: string
  from: string
  snippet: string
  date: Date
  isUnread: boolean
}

export class GmailService {
  constructor(private readonly auth: GoogleAuthService) {}

  async getUnreadMessages(maxResults = 20): Promise<GmailMessage[]> {
    const client = await this.auth.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth: client })

    const list = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults,
    })

    const messages = list.data.messages ?? []
    const results: GmailMessage[] = []

    for (const msg of messages.slice(0, 10)) {
      if (!msg.id) continue
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })

      const headers = detail.data.payload?.headers ?? []
      const get = (name: string) => headers.find(h => h.name === name)?.value ?? ''

      results.push({
        id: msg.id,
        subject: get('Subject') || '(sans sujet)',
        from: get('From'),
        snippet: detail.data.snippet ?? '',
        date: new Date(Number(detail.data.internalDate ?? Date.now())),
        isUnread: (detail.data.labelIds ?? []).includes('UNREAD'),
      })
    }

    return results
  }
}
