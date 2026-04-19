import type { Pool } from 'pg'
import type { TelegramUserRepository } from '../../domain/users/repositories'
import type { TelegramUser } from '../../domain/users/types'

interface UserRow {
  chat_id: string
  name: string
  role: 'admin' | 'user'
  status: 'active' | 'blocked'
  added_by: string | null
  created_at: Date
}

function toUser(row: UserRow): TelegramUser {
  return {
    chatId: row.chat_id,
    name: row.name,
    role: row.role,
    status: row.status,
    addedBy: row.added_by ?? undefined,
    createdAt: row.created_at
  }
}

export class PgTelegramUserRepository implements TelegramUserRepository {
  constructor(private readonly pool: Pool) {}

  async findByChatId(chatId: string): Promise<TelegramUser | null> {
    const res = await this.pool.query<UserRow>(
      'SELECT * FROM telegram_users WHERE chat_id = $1',
      [chatId]
    )
    return res.rows[0] ? toUser(res.rows[0]) : null
  }

  async list(): Promise<TelegramUser[]> {
    const res = await this.pool.query<UserRow>(
      'SELECT * FROM telegram_users ORDER BY created_at ASC'
    )
    return res.rows.map(toUser)
  }

  async add(chatId: string, name: string, addedBy: string, role: 'admin' | 'user' = 'user'): Promise<TelegramUser> {
    const res = await this.pool.query<UserRow>(
      `INSERT INTO telegram_users (chat_id, name, role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (chat_id) DO UPDATE SET name = $2, status = 'active'
       RETURNING *`,
      [chatId, name, role, addedBy]
    )
    return toUser(res.rows[0]!)
  }

  async setStatus(chatId: string, status: 'active' | 'blocked'): Promise<void> {
    await this.pool.query(
      'UPDATE telegram_users SET status = $1 WHERE chat_id = $2',
      [status, chatId]
    )
  }

  async isAuthorized(chatId: string): Promise<boolean> {
    const res = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM telegram_users WHERE chat_id = $1 AND status = 'active'
       ) AS exists`,
      [chatId]
    )
    return res.rows[0]?.exists ?? false
  }
}
