export interface TelegramUser {
  chatId: string
  name: string
  role: 'admin' | 'user'
  status: 'active' | 'blocked'
  addedBy?: string | undefined
  createdAt: Date
}
