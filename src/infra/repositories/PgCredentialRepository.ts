import type { Pool } from 'pg'
import { encrypt, decrypt } from '../crypto/CredentialCrypto'

export interface Credential {
  key: string
  label: string
  category: 'api' | 'oauth' | 'webhook' | 'other'
  description?: string | undefined
  createdAt: Date
  updatedAt: Date
}

interface CredentialRow {
  key: string
  label: string
  category: 'api' | 'oauth' | 'webhook' | 'other'
  encrypted_value: string
  iv: string
  auth_tag: string
  description: string | null
  created_at: Date
  updated_at: Date
}

export class PgCredentialRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Credential[]> {
    const res = await this.pool.query<CredentialRow>(
      'SELECT * FROM credentials ORDER BY category, key'
    )
    return res.rows.map(this.toCredential)
  }

  async get(key: string): Promise<string | null> {
    const res = await this.pool.query<CredentialRow>(
      'SELECT * FROM credentials WHERE key = $1',
      [key]
    )
    if (!res.rows[0]) return null
    const row = res.rows[0]
    return decrypt({
      encryptedValue: row.encrypted_value,
      iv: row.iv,
      authTag: row.auth_tag
    })
  }

  async set(
    key: string,
    value: string,
    label: string,
    category: 'api' | 'oauth' | 'webhook' | 'other' = 'api',
    description?: string
  ): Promise<Credential> {
    const payload = encrypt(value)
    const res = await this.pool.query<CredentialRow>(
      `INSERT INTO credentials (key, label, category, encrypted_value, iv, auth_tag, description, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (key) DO UPDATE SET
         label = $2, category = $3,
         encrypted_value = $4, iv = $5, auth_tag = $6,
         description = $7, updated_at = NOW()
       RETURNING *`,
      [key, label, category, payload.encryptedValue, payload.iv, payload.authTag, description ?? null]
    )
    return this.toCredential(res.rows[0]!)
  }

  async delete(key: string): Promise<boolean> {
    const res = await this.pool.query(
      'DELETE FROM credentials WHERE key = $1',
      [key]
    )
    return (res.rowCount ?? 0) > 0
  }

  private toCredential(row: CredentialRow): Credential {
    return {
      key: row.key,
      label: row.label,
      category: row.category,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
