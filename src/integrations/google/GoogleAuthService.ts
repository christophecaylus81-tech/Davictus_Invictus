import { google } from 'googleapis'
import { env } from '../../config/env'
import type { PgCredentialRepository } from '../../infra/repositories/PgCredentialRepository'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',           // read + write
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
]

function getRedirectUri(): string {
  if (env.google.redirectUri) return env.google.redirectUri
  // Auto-detect: use VPS public IP if HOST is 0.0.0.0, otherwise localhost
  const port = env.port
  const host = env.host === '0.0.0.0' ? process.env['VIRTUAL_HOST'] ?? 'localhost' : env.host
  return `http://${host}:${port}/auth/google/callback`
}

export class GoogleAuthService {
  constructor(private readonly credentials: PgCredentialRepository) {}

  async createOAuth2Client() {
    const clientId     = await this.credentials.get('GOOGLE_CLIENT_ID')
    const clientSecret = await this.credentials.get('GOOGLE_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET non configurés dans Admin.')
    }

    return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri())
  }

  async getAuthUrl(): Promise<string> {
    const oauth2 = await this.createOAuth2Client()
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    })
  }

  async handleCallback(code: string): Promise<void> {
    const oauth2 = await this.createOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    if (tokens.refresh_token) {
      await this.credentials.set(
        'GOOGLE_REFRESH_TOKEN',
        tokens.refresh_token,
        'Google Refresh Token',
        'oauth',
        'Token OAuth2 Google — ne pas modifier manuellement'
      )
    }

    if (tokens.access_token) {
      await this.credentials.set(
        'GOOGLE_ACCESS_TOKEN',
        tokens.access_token,
        'Google Access Token',
        'oauth'
      )
    }
  }

  async getAuthenticatedClient() {
    const oauth2       = await this.createOAuth2Client()
    const refreshToken = await this.credentials.get('GOOGLE_REFRESH_TOKEN')

    if (!refreshToken) {
      throw new Error('Compte Google non connecté. Lance /auth/google pour autoriser.')
    }

    oauth2.setCredentials({ refresh_token: refreshToken })

    // Rafraîchit automatiquement l'access token si expiré
    oauth2.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await this.credentials.set('GOOGLE_ACCESS_TOKEN', tokens.access_token, 'Google Access Token', 'oauth')
      }
    })

    return oauth2
  }

  async isConnected(): Promise<boolean> {
    const token = await this.credentials.get('GOOGLE_REFRESH_TOKEN')
    return token !== null
  }
}
