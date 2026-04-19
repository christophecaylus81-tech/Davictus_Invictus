import type { TelegramUser } from './types'

export interface TelegramUserRepository {
  findByChatId(chatId: string): Promise<TelegramUser | null>
  list(): Promise<TelegramUser[]>
  add(chatId: string, name: string, addedBy: string, role?: 'admin' | 'user'): Promise<TelegramUser>
  setStatus(chatId: string, status: 'active' | 'blocked'): Promise<void>
  isAuthorized(chatId: string): Promise<boolean>
}
