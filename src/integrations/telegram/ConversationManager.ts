export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const MAX_HISTORY = 8
const TTL_MS = 2 * 60 * 60 * 1000 // 2h — reset si inactif

export class ConversationManager {
  private readonly histories = new Map<string, ConversationMessage[]>()
  private readonly lastActivity = new Map<string, number>()

  add(chatId: string, role: 'user' | 'assistant', content: string): void {
    this.pruneIfStale(chatId)

    const history = this.histories.get(chatId) ?? []
    history.push({ role, content, timestamp: Date.now() })

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY)
    }

    this.histories.set(chatId, history)
    this.lastActivity.set(chatId, Date.now())
  }

  get(chatId: string): ConversationMessage[] {
    this.pruneIfStale(chatId)
    return this.histories.get(chatId) ?? []
  }

  clear(chatId: string): void {
    this.histories.delete(chatId)
    this.lastActivity.delete(chatId)
  }

  private pruneIfStale(chatId: string): void {
    const last = this.lastActivity.get(chatId)
    if (last && Date.now() - last > TTL_MS) {
      this.clear(chatId)
    }
  }
}
